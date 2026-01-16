@echo off
echo Starting PST Vault Frontend...
echo.

if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting Next.js development server on http://localhost:3000
echo.

npm run dev
