import { useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";

const MARKER_CONFIG = {
  truck: {
    className: "truck-map-marker",
    title: "Truck current location",
    badgeColor: "#2563eb",
    icon: `<svg class="map-marker__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20 8h-3V5H5a2 2 0 0 0-2 2v9h2a3 3 0 0 0 6 0h4a3 3 0 0 0 6 0h2v-5l-2-3zM6 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 12h-3V9h1.5l1.5 2v1z"/>
    </svg>`,
  },
  home: {
    className: "home-map-marker",
    title: "Home base",
    badgeColor: "#16a34a",
    icon: `<svg class="map-marker__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3z"/>
    </svg>`,
  },
};

function createMarkerContent(variant) {
  const cfg = MARKER_CONFIG[variant] || MARKER_CONFIG.truck;
  const wrapper = document.createElement("div");
  wrapper.className = cfg.className;
  wrapper.tabIndex = -1;
  wrapper.innerHTML = `
    <div class="map-marker__badge" style="background:${cfg.badgeColor}">
      ${cfg.icon}
    </div>
    <span class="map-marker__point" style="background:${cfg.badgeColor}"></span>
  `;
  return wrapper;
}

function readPosition(position) {
  if (!position) return null;
  const lat = typeof position.lat === "function" ? position.lat() : position.lat;
  const lng = typeof position.lng === "function" ? position.lng() : position.lng;
  return { lat, lng };
}

export default function TruckMarker({
  position,
  onDragEnd,
  variant = "truck",
  draggable = variant === "truck",
}) {
  const map = useGoogleMap();
  const markerRef = useRef(null);
  const onDragEndRef = useRef(onDragEnd);
  const cfg = MARKER_CONFIG[variant] || MARKER_CONFIG.truck;

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: createMarkerContent(variant),
      gmpDraggable: draggable,
      title: cfg.title,
    });

    markerRef.current = marker;

    const el = marker.element;
    if (el) {
      el.style.outline = "none";
      el.style.boxShadow = "none";
      const shadow = el.shadowRoot;
      if (shadow && !shadow.querySelector("[data-cinesis-marker-style]")) {
        const style = document.createElement("style");
        style.setAttribute("data-cinesis-marker-style", "true");
        style.textContent = `
          :host(:focus),
          :host(:focus-visible),
          :host(:active) {
            outline: none !important;
            box-shadow: none !important;
          }
          *:focus,
          *:focus-visible {
            outline: none !important;
            box-shadow: none !important;
          }
        `;
        shadow.appendChild(style);
      }
    }

    const clearFocus = () => {
      marker.element?.blur?.();
      document.activeElement?.blur?.();
    };

    const listeners = [];
    if (draggable) {
      listeners.push(marker.addListener("dragstart", clearFocus));
      listeners.push(
        marker.addListener("dragend", () => {
          const coords = readPosition(marker.position);
          if (coords) onDragEndRef.current?.(coords.lat, coords.lng);
          clearFocus();
        })
      );
    }
    listeners.push(marker.addListener("gmp-click", clearFocus));

    return () => {
      listeners.forEach((listener) => window.google.maps.event.removeListener(listener));
      marker.map = null;
      markerRef.current = null;
    };
  }, [map, variant, draggable, cfg.title]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
    }
  }, [position.lat, position.lng]);

  return null;
}
