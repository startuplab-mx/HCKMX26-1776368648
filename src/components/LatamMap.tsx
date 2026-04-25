import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

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

// Bounds covering LATAM (roughly from southern US down to southern Argentina)
const LATAM_BOUNDS: LatLngBoundsExpression = [
  [-40, -120], // SW
  [33, -34],   // NE
];

interface Props {
  signals: MapSignal[];
  heat: MapHeat[];
  onSelect?: (signal: MapSignal) => void;
}

export function LatamMap({ signals, heat, onSelect }: Props) {
  // Cap recent rendered pings
  const visible = useMemo(() => signals.slice(0, 60), [signals]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        bounds={LATAM_BOUNDS}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full"
        style={{ background: "hsl(var(--muted))" }}
      >
        <ZoomControl position="bottomright" />
        {/* Free OSM tiles - Carto light theme matches our design system */}
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
        />

        {/* Region heat (aggregated) */}
        {heat.map((r) => {
          const radius = Math.min(10 + r.count * 1.5, 36);
          return (
            <CircleMarker
              key={`heat-${r.name}`}
              center={[r.lat, r.lng]}
              radius={radius}
              pathOptions={{
                color: "hsl(0, 84%, 55%)",
                fillColor: "hsl(0, 84%, 55%)",
                fillOpacity: 0.15,
                weight: 1,
                opacity: 0.4,
              }}
              interactive={false}
            />
          );
        })}

        {/* Individual signal pings */}
        {visible.map((s) => {
          const color = SOURCE_COLOR[s.source] ?? "hsl(222, 84%, 32%)";
          const isHigh = s.risk_score >= 0.7;
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={isHigh ? 7 : 5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => onSelect?.(s),
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-xs">
                  <strong>{s.category}</strong> · {s.risk_score.toFixed(2)}
                  <br />
                  <span className="text-muted-foreground">{s.region}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold capitalize">
                    {s.source} · {s.category}
                  </p>
                  <p className="mt-1">
                    Risk score: <strong>{s.risk_score.toFixed(2)}</strong>
                  </p>
                  <p>Region: {s.region}</p>
                  <p>Platform: {s.platform}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {s.device_id}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
