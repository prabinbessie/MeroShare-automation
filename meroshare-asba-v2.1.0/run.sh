# #!/usr/bin/env bash
# # Helper to run the packaged binary and optionally point to bundled Chromium.
# HERE="$(cd "$(dirname "$0")" && pwd)"
# if [ -x "$HERE/meroshare-asba" ]; then
#   if [ -d "$HERE/puppeteer/.local-chromium" ]; then
#     export PUPPETEER_EXECUTABLE_PATH="$HERE/puppeteer/.local-chromium"
#     # If you know the exact path to the chrome binary inside, set it explicitly:
#     # export PUPPETEER_EXECUTABLE_PATH="$HERE/puppeteer/.local-chromium/<platform>/chrome"
#   fi
#   LOG_LEVEL=info NODE_ENV=production "$HERE/meroshare-asba"
# else
#   echo "Executable not found or not runnable."
# fi

#!/usr/bin/env bash
# Helper to run the packaged binary and optionally point to bundled Chromium.
HERE="$(cd "$(dirname "$0")" && pwd)"

# Unset common proxy environment vars that can break proxy-agent initialization in packaged binaries
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy NO_PROXY no_proxy

# Try to locate an actual chrome / headless shell executable inside the bundled puppeteer folder
if [ -d "$HERE/puppeteer/.local-chromium" ]; then
  CHROME_CANDIDATE=""

  CHROME_CANDIDATE=$(find "$HERE/puppeteer/.local-chromium" -type f \( -iname "chrome-headless-shell" -o -iname "chrome" -o -iname "*google*chrome*for*testing*" \) -perm -111 2>/dev/null | head -n 1)

  if [ -z "$CHROME_CANDIDATE" ]; then
    CHROME_CANDIDATE=$(find "$HERE/puppeteer/.local-chromium" -type f -path "*Google Chrome for Testing.app*/Contents/MacOS/*" 2>/dev/null | head -n 1)
  fi

  if [ -z "$CHROME_CANDIDATE" ]; then
    CHROME_CANDIDATE=$(find "$HERE/puppeteer/.local-chromium" -type f -perm -111 2>/dev/null | head -n 1)
  fi

  if [ -n "$CHROME_CANDIDATE" ] && [ -x "$CHROME_CANDIDATE" ]; then
    export PUPPETEER_EXECUTABLE_PATH="$CHROME_CANDIDATE"
    echo "Using bundled Chrome: $PUPPETEER_EXECUTABLE_PATH"
  else
    echo "No bundled chrome executable found in $HERE/puppeteer/.local-chromium; not setting PUPPETEER_EXECUTABLE_PATH"
  fi
fi

if [ -x "$HERE/meroshare-asba" ]; then
  LOG_LEVEL=info NODE_ENV=production "$HERE/meroshare-asba"
else
  echo "Executable not found or not runnable."
fi