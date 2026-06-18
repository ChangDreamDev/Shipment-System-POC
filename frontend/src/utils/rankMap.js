export const RANK_COLORS = {
  1: "#ea580c",
  2: "#7c3aed",
  3: "#db2777",
};

export const LEG_TYPES = {
  DEADHEAD_TO_ORIGIN: "deadhead_to_origin",
  LOADED: "loaded",
  DEADHEAD_HOME: "deadhead_home",
};

function toPosition(location) {
  return { lat: location.lat, lng: location.lng };
}

export function buildLoadRouteLegs(truck, rankedLoad, home) {
  if (
    !rankedLoad ||
    !home ||
    rankedLoad.origin_lat == null ||
    rankedLoad.origin_lon == null ||
    rankedLoad.destination_lat == null ||
    rankedLoad.destination_lon == null
  ) {
    return [];
  }

  const origin = { lat: rankedLoad.origin_lat, lng: rankedLoad.origin_lon };
  const destination = {
    lat: rankedLoad.destination_lat,
    lng: rankedLoad.destination_lon,
  };

  return [
    {
      type: LEG_TYPES.DEADHEAD_TO_ORIGIN,
      path: [toPosition(truck), origin],
      miles: rankedLoad.deadhead_to_origin,
      label: "Truck → origin",
    },
    {
      type: LEG_TYPES.LOADED,
      path: [origin, destination],
      miles: rankedLoad.loaded_miles,
      label: "Loaded",
    },
    {
      type: LEG_TYPES.DEADHEAD_HOME,
      path: [destination, toPosition(home)],
      miles: rankedLoad.deadhead_home,
      label: "Destination → home",
    },
  ];
}

/** Full path for bounds fitting (truck → origin → destination → home). */
export function buildLoadRoutePath(truck, rankedLoad, home) {
  const legs = buildLoadRouteLegs(truck, rankedLoad, home);
  if (!legs.length) return [];

  const path = [];
  for (const leg of legs) {
    if (!path.length) {
      path.push(...leg.path);
    } else {
      path.push(...leg.path.slice(1));
    }
  }
  return path;
}
