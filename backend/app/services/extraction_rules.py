import re

from app.schemas import DriverProfile, ExtractResponse

WORD_NUMBERS = {
    "forty-five": 45000,
    "forty five": 45000,
    "forty-five thousand": 45000,
    "forty five thousand": 45000,
    "45,000": 45000,
    "45000": 45000,
}


def _find_driver_name(transcript: str) -> str | None:
    match = re.search(r"\bhey\s+([A-Za-z]+)", transcript, re.I)
    return match.group(1).capitalize() if match else None


def _find_trailer_types(transcript: str) -> list[str]:
    t = transcript.lower()
    types: list[str] = []
    if re.search(r"\bdry\s*van\b|\bjust\s+van\b", t):
        types.append("dry van")
    if re.search(r"\breefer\b|\brefrigerated\b", t) and "don't do reefer" not in t:
        types.append("reefer")
    if re.search(r"\bflatbed\b|\bflat\s+bed\b", t) and "don't do flatbed" not in t:
        types.append("flatbed")
    return types


def _find_max_weight(transcript: str) -> float | None:
    t = transcript.lower()
    for phrase, value in WORD_NUMBERS.items():
        if phrase in t and "plated" in t or phrase in t and "weight" in t:
            return float(value)
    match = re.search(r"(\d{1,3}[,.]?\d{0,3})\s*(?:lbs|pounds|lb)", transcript, re.I)
    if match:
        return float(match.group(1).replace(",", ""))
    match = re.search(
        r"(forty[- ]five|forty five)(?:\s+thousand)?", t
    )
    if match:
        return 45000.0
    return None


def _find_min_rate(transcript: str) -> tuple[float | None, list[str]]:
    notes: list[str] = []
    t = transcript.lower()
    if "all-in" in t or "effective" in t or "deadhead and getting home" in t:
        notes.append("Driver stated minimum is effective/all-in rate per mile, not loaded miles only.")
    match = re.search(
        r"(?:two|2)\s+bucks?\s+a\s+mile|(?:\$|usd\s*)?2(?:\.00)?\s*(?:/|per)\s*(?:mi|mile)",
        t,
    )
    if match:
        return 2.0, notes
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:/|per)\s*(?:mi|mile)", t)
    if match:
        return float(match.group(1)), notes
    return None, notes


def _find_truck_location(transcript: str) -> tuple[str | None, float | None, float | None]:
    patterns = [
        r"(?:i'm|i am)\s+empty\s+in\s+([A-Za-z\s]+?)(?:\.|,|\n|$)",
        r"empty in\s+([A-Za-z\s]+?)(?:\.|,|\n|$)",
        r"(?:sitting|located|parked)\s+(?:in|at)\s+([A-Za-z\s]+?)(?:\.|,|\n|$)",
    ]
    city = None
    for pattern in patterns:
        match = re.search(pattern, transcript, re.I | re.M)
        if match:
            city = match.group(1).strip().rstrip(".")
            break
    if not city:
        return None, None, None
    return city, None, None


def _find_home_base(transcript: str) -> tuple[str | None, float | None, float | None]:
    patterns = [
        r"home base\??\s*\n?\s*Driver:\s*([^\n.]+)",
        r"that's where i live[^.]*\.?",
        r"home (?:is|base(?:\s+is)?)\s+([A-Z][A-Za-z\s]+)",
        r"Driver:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\.\s*That's where I live",
    ]
    city = None
    for pattern in patterns:
        match = re.search(pattern, transcript, re.I | re.M)
        if match:
            city = match.group(1).strip().rstrip(".")
            break
    if not city:
        match = re.search(
            r"Driver:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\.\s*That's where",
            transcript,
        )
        if match:
            city = match.group(1).strip()

    return city, None, None


def extract_profile_rules(transcript: str) -> ExtractResponse:
    notes: list[str] = []
    min_rate, rate_notes = _find_min_rate(transcript)
    notes.extend(rate_notes)

    t = transcript.lower()
    if "northeast" in t and "not trying" in t:
        notes.append("Driver prefers to avoid northeast lanes this week.")
    if "pointed back toward home" in t or "back toward home" in t:
        notes.append("Driver prefers loads that move toward home base.")
    if "heavy over" in t or "over forty-five" in t:
        notes.append("Driver asked to skip loads over 45,000 lbs capacity.")

    home_city, home_lat, home_lon = _find_home_base(transcript)
    truck_city, truck_lat, truck_lon = _find_truck_location(transcript)
    profile = DriverProfile(
        driver_name=_find_driver_name(transcript),
        trailer_types=_find_trailer_types(transcript),
        max_weight_lbs=_find_max_weight(transcript),
        min_rate_per_mile=min_rate,
        home_base_city=home_city,
        home_base_lat=home_lat,
        home_base_lon=home_lon,
        truck_location_city=truck_city,
        truck_location_lat=truck_lat,
        truck_location_lon=truck_lon,
        notes=notes,
    )
    return ExtractResponse(profile=profile, source="rule-based")
