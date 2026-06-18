import { useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";
import { LEG_TYPES } from "../utils/rankMap";

const DASH_ICON = {
  path: "M 0,-1 0,1",
  strokeOpacity: 1,
  scale: 3,
};

function createPolyline(map, options) {
  return new window.google.maps.Polyline({ ...options, map });
}

export default function RoutePolylines({ routes, selectedRank }) {
  const map = useGoogleMap();
  const polylinesRef = useRef([]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];

    for (const route of routes) {
      const isSelected = route.rank === selectedRank;
      const showRoute = !selectedRank || isSelected;

      if (!showRoute) continue;

      for (const leg of route.legs) {
        const isLoaded = leg.type === LEG_TYPES.LOADED;
        const baseOpacity = isSelected ? 1 : 0.4;
        const strokeWeight = isSelected ? (isLoaded ? 6 : 4) : isLoaded ? 3 : 2;

        const lineOptions = {
          path: leg.path,
          geodesic: true,
          strokeColor: route.color,
          strokeOpacity: isLoaded ? baseOpacity : 0,
          strokeWeight,
          zIndex: isSelected ? 2 : 1,
        };

        if (!isLoaded) {
          lineOptions.icons = [
            {
              icon: { ...DASH_ICON, strokeColor: route.color },
              offset: "0",
              repeat: isSelected ? "14px" : "12px",
            },
          ];
        }

        if (isSelected && isLoaded) {
          const outline = createPolyline(map, {
            path: leg.path,
            geodesic: true,
            strokeColor: "#ffffff",
            strokeOpacity: 0.85,
            strokeWeight: 10,
            zIndex: 1,
          });
          polylinesRef.current.push(outline);
        }

        polylinesRef.current.push(createPolyline(map, lineOptions));
      }
    }

    return () => {
      polylinesRef.current.forEach((line) => line.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routes, selectedRank]);

  return null;
}
