import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapOverlayProps {
  lat: number | null;
  lng: number | null;
  headingDeg: number;
  maxRangeMeters: number;
  visible: boolean;
  headUpMode: boolean;
  mapStyle: 'SATELLITE' | 'TOPO';
}

// Default tactical staging coordinates before GPS lock
const FALLBACK_COORDS: [number, number] = [37.7749, -122.4194];

function rangeToZoomLevel(rangeMeters: number): number {
  if (rangeMeters <= 25) return 18;
  if (rangeMeters <= 50) return 17;
  if (rangeMeters <= 90) return 16;
  return 15;
}

export const MapOverlay: React.FC<MapOverlayProps> = ({
  lat,
  lng,
  headingDeg,
  maxRangeMeters,
  visible,
  headUpMode,
  mapStyle,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const effectiveLat = lat ?? FALLBACK_COORDS[0];
  const effectiveLng = lng ?? FALLBACK_COORDS[1];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [effectiveLat, effectiveLng],
      zoom: rangeToZoomLevel(maxRangeMeters),
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    const satUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const layer = L.tileLayer(satUrl, {
      maxNativeZoom: 17, // Prevents missing/blank satellite tiles at high zoom anywhere in the world
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = layer;

    // Ensure Leaflet recalculates tile coverage whenever the radar circle resizes
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(containerRef.current);

    setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 150);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const satUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    tileLayerRef.current.setUrl(mapStyle === 'SATELLITE' ? satUrl : topoUrl);
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    const targetZoom = rangeToZoomLevel(maxRangeMeters);
    mapRef.current.invalidateSize({ animate: false });
    mapRef.current.setView([effectiveLat, effectiveLng], targetZoom, {
      animate: false,
    });
  }, [effectiveLat, effectiveLng, maxRangeMeters, visible]);

  if (!visible) return null;

  const rotation = headUpMode ? -headingDeg : 0;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
      <div
        ref={containerRef}
        style={{
          width: '146%',
          height: '146%',
          left: '-23%',
          top: '-23%',
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 120ms linear',
          filter:
            mapStyle === 'SATELLITE'
              ? 'brightness(0.85) contrast(1.15) saturate(0.85)'
              : 'invert(0.88) hue-rotate(110deg) brightness(0.75) contrast(1.2)',
        }}
        className="relative"
      />
      {/* Subtle tactical green tint that preserves satellite visibility */}
      <div className="absolute inset-0 bg-emerald-950/20 pointer-events-none" />
    </div>
  );
};
