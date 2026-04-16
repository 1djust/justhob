#!/bin/bash

# Always execute with a clean path
export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
eval "$(fnm env --shell bash)"

cd ~/projects/justhub/property-management-saas

# Start the dev server in the background and pipe output
echo "Starting Turbo Dev servers in WSL..."
npm run dev
