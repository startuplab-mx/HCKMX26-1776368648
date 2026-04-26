import { useEffect, useMemo, useRef } from "react";
import L, { type LatLngBoundsExpression } from "leaflet";

export type MapSignal = {
  id: string;
  source: string;
  category: string;
  risk_score: number;
  region: string;
  lat: number;
  lng: number;
  ts: number;
  device_id: string;
  platform: string;
};

export type MapHeat = {
  name: string;
  count: number;
  lat: number;
  lng: number;
};

const SOURCE_COLOR: Record<string, string> = {
  argus: "hsl(222, 84%, 32%)",
  echo: "hsl(168, 76%, 42%)",
  helios: "hsl(35, 95%, 50%)",
  mnemosyne: "hsl(0, 84%, 55%)",
};

// Bounds covering Mexico
const LATAM_BOUNDS: LatLngBoundsExpression = [
  [14, -118], // SW
  [33, -86],  // NE
];

interface Props {
  signals: MapSignal[];
  heat: MapHeat[];
  onSelect?: (signal: MapSignal) => void;
}

export function LatamMap({ signals, heat, onSelect }: Props) {
  // Cap recent rendered pings
  const visible = useMemo(() => signals.slice(0, 60), [signals]);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const map = L.map(mapEl.current, {
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true,
      maxBoundsViscosity: 0.25,
    });

    map.fitBounds(LATAM_BOUNDS, { padding: [12, 12] });
    map.setMaxBounds(LATAM_BOUNDS);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: ["a", "b", "c", "d"],
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();

    heat.forEach((r) => {
      const radius = Math.min(10 + r.count * 1.5, 36);
      L.circleMarker([r.lat, r.lng], {
        radius,
        color: "hsl(0, 84%, 55%)",
        fillColor: "hsl(0, 84%, 55%)",
        fillOpacity: 0.15,
        weight: 1,
        opacity: 0.4,
        interactive: false,
      }).addTo(layer);
    });

    visible.forEach((s) => {
      const color = SOURCE_COLOR[s.source] ?? "hsl(222, 84%, 32%)";
      const isHigh = s.risk_score >= 0.7;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isHigh ? 7 : 5,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 1.5,
      });

      marker.bindTooltip(
        `<div class="text-xs"><strong>${s.category}</strong> · ${s.risk_score.toFixed(2)}<br /><span class="text-muted-foreground">${s.region}</span></div>`,
        { direction: "top", offset: [0, -4], opacity: 0.95 },
      );
      marker.bindPopup(
        `<div class="text-xs"><p class="font-semibold capitalize">${s.source} · ${s.category}</p><p class="mt-1">Risk score: <strong>${s.risk_score.toFixed(2)}</strong></p><p>Region: ${s.region}</p><p>Platform: ${s.platform}</p><p class="font-mono text-[10px] text-muted-foreground">${s.device_id}</p></div>`,
      );
      marker.on("click", () => onSelectRef.current?.(s));
      marker.addTo(layer);
    });
  }, [heat, visible]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <div ref={mapEl} className="h-full w-full bg-muted" />
    </div>
  );
}
