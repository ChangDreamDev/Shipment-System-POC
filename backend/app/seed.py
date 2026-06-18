import asyncio
import json
from app.config import DATA_DIR

from app.database import connect_db, close_db, get_db


async def seed() -> None:
    await connect_db()
    db = get_db()

    data_dir = DATA_DIR
    xlsx_path = data_dir / "cinesis_test.xlsx"

    if xlsx_path.exists():
        from app.services.import_data import import_from_xlsx

        transcript, loads = import_from_xlsx(xlsx_path)
        print(f"Imported from {xlsx_path}: {len(loads)} loads")
    else:
        conv_path = data_dir / "conversation.json"
        loads_path = data_dir / "loads.json"
        if not conv_path.exists() or not loads_path.exists():
            print("No data/cinesis_test.xlsx or JSON seed files found.")
            await close_db()
            return
        transcript = json.loads(conv_path.read_text())["transcript"]
        loads = json.loads(loads_path.read_text())["loads"]
        print(f"Seeded from JSON: {len(loads)} loads")

    await db.conversations.delete_many({})
    await db.loads.delete_many({})
    await db.driver_profiles.delete_many({})
    await db.rankings.delete_many({})
    await db.conversations.insert_one(
        {
            "transcript": transcript,
            "profile_id": None,
            "ranking_id": None,
        }
    )
    await db.loads.insert_many(loads)
    print("Database seeded successfully.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
