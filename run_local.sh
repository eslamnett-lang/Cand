#!/usr/bin/env bash
#
# Launch a simple static web server to serve the MNDO View application.
#
# Usage:
#   ./run_local.sh
#
# This script assumes Python 3 is installed and available on your PATH.  It
# starts a `http.server` on port 8080 from the directory containing this script.

set -e

# Determine the directory of this script and switch into it
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Starting MNDO View static server on http://localhost:8080 …"
python3 -m http.server 8080