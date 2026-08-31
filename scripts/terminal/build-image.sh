#!/usr/bin/env bash
# Builds the Alpine 9p rootfs that public/terminal/ serves to the in-browser v86 VM.
# Adapted from copy/v86 tools/docker/alpine/build.sh @ 180830d539dcc87db1a191febf6c914f516d102f.
# Outputs are committed; rerun this only when the Dockerfile or rootfs-extra/ changes.
set -euo pipefail

cd "$(dirname "$0")"
HERE="$PWD"
REPO="$(cd ../.. && pwd)"

OUT_DIR="$REPO/public/terminal"
OUT_FSJSON="$OUT_DIR/fs.json"
OUT_FLAT="$OUT_DIR/rootfs-flat"
BUILD_DIR="$HERE/.build"
OUT_TAR="$BUILD_DIR/rootfs.tar"
CONTAINER_NAME=bonzi-terminal
IMAGE_NAME=bonzi/alpine-v86
V86_SHA=180830d539dcc87db1a191febf6c914f516d102f

# copy-to-sha256.py needs zstd: python >=3.14 has compression.zstd, older needs the
# zstandard package, which we install into a local venv rather than the system python.
PY=python3
if ! "$PY" -c "import compression.zstd" >/dev/null 2>&1 && ! "$PY" -c "import zstandard" >/dev/null 2>&1; then
    echo "==> system python lacks zstd, using $HERE/.venv"
    [ -x "$HERE/.venv/bin/python" ] || python3 -m venv "$HERE/.venv"
    "$HERE/.venv/bin/pip" install --quiet --disable-pip-version-check zstandard
    PY="$HERE/.venv/bin/python"
fi

mkdir -p "$BUILD_DIR" "$OUT_DIR"

# v86 will not boot without a BIOS and the npm package ships none, so vendor it here.
for bios in seabios.bin vgabios.bin; do
    if [ ! -f "$OUT_DIR/$bios" ]; then
        echo "==> fetching $bios from v86 @ $V86_SHA"
        curl -sfL "https://raw.githubusercontent.com/copy/v86/$V86_SHA/bios/$bios" -o "$OUT_DIR/$bios"
    fi
done

echo "==> docker build (linux/386, emulated on arm64 hosts)"
docker build . --platform linux/386 --rm --tag "$IMAGE_NAME"

docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker create --platform linux/386 -t -i --name "$CONTAINER_NAME" "$IMAGE_NAME" >/dev/null
echo "==> docker export"
docker export "$CONTAINER_NAME" -o "$OUT_TAR"
docker rm "$CONTAINER_NAME" >/dev/null

# https://github.com/iximiuz/docker-to-linux/issues/19#issuecomment-1242809707
# macOS ships bsdtar, which has no --delete; fall back to rewriting the tar.
if ! tar -f "$OUT_TAR" --delete ".dockerenv" >/dev/null 2>&1; then
    "$PY" - "$OUT_TAR" <<'PYEOF'
import os, sys, tarfile
src = sys.argv[1]
tmp = src + ".tmp"
dropped = 0
with tarfile.open(src) as inp, tarfile.open(tmp, "w") as out:
    for m in inp.getmembers():
        if m.name in (".dockerenv", "./.dockerenv"):
            dropped += 1
            continue
        out.addfile(m, inp.extractfile(m) if m.isreg() else None)
os.replace(tmp, src)
print("removed .dockerenv (python fallback)" if dropped
      else "warning: no .dockerenv entry found to remove")
PYEOF
fi

# stale flat files are content-addressed and would be served forever, so start clean
rm -rf "$OUT_FLAT" "$OUT_FSJSON"
mkdir -p "$OUT_FLAT"

# both tools log one line per file; keep that out of the terminal but on disk
TOOL_LOG="$BUILD_DIR/tools.log"
echo "==> fs2json (log: $TOOL_LOG)"
"$PY" vendor/fs2json.py --zstd --out "$OUT_FSJSON" "$OUT_TAR" 2>"$TOOL_LOG"
echo "==> copy-to-sha256, zstd level 19 (slow)"
"$PY" vendor/copy-to-sha256.py --zstd "$OUT_TAR" "$OUT_FLAT" >>"$TOOL_LOG" 2>&1

echo
echo "==> artifacts"
echo "  fs.json      $(du -h "$OUT_FSJSON" | cut -f1)"
echo "  rootfs-flat  $(du -sh "$OUT_FLAT" | cut -f1) in $(find "$OUT_FLAT" -type f | wc -l | tr -d ' ') files"
echo "  bios         $(du -ch "$OUT_DIR"/*.bin | tail -1 | cut -f1)"
echo "  total        $(du -sh "$OUT_DIR" | cut -f1)"
echo "  (expected ~25-40MB total, ~1.5-3k flat files; if far above, trim packages)"
