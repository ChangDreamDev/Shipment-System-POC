import { useCallback, useEffect, useMemo, useRef } from "react";
import { Circle, GoogleMap } from "@react-google-maps/api";
import { config } from "../config";
import RankDestinationMarker from "./RankDestinationMarker";
import RoutePolylines from "./RoutePolylines";
import TruckMarker from "./TruckMarker";
import { buildLoadRouteLegs, buildLoadRoutePath, RANK_COLORS } from "../utils/rankMap";

const MAP_CONTAINER_STYLE = { width: "100%", height: "420px", borderRadius: "8px" };

export function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function locationLabel(lat, lng, prefix = "Selected location") {
  return `${prefix} (${formatCoords(lat, lng)})`;
}

function toPosition(location) {
  return { lat: location.lat, lng: location.lng };
}

function MapPicker({
  truckLocation,
  homeLocation,
  ranking,
  selectedRank,
  onSelectRank,
  onTruckChange,
}) {
  const mapRef = useRef(null);

  const truckPosition = useMemo(
    () => toPosition(truckLocation),
    [truckLocation.lat, truckLocation.lng]
  );

  const homePosition = useMemo(() => {
    if (!homeLocation) return null;
    return toPosition(homeLocation);
  }, [homeLocation?.lat, homeLocation?.lng]);

  const rankedLoads = useMemo(() => {
    if (!ranking?.top_3) return [];
    return ranking.top_3.filter(
      (r) =>
        r.origin_lat != null &&
        r.origin_lon != null &&
        r.destination_lat != null &&
        r.destination_lon != null
    );
  }, [ranking]);

  const rankedOrigins = useMemo(
    () =>
      rankedLoads.map((r) => ({
        rank: r.rank,
        loadId: r.load_id,
        position: { lat: r.origin_lat, lng: r.origin_lon },
        label: `#${r.rank} pickup — ${r.origin_city || r.load_id}`,
        data: r,
      })),
    [rankedLoads]
  );

  const rankedDestinations = useMemo(
    () =>
      rankedLoads.map((r) => ({
        rank: r.rank,
        loadId: r.load_id,
        position: { lat: r.destination_lat, lng: r.destination_lon },
        label: `#${r.rank} delivery — ${r.destination_city || r.load_id}`,
        data: r,
      })),
    [rankedLoads]
  );

  const allRoutePaths = useMemo(() => {
    if (!homePosition || !rankedLoads.length) return [];
    return rankedLoads
      .map((r) => ({
        rank: r.rank,
        legs: buildLoadRouteLegs(truckLocation, r, homeLocation),
        path: buildLoadRoutePath(truckLocation, r, homeLocation),
        color: RANK_COLORS[r.rank] || "#64748b",
      }))
      .filter((r) => r.legs.length === 3);
  }, [rankedLoads, truckLocation, homeLocation, homePosition]);

  const selectedLoad = useMemo(() => {
    if (!selectedRank || !ranking?.top_3) return null;
    return ranking.top_3.find((r) => r.rank === selectedRank) || null;
  }, [ranking, selectedRank]);

  const mapOptions = useMemo(
    () => ({
      mapId: config.googleMapId,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    }),
    []
  );

  const fitMapView = useCallback(
    (focusRank = null) => {
      const map = mapRef.current;
      if (!map || !window.google?.maps) return;

      const bounds = new window.google.maps.LatLngBounds();
      let hasPoint = false;

      const extend = (point) => {
        if (point?.lat != null && point?.lng != null) {
          bounds.extend(point);
          hasPoint = true;
        }
      };

      const focusedRoute = focusRank
        ? allRoutePaths.find((r) => r.rank === focusRank)
        : null;

      if (focusedRoute) {
        focusedRoute.path.forEach(extend);
      } else {
        extend(truckPosition);
        if (homePosition) extend(homePosition);
        rankedOrigins.forEach((d) => extend(d.position));
        rankedDestinations.forEach((d) => extend(d.position));
        allRoutePaths.forEach((route) => route.path.forEach(extend));
      }

      if (!hasPoint) return;

      map.fitBounds(bounds, focusedRoute ? 72 : 64);
      const listener = window.google.maps.event.addListenerOnce(map, "idle", () => {
        const maxZoom = focusedRoute ? 10 : 12;
        if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
      });
      return () => window.google.maps.event.removeListener(listener);
    },
    [truckPosition, homePosition, rankedOrigins, rankedDestinations, allRoutePaths]
  );

  useEffect(() => {
    return fitMapView(selectedRank);
  }, [fitMapView, selectedRank, ranking]);

  const updateTruckLocation = useCallback(
    (lat, lng) => {
      onTruckChange({
        lat,
        lng,
        label: locationLabel(lat, lng, "Truck"),
      });
    },
    [onTruckChange]
  );

  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map;
      fitMapView(selectedRank);
    },
    [fitMapView, selectedRank]
  );

  const routeColor = selectedRank ? RANK_COLORS[selectedRank] : "#ea580c";

  return (
    <>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={truckPosition}
        zoom={11}
        onLoad={onMapLoad}
        options={mapOptions}
        onClick={(e) => {
          const latLng = e.latLng;
          if (!latLng) return;
          updateTruckLocation(latLng.lat(), latLng.lng());
        }}
      >
        <TruckMarker
          variant="truck"
          position={truckPosition}
          onDragEnd={updateTruckLocation}
        />
        <Circle
          center={truckPosition}
          radius={800}
          options={{
            fillColor: "#2563eb",
            fillOpacity: 0.15,
            strokeColor: "#2563eb",
            strokeOpacity: 0.5,
            strokeWeight: 2,
            clickable: false,
          }}
        />

        {homePosition && (
          <>
            <TruckMarker variant="home" position={homePosition} draggable={false} />
            <Circle
              center={homePosition}
              radius={800}
              options={{
                fillColor: "#16a34a",
                fillOpacity: 0.12,
                strokeColor: "#16a34a",
                strokeOpacity: 0.45,
                strokeWeight: 2,
                clickable: false,
              }}
            />
          </>
        )}

        {rankedOrigins.map((origin) => (
          <RankDestinationMarker
            key={`origin-${origin.loadId}`}
            variant="origin"
            rank={origin.rank}
            position={origin.position}
            label={origin.label}
            selected={selectedRank === origin.rank}
            onSelect={onSelectRank}
          />
        ))}

        {rankedDestinations.map((dest) => (
          <RankDestinationMarker
            key={`dest-${dest.loadId}`}
            variant="destination"
            rank={dest.rank}
            position={dest.position}
            label={dest.label}
            selected={selectedRank === dest.rank}
            onSelect={onSelectRank}
          />
        ))}

        {allRoutePaths.length > 0 && (
          <RoutePolylines routes={allRoutePaths} selectedRank={selectedRank} />
        )}
      </GoogleMap>

      {selectedLoad && (
        <div className="route-info" style={{ borderColor: routeColor }}>
          <div className="route-info__header">
            <span className="rank-badge">#{selectedLoad.rank}</span>
            <strong>{selectedLoad.load_id}</strong>
            <span className="route-info__lane">
              {selectedLoad.origin_city} → {selectedLoad.destination_city}
            </span>
          </div>
          <p className="route-info__path">
            Truck → {selectedLoad.origin_city} → {selectedLoad.destination_city} → Home
          </p>
          <ul className="route-info__legs">
            <li>
              <span className="route-leg route-leg--deadhead" aria-hidden="true" />
              Deadhead to origin:{" "}
              <strong>{selectedLoad.deadhead_to_origin.toFixed(1)} mi</strong>
            </li>
            <li>
              <span className="route-leg route-leg--loaded" aria-hidden="true" />
              Loaded miles: <strong>{selectedLoad.loaded_miles.toFixed(1)} mi</strong>
            </li>
            <li>
              <span className="route-leg route-leg--deadhead" aria-hidden="true" />
              Deadhead home: <strong>{selectedLoad.deadhead_home.toFixed(1)} mi</strong>
            </li>
          </ul>
          <div className="route-info__stats">
            <span>
              <strong>{selectedLoad.total_miles.toFixed(1)}</strong> total mi
            </span>
            <span>
              <strong>${selectedLoad.effective_rate_per_mile.toFixed(3)}</strong>/mi
            </span>
            <span>
              <strong>${selectedLoad.price?.toLocaleString()}</strong> pay
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default function LocationPicker({
  truckLocation,
  homeLocation,
  ranking,
  selectedRank,
  onSelectRank,
  onTruckChange,
  onDetect,
  detecting,
  locationReady,
  mapsLoaded,
  mapsLoadError,
}) {
  const mapConfigured = config.googleMapsApiKey && config.googleMapId;
  const showMap = mapConfigured && mapsLoaded && locationReady && !mapsLoadError;
  const showMapLoading =
    mapConfigured && !mapsLoadError && (!locationReady || !mapsLoaded);

  return (
    <section className="card location-card">
      <div className="location-header">
        <div>
          <h2>Truck & Home Base</h2>
          <p className="location-label">
            <span className="location-dot truck" aria-hidden="true" />
            Truck: {locationReady ? truckLocation.label : "Loading…"}
          </p>
          {homeLocation ? (
            <p className="location-label">
              <span className="location-dot home" aria-hidden="true" />
              Home: {homeLocation.label}
            </p>
          ) : (
            <p className="location-hint">Home base appears after Part A extraction.</p>
          )}
        </div>
        <button
          type="button"
          className="secondary"
          onClick={onDetect}
          disabled={detecting}
        >
          {detecting ? "Detecting…" : "Use my location"}
        </button>
      </div>

      <div className="map-legend">
        <span>
          <span className="location-dot truck" /> Truck (drag or click map)
        </span>
        <span>
          <span className="location-dot home" /> Home base
        </span>
        {ranking?.top_3?.length > 0 && (
          <>
            <span>Ring = pickup · Filled = delivery</span>
            <span>Solid line = loaded · Dashed = deadhead</span>
            <span>Click a rank marker to highlight its route</span>
          </>
        )}
      </div>

      {!config.googleMapsApiKey && (
        <p className="location-hint">
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>frontend/.env</code> and
          enable <strong>Maps JavaScript API</strong> in Google Cloud.
        </p>
      )}

      {config.googleMapsApiKey && !config.googleMapId && (
        <p className="location-hint error-text">
          Set <code>VITE_GOOGLE_MAP_ID</code> in <code>frontend/.env</code> (create a Map
          ID in Google Cloud Console).
        </p>
      )}

      {mapsLoadError && (
        <p className="location-hint error-text">Failed to load Google Maps.</p>
      )}

      {showMap && (
        <MapPicker
          truckLocation={truckLocation}
          homeLocation={homeLocation}
          ranking={ranking}
          selectedRank={selectedRank}
          onSelectRank={onSelectRank}
          onTruckChange={onTruckChange}
        />
      )}

      {showMapLoading && (
        <div className="map-placeholder">
          {!locationReady ? "Loading truck location…" : "Loading map…"}
        </div>
      )}
    </section>
  );
}
