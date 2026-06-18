# Cinesis Good Fit Test

AI dispatcher take-home: extract a driver profile from a phone transcript (Part A), filter and rank loads by effective rate/mile (Part B).

**Stack:** Python, FastAPI, LangChain, MongoDB, React.

## Assumptions

- Truck current location is selected on the map (default **Dallas, TX**). Browser geolocation runs on page load; click/drag on the map or **Use my location** to change it.
- Effective rate = `price ÷ (deadhead_to_origin + loaded_miles + deadhead_home)` using haversine miles.
- **Incomplete loads** (missing price or destination coordinates) are skipped — not ranked, not crashed.
- Home-base coordinates are taken from extraction or inferred from a city lookup table.

## Extraction (Part A)

LangChain + OpenAI structured output reads the transcript and fills a Pydantic driver profile (equipment, weight cap, min effective rate, home base, notes on implied constraints).

## Incomplete rows

Loads missing **price** or **destination lat/lon** are marked incomplete and excluded from ranking.

## Rejected high payer (sample data)

**LD-1155** (Dallas → Chicago, $4,200) — highest gross pay on the board but **flatbed**; driver runs **dry van only**.

## Quick start

**Prerequisites:** Python 3.12+, Node.js, MongoDB running locally on `localhost:27017`.

```bash
# One-time setup
bash scripts/setup.sh

# Configure environment (required for Part A extraction)
cd backend
cp .env.example .env   # then set OPENAI_API_KEY in backend/.env

# Backend
source .venv/bin/activate
PYTHONPATH=. python app/seed.py
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
cp .env.example .env   # optional: set VITE_API_BASE_URL for proxy target
npm install && npm run dev
```

Place the official workbook at `data/cinesis_test.xlsx` (tabs: **Sample Conversation**, **Loads**) or use bundled JSON seed data.

## Environment

| File | Purpose |
|------|---------|
| `backend/.env` | `OPENAI_API_KEY`, `MONGODB_URL` |
| `frontend/.env` | `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID` (`DEMO_MAP_ID` for dev) |

In dev, leave `VITE_API_URL` empty so requests use the Vite proxy (`/api` → backend).

## API

- `POST /api/extract` — Part A (LangChain)
- `POST /api/rank` — Part B (filter + rank top 3; body includes truck lat/lon)

Docs: http://localhost:8000/docs
