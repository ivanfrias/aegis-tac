import React from 'react';

interface TacticalCamoBackgroundProps {
  className?: string;
  opacity?: number;
  showVignette?: boolean;
}

/**
 * Military Multicam Black / Dark Woodland Camouflage Background
 * Seamless vector SVG pattern designed for tactical tablets & smartphones
 * to replace empty black letterbox/margin zones.
 */
export const TacticalCamoBackground: React.FC<TacticalCamoBackgroundProps> = ({
  className = '',
  opacity = 1,
  showVignette = true,
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Seamless Vector Camo SVG Pattern */}
      <svg
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          {/* Micro Ripstop Fabric Grid Pattern */}
          <pattern
            id="camo-ripstop-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#34d399"
              strokeWidth="0.5"
              strokeOpacity="0.04"
            />
            <circle cx="12" cy="12" r="0.75" fill="#34d399" fillOpacity="0.05" />
          </pattern>

          {/* Seamless Multi-Layered Multicam Camouflage Pattern */}
          <pattern
            id="tactical-camo-pattern"
            width="320"
            height="320"
            patternUnits="userSpaceOnUse"
          >
            {/* Base Layer: Deep Stealth Black */}
            <rect width="320" height="320" fill="#040906" />

            {/* Layer 1: Dark Charcoal Slate Blobs */}
            <path
              d="M 0,30 Q 30,10 70,25 T 140,20 Q 180,35 190,80 T 170,140 Q 140,160 100,140 T 30,110 Q 0,80 0,30 Z
                 M 210,180 Q 260,160 300,190 T 320,260 Q 300,310 240,300 T 170,250 Q 180,200 210,180 Z"
              fill="#08120a"
            />

            {/* Layer 2: Muted Deep Olive Splotches */}
            <path
              d="M 90,60 Q 140,40 180,70 T 210,130 Q 190,170 140,160 T 80,120 Q 70,80 90,60 Z
                 M 10,190 Q 50,170 90,195 T 120,260 Q 90,300 40,290 T -10,240 Q -10,200 10,190 Z
                 M 240,30 Q 280,15 310,40 T 330,100 Q 290,120 260,95 T 225,50 Q 225,35 240,30 Z"
              fill="#0e1f13"
            />

            {/* Layer 3: Tactical Woodland Green Elements */}
            <path
              d="M 130,90 Q 165,75 190,100 T 200,145 Q 175,170 145,155 T 120,120 Q 115,100 130,90 Z
                 M 30,220 Q 65,205 95,230 T 100,275 Q 75,300 45,285 T 20,250 Q 15,230 30,220 Z
                 M 230,200 Q 270,190 295,215 T 305,260 Q 280,285 245,275 T 220,235 Q 215,210 230,200 Z"
              fill="#132b1a"
            />

            {/* Layer 4: Organic Forest Camo Contours */}
            <path
              d="M 50,10 Q 80,0 110,15 T 130,55 Q 110,80 75,70 T 35,45 Q 35,20 50,10 Z
                 M 160,220 Q 200,200 230,225 T 240,270 Q 215,295 180,285 T 145,250 Q 145,230 160,220 Z
                 M 270,120 Q 300,105 320,130 T 325,175 Q 300,195 275,185 T 255,150 Q 255,130 270,120 Z"
              fill="#1a3823"
            />

            {/* Layer 5: Small Micro-Disruption Camo Flecks */}
            <path
              d="M 60,130 Q 75,120 85,135 T 75,155 Q 60,160 55,145 Z
                 M 175,45 Q 190,38 198,48 T 192,62 Q 180,68 172,55 Z
                 M 270,230 Q 285,222 292,232 T 288,245 Q 275,250 268,240 Z
                 M 115,185 Q 130,178 138,188 T 132,202 Q 120,208 112,198 Z"
              fill="#22492e"
              opacity="0.85"
            />

            {/* Layer 6: Ripstop Texture Overprint */}
            <rect width="320" height="320" fill="url(#camo-ripstop-grid)" />
          </pattern>
        </defs>

        {/* Camouflage Base Fill */}
        <rect width="100%" height="100%" fill="url(#tactical-camo-pattern)" />
      </svg>

      {/* Radial Vignette & Tactical Edge Shadowing */}
      {showVignette && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 35%, rgba(2, 6, 3, 0.45) 75%, rgba(0, 0, 0, 0.88) 100%)',
          }}
        />
      )}
    </div>
  );
};
