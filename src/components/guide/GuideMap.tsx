"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { CATEGORY_HUE, CATEGORY_ONE, type Place } from "@/lib/guide";
import "leaflet/dist/leaflet.css";

/* Même recette que la carte Food : Leaflet chargé au montage seulement,
   épingles colorées par catégorie. */
export default function GuideMap({ places }: { places: Place[] }) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !holder.current) return;

      if (!map.current) {
        map.current = L.map(holder.current, {
          center: [17.9005, -62.8324],
          zoom: 13,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);
        markers.current = L.layerGroup().addTo(map.current);
      }

      const group = markers.current!;
      group.clearLayers();

      const placed = places.filter((p) => p.lat != null && p.lng != null);
      for (const p of placed) {
        const icon = L.divIcon({
          className: "resto-pin",
          html: `<div class="resto-pin-dot est-ouvert" style="background:${CATEGORY_HUE[p.category]};border-color:var(--green)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -10],
        });
        const popup = document.createElement("div");
        popup.className = "resto-popup";
        const name = document.createElement("strong");
        name.textContent = p.name;
        const details = document.createElement("span");
        details.textContent = `${CATEGORY_ONE[p.category]} · ${p.quartier}`;
        const link = document.createElement("a");
        link.href = `/guide/lieu/${encodeURIComponent(p.id)}`;
        link.textContent = "Voir la fiche →";
        popup.append(name, details, link);

        L.marker([p.lat!, p.lng!], { icon, title: p.name })
          .bindPopup(popup, { closeButton: false })
          .addTo(group);
      }

      if (placed.length > 0) {
        map.current!.fitBounds(
          L.latLngBounds(placed.map((p) => [p.lat!, p.lng!] as [number, number])),
          { padding: [36, 36], maxZoom: 15 }
        );
      }
    })();
    return () => { disposed = true; };
  }, [places]);

  useEffect(() => () => { map.current?.remove(); map.current = null; markers.current = null; }, []);

  const missing = places.filter((p) => p.lat == null || p.lng == null).length;

  return (
    <div>
      <div
        ref={holder}
        style={{ height: "min(62dvh, 560px)", minHeight: 380, borderRadius: 16,
          border: "1px solid var(--border)", overflow: "hidden", zIndex: 0 }}
        aria-label="Carte des lieux"
      />
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 2px 0" }}>
        Positions indicatives, données à titre de repère.
        {missing > 0 && ` ${missing} lieu${missing > 1 ? "x" : ""} sans position n'apparai${missing > 1 ? "ssent" : "t"} pas ici.`}
      </p>
    </div>
  );
}
