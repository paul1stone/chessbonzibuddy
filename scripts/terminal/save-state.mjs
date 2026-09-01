// Boots the committed terminal image in headless Chromium, snapshots the running VM once it
// reaches the prompt, and writes public/terminal/state.bin.zst + state.meta.json. create-vm.ts
// restores that snapshot so the terminal opens at C:\> instead of cold booting for ~17 s.
//
//   node scripts/terminal/save-state.mjs
//
// Re-run whenever the image changes (build-image.sh) or the v86 pin moves: a state is only
// restorable by the same v86 version, and only useful against the fs.json it was taken from.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { constants as zlib, zstdCompressSync } from "node:zlib";

const REPO = path.resolve(import.meta.dirname, "../..");
const PUBLIC_DIR = path.join(REPO, "public");
const FS_JSON = path.join(PUBLIC_DIR, "terminal/fs.json");
const OUT_STATE = path.join(PUBLIC_DIR, "terminal/state.bin.zst");
const OUT_META = path.join(PUBLIC_DIR, "terminal/state.meta.json");
const RAW_STATE = path.join(REPO, "scripts/terminal/.build/state.bin");

const PROMPT_TIMEOUT_MS = 10 * 60_000;
// The prompt appears while the last boot services are still settling; snapshotting mid-write
// would resume into their half-finished work.
const SETTLE_MS = 3000;
const SIZE_GATE_MB = 60;
const ZSTD_LEVEL = 19;

// Must stay byte-identical to src/lib/terminal/create-vm.ts — restore_state only accepts a
// machine built the same way, so memory_size in particular has to match on both sides.
const V86_OPTIONS = {
  wasm_path: "/v86/v86.wasm",
  memory_size: 128 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  bios: { url: "/terminal/seabios.bin" },
  vga_bios: { url: "/terminal/vgabios.bin" },
  filesystem: { baseurl: "/terminal/rootfs-flat/", basefs: "/terminal/fs.json" },
  bzimage_initrd_from_filesystem: true,
  cmdline:
    "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0 tsc=reliable",
  autostart: true,
  disable_keyboard: true,
  disable_mouse: true,
  disable_speaker: true,
};

// No backslashes in here: the C:\> check lives in node so this stays escape-free.
const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>v86 save-state</title>
<body>
<script type="module">
const save = { bytes: 0, tail: "", error: null };
window.__save = save;
(async () => {
  try {
    const { V86 } = await import("/v86/libv86.mjs");
    const emulator = new V86(${JSON.stringify(V86_OPTIONS, null, 2)});
    emulator.add_listener("serial0-output-byte", (byte) => {
      save.bytes++;
      save.tail = (save.tail + String.fromCharCode(byte)).slice(-200);
    });
    window.__snapshot = async () => {
      await emulator.stop();
      const buffer = await emulator.save_state();
      const res = await fetch("/__state", { method: "PUT", body: buffer });
      if (!res.ok) throw new Error("PUT /__state responded " + res.status);
      return buffer.byteLength;
    };
  } catch (err) {
    save.error = String((err && err.stack) || err);
  }
})();
</script>
`;

const TYPES = new Map([
  [".html", "text/html"],
  [".mjs", "text/javascript"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".wasm", "application/wasm"],
]);

const serve = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  void (async () => {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(PAGE);
      return;
    }
    if (url.pathname === "/__state" && req.method === "PUT") {
      await mkdir(path.dirname(RAW_STATE), { recursive: true });
      await pipeline(req, createWriteStream(RAW_STATE));
      res.writeHead(204);
      res.end();
      return;
    }
    const file = path.join(PUBLIC_DIR, path.normalize(url.pathname));
    if (!file.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const info = await stat(file);
      const type = TYPES.get(path.extname(file)) ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type, "content-length": info.size });
      await pipeline(createReadStream(file), res);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })().catch((err) => {
    console.error("server:", err.message);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const secs = (ms) => (ms / 1000).toFixed(1);
const lastLine = (tail) => tail.split("\n").filter((l) => l.trim()).pop()?.trim().slice(-60) ?? "";

await new Promise((resolve) => serve.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${serve.address().port}`;
console.log(`==> serving ${path.relative(REPO, PUBLIC_DIR)}/ at ${origin}`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.error("  [page]", err.message));
  await page.goto(origin, { waitUntil: "domcontentloaded" });

  console.log("==> booting (expect 15-40s headless; 10 min ceiling)");
  const started = Date.now();
  let beat = 0;
  for (;;) {
    const save = await page.evaluate(() => window.__save ?? null);
    if (save?.error) throw new Error(`page: ${save.error}`);
    if (save?.tail.includes("C:\\>")) {
      console.log(`==> prompt after ${secs(Date.now() - started)}s, ${save.bytes} serial bytes`);
      break;
    }
    if (Date.now() - started > PROMPT_TIMEOUT_MS) {
      throw new Error(`no prompt in ${secs(PROMPT_TIMEOUT_MS)}s (last: ${lastLine(save?.tail ?? "")})`);
    }
    if (Date.now() - started > beat) {
      beat += 5000;
      console.log(`    ${secs(Date.now() - started)}s  ${save?.bytes ?? 0} bytes  ${lastLine(save?.tail ?? "")}`);
    }
    await page.waitForTimeout(250);
  }

  await page.waitForTimeout(SETTLE_MS);
  console.log("==> stop + save_state");
  const rawSize = await page.evaluate(() => window.__snapshot());
  const raw = await readFile(RAW_STATE);
  if (raw.length !== rawSize) {
    throw new Error(`state truncated in transit: ${raw.length} of ${rawSize} bytes`);
  }

  console.log(`==> zstd -${ZSTD_LEVEL} (slow)`);
  const compressStarted = Date.now();
  const packed = zstdCompressSync(raw, { params: { [zlib.ZSTD_c_compressionLevel]: ZSTD_LEVEL } });
  console.log();
  console.log("==> artifacts");
  console.log(`  raw         ${mb(raw.length)} MB  (${path.relative(REPO, RAW_STATE)}, gitignored)`);
  console.log(`  compressed  ${mb(packed.length)} MB  in ${secs(Date.now() - compressStarted)}s`);

  if (packed.length > SIZE_GATE_MB * 1024 * 1024) {
    throw new Error(
      `${mb(packed.length)} MB exceeds the ${SIZE_GATE_MB} MB budget — nothing written. ` +
        `Drop memory_size to 64 MB here AND in create-vm.ts, then re-run.`,
    );
  }

  const meta = {
    fsJsonSha256: createHash("sha256").update(await readFile(FS_JSON)).digest("hex"),
    v86Version: JSON.parse(await readFile(path.join(REPO, "node_modules/v86/package.json"), "utf8"))
      .version,
    createdAt: new Date().toISOString(),
  };
  await writeFile(OUT_STATE, packed);
  await writeFile(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`  wrote       ${path.relative(REPO, OUT_STATE)} + state.meta.json`);
} finally {
  await browser.close();
  serve.close();
}
