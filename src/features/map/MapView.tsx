import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../../store/useStore';
import { formatDistance } from '../../shared/utils/coordinates';
import type { CenterPoint } from '../../types';

/**
 * Compute a lat/lng point offset from a center by `radiusKm` at a given bearing (degrees).
 * Used to position distance labels on the circle perimeter.
 */
function offsetPoint(lat: number, lng: number, radiusKm: number, bearingDeg: number): [number, number] {
  const R = 6371; // earth radius km
  const d = radiusKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

const invisibleMarkerIcon = L.divIcon({
  className: '',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const OSM_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const OSM_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RangeInfo {
  point: CenterPoint;
  distance: number;
  innerRadius: number | null;
  outerRadius: number | null;
}

function computeRangeInfo(lat: number, lng: number, points: CenterPoint[]): RangeInfo[] {
  return points.filter((p) => p.visible).map((point) => {
    const distance = haversineKm(lat, lng, point.lat, point.lng);
    const sortedRadii = [...point.circles].map((c) => c.radius).sort((a, b) => a - b);

    let innerRadius: number | null = null;
    let outerRadius: number | null = null;

    if (sortedRadii.length > 0) {
      if (distance <= sortedRadii[0]) {
        innerRadius = null;
        outerRadius = sortedRadii[0];
      } else if (distance > sortedRadii[sortedRadii.length - 1]) {
        innerRadius = sortedRadii[sortedRadii.length - 1];
        outerRadius = null;
      } else {
        for (let i = 0; i < sortedRadii.length - 1; i++) {
          if (distance > sortedRadii[i] && distance <= sortedRadii[i + 1]) {
            innerRadius = sortedRadii[i];
            outerRadius = sortedRadii[i + 1];
            break;
          }
        }
      }
    }

    return { point, distance, innerRadius, outerRadius };
  });
}

function buildPopupHtml(
  lat: number,
  lng: number,
  rangeInfos: RangeInfo[],
  unit: 'km' | 'miles',
): string {
  const fmt = (km: number) => formatDistance(km, unit);

  const formatBand = (info: RangeInfo): string => {
    if (info.innerRadius === null && info.outerRadius !== null) {
      return `0 ~ ${fmt(info.outerRadius)}`;
    }
    if (info.innerRadius !== null && info.outerRadius === null) {
      return `${fmt(info.innerRadius)} ~ \u221E`;
    }
    if (info.innerRadius !== null && info.outerRadius !== null) {
      return `${fmt(info.innerRadius)} ~ ${fmt(info.outerRadius)}`;
    }
    return 'N/A';
  };

  const coordLine = `<div style="font-size:11px;color:#888;margin-bottom:8px">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`;

  let rangeSection: string;
  if (rangeInfos.length > 0) {
    const rows = rangeInfos.map((info) =>
      `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px">
        <span style="width:10px;height:10px;border-radius:50%;background:${info.point.color};flex-shrink:0"></span>
        <span><strong>${info.point.label}</strong>: <span style="color:#555">${formatBand(info)} (${fmt(info.distance)} away)</span></span>
      </div>`
    ).join('');
    rangeSection = `<div style="margin-bottom:10px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">Range Analysis</div>${rows}</div>`;
  } else {
    rangeSection = `<div style="font-size:12px;color:#888;margin-bottom:10px">No center points yet.</div>`;
  }

  const button = `<button id="range-make-point-btn" style="width:100%;padding:6px 12px;background:#1976d2;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">Make it a new center point</button>`;

  return `<div style="min-width:220px;font-family:sans-serif">${coordLine}${rangeSection}${button}</div>`;
}

function MapClickHandler() {
  const map = useMap();
  const popupRef = useRef<L.Popup | null>(null);

  useMapEvents({
    click(e) {
      // Close any existing popup
      if (popupRef.current) {
        map.closePopup(popupRef.current);
      }

      const { lat, lng } = e.latlng;
      const { points, settings, addPoint } = useStore.getState();
      const infos = computeRangeInfo(lat, lng, points);
      const html = buildPopupHtml(lat, lng, infos, settings.unit);

      const popup = L.popup({ maxWidth: 320 })
        .setLatLng(e.latlng)
        .setContent(html)
        .openOn(map);

      popupRef.current = popup;

      // Attach click handler to the button after popup opens
      setTimeout(() => {
        const btn = document.getElementById('range-make-point-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            addPoint(lat, lng);
            map.closePopup(popup);
          });
        }
      }, 0);
    },
  });

  return null;
}

function FlyToHandler() {
  const map = useMap();
  const flyToRequest = useStore((s) => s.flyToRequest);
  const points = useStore((s) => s.points);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!flyToRequest || flyToRequest.ts === lastTs.current) return;
    lastTs.current = flyToRequest.ts;

    const point = points.find((p) => p.id === flyToRequest.pointId);
    if (!point) return;

    const maxRadius = Math.max(...point.circles.map((c) => c.radius), 1);
    const metersRadius = maxRadius * 1000;
    const bounds = L.latLng(point.lat, point.lng).toBounds(metersRadius * 2);
    map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 18, duration: 0.8 });
  }, [flyToRequest, points, map]);

  return null;
}

