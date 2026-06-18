import { useCallback, useEffect, useState } from "react";
import { api, DEFAULT_TRUCK_LOCATION } from "./api";
import LocationPicker, { locationLabel } from "./components/LocationPicker";
import { useGoogleMapsLoader } from "./hooks/useGoogleMapsLoader";
import { RANK_COLORS } from "./utils/rankMap";
import { detectUserLocation, geolocationErrorMessage } from "./utils/geolocation";

function Notification({ message, variant, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`notification ${variant}`} role="alert">
      <span className="notification-text">{message}</span>
      <button
        type="button"
        className="notification-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

function ProfileView({ profile }) {
  if (!profile) return <p>No profile yet. Run extraction or import your spreadsheet.</p>;
  return (
    <div>
      <div className="profile-field">
        <label>Driver</label>
        <span>{profile.driver_name || "—"}</span>
      </div>
      <div className="profile-field">
        <label>Equipment</label>
        <span>{(profile.trailer_types || []).join(", ") || "—"}</span>
      </div>
      <div className="profile-field">
        <label>Max weight</label>
        <span>
          {profile.max_weight_lbs != null
            ? `${profile.max_weight_lbs.toLocaleString()} lbs`
            : "—"}
        </span>
      </div>
      <div className="profile-field">
        <label>Min rate</label>
        <span>
          {profile.min_rate_per_mile != null
            ? `$${profile.min_rate_per_mile.toFixed(2)}/mi (effective)`
            : "—"}
        </span>
      </div>
      <div className="profile-field">
        <label>Truck location</label>
        <span>
          {profile.truck_location_city || "—"}
          {profile.truck_location_lat != null &&
            ` (${profile.truck_location_lat}, ${profile.truck_location_lon})`}
        </span>
      </div>
      <div className="profile-field">
        <label>Home base</label>
        <span>
          {profile.home_base_city || "—"}
          {profile.home_base_lat != null &&
            ` (${profile.home_base_lat}, ${profile.home_base_lon})`}
        </span>
      </div>
      {profile.notes?.length > 0 && (
        <div className="notes">
          <strong>Notes / implied constraints:</strong>
          <ul>
            {profile.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function truckLocationFromProfile(profile) {
  if (
    profile?.truck_location_lat != null &&
    profile?.truck_location_lon != null
  ) {
    const city = profile.truck_location_city?.trim();
    return {
      lat: profile.truck_location_lat,
      lng: profile.truck_location_lon,
      label:
        city ||
        locationLabel(
          profile.truck_location_lat,
          profile.truck_location_lon,
          "Truck"
        ),
    };
  }
  return DEFAULT_TRUCK_LOCATION;
}

function homeLocationFromProfile(profile) {
  if (!profile || profile.home_base_lat == null || profile.home_base_lon == null) {
    return null;
  }
  const city = profile.home_base_city?.trim();
  return {
    lat: profile.home_base_lat,
    lng: profile.home_base_lon,
    label: city || locationLabel(profile.home_base_lat, profile.home_base_lon, "Home base"),
  };
}

function detectBrowserLocation(options) {
  return detectUserLocation(options);
}

let initialLoadStarted = false;

export default function App() {
  const [transcript, setTranscript] = useState("");
  const [loads, setLoads] = useState([]);
  const [profile, setProfile] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [truckLocation, setTruckLocation] = useState(DEFAULT_TRUCK_LOCATION);
  const [homeLocation, setHomeLocation] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [selectedRank, setSelectedRank] = useState(null);
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useGoogleMapsLoader();

  const applyProfileLocations = useCallback((nextProfile) => {
    setHomeLocation(homeLocationFromProfile(nextProfile));
    setTruckLocation(truckLocationFromProfile(nextProfile));
  }, []);

  const persistTruckLocation = useCallback(
    async (truckLoc, { silent = false } = {}) => {
      if (!profile) {
        setTruckLocation(truckLoc);
        return;
      }

      const { profile: updatedProfile, ranking: updatedRanking } =
        await api.updateTruckLocation(truckLoc);

      setTruckLocation(truckLoc);
      setProfile(updatedProfile);
      setHomeLocation(homeLocationFromProfile(updatedProfile));

      if (updatedRanking) {
        setRanking(updatedRanking);
        setSelectedRank((prev) =>
          prev && updatedRanking.top_3?.some((r) => r.rank === prev)
            ? prev
            : updatedRanking.top_3?.[0]?.rank ?? null
        );
      }

      if (!silent) {
        setMessage("Truck location updated and top loads re-ranked.");
      }
    },
    [profile]
  );

  const handleTruckChange = useCallback(
    async (truckLoc) => {
      setTruckLocation(truckLoc);
      if (!profile) return;

      try {
        setError(null);
        await persistTruckLocation(truckLoc, { silent: true });
      } catch (err) {
        setError(err.message);
      }
    },
    [profile, persistTruckLocation]
  );

  const handleUseMyLocation = useCallback(async () => {
    setDetecting(true);
    setError(null);
    try {
      const result = await detectBrowserLocation();
      const prefix =
        result.source === "browser"
          ? "Truck"
          : result.source === "google"
            ? "Truck (network)"
            : "Truck (approximate)";
      const truckLoc = {
        lat: result.lat,
        lng: result.lng,
        label: locationLabel(result.lat, result.lng, prefix),
      };

      if (profile) {
        await persistTruckLocation(truckLoc);
      } else {
        setTruckLocation(truckLoc);
        if (result.source !== "browser") {
          setMessage(
            result.source === "google"
              ? "Used network-based location (GPS unavailable)."
              : "Used approximate location from your IP address."
          );
        }
      }
    } catch (err) {
      setError(geolocationErrorMessage(err));
    } finally {
      setDetecting(false);
    }
  }, [profile, persistTruckLocation]);

  const refresh = useCallback(async () => {
    let loadedProfile = null;
    let loadedRanking = null;
    try {
      const [conv, loadsRes, rankingRes] = await Promise.allSettled([
        api.getConversation(),
        api.getLoads(),
        api.getRanking(),
      ]);
      if (conv.status === "fulfilled") {
        setTranscript(conv.value.transcript);
        loadedProfile = conv.value.profile ?? null;
        setProfile(loadedProfile);
      }
      if (loadsRes.status === "fulfilled") setLoads(loadsRes.value.loads || []);
      if (rankingRes.status === "fulfilled") {
        loadedRanking = rankingRes.value.ranking ?? null;
        setRanking(loadedRanking);
        if (loadedRanking?.top_3?.length) {
          setSelectedRank((prev) =>
            prev && loadedRanking.top_3.some((r) => r.rank === prev) ? prev : null
          );
        } else {
          setSelectedRank(null);
        }
      }
    } catch {
      /* initial load may be empty */
    }
    return { profile: loadedProfile, ranking: loadedRanking };
  }, []);

  useEffect(() => {
    if (initialLoadStarted) return;
    initialLoadStarted = true;
    refresh().then(({ profile: loadedProfile }) => {
      applyProfileLocations(loadedProfile);
      setLocationReady(true);
    });
  }, [refresh, applyProfileLocations]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissMessage = useCallback(() => setMessage(null), []);

  async function run(action) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(result.message || "Done.");
      await refresh();
      if (result.profile) {
        setProfile(result.profile);
        applyProfileLocations(result.profile);
        setLocationReady(true);
      }
      if (result.top_3) {
        setRanking(result);
        setSelectedRank(result.top_3[0]?.rank ?? null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <header>
        <h1>Cinesis Good Fit Test</h1>
        <p>Extract driver profile (Part A) and rank eligible loads (Part B)</p>
      </header>

      {error && (
        <Notification message={error} variant="error" onClose={dismissError} />
      )}
      {message && (
        <Notification message={message} variant="success" onClose={dismissMessage} />
      )}

      <LocationPicker
        truckLocation={truckLocation}
        homeLocation={homeLocation}
        ranking={ranking}
        selectedRank={selectedRank}
        onSelectRank={setSelectedRank}
        onTruckChange={handleTruckChange}
        onDetect={handleUseMyLocation}
        detecting={detecting}
        locationReady={locationReady}
        mapsLoaded={mapsLoaded}
        mapsLoadError={mapsLoadError}
      />

      <div className="actions">
        <button disabled={loading} onClick={() => run(() => api.extract())}>
          Run Part A — Extract Profile
        </button>
        <button
          disabled={loading || !profile}
          title={!profile ? "Run Part A to extract a driver profile first" : undefined}
          onClick={() => {
            if (!profile) return;
            run(() => api.rank(truckLocation));
          }}
        >
          Run Part B — Rank Top 3
        </button>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Sample Conversation</h2>
          <pre>{transcript || "No transcript loaded."}</pre>
        </section>

        <section className="card">
          <h2>Part A — Driver Profile</h2>
          <ProfileView profile={profile} />
        </section>
      </div>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Loads Board ({loads.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Lane</th>
              <th>Type</th>
              <th>Weight</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.load_id}>
                <td>{l.load_id}</td>
                <td>
                  {l.origin_city || "?"} → {l.destination_city || "?"}
                </td>
                <td>{l.trailer_type || "—"}</td>
                <td>{l.weight_lbs?.toLocaleString() ?? "—"}</td>
                <td>{l.price != null ? `$${l.price}` : "—"}</td>
                <td>{l.incomplete ? l.incomplete_reason || "incomplete" : "ok"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {ranking && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Part B — Top 3 Eligible Loads</h2>
          <p style={{ color: "#8b9cb3", fontSize: "0.9rem" }}>
            {ranking.eligible_count} eligible · {ranking.filtered_count} filtered ·
            from {truckLocation.label}
          </p>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Load</th>
                <th>Lane</th>
                <th>Deadhead</th>
                <th>Loaded</th>
                <th>Home DH</th>
                <th>Total mi</th>
                <th>Effective $/mi</th>
              </tr>
            </thead>
            <tbody>
              {ranking.top_3.map((r) => (
                <tr
                  key={r.load_id}
                  className={selectedRank === r.rank ? "rank-row rank-row--selected" : "rank-row"}
                  onClick={() => setSelectedRank(r.rank)}
                  style={
                    selectedRank === r.rank
                      ? { outlineColor: RANK_COLORS[r.rank] }
                      : undefined
                  }
                >
                  <td>
                    <span className="rank-badge">#{r.rank}</span>
                  </td>
                  <td>{r.load_id}</td>
                  <td>
                    {r.origin_city} → {r.destination_city}
                  </td>
                  <td>{r.deadhead_to_origin.toFixed(1)}</td>
                  <td>{r.loaded_miles.toFixed(1)}</td>
                  <td>{r.deadhead_home.toFixed(1)}</td>
                  <td>{r.total_miles.toFixed(1)}</td>
                  <td>
                    <strong>${r.effective_rate_per_mile.toFixed(3)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {ranking.rejected_high_payer && (
            <div className="rejected">
              <h3>High-paying load rejected</h3>
              <p>
                <strong>{ranking.rejected_high_payer.load_id}</strong> (
                {ranking.rejected_high_payer.origin_city} →{" "}
                {ranking.rejected_high_payer.destination_city}) — $
                {ranking.rejected_high_payer.price?.toLocaleString()} —{" "}
                {ranking.rejected_high_payer.reason}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
