import httpx

from app.config import settings

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_cache: dict[str, tuple[float, float] | None] = {}


async def geocode_city(city: str | None) -> tuple[float, float] | None:
    """Resolve a city name to lat/lon via Google Geocoding API."""
    if not city or not city.strip():
        return None

    key = city.strip().lower()
    if key in _cache:
        return _cache[key]

    api_key = settings.google_maps_api_key
    if not api_key:
        _cache[key] = None
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                GEOCODE_URL,
                params={"address": city.strip(), "key": api_key},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        _cache[key] = None
        return None

    if data.get("status") != "OK" or not data.get("results"):
        _cache[key] = None
        return None

    location = data["results"][0]["geometry"]["location"]
    coords = (float(location["lat"]), float(location["lng"]))
    _cache[key] = coords
    return coords
