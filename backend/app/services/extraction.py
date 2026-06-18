from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas import DriverProfile, ExtractResponse
from app.services.extraction_rules import extract_profile_rules


class ExtractedProfile(BaseModel):
    """Structured output schema for LangChain extraction."""

    driver_name: str | None = Field(default=None, description="Driver's name if mentioned")
    trailer_types: list[str] = Field(
        description="Equipment types the driver runs, e.g. ['dry van'] or ['reefer']"
    )
    max_weight_lbs: float | None = Field(
        default=None, description="Maximum load weight capacity in pounds"
    )
    min_rate_per_mile: float | None = Field(
        default=None,
        description="Minimum acceptable effective rate per mile in USD. "
        "If driver states loaded-mile rate, note the interpretation in notes.",
    )
    home_base_city: str | None = Field(
        default=None, description="Driver's home base city"
    )
    home_base_lat: float | None = Field(default=None)
    home_base_lon: float | None = Field(default=None)
    truck_location_city: str | None = Field(
        default=None,
        description="City where the truck is currently empty/sitting per the conversation",
    )
    truck_location_lat: float | None = Field(default=None)
    truck_location_lon: float | None = Field(default=None)
    notes: list[str] = Field(
        default_factory=list,
        description="Interpretations of implied constraints, ambiguities, or assumptions",
    )


EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a freight dispatch assistant. Extract a structured driver profile from a phone call transcript.

Rules:
- Fields are scattered in plain speech — extract faithfully.
- When the driver implies a constraint rather than stating it, capture your interpretation in notes.
- trailer_types: list all equipment types the driver says they run.
- min_rate_per_mile: use effective rate per mile if stated; if only loaded-mile rate is given, estimate or note ambiguity.
- home_base: city name from the conversation (leave lat/lon null).
- truck_location: where the driver says they are empty/sitting right now (city name only; leave lat/lon null).""",
        ),
        ("human", "Transcript:\n\n{transcript}"),
    ]
)


def _build_profile(extracted: ExtractedProfile) -> DriverProfile:
    return DriverProfile(
        driver_name=extracted.driver_name,
        trailer_types=extracted.trailer_types,
        max_weight_lbs=extracted.max_weight_lbs,
        min_rate_per_mile=extracted.min_rate_per_mile,
        home_base_city=extracted.home_base_city,
        home_base_lat=extracted.home_base_lat,
        home_base_lon=extracted.home_base_lon,
        truck_location_city=extracted.truck_location_city,
        truck_location_lat=extracted.truck_location_lat,
        truck_location_lon=extracted.truck_location_lon,
        notes=extracted.notes,
    )


async def _extract_with_llm(transcript: str) -> ExtractResponse:
    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )
    structured_llm = llm.with_structured_output(ExtractedProfile)
    chain = EXTRACTION_PROMPT | structured_llm
    extracted: ExtractedProfile = await chain.ainvoke({"transcript": transcript})
    return ExtractResponse(profile=_build_profile(extracted), source="langchain-openai")


async def extract_profile(transcript: str) -> ExtractResponse:
    if not settings.openai_api_key:
        return extract_profile_rules(transcript)

    try:
        return await _extract_with_llm(transcript)
    except Exception:
        # Fallback when OpenAI is unavailable (e.g. region restrictions)
        return extract_profile_rules(transcript)
