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

// Default tactical staging coordinates (can be overridden by live GPS or manual drag)
const FALLBACK_COORDS: [number, number] = [37.7749, -122.4194];

function rangeToZoomLevel(rangeMeters: number): number {
  if (rangeMeters <= 20) return 19;
  if (rangeMeters <= 45) return 18;
  if (rangeMeters <= 85) return 17;
  return 16;
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
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = layer;

    return () => {
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
    mapRef.current.setView([effectiveLat, effectiveLng], targetZoom, {
      animate: false,
    });
  }, [effectiveLat, effectiveLng, maxRangeMeters]);

  if (!visible) return null;

  const rotation = headUpMode ? -headingDeg : 0;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
      <div
        ref={containerRef}
        style={{
          width: '145%',
          height: '145%',
          left: '-22.5%',
          top: '-22.5%',
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 120ms linear',
          filter:
            mapStyle === 'SATELLITE'
              ? 'brightness(0.55) contrast(1.25) saturate(0.75) hue-rotate(35deg)'
              : 'invert(0.9) hue-rotate(110deg) brightness(0.55) contrast(1.3)',
        }}
        className="relative"
      />
      {/* Tactical CRT / Night-Vision Tint */}
      <div className="absolute inset-0 bg-emerald-950/35 mix-blend-multiply" />
    </div>
  );
};
