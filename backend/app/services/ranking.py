from app.schemas import DriverProfile, Load, RankResult, RankedLoad, RejectedLoad
from app.services.geo import haversine_miles

TRAILER_ALIASES: dict[str, set[str]] = {
    "dry van": {"dry van", "van", "dryvan", "dry-van"},
    "reefer": {"reefer", "refrigerated", "refeer"},
    "flatbed": {"flatbed", "flat bed", "flat-bed"},
}


def _normalize_trailer(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def _trailer_matches(driver_types: list[str], load_type: str | None) -> bool:
    load_norm = _normalize_trailer(load_type)
    if not load_norm:
        return False
    driver_norms = {_normalize_trailer(t) for t in driver_types}
    for driver_type in driver_norms:
        aliases = TRAILER_ALIASES.get(driver_type, {driver_type})
        if load_norm in aliases or driver_type in load_norm:
            return True
    return False


def _is_complete(load: Load) -> tuple[bool, str | None]:
    missing = []
    if load.price is None:
        missing.append("price")
    if load.destination_lat is None or load.destination_lon is None:
        missing.append("destination coordinates")
    if load.origin_lat is None or load.origin_lon is None:
        missing.append("origin coordinates")
    if load.weight_lbs is None:
        missing.append("weight")
    if not load.trailer_type:
        missing.append("trailer type")
    if missing:
        return False, f"Incomplete row: missing {', '.join(missing)}"
    return True, None


def _compute_legs(
    load: Load,
    profile: DriverProfile,
    truck_lat: float,
    truck_lon: float,
) -> tuple[float, float, float] | None:
    if (
        load.origin_lat is None
        or load.origin_lon is None
        or load.destination_lat is None
        or load.destination_lon is None
        or profile.home_base_lat is None
        or profile.home_base_lon is None
    ):
        return None

    deadhead_to_origin = haversine_miles(
        truck_lat,
        truck_lon,
        load.origin_lat,
        load.origin_lon,
    )
    loaded_miles = haversine_miles(
        load.origin_lat,
        load.origin_lon,
        load.destination_lat,
        load.destination_lon,
    )
    deadhead_home = haversine_miles(
        load.destination_lat,
        load.destination_lon,
        profile.home_base_lat,
        profile.home_base_lon,
    )
    return deadhead_to_origin, loaded_miles, deadhead_home


def _effective_rate(price: float, total_miles: float) -> float:
    if total_miles <= 0:
        return 0.0
    return price / total_miles


def rank_loads(
    profile: DriverProfile,
    loads: list[Load],
    truck_lat: float,
    truck_lon: float,
) -> RankResult:
    eligible: list[RankedLoad] = []
    rejected: list[tuple[Load, str, float | None]] = []

    for load in loads:
        complete, reason = _is_complete(load)
        if not complete:
            rejected.append((load, reason or "Incomplete", None))
            continue

        assert load.price is not None
        assert load.weight_lbs is not None

        if not _trailer_matches(profile.trailer_types, load.trailer_type):
            rejected.append(
                (
                    load,
                    f"Trailer mismatch: load requires {_normalize_trailer(load.trailer_type)}, "
                    f"driver runs {', '.join(profile.trailer_types)}",
                    None,
                )
            )
            continue

        if profile.max_weight_lbs is not None and load.weight_lbs > profile.max_weight_lbs:
            rejected.append(
                (
                    load,
                    f"Weight {load.weight_lbs:.0f} lbs exceeds capacity "
                    f"{profile.max_weight_lbs:.0f} lbs",
                    None,
                )
            )
            continue

        legs = _compute_legs(load, profile, truck_lat, truck_lon)
        if legs is None:
            rejected.append((load, "Cannot compute miles: missing coordinates", None))
            continue

        deadhead_to_origin, loaded_miles, deadhead_home = legs
        total_miles = deadhead_to_origin + loaded_miles + deadhead_home
        rate = _effective_rate(load.price, total_miles)

        if profile.min_rate_per_mile is not None and rate < profile.min_rate_per_mile:
            rejected.append(
                (
                    load,
                    f"Effective rate ${rate:.3f}/mi below minimum "
                    f"${profile.min_rate_per_mile:.3f}/mi",
                    rate,
                )
            )
            continue

        eligible.append(
            RankedLoad(
                rank=0,
                load_id=load.load_id,
                origin_city=load.origin_city,
                destination_city=load.destination_city,
                origin_lat=load.origin_lat,
                origin_lon=load.origin_lon,
                destination_lat=load.destination_lat,
                destination_lon=load.destination_lon,
                price=load.price,
                trailer_type=load.trailer_type,
                deadhead_to_origin=round(deadhead_to_origin, 3),
                loaded_miles=round(loaded_miles, 3),
                deadhead_home=round(deadhead_home, 3),
                total_miles=round(total_miles, 3),
                effective_rate_per_mile=round(rate, 3),
            )
        )

    eligible.sort(key=lambda x: x.effective_rate_per_mile, reverse=True)
    for i, item in enumerate(eligible[:3], start=1):
        item.rank = i

    top_3 = eligible[:3]

    rejected_high_payer: RejectedLoad | None = None
    priced_rejects = [
        (load, reason, rate) for load, reason, rate in rejected if load.price is not None
    ]
    if priced_rejects:
        load, reason, rate = max(priced_rejects, key=lambda x: x[0].price or 0)
        rejected_high_payer = RejectedLoad(
            load_id=load.load_id,
            origin_city=load.origin_city,
            destination_city=load.destination_city,
            price=load.price,
            trailer_type=load.trailer_type,
            reason=reason,
            effective_rate_per_mile=round(rate, 3) if rate is not None else None,
        )

    return RankResult(
        top_3=top_3,
        rejected_high_payer=rejected_high_payer,
        eligible_count=len(eligible),
        filtered_count=len(rejected),
    )
