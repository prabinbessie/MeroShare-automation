
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.."; pwd)"
cd "$ROOT"

# Find version from package.json (portable grep/sed)
VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[0-9]\+\.[0-9]\+\.[0-9]\+"' package.json | head -n1 | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')"
if [ -z "$VERSION" ]; then
  echo "Could not detect version in package.json; using 'local'."
  VERSION="local"
fi

OUTDIR="${ROOT}/meroshare-asba-v${VERSION}"
echo "Packaging into: ${OUTDIR}"

# Clean previous package
rm -rf "$OUTDIR" "${OUTDIR}.zip"
mkdir -p "$OUTDIR"

# Choose binary (prefer macOS build if present)
if [ -f dist/meroshare-asba-macos ]; then
  BIN_SRC="dist/meroshare-asba-macos"
  BIN_NAME="meroshare-asba"
elif [ -f dist/meroshare-asba-linux ]; then
  BIN_SRC="dist/meroshare-asba-linux"
  BIN_NAME="meroshare-asba"
elif [ -f dist/meroshare-asba-win.exe ]; then
  BIN_SRC="dist/meroshare-asba-win.exe"
  BIN_NAME="meroshare-asba.exe"
elif [ -f dist/meroshare-asba-automation ]; then
  BIN_SRC="dist/meroshare-asba-automation"
  BIN_NAME="meroshare-asba"
else
  echo "No built binary found in dist/. Run 'npm run build:mac' (or build:linux/win) first."
  exit 1
fi

# Copy binary
cp -p "$BIN_SRC" "${OUTDIR}/${BIN_NAME}"
chmod +x "${OUTDIR}/${BIN_NAME}" || true

# Copy README
if [ -f README.md ]; then
  cp README.md "${OUTDIR}/README.md"
fi

# Copy config template or create from .env
if [ -f config/.env.example ]; then
  cp config/.env.example "${OUTDIR}/.env.example"
fi

if [ -f .env ]; then
  cp .env "${OUTDIR}/.env"
fi

# Create folders users expect
mkdir -p "${OUTDIR}/screenshots" "${OUTDIR}/logs"

# Attempt to include Puppeteer's chromium if available
# Prefer dist/puppeteer first (postbuild), then node_modules
if [ -d dist/puppeteer/.local-chromium ]; then
  echo "Including Chromium from dist/puppeteer/.local-chromium"
  mkdir -p "${OUTDIR}/puppeteer"
  cp -R dist/puppeteer/.local-chromium "${OUTDIR}/puppeteer/.local-chromium"
elif [ -d node_modules/puppeteer/.local-chromium ]; then
  echo "Including Chromium from node_modules/puppeteer/.local-chromium"
  mkdir -p "${OUTDIR}/puppeteer"
  cp -R node_modules/puppeteer/.local-chromium "${OUTDIR}/puppeteer/.local-chromium"
else
  echo "Note: Puppeteer Chromium not found. The packaged binary will use system Chrome unless you include Chromium."
  echo "To download Chromium locally (optional): node node_modules/puppeteer/install.mjs"
fi

# Include Sharp vendor files if present
if [ -d node_modules/sharp/vendor ]; then
  echo "Including sharp vendor files"
  mkdir -p "${OUTDIR}/sharp"
  cp -R node_modules/sharp/vendor "${OUTDIR}/sharp/vendor"
fi
if [ -d node_modules/sharp/build ]; then
  cp -R node_modules/sharp/build "${OUTDIR}/sharp/build" || true
fi

# Include extra runtime files from dist (if any)
if [ -d dist/puppeteer ] && [ ! -d "${OUTDIR}/puppeteer" ]; then
  mkdir -p "${OUTDIR}/puppeteer"
  cp -R dist/puppeteer/* "${OUTDIR}/puppeteer/" || true
fi

# Make a small run script for users (mac/linux)
cat > "${OUTDIR}/run.sh" <<'RUN'
#!/usr/bin/env bash
# Helper to run the packaged binary and optionally point to bundled Chromium.
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$HERE/meroshare-asba" ]; then
  if [ -d "$HERE/puppeteer/.local-chromium" ]; then
    export PUPPETEER_EXECUTABLE_PATH="$HERE/puppeteer/.local-chromium"
    # If you know the exact path to the chrome binary inside, set it explicitly:
    # export PUPPETEER_EXECUTABLE_PATH="$HERE/puppeteer/.local-chromium/<platform>/chrome"
  fi
  LOG_LEVEL=info NODE_ENV=production "$HERE/meroshare-asba"
else
  echo "Executable not found or not runnable."
fi
RUN
chmod +x "${OUTDIR}/run.sh" || true

# Zip the package
cd "$(dirname "$OUTDIR")"
ZIPNAME="$(basename "$OUTDIR").zip"
rm -f "$ZIPNAME"
zip -r "$ZIPNAME" "$(basename "$OUTDIR")" > /dev/null
echo "Created archive: ${ZIPNAME}"
echo "Package ready at: ${OUTDIR} and ${ZIPNAME}"

echo ""
echo "Next steps:"
echo " - Copy the zip to target machine and extract."
echo " - If Chromium not bundled, instruct users to set PUPPETEER_EXECUTABLE_PATH to their Chrome/Chromium binary."
echo " - Run ${OUTDIR}/${BIN_NAME} or use ${OUTDIR}/run.sh"
