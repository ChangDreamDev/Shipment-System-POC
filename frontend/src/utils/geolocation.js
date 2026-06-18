import { config } from "../config";

const BROWSER_TIMEOUT_MS = 5000;
const NETWORK_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error("Request timed out"), { code: 3 })), ms);
    }),
  ]);
}

function browserPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("Geolocation not supported"), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "browser",
        }),
      (err) => reject(err),
      options
    );
  });
}

async function tryBrowserGeolocation() {
  return browserPosition({
    enableHighAccuracy: false,
    timeout: BROWSER_TIMEOUT_MS,
    maximumAge: 300000,
  });
}

async function ipApiComGeolocation() {
  const res = await fetch("http://ip-api.com/json/?fields=status,message,lat,lon");
  if (!res.ok) throw new Error("IP lookup failed");
  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "IP lookup failed");
  }
  if (data.lat == null || data.lon == null) {
    throw new Error("IP lookup returned no coordinates");
  }
  return { lat: data.lat, lng: data.lon, source: "ip" };
}

async function googleGeolocation() {
  // return ipApiComGeolocation();
  const key = config.googleMapsApiKey;
  if (!key) {
    return ipApiComGeolocation();
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.location) {
      throw new Error(
        data.error?.message || `Google Geolocation API error (${res.status})`
      );
    }

    return {
      lat: data.location.lat,
      lng: data.location.lng,
      source: "google",
    };
  } catch {
    return ipApiComGeolocation();
  }
}

async function networkFallback() {
  return withTimeout(googleGeolocation(), NETWORK_TIMEOUT_MS);
}

export function geolocationErrorMessage(err) {
  if (err?.code === 1) {
    return "Location permission denied. Allow location in browser settings, or pick a spot on the map.";
  }
  if (err?.code === 2) {
    return "GPS unavailable. Enable Geolocation API in Google Cloud for network-based fallback, or click the map.";
  }
  if (err?.code === 3) {
    return "Location request timed out. Try again or click the map.";
  }
  return err?.message || "Could not detect location. Click the map to set your position.";
}

/**
 * @param {{ fast?: boolean }} options
 * - fast: skip browser GPS (use on page load — IP/network only, ~1–2s)
 */
export async function detectUserLocation({ fast = false } = {}) {
  if (fast) {
    return networkFallback();
  }

  let browserErr;
  try {
    return await tryBrowserGeolocation();
  } catch (err) {
    browserErr = err;
  }

  try {
    return await networkFallback();
  } catch {
    if (browserErr?.code === 1) throw browserErr;
    throw new Error("Could not detect location. Click the map to set your position.");
  }
}
