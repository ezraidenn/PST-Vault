#!/bin/bash

echo "Starting PST Vault Frontend..."
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting Next.js development server on http://localhost:3000"
echo ""

npm run dev
