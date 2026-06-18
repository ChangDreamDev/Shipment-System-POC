import { useJsApiLoader } from "@react-google-maps/api";
import { config, GOOGLE_MAP_IDS, GOOGLE_MAP_LIBRARIES } from "../config";

export function useGoogleMapsLoader() {
  return useJsApiLoader({
    id: "cinesis-google-maps-v2",
    googleMapsApiKey: config.googleMapsApiKey,
    libraries: GOOGLE_MAP_LIBRARIES,
    mapIds: GOOGLE_MAP_IDS,
  });
}
