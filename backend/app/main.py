from contextlib import asynccontextmanager
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DATA_DIR
from app.database import close_db, connect_db, get_db
from app.routers import api


async def _seed_if_empty() -> None:
    db = get_db()
    if await db.conversations.count_documents({}) > 0:
        return

    data_dir = DATA_DIR
    xlsx_path = data_dir / "cinesis_test.xlsx"

    if xlsx_path.exists():
        from app.services.import_data import import_from_xlsx

        transcript, loads = import_from_xlsx(xlsx_path)
        load_docs = [load.model_dump() for load in loads]
    else:
        conv_path = data_dir / "conversation.json"
        loads_path = data_dir / "loads.json"
        if not conv_path.exists() or not loads_path.exists():
            return
        transcript = json.loads(conv_path.read_text())["transcript"]
        load_docs = json.loads(loads_path.read_text())["loads"]

    await db.conversations.insert_one(
        {
            "transcript": transcript,
            "profile_id": None,
            "ranking_id": None,
        }
    )
    await db.loads.insert_many(load_docs)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect_db()
    await _seed_if_empty()
    yield
    await close_db()


app = FastAPI(
    title="Cinesis Good Fit Test",
    description="Driver profile extraction and load ranking API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Cinesis Good Fit Test API", "docs": "/docs"}
