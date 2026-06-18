export const DEFAULT_TRUCK_LOCATION = {
  lat: 32.7767,
  lng: -96.7970,
  label: "Dallas, TX",
};

const googleMapId = (import.meta.env.VITE_GOOGLE_MAP_ID || "").trim() || "DEMO_MAP_ID";

/** Stable reference — do not inline in useJsApiLoader */
export const GOOGLE_MAP_LIBRARIES = ["marker"];

/** Stable reference — do not inline in useJsApiLoader */
export const GOOGLE_MAP_IDS = [googleMapId];

export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  port: Number(import.meta.env.VITE_PORT ?? 5173),
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  googleMapId,
};