/** Stores the Leaflet map instance in the store for use by export */
function MapInstanceRegistrar() {
  const map = useMap();
  const setMapInstance = useStore((s) => s.setMapInstance);

  useEffect(() => {
    setMapInstance(map);
    return () => setMapInstance(null);
  }, [map, setMapInstance]);

  return null;
}

/** Restores the saved viewport once after IndexedDB hydration */
function ViewportRestorer() {
  const map = useMap();
  const restored = useRef(false);

  useEffect(() => {
    // Subscribe to settings changes — when hydrate fires, we get the saved viewport
    const unsub = useStore.subscribe(
      (s) => s.settings.lastViewport,
      (viewport) => {
        if (!restored.current) {
          restored.current = true;
          map.setView(viewport.center, viewport.zoom);
        }
      }
    );
    return unsub;
  }, [map]);

  return null;
}

function ViewportTracker() {
  const updateSettings = useStore((s) => s.updateSettings);
  const map = useMap();

  useEffect(() => {
    const handler = () => {
      const center = map.getCenter();
      updateSettings({
        lastViewport: {
          center: [center.lat, center.lng],
          zoom: map.getZoom(),
        },
      });
    };
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, updateSettings]);

  return null;
}

function PointCircles({ point }: { point: CenterPoint }) {
  const unit = useStore((s) => s.settings.unit);
  const sortedCircles = [...point.circles].sort((a, b) => b.radius - a.radius);
  const count = sortedCircles.length;

  // Spread distance labels around the circle perimeter so they don't overlap.
  // Use bearings: 90° (east) for the first, then distribute evenly.
  const bearings = count === 1
    ? [90]
    : sortedCircles.map((_, i) => 45 + (i * 270) / (count - 1)); // spread from 45° to 315°

  return (
    <>
      {/* Center point name label */}
      <Marker position={[point.lat, point.lng]} icon={invisibleMarkerIcon}>
        <Tooltip permanent direction="top" offset={[0, -8]}>
          <span style={{ fontWeight: 600, color: point.color }}>{point.label}</span>
        </Tooltip>
      </Marker>

      {sortedCircles.map((circle, index) => {
        const opacityRange = { min: 0.08, max: 0.35 };
        const fillOpacity = count === 1
          ? 0.15
          : opacityRange.min + (index / (count - 1)) * (opacityRange.max - opacityRange.min);

        return (
          <Circle
            key={circle.id}
            center={[point.lat, point.lng]}
            radius={circle.radius * 1000}
            pathOptions={{
              color: point.color,
              fillColor: point.color,
              fillOpacity,
              weight: 2,
              opacity: 0.8,
            }}
          />
        );
      })}

      {/* Distance labels as separate markers on circle perimeters */}
      {sortedCircles.map((circle, index) => {
        const labelPos = offsetPoint(point.lat, point.lng, circle.radius, bearings[index]);
        return (
          <Marker key={`label-${circle.id}`} position={labelPos} icon={invisibleMarkerIcon}>
            <Tooltip permanent direction="right" offset={[0, 0]}>
              {formatDistance(circle.radius, unit)}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

export default function MapView() {
  const points = useStore((s) => s.points);
  const settings = useStore((s) => s.settings);
  const isDark = useStore((s) => {
    if (s.settings.themeMode === 'dark') return true;
    if (s.settings.themeMode === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const getTileUrl = () => {
    if (settings.satelliteView) return OSM_SATELLITE;
    return isDark ? OSM_DARK : OSM_LIGHT;
  };

  const attribution = settings.satelliteView
    ? '&copy; Esri'
    : isDark
    ? '&copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

  return (
    <MapContainer
      center={settings.lastViewport.center}
      zoom={settings.lastViewport.zoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer url={getTileUrl()} attribution={attribution} />
      <MapClickHandler />
      <MapInstanceRegistrar />
      <ViewportTracker />
      <ViewportRestorer />
      <FlyToHandler />
      {points
        .filter((p) => p.visible)
        .map((point) => (
          <PointCircles key={point.id} point={point} />
        ))}
    </MapContainer>
  );
}
