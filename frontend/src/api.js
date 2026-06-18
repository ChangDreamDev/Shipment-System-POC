import { config, DEFAULT_TRUCK_LOCATION } from "./config";

async function request(path, options = {}) {
  const res = await fetch(`${config.apiUrl}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || res.statusText);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  getConversation: () => request("/api/conversation"),
  getLoads: () => request("/api/loads"),
  getRanking: () => request("/api/ranking"),
  extract: () => request("/api/extract", { method: "POST" }),
  rank: (truckLocation) =>
    request("/api/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        truck_location_lat: truckLocation.lat,
        truck_location_lon: truckLocation.lng,
        truck_location_city: truckLocation.label,
      }),
    }),
  updateTruckLocation: (truckLocation) =>
    request("/api/truck-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        truck_location_lat: truckLocation.lat,
        truck_location_lon: truckLocation.lng,
        truck_location_city: truckLocation.label,
      }),
    }),
  saveProfile: (profile) =>
    request("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }),
};

export { DEFAULT_TRUCK_LOCATION };
