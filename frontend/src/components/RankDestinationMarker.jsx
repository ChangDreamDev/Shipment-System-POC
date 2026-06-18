import { useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";
import { RANK_COLORS } from "../utils/rankMap";

function createRankMarkerContent(rank, selected, variant = "destination") {
  const color = RANK_COLORS[rank] || "#64748b";
  const wrapper = document.createElement("div");
  wrapper.className = `rank-map-marker rank-map-marker--${variant}${
    selected ? " rank-map-marker--selected" : ""
  }`;
  wrapper.tabIndex = -1;

  if (variant === "origin") {
    wrapper.innerHTML = `
      <div class="rank-map-marker__ring" style="border-color:${color};color:${color}">
        <span class="rank-map-marker__num">${rank}</span>
      </div>
      <span class="rank-map-marker__point" style="border-top-color:${color}"></span>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="rank-map-marker__badge" style="background:${color}">
        <span class="rank-map-marker__num">${rank}</span>
      </div>
      <span class="rank-map-marker__point" style="background:${color}"></span>
    `;
  }

  return wrapper;
}

export default function RankDestinationMarker({
  rank,
  position,
  label,
  selected,
  onSelect,
  variant = "destination",
}) {
  const map = useGoogleMap();
  const markerRef = useRef(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: createRankMarkerContent(rank, selected, variant),
      gmpDraggable: false,
      title: label,
    });

    markerRef.current = marker;

    const clickListener = marker.addListener("gmp-click", () => {
      onSelectRef.current?.(rank);
    });

    return () => {
      window.google.maps.event.removeListener(clickListener);
      marker.map = null;
      markerRef.current = null;
    };
  }, [map, rank, label, selected, variant]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
      markerRef.current.content = createRankMarkerContent(rank, selected, variant);
    }
  }, [position.lat, position.lng, rank, selected, variant]);

  return null;
}
