#!/bin/bash
set -e

# Clean PATH
export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
eval "$(fnm env --shell bash)"

# Create projects directory
echo ">>> Creating ~/projects..."
mkdir -p ~/projects

# Clone the repository
echo ">>> Cloning Just Hub repository..."
if [ -d ~/projects/justhub ]; then
    echo "Directory already exists, pulling latest..."
    cd ~/projects/justhub
    git pull
else
    git clone https://github.com/1djust/justhob.git ~/projects/justhub
fi

cd ~/projects/justhub

echo ""
echo "=== Clone Verification ==="
echo "Directory: $(pwd)"
echo "Git branch: $(git branch --show-current)"
ls -la
echo "=== CLONE COMPLETE ==="
