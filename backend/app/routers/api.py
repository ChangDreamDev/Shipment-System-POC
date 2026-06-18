from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.schemas import (
    DriverProfile,
    ExtractResponse,
    Load,
    RankRequest,
    RankResult,
)
from app.services.conversation_store import (
    enrich_profile_coords,
    get_latest_conversation,
    get_profile_for_conversation,
    get_ranking_for_conversation,
    upsert_profile_for_conversation,
    upsert_ranking_for_conversation,
)
from app.services.extraction import extract_profile
from app.services.ranking import rank_loads

router = APIRouter()


async def _rank_with_truck(
    db,
    conv: dict,
    truck_lat: float,
    truck_lon: float,
    truck_city: str | None,
) -> RankResult:
    profile_doc = await get_profile_for_conversation(db, conv)
    if not profile_doc:
        raise HTTPException(
            status_code=400,
            detail="Driver profile not found. Run Part A extraction first.",
        )

    profile = DriverProfile(**profile_doc)
    cursor = db.loads.find({}, {"_id": 0})
    loads = [Load(**doc) async for doc in cursor]
    result = rank_loads(profile, loads, truck_lat, truck_lon)

    ranking_doc = {
        **result.model_dump(),
        "truck_location": {
            "truck_location_lat": truck_lat,
            "truck_location_lon": truck_lon,
            "truck_location_city": truck_city,
        },
    }
    await upsert_ranking_for_conversation(db, conv, ranking_doc)
    return result


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/conversation")
async def get_conversation():
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        raise HTTPException(404, "No conversation loaded. Import spreadsheet or seed data.")
    profile = await get_profile_for_conversation(db, conv)
    return {
        "transcript": conv["transcript"],
        "profile_id": str(conv["profile_id"]) if conv.get("profile_id") else None,
        "ranking_id": str(conv["ranking_id"]) if conv.get("ranking_id") else None,
        "profile": profile,
    }


@router.get("/loads")
async def get_loads():
    db = get_db()
    cursor = db.loads.find({}, {"_id": 0})
    loads = [doc async for doc in cursor]
    return {"loads": loads, "count": len(loads)}


@router.get("/ranking")
async def get_ranking():
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        return {"ranking": None}
    ranking = await get_ranking_for_conversation(db, conv)
    return {"ranking": ranking}


@router.post("/extract", response_model=ExtractResponse)
async def run_extraction():
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        raise HTTPException(404, "No conversation loaded.")

    try:
        result = await extract_profile(conv["transcript"])
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    profile_doc = result.profile.model_dump()
    await upsert_profile_for_conversation(db, conv, profile_doc)

    await enrich_profile_coords(profile_doc)
    if profile_doc.get("home_base_lat") is not None:
        result.profile.home_base_lat = profile_doc["home_base_lat"]
        result.profile.home_base_lon = profile_doc["home_base_lon"]
    if profile_doc.get("truck_location_lat") is not None:
        result.profile.truck_location_lat = profile_doc["truck_location_lat"]
        result.profile.truck_location_lon = profile_doc["truck_location_lon"]

    return result


@router.post("/rank", response_model=RankResult)
async def run_ranking(body: RankRequest):
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        raise HTTPException(status_code=404, detail="No conversation loaded.")
    if not conv.get("profile_id"):
        raise HTTPException(
            status_code=400,
            detail="Driver profile not found. Run Part A extraction first.",
        )

    return await _rank_with_truck(
        db,
        conv,
        body.truck_location_lat,
        body.truck_location_lon,
        body.truck_location_city,
    )


@router.post("/truck-location")
async def update_truck_location(body: RankRequest):
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        raise HTTPException(status_code=404, detail="No conversation loaded.")
    if not conv.get("profile_id"):
        raise HTTPException(
            status_code=400,
            detail="Driver profile not found. Run Part A extraction first.",
        )

    profile_doc = await get_profile_for_conversation(db, conv)
    if not profile_doc:
        raise HTTPException(
            status_code=400,
            detail="Driver profile not found. Run Part A extraction first.",
        )

    profile_doc["truck_location_lat"] = body.truck_location_lat
    profile_doc["truck_location_lon"] = body.truck_location_lon
    if body.truck_location_city:
        profile_doc["truck_location_city"] = body.truck_location_city

    await upsert_profile_for_conversation(db, conv, profile_doc)
    await enrich_profile_coords(profile_doc)

    ranking = await _rank_with_truck(
        db,
        conv,
        body.truck_location_lat,
        body.truck_location_lon,
        body.truck_location_city,
    )

    return {
        "profile": profile_doc,
        "ranking": ranking.model_dump(),
    }


@router.get("/export/part-b")
async def export_part_b(
    truck_location_lat: float = 32.7767,
    truck_location_lon: float = -96.7970,
):
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv or not conv.get("profile_id"):
        raise HTTPException(404, "Extract driver profile first.")

    profile_doc = await get_profile_for_conversation(db, conv)
    if not profile_doc:
        raise HTTPException(404, "Extract driver profile first.")

    profile = DriverProfile(**profile_doc)

    cursor = db.loads.find({}, {"_id": 0})
    from app.schemas import Load

    loads = [Load(**doc) async for doc in cursor]
    result = rank_loads(profile, loads, truck_location_lat, truck_location_lon)

    rows = [
        {
            "rank": r.rank,
            "load_id": r.load_id,
            "origin": r.origin_city,
            "destination": r.destination_city,
            "effective_rate_per_mile": f"{r.effective_rate_per_mile:.3f}",
            "total_miles": r.total_miles,
        }
        for r in result.top_3
    ]
    return {"top_3": rows, "rejected_high_payer": result.rejected_high_payer}


@router.get("/export/part-a")
async def export_part_a():
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv or not conv.get("profile_id"):
        raise HTTPException(404, "No profile extracted yet.")

    profile = await get_profile_for_conversation(db, conv)
    if not profile:
        raise HTTPException(404, "No profile extracted yet.")
    return profile


@router.post("/profile", response_model=DriverProfile)
async def save_profile(profile: DriverProfile):
    db = get_db()
    conv = await get_latest_conversation(db)
    if not conv:
        raise HTTPException(404, "No conversation loaded.")

    doc = profile.model_dump()
    await upsert_profile_for_conversation(db, conv, doc)
    await enrich_profile_coords(doc)
    return DriverProfile(**doc)
