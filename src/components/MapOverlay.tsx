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
  if (rangeMeters <= 5) return 20.5;
  if (rangeMeters <= 10) return 19.5;
  if (rangeMeters <= 20) return 18.5;
  if (rangeMeters <= 35) return 17.5;
  if (rangeMeters <= 50) return 16.8;
  if (rangeMeters <= 75) return 16.0;
  return 15.0;
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
      zoomSnap: 0.1,
      zoomDelta: 0.5,
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
      maxNativeZoom: 18,
      maxZoom: 22,
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = layer;

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

  const rotation = headUpMode ? -headingDeg : 0;

  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-full pointer-events-none transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
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
      <div className="absolute inset-0 bg-emerald-950/20 pointer-events-none" />
    </div>
  );
};
