#!/bin/bash
# Move to the project directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Wait 2 seconds for server to start, then open Chrome with silent auto-print (--kiosk-printing)
(
  sleep 2
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -n -a "Google Chrome" --args --kiosk-printing "http://localhost:8080"
  else
    open "http://localhost:8080"
  fi
) &

# Start the dev server
npm run dev
