#!/usr/bin/env python3
"""Run Part B ranking with a saved or default profile (no API server required)."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.schemas import DriverProfile, Load  # noqa: E402
from app.services.ranking import rank_loads  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Rank loads for Cinesis Good Fit Test")
    parser.add_argument(
        "--profile",
        type=Path,
        help="JSON file with driver profile (default: built-in sample)",
    )
    parser.add_argument(
        "--loads",
        type=Path,
        default=ROOT / "data" / "loads.json",
        help="Loads JSON file",
    )
    parser.add_argument("--lat", type=float, default=32.7767, help="Truck latitude")
    parser.add_argument("--lon", type=float, default=-96.7970, help="Truck longitude")
    args = parser.parse_args()

    if args.profile:
        profile_data = json.loads(args.profile.read_text())
    else:
        profile_data = {
            "driver_name": "Marcus",
            "trailer_types": ["dry van"],
            "max_weight_lbs": 45000,
            "min_rate_per_mile": 2.0,
            "home_base_city": "Oklahoma City",
            "home_base_lat": 35.4676,
            "home_base_lon": -97.5164,
            "notes": [
                "Dry van only — no flatbed or reefer",
                "Minimum $2.00/mi effective (all-in including deadhead home)",
                "Prefers lanes toward home; avoid northeast this week",
            ],
        }

    loads_raw = json.loads(args.loads.read_text())
    loads_list = loads_raw["loads"] if isinstance(loads_raw, dict) else loads_raw
    profile = DriverProfile(**profile_data)
    loads = [Load(**item) for item in loads_list]
    result = rank_loads(profile, loads, args.lat, args.lon)

    print(json.dumps(result.model_dump(), indent=2))


if __name__ == "__main__":
    main()
