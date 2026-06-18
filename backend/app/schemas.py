from pydantic import BaseModel, Field


class DriverProfile(BaseModel):
    driver_name: str | None = None
    trailer_types: list[str] = Field(
        description="Equipment types the driver runs, e.g. dry van, reefer"
    )
    max_weight_lbs: float | None = Field(
        description="Maximum load weight the driver can haul in pounds"
    )
    min_rate_per_mile: float | None = Field(
        description="Minimum acceptable effective rate per mile in USD"
    )
    home_base_city: str | None = None
    home_base_lat: float | None = None
    home_base_lon: float | None = None
    truck_location_city: str | None = None
    truck_location_lat: float | None = None
    truck_location_lon: float | None = None
    notes: list[str] = Field(
        default_factory=list,
        description="Interpretations of implied constraints from the conversation",
    )


class Load(BaseModel):
    load_id: str
    origin_city: str | None = None
    origin_lat: float | None = None
    origin_lon: float | None = None
    destination_city: str | None = None
    destination_lat: float | None = None
    destination_lon: float | None = None
    price: float | None = None
    weight_lbs: float | None = None
    trailer_type: str | None = None
    incomplete: bool = False
    incomplete_reason: str | None = None


class RankedLoad(BaseModel):
    rank: int
    load_id: str
    origin_city: str | None
    destination_city: str | None
    origin_lat: float | None = None
    origin_lon: float | None = None
    destination_lat: float | None = None
    destination_lon: float | None = None
    price: float | None
    trailer_type: str | None
    deadhead_to_origin: float
    loaded_miles: float
    deadhead_home: float
    total_miles: float
    effective_rate_per_mile: float


class RejectedLoad(BaseModel):
    load_id: str
    origin_city: str | None
    destination_city: str | None
    price: float | None
    trailer_type: str | None
    reason: str
    effective_rate_per_mile: float | None = None


class RankRequest(BaseModel):
    truck_location_lat: float
    truck_location_lon: float
    truck_location_city: str | None = None


class RankResult(BaseModel):
    top_3: list[RankedLoad]
    rejected_high_payer: RejectedLoad | None = None
    eligible_count: int
    filtered_count: int


class ExtractResponse(BaseModel):
    profile: DriverProfile
    source: str


class ImportResponse(BaseModel):
    conversation_chars: int
    loads_imported: int
    message: str
