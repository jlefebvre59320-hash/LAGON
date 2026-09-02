"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { hasHours, isOpenNow, type Restaurant, type RatingSummary } from "@/lib/food";
import { MIN_RATINGS } from "@/lib/food";
import "leaflet/dist/leaflet.css";

/* Leaflet touche window dès l'import : on ne le charge que dans le
   navigateur, une fois le composant monté. */

export default function FoodMap({
  restos,
  ratings,
}: {
  restos: Restaurant[];
  ratings: Record<string, RatingSummary>;
}) {
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
          center: [17.9005, -62.8324], // le milieu de l'île
          zoom: 13,
          scrollWheelZoom: true,
          attributionControl: true,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);
        markers.current = L.layerGroup().addTo(map.current);
      }

      const group = markers.current!;
      group.clearLayers();

      const placed = restos.filter((r) => r.lat != null && r.lng != null);
      for (const r of placed) {
        const open = hasHours(r.hours) && isOpenNow(r.hours);
        const s = ratings[r.id];
        const note = s && s.votes >= MIN_RATINGS ? ` · ★ ${s.avg_rating.toFixed(1)}` : "";
        const icon = L.divIcon({
          className: "resto-pin",
          html: `<div class="resto-pin-dot${open ? " est-ouvert" : ""}"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -10],
        });
        const popup = document.createElement("div");
        popup.className = "resto-popup";
        const name = document.createElement("strong");
        name.textContent = r.name;
        const details = document.createElement("span");
        details.textContent = `${r.cuisine} · ${r.quartier}${note}`;
        const link = document.createElement("a");
        link.href = `/food/resto/${encodeURIComponent(r.id)}`;
        link.textContent = "Voir la fiche →";
        popup.append(name, details, link);

        L.marker([r.lat!, r.lng!], { icon, title: r.name })
          .bindPopup(popup, { closeButton: false })
          .addTo(group);
      }

      if (placed.length > 0) {
        map.current!.fitBounds(
          L.latLngBounds(placed.map((r) => [r.lat!, r.lng!] as [number, number])),
          { padding: [36, 36], maxZoom: 15 }
        );
      }
    })();
    return () => { disposed = true; };
  }, [restos, ratings]);

  // Le démontage complet libère la carte (retour à la liste, navigation).
  useEffect(() => () => { map.current?.remove(); map.current = null; markers.current = null; }, []);

  const missing = restos.filter((r) => r.lat == null || r.lng == null).length;

  return (
    <div>
      <div
        ref={holder}
        style={{ height: "min(62dvh, 560px)", minHeight: 380, borderRadius: 16,
          border: "1px solid var(--border)", overflow: "hidden", zIndex: 0 }}
        aria-label="Carte des restaurants"
      />
      {missing > 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 2px 0" }}>
          {missing} adresse{missing > 1 ? "s" : ""} sans position connue n&apos;apparai{missing > 1 ? "ssent" : "t"} pas
          sur la carte — la liste reste complète.
        </p>
      )}
    </div>
  );
}
