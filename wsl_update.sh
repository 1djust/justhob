#!/bin/bash
set -e

# Setup clean PATH
export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
eval "$(fnm env --shell bash)"

echo ">>> Pulling latest changes from GitHub..."
cd ~/projects/justhub
git pull

echo ">>> Updating dependencies..."
cd property-management-saas
npm install

echo "=== UPDATE COMPLETE ==="
