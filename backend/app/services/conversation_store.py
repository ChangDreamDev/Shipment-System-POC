from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.geocoding import geocode_city


async def enrich_profile_coords(profile_doc: dict) -> None:
    if profile_doc.get("home_base_lat") is None and profile_doc.get("home_base_city"):
        coords = await geocode_city(profile_doc["home_base_city"])
        if coords:
            profile_doc["home_base_lat"], profile_doc["home_base_lon"] = coords
    if profile_doc.get("truck_location_lat") is None and profile_doc.get("truck_location_city"):
        coords = await geocode_city(profile_doc["truck_location_city"])
        if coords:
            profile_doc["truck_location_lat"], profile_doc["truck_location_lon"] = coords


async def get_latest_conversation(db: AsyncIOMotorDatabase) -> dict | None:
    return await db.conversations.find_one(sort=[("_id", -1)])


def sanitize_mongo_doc(doc: dict) -> dict:
    cleaned = dict(doc)
    cleaned.pop("_id", None)
    cleaned.pop("conversation_id", None)
    cleaned.pop("raw_extraction", None)
    return cleaned


async def get_profile_for_conversation(
    db: AsyncIOMotorDatabase, conversation: dict
) -> dict | None:
    profile_id = conversation.get("profile_id")
    if not profile_id:
        return None
    doc = await db.driver_profiles.find_one({"_id": profile_id})
    if not doc:
        return None
    doc = sanitize_mongo_doc(doc)
    await enrich_profile_coords(doc)
    return doc


async def enrich_ranking_coords(
    db: AsyncIOMotorDatabase, ranking: dict | None
) -> dict | None:
    if not ranking or not ranking.get("top_3"):
        return ranking
    for item in ranking["top_3"]:
        if item.get("origin_lat") is not None and item.get("destination_lat") is not None:
            continue
        load = await db.loads.find_one({"load_id": item.get("load_id")}, {"_id": 0})
        if not load:
            continue
        item["origin_lat"] = load.get("origin_lat")
        item["origin_lon"] = load.get("origin_lon")
        item["destination_lat"] = load.get("destination_lat")
        item["destination_lon"] = load.get("destination_lon")
    return ranking


async def get_ranking_for_conversation(
    db: AsyncIOMotorDatabase, conversation: dict
) -> dict | None:
    ranking_id = conversation.get("ranking_id")
    if not ranking_id:
        return None
    doc = await db.rankings.find_one({"_id": ranking_id})
    if not doc:
        return None
    ranking = sanitize_mongo_doc(doc)
    return await enrich_ranking_coords(db, ranking)


async def upsert_profile_for_conversation(
    db: AsyncIOMotorDatabase,
    conversation: dict,
    profile_doc: dict,
) -> ObjectId:
    await enrich_profile_coords(profile_doc)
    conv_id = conversation["_id"]
    profile_id = conversation.get("profile_id")

    if profile_id:
        await db.driver_profiles.update_one(
            {"_id": profile_id},
            {"$set": profile_doc, "$unset": {"raw_extraction": ""}},
        )
        return profile_id

    profile_doc["conversation_id"] = conv_id
    result = await db.driver_profiles.insert_one(profile_doc)
    await db.conversations.update_one(
        {"_id": conv_id},
        {"$set": {"profile_id": result.inserted_id}},
    )
    return result.inserted_id


async def upsert_ranking_for_conversation(
    db: AsyncIOMotorDatabase,
    conversation: dict,
    ranking_doc: dict[str, Any],
) -> ObjectId:
    conv_id = conversation["_id"]
    ranking_id = conversation.get("ranking_id")

    if ranking_id:
        await db.rankings.update_one({"_id": ranking_id}, {"$set": ranking_doc})
        return ranking_id

    ranking_doc["conversation_id"] = conv_id
    result = await db.rankings.insert_one(ranking_doc)
    await db.conversations.update_one(
        {"_id": conv_id},
        {"$set": {"ranking_id": result.inserted_id}},
    )
    return result.inserted_id
