#!/bin/bash
set -e

# Clean PATH - only Linux paths, no Windows contamination
export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Setup fnm environment
eval "$(fnm env --shell bash)"

# Install Node LTS
echo ">>> Installing Node.js LTS..."
fnm install --lts
fnm default lts-latest

# Re-eval after install
eval "$(fnm env --shell bash)"

# Enable corepack for pnpm
echo ">>> Enabling corepack..."
corepack enable

echo ""
echo "=== Verification ==="
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo "fnm:  $(fnm -V)"
echo "=== SETUP COMPLETE ==="
