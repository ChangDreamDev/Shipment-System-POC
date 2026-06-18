#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Backend setup"
cd "$ROOT/backend"
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -q
[ -f .env ] || cp .env.example .env
echo "Edit backend/.env with your OPENAI_API_KEY and MongoDB settings."

echo "==> Seed MongoDB (requires mongod on localhost:27017)"
PYTHONPATH=. .venv/bin/python app/seed.py || echo "Seed skipped — start MongoDB first"

echo "==> Frontend setup"
cd "$ROOT/frontend"
[ -f .env ] || cp .env.example .env
echo "Edit frontend/.env to point at your backend (VITE_API_BASE_URL)."
npm install

echo ""
echo "Run backend:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "Run frontend: cd frontend && npm run dev"
