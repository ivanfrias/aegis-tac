import React, { useEffect, useRef } from 'react';
import {
  BleContact,
  PingType,
  SquadMember,
  TacticalPing,
} from '../types/radar';
import {
  calculateGpsBearingDeg,
  calculateGpsDistanceMeters,
} from '../services/orientation';
import { MapOverlay } from './MapOverlay';

interface RadarDisplayProps {
  contacts: BleContact[];
  squadMembers: SquadMember[];
  selfPeerId: string;
  pings: TacticalPing[];
  selfLat: number | null;
  selfLng: number | null;
  headingDeg: number;
  maxRangeMeters: number;
  headUpMode: boolean;
  showSatellite: boolean;
  mapStyle: 'SATELLITE' | 'TOPO';
  activePingTool: PingType | null;
  onRadarTapPing: (bearingDeg: number, distanceMeters: number) => void;
  onSelectContact?: (contact: BleContact) => void;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({
  contacts,
  squadMembers,
  selfPeerId,
  pings,
  selfLat,
  selfLng,
  headingDeg,
  maxRangeMeters,
  headUpMode,
  showSatellite,
  mapStyle,
  activePingTool,
  onRadarTapPing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef<number>(0);

  // Convert world compass bearing (0 = North) into canvas angle in radians (0 = Right, -PI/2 = Up)
  const bearingToCanvasRad = (worldBearingDeg: number): number => {
    const relativeDeg = headUpMode
      ? (worldBearingDeg - headingDeg + 360) % 360
      : worldBearingDeg;
    return ((relativeDeg - 90) * Math.PI) / 180;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activePingTool || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const maxRadius = Math.min(cx, cy) * 0.88;

    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    if (distPx > maxRadius) return;

    const distanceMeters = Math.max(
      1,
      Math.round((distPx / maxRadius) * maxRangeMeters)
    );
    // Angle from top (0 deg = Up)
    const screenAngleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const worldBearingDeg = headUpMode
      ? (screenAngleDeg + headingDeg) % 360
      : screenAngleDeg;

    onRadarTapPing(Math.round(worldBearingDeg), distanceMeters);
  };

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const outerRadius = Math.min(cx, cy) * 0.88;
      const now = Date.now();

      // 1. Background Circle (if satellite overlay is off, draw dark radar gradient)
      if (!showSatellite) {
        const bgGrad = ctx.createRadialGradient(
          cx,
          cy,
          outerRadius * 0.05,
          cx,
          cy,
          outerRadius
        );
        bgGrad.addColorStop(0, 'rgba(6, 32, 20, 0.92)');
        bgGrad.addColorStop(0.7, 'rgba(4, 18, 12, 0.96)');
        bgGrad.addColorStop(1, 'rgba(2, 10, 7, 0.99)');
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Subtle vignette over satellite map
        const vig = ctx.createRadialGradient(
          cx,
          cy,
          outerRadius * 0.5,
          cx,
          cy,
          outerRadius
        );
        vig.addColorStop(0, 'rgba(2, 12, 8, 0.15)');
        vig.addColorStop(1, 'rgba(2, 12, 8, 0.72)');
        ctx.fillStyle = vig;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Range Rings (25%, 50%, 75%, 100%)
      const ringFractions = [0.25, 0.5, 0.75, 1.0];
      ctx.lineWidth = 1;
      for (const frac of ringFractions) {
        const r = outerRadius * frac;
        ctx.strokeStyle =
          frac === 1.0
            ? 'rgba(16, 185, 129, 0.65)'
            : 'rgba(16, 185, 129, 0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Range label in meters
        const ringMeters = Math.round(maxRangeMeters * frac);
        ctx.fillStyle = 'rgba(110, 231, 183, 0.65)';
        ctx.font = '600 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${ringMeters}m`, cx + 4, cy - r + 11);
      }

      // 3. Crosshairs & Forward Field-of-View Cone
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.beginPath();
      ctx.moveTo(cx - outerRadius, cy);
      ctx.lineTo(cx + outerRadius, cy);
      ctx.moveTo(cx, cy - outerRadius);
      ctx.lineTo(cx, cy + outerRadius);
      ctx.stroke();

      // Forward FOV cone (90 deg sector ahead of player)
      const fovCenterRad = headUpMode
        ? -Math.PI / 2
        : ((headingDeg - 90) * Math.PI) / 180;
      const fovGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, outerRadius);
      fovGrad.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
      fovGrad.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
      ctx.fillStyle = fovGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        outerRadius,
        fovCenterRad - Math.PI / 5,
        fovCenterRad + Math.PI / 5
      );
      ctx.closePath();
      ctx.fill();

      // 4. Outer Compass Bezel (rotates with heading in Head-Up mode)
      const cardinalLabels: Record<number, string> = {
        0: 'N',
        90: 'E',
        180: 'S',
        270: 'W',
      };
      for (let deg = 0; deg < 360; deg += 15) {
        const rad = bearingToCanvasRad(deg);
        const isCardinal = deg % 90 === 0;
        const innerTick = outerRadius + (isCardinal ? 2 : 4);
        const outerTick = outerRadius + (isCardinal ? 9 : 7);

        ctx.strokeStyle =
          deg === 0
            ? '#f87171'
            : isCardinal
            ? 'rgba(167, 243, 208, 0.85)'
            : 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = isCardinal ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * innerTick, cy + Math.sin(rad) * innerTick);
        ctx.lineTo(cx + Math.cos(rad) * outerTick, cy + Math.sin(rad) * outerTick);
        ctx.stroke();

        if (isCardinal) {
          const labelRadius = outerRadius + 17;
          const lx = cx + Math.cos(rad) * labelRadius;
          const ly = cy + Math.sin(rad) * labelRadius;
          ctx.fillStyle = deg === 0 ? '#f87171' : '#a7f3d0';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cardinalLabels[deg], lx, ly);
        }
      }

      // 5. Rotating Radar Sweep Beam
      sweepAngleRef.current = (sweepAngleRef.current + 0.028) % (Math.PI * 2);
      const sweepRad = sweepAngleRef.current;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerRadius, sweepRad - 0.55, sweepRad);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(
        cx,
        cy,
        2,
        cx,
        cy,
        outerRadius
      );
      sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.02)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.22)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(sweepRad) * outerRadius,
        cy + Math.sin(sweepRad) * outerRadius
      );
      ctx.stroke();
      ctx.restore();

      // 6. Render BLE Contacts (Unknown Bogeys = Pulsing Proximity Arcs; Friendlies = Tactical Diamonds)
      const pulse = 0.55 + 0.45 * Math.sin(now / 260);

      for (const contact of contacts) {
        const clampedDist = Math.min(maxRangeMeters, contact.distanceMeters);
        const radiusPx = Math.max(
          14,
          (clampedDist / maxRangeMeters) * outerRadius
        );
        const centerRad = bearingToCanvasRad(contact.estimatedBearingDeg);

        if (!contact.isFriendly) {
          // UNKNOWN BOGEY -> Pulsing Heartbeat-Sensor Proximity Arc + Signal Trend
          const halfSpreadRad = ((contact.arcSpreadDeg / 2) * Math.PI) / 180;
          const isCloseDanger = contact.distanceMeters <= 12;
          const isMediumWarning = contact.distanceMeters <= 28;

          const baseRgb = isCloseDanger
            ? '239, 68, 68' // Red
            : isMediumWarning
            ? '245, 158, 11' // Amber
            : '234, 179, 8'; // Yellow

          // Outer glow arc
          ctx.strokeStyle = `rgba(${baseRgb}, ${0.22 * pulse})`;
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            radiusPx,
            centerRad - halfSpreadRad,
            centerRad + halfSpreadRad
          );
          ctx.stroke();

          // Core sharp proximity arc
          ctx.strokeStyle = `rgba(${baseRgb}, 0.92)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            radiusPx,
            centerRad - halfSpreadRad,
            centerRad + halfSpreadRad
          );
          ctx.stroke();

          // Center bogey pip on the arc
          const bx = cx + Math.cos(centerRad) * radiusPx;
          const by = cy + Math.sin(centerRad) * radiusPx;

          ctx.fillStyle = `rgb(${baseRgb})`;
          ctx.beginPath();
          ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Trend & Distance callout badge
          const trendSymbol =
            contact.trend === 'APPROACHING'
              ? '▲'
              : contact.trend === 'RECEDING'
              ? '▼'
              : '•';
          const tagText = `${trendSymbol} ${contact.distanceMeters}m (${contact.smoothedRssi}dBm)`;
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = 'rgba(5, 11, 7, 0.82)';
          const textWidth = ctx.measureText(tagText).width;
          ctx.fillRect(bx - textWidth / 2 - 4, by - 22, textWidth + 8, 14);

          ctx.fillStyle = `rgb(${baseRgb})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagText, bx, by - 15);
        } else {
          // WHITELISTED FRIENDLY BLE BEACON -> Cyan Tactical Diamond
          const fx = cx + Math.cos(centerRad) * radiusPx;
          const fy = cy + Math.sin(centerRad) * radiusPx;

          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#cffafe';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-5, -5, 10, 10);
          ctx.strokeRect(-5, -5, 10, 10);
          ctx.restore();

          ctx.fillStyle = '#67e8f9';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${contact.assignedCallsign || contact.name} (${contact.distanceMeters}m)`,
            fx,
            fy - 12
          );
        }
      }

      // 7. Render Squad Room Teammates (GPS + Status)
      for (const member of squadMembers) {
        if (member.peerId === selfPeerId) continue;

        let distMeters = 18;
        let bearingDeg = member.heading || 45;

        if (
          selfLat !== null &&
          selfLng !== null &&
          member.lat !== null &&
          member.lng !== null
        ) {
          distMeters = calculateGpsDistanceMeters(
            selfLat,
            selfLng,
            member.lat,
            member.lng
          );
          bearingDeg = calculateGpsBearingDeg(
            selfLat,
            selfLng,
            member.lat,
            member.lng
          );
        }

        const clampedDist = Math.min(maxRangeMeters, distMeters);
        const radiusPx = Math.max(
          16,
          (clampedDist / maxRangeMeters) * outerRadius
        );
        const rad = bearingToCanvasRad(bearingDeg);
        const mx = cx + Math.cos(rad) * radiusPx;
        const my = cy + Math.sin(rad) * radiusPx;

        const isMedic = member.status === 'MEDIC';
        const isHit = member.status === 'HIT';

        if (isMedic) {
          // Flashing red/white ring for MEDIC NEEDED
          ctx.strokeStyle = pulse > 0.7 ? '#ef4444' : '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(mx, my, 11, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isMedic
          ? '#ef4444'
          : isHit
          ? '#9ca3af'
          : '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#050b07';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const statusBadge = isMedic
          ? ' [MEDIC!]'
          : isHit
          ? ' [HIT]'
          : '';
        ctx.fillStyle = isMedic ? '#fca5a5' : '#bae6fd';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${member.callsign}${statusBadge} ${Math.round(distMeters)}m`,
          mx,
          my - 12
        );
      }

      // 8. Render Tactical Pings (ENEMY, OBJECTIVE, DANGER)
      for (const ping of pings) {
        let distMeters = ping.distanceMeters;
        let bearingDeg = ping.bearingDeg;

        if (
          selfLat !== null &&
          selfLng !== null &&
          ping.lat != null &&
          ping.lng != null
        ) {
          distMeters = calculateGpsDistanceMeters(
            selfLat,
            selfLng,
            ping.lat,
            ping.lng
          );
          bearingDeg = calculateGpsBearingDeg(
            selfLat,
            selfLng,
            ping.lat,
            ping.lng
          );
        }

        const clampedDist = Math.min(maxRangeMeters, distMeters);
        const radiusPx = (clampedDist / maxRangeMeters) * outerRadius;
        const rad = bearingToCanvasRad(bearingDeg);
        const px = cx + Math.cos(rad) * radiusPx;
        const py = cy + Math.sin(rad) * radiusPx;

        const pingColor =
          ping.type === 'ENEMY'
            ? '#ef4444'
            : ping.type === 'DANGER'
            ? '#f97316'
            : '#eab308';

        // Expanding ripple
        const rippleRadius = 6 + ((now - ping.createdAt) % 1400) / 70;
        ctx.strokeStyle = pingColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Ping crosshair marker
        ctx.fillStyle = pingColor;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();

        const secsLeft = Math.max(
          0,
          Math.ceil((ping.expiresAt - now) / 1000)
        );
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = pingColor;
        ctx.textAlign = 'center';
        ctx.fillText(
          `! ${ping.type} (${ping.senderCallsign}) ${secsLeft}s`,
          px,
          py + 14
        );
      }

      // 9. Self Player Center Marker (Chevron pointing forward)
      ctx.save();
      ctx.translate(cx, cy);
      if (!headUpMode) {
        ctx.rotate((headingDeg * Math.PI) / 180);
      }
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    contacts,
    squadMembers,
    selfPeerId,
    pings,
    selfLat,
    selfLng,
    headingDeg,
    maxRangeMeters,
    headUpMode,
    showSatellite,
  ]);

  return (
    <div className="relative w-full h-full aspect-square max-w-full max-h-full mx-auto flex items-center justify-center select-none">
      {/* Satellite / Topo Map Underlay */}
      <div className="absolute inset-[7%] rounded-full overflow-hidden">
        <MapOverlay
          lat={selfLat}
          lng={selfLng}
          headingDeg={headingDeg}
          maxRangeMeters={maxRangeMeters}
          visible={showSatellite}
          headUpMode={headUpMode}
          mapStyle={mapStyle}
        />
      </div>

      {/* Main Radar Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`relative z-10 w-full h-full ${
          activePingTool ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {/* Active Ping Placement Hint Banner */}
      {activePingTool && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-red-950/90 border border-red-500/60 text-red-200 text-[10px] sm:text-[11px] font-mono px-2.5 py-0.5 rounded-full shadow-lg animate-pulse pointer-events-none whitespace-nowrap">
          TAP RADAR TO DROP [{activePingTool}]
        </div>
      )}
    </div>
  );
};
