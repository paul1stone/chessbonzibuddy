import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTD_BANNER } from "./create-vm";

// The image prints /etc/motd from a login the restored path resumes past, so create-vm replays
// a copy of it — and that copy is what nearly every visitor sees. A motd edit that forgets the
// copy would desync silently, so pin them together instead of trusting the comments.
const MOTD_FILE = new URL("../../../scripts/terminal/rootfs-extra/etc/motd", import.meta.url);

describe("terminal motd banner", () => {
  it("mirrors the image's /etc/motd", () => {
    expect(MOTD_BANNER.replaceAll("\r\n", "\n")).toBe(readFileSync(MOTD_FILE, "utf8"));
  });

  it("ends every line with CRLF, which is what keeps the art off a staircase", () => {
    expect(MOTD_BANNER).toContain("\r\n");
    expect(MOTD_BANNER.replaceAll("\r\n", "")).not.toContain("\n");
  });
});
