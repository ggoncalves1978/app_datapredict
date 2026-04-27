#!/bin/bash
# Inicia backend e frontend do DataPredict

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Iniciando backend (porta 8001)..."
cd "$ROOT/backend"
venv/Scripts/uvicorn main:app --port 8001 &
BACKEND_PID=$!

echo "==> Iniciando frontend (porta 5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Pressione Ctrl+C para encerrar ambos."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
