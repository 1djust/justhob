#!/bin/bash
set -e

# Clean PATH
export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
eval "$(fnm env --shell bash)"

LIN="$HOME/projects/justhub/property-management-saas"

echo ">>> Running npm install in $LIN..."
cd "$LIN"
npm install

echo ""
echo ">>> Generating Prisma client..."
npx prisma generate --schema=packages/database/prisma/schema.prisma

echo ""
echo "=== ALL DEPENDENCIES INSTALLED ==="
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
echo "Location: $(pwd)"
