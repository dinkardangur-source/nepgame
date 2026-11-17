import React, { useEffect, useRef, useState } from 'react';
import {
  RESERVED_PLOTS,
  STRATEGIC_DISTANCE_LINKS,
  CastleSpawnData,
  ReservedPlot,
  WORLD_BOUNDS,
} from '../game/WorldCoordinates';

interface StrategicWorldMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  castles: CastleSpawnData[];
  conqueredPlots?: Record<string, 'neutral' | 'enemy' | 'alliance'>;
  cameraInfo: { x: number; y: number; z: number; zoom: number };
  isStrategicFilterActive: boolean;
  onToggleStrategicFilter: (enabled: boolean) => void;
  onRelocateCastles: () => void;
  onPanToLocation: (x: number, z: number, label?: string) => void;
  onEnterMyCastle: () => void;
}

const MAP_MIN = WORLD_BOUNDS.MIN_X; // 0
const MAP_MAX = WORLD_BOUNDS.MAX_X; // 1600
const CANVAS_SIZE = 760;

// Deterministic earthy blotch coordinates for parchment terrain texture
const PARCHMENT_BLOTCHES: Array<{ x: number; y: number; rx: number; ry: number; rot: number; dark: boolean }> =
  Array.from({ length: 68 }, (_, i) => {
    const s1 = Math.sin(i * 12.9898 + 4.14) * 43758.5453;
    const s2 = Math.sin(i * 78.233 + 1.77) * 24634.6345;
    const s3 = Math.sin(i * 39.425 + 9.21) * 19283.4123;
    const f1 = s1 - Math.floor(s1);
    const f2 = s2 - Math.floor(s2);
    const f3 = s3 - Math.floor(s3);
    return {
      x: f1 * CANVAS_SIZE,
      y: f2 * CANVAS_SIZE,
      rx: 14 + f3 * 42,
      ry: 8 + ((f1 + f2) % 1) * 22,
      rot: f3 * Math.PI,
      dark: i % 3 !== 0,
    };
  });

export const StrategicWorldMapModal: React.FC<StrategicWorldMapModalProps> = ({
  isOpen,
  onClose,
  castles,
  conqueredPlots,
  cameraInfo,
  isStrategicFilterActive,
  onToggleStrategicFilter,
  onRelocateCastles,
  onPanToLocation,
  onEnterMyCastle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Layer toggles matching screenshot (Shrine, Object, Land, Level)
  const [showShrine, setShowShrine] = useState(true);
  const [showObject, setShowObject] = useState(true);
  const [showLand, setShowLand] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{
    name: string;
    subtitle: string;
    x: number;
    z: number;
    categoryColor: string;
  } | null>(null);

  // World -> 2D Canvas without Z flip so Z=220 (Shrine C1-C6) stays at top & matches minimap
  const worldToCanvas = (wx: number, wz: number) => {
    const cx = ((wx - MAP_MIN) / (MAP_MAX - MAP_MIN)) * CANVAS_SIZE;
    const cy = ((wz - MAP_MIN) / (MAP_MAX - MAP_MIN)) * CANVAS_SIZE;
    return { cx, cy };
  };

  const canvasToWorld = (cx: number, cy: number) => {
    const wx = MAP_MIN + (cx / CANVAS_SIZE) * (MAP_MAX - MAP_MIN);
    const wz = MAP_MIN + (cy / CANVAS_SIZE) * (MAP_MAX - MAP_MIN);
    return { wx, wz };
  };

  // Pick highest-power allied commander to display with purple ALLIANCE COMMANDER badge
  const allianceCastles = castles.filter((c) => !c.isMyCastle && c.faction !== 'enemy');
  const topCommanderId = allianceCastles.reduce<string | null>((bestId, cur) => {
    if (!bestId) return cur.id;
    const best = allianceCastles.find((c) => c.id === bestId);
    return !best || cur.power > best.power ? cur.id : bestId;
  }, null);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = CANVAS_SIZE;
    ctx.clearRect(0, 0, S, S);

    // 1. Warm Textured Parchment Terrain Base (matching Continent 1 screenshot)
    const baseGrad = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.78);
    baseGrad.addColorStop(0, '#9c784c');
    baseGrad.addColorStop(0.55, '#89663e');
    baseGrad.addColorStop(1, '#70512f');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);

    // Subtle earthy ridge blotches for authentic topographic parchment texture
    for (const b of PARCHMENT_BLOTCHES) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.dark ? 'rgba(66, 44, 22, 0.19)' : 'rgba(196, 160, 108, 0.14)';
      ctx.beginPath();
      ctx.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Optional "Land" Layer: Continent Sectors, Zone Borders & Elevation Rings
    if (showLand) {
      // Quadrant sector tints
      ctx.fillStyle = 'rgba(186, 230, 253, 0.10)'; // NW Highlands
      ctx.fillRect(0, 0, S / 2, S / 2);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.08)'; // NE Ridges
      ctx.fillRect(S / 2, 0, S / 2, S / 2);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.08)'; // SW Pines
      ctx.fillRect(0, S / 2, S / 2, S / 2);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.08)'; // SE Basin
      ctx.fillRect(S / 2, S / 2, S / 2, S / 2);

      // Grid lines along the 6x6 lattice bands
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 6]);
      for (const coord of [220, 452, 684, 916, 1148, 1380]) {
        const p = worldToCanvas(coord, coord);
        ctx.beginPath();
        ctx.moveTo(p.cx, 0);
        ctx.lineTo(p.cx, S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p.cy);
        ctx.lineTo(S, p.cy);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Concentric Tier Rings (C, B, A)
      const centerPt = worldToCanvas(800, 800);
      for (const [radWorld, color] of [
        [180, 'rgba(250, 204, 21, 0.35)'],
        [390, 'rgba(56, 189, 248, 0.25)'],
        [620, 'rgba(255, 255, 255, 0.18)'],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerPt.cx, centerPt.cy, (radWorld / (MAP_MAX - MAP_MIN)) * S, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. Draw Directional Progression Road Links (C -> B -> A -> The Congress)
    const plotById = new Map<string, ReservedPlot>();
    RESERVED_PLOTS.forEach((p) => plotById.set(p.id, p));

    for (const link of STRATEGIC_DISTANCE_LINKS) {
      const fromPlot = plotById.get(link.fromId);
      const toPlot = plotById.get(link.toId);
      if (!fromPlot || !toPlot) continue;

      const p1 = worldToCanvas(fromPlot.position[0], fromPlot.position[2]);
      const p2 = worldToCanvas(toPlot.position[0], toPlot.position[2]);

      const isImperial = link.color === 'gold';
      ctx.strokeStyle = isImperial ? '#452b12' : '#4a3016';
      ctx.lineWidth = isImperial ? 3.2 : 2.6;
      ctx.beginPath();
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
      ctx.stroke();

      // Subtle inner highlight along road
      ctx.strokeStyle = isImperial ? 'rgba(217, 159, 64, 0.45)' : 'rgba(130, 92, 52, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
      ctx.stroke();

      // Inward Directional Arrowhead near target node
      const dx = p2.cx - p1.cx;
      const dy = p2.cy - p1.cy;
      const len = Math.hypot(dx, dy);
      if (len > 10) {
        const ux = dx / len;
        const uy = dy / len;
        const offset = toPlot.type === 'congress' ? 32 : 25;
        const tipX = p2.cx - ux * offset;
        const tipY = p2.cy - uy * offset;
        const angle = Math.atan2(uy, ux);
        const headLen = 7.5;

        ctx.fillStyle = '#38210c';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLen * Math.cos(angle - Math.PI / 6),
          tipY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          tipX - headLen * Math.cos(angle + Math.PI / 6),
          tipY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    // Helper: Draw heraldic shield emblem inside parchment node cards
    const drawShieldIcon = (
      x: number,
      y: number,
      w: number,
      h: number,
      fillColor: string,
      strokeColor: string,
      innerColor?: string
    ) => {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y + h * 0.12);
      ctx.lineTo(x, y + h / 2);
      ctx.lineTo(x - w / 2, y + h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (innerColor) {
        ctx.fillStyle = innerColor;
        ctx.beginPath();
        ctx.arc(x, y - 1, w * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // 4. Draw Shrine Layer (Shrine C1–C20, Shrine B1–B12, Shrine A1–A4, The Congress)
    if (showShrine) {
      for (const plot of RESERVED_PLOTS) {
        const { cx, cy } = worldToCanvas(plot.position[0], plot.position[2]);
        const isCongress = plot.type === 'congress';
        const isShrineA = plot.type === 'shrine_a';
        const isShrineB = plot.type === 'shrine_b';
        const isConquered = conqueredPlots?.[plot.id] === 'alliance';

        const boxW = isCongress ? 52 : isShrineA ? 46 : 42;
        const boxH = isCongress ? 50 : isShrineA ? 44 : 40;

        // Translucent Square Parchment Card matching Screenshot (emerald tint when conquered)
        ctx.fillStyle = isConquered
          ? 'rgba(6, 78, 59, 0.88)'
          : isCongress
            ? 'rgba(84, 58, 22, 0.86)'
            : 'rgba(72, 51, 28, 0.74)';
        ctx.strokeStyle = isConquered
          ? '#10b981'
          : isCongress
            ? '#fde047'
            : isShrineA
              ? 'rgba(253, 224, 71, 0.82)'
              : 'rgba(245, 232, 210, 0.65)';
        ctx.lineWidth = isCongress || isConquered ? 2.0 : 1.2;
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

        // Node Title at Top of Card
        ctx.font = isCongress
          ? "800 9.5px 'Barlow Condensed', sans-serif"
          : "700 9px 'Barlow Condensed', sans-serif";
        ctx.fillStyle = isConquered ? '#a7f3d0' : isCongress ? '#fef08a' : '#fffbeb';
        ctx.textAlign = 'center';
        ctx.fillText(plot.name, cx, cy - boxH / 2 + 10.5);

        // Subtitle or Coordinate Line
        ctx.font = "600 6.5px 'Inter', sans-serif";
        ctx.fillStyle = isConquered ? '#6ee7b7' : isCongress ? '#fde047' : '#e5d3b3';
        ctx.fillText(
          isConquered
            ? 'ALLIANCE'
            : isCongress
              ? 'Continent 1'
              : `[${Math.round(plot.position[0])}, ${Math.round(plot.position[2])}]`,
          cx,
          cy - boxH / 2 + 18
        );

        // Shield Crest in Center-Bottom of Card
        if (isConquered) {
          drawShieldIcon(cx, cy + 6.5, isCongress ? 14 : 11, isCongress ? 16 : 13, '#10b981', '#fef08a', '#facc15');
        } else if (isCongress) {
          drawShieldIcon(cx, cy + 7, 14, 16, '#facc15', '#78350f', '#38bdf8');
        } else if (isShrineA) {
          drawShieldIcon(cx, cy + 6.5, 11, 13, '#f8fafc', '#451a03', '#38bdf8');
        } else if (isShrineB) {
          drawShieldIcon(cx, cy + 6.5, 10.5, 12.5, '#f1f5f9', '#451a03', '#60a5fa');
        } else {
          drawShieldIcon(cx, cy + 6.5, 10, 12, '#e2e8f0', '#451a03');
        }

        // Optional Level / Tier Badge
        if (showLevel) {
          const tierTag = isCongress
            ? 'CONGRESS'
            : isShrineA
              ? 'TIER A'
              : isShrineB
                ? 'TIER B'
                : 'TIER C';
          ctx.fillStyle = isCongress ? '#854d0e' : 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(cx - 18, cy + boxH / 2 - 4, 36, 10);
          ctx.strokeStyle = isCongress ? '#facc15' : '#38bdf8';
          ctx.lineWidth = 0.9;
          ctx.strokeRect(cx - 18, cy + boxH / 2 - 4, 36, 10);
          ctx.font = "800 7px 'Barlow Condensed', sans-serif";
          ctx.fillStyle = isCongress ? '#fef08a' : '#7dd3fc';
          ctx.fillText(tierTag, cx, cy + boxH / 2 + 3.5);
        }
      }
    }

    // 5. Draw Object Layer (My Castle, Alliance Commander, Alliance Castles)
    if (showObject) {
      for (const castle of castles) {
        const { cx, cy } = worldToCanvas(castle.position[0], castle.position[2]);
        const isCommander = !castle.isMyCastle && castle.id === topCommanderId;

        if (castle.isMyCastle) {
          // Emerald Glow + Crest
          const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
          grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#059669';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(cx - 9, cy - 9, 18, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🏰', cx, cy + 4);

          ctx.fillStyle = 'rgba(6, 78, 59, 0.94)';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(cx - 34, cy + 11, 68, 13, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = "800 8.5px 'Barlow Condensed', sans-serif";
          ctx.fillStyle = '#fef08a';
          ctx.fillText(
            showLevel ? `MY CASTLE · Lv.${castle.level}` : 'MY CASTLE',
            cx,
            cy + 20.5
          );
        } else if (castle.faction === 'enemy') {
          // Crimson Enemy Citadel
          ctx.fillStyle = '#b91c1c';
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(cx - 7.5, cy - 7.5, 15, 15, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = '8.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('☠️', cx, cy + 3);

          ctx.fillStyle = 'rgba(69, 10, 10, 0.92)';
          ctx.beginPath();
          ctx.roundRect(cx - 32, cy + 9, 64, 11, 3);
          ctx.fill();

          ctx.font = "700 8px 'Barlow Condensed', sans-serif";
          ctx.fillStyle = '#fca5a5';
          ctx.fillText(
            showLevel ? `${castle.allianceTag} Lv.${castle.level}` : `${castle.allianceTag} ${castle.owner}`,
            cx,
            cy + 17
          );
        } else {
          // Purple for Alliance Commander, Sky Blue for Alliance Member Kingdoms
          const fillCol = isCommander ? '#7e22ce' : '#0284c7';
          const borderCol = isCommander ? '#e879f9' : '#7dd3fc';

          ctx.fillStyle = fillCol;
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(cx - 7, cy - 7, 14, 14, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = '8.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(isCommander ? '👑' : '🏰', cx, cy + 3);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(cx - 28, cy + 9, 56, 11, 3);
          ctx.fill();

          ctx.font = "700 8px 'Barlow Condensed', sans-serif";
          ctx.fillStyle = isCommander ? '#f5d0fe' : '#bae6fd';
          ctx.fillText(
            showLevel ? `${castle.owner} Lv.${castle.level}` : castle.owner,
            cx,
            cy + 17
          );
        }
      }
    }

    // 6. Current 3D Camera Focus Reticle
    const camPos = worldToCanvas(cameraInfo.x, cameraInfo.z);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(camPos.cx - 18, camPos.cy - 14, 36, 28);
  }, [isOpen, castles, conqueredPlots, cameraInfo, showShrine, showObject, showLand, showLevel, topCommanderId]);

  if (!isOpen) return null;

  const findNearestStrategicNode = (wx: number, wz: number) => {
    let best: {
      name: string;
      subtitle: string;
      x: number;
      z: number;
      categoryColor: string;
      dist: number;
    } | null = null;

    if (showShrine) {
      for (const plot of RESERVED_PLOTS) {
        const d = Math.hypot(wx - plot.position[0], wz - plot.position[2]);
        if (d < 56 && (!best || d < best.dist)) {
          const isConquered = conqueredPlots?.[plot.id] === 'alliance';
          const baseSub =
            plot.type === 'congress'
              ? '👑 The Congress — Supreme Continent Citadel'
              : plot.type === 'shrine_a'
                ? '★★★ Tier A Inner Sanctum Shrine'
                : plot.type === 'shrine_b'
                  ? '★★ Tier B Mid-Ring Shrine'
                  : '✦ Tier C Outer Perimeter Shrine';
          best = {
            name: plot.name,
            subtitle: isConquered ? `${baseSub} [CONQUERED]` : baseSub,
            x: plot.position[0],
            z: plot.position[2],
            categoryColor: isConquered
              ? '#10b981'
              : plot.type === 'congress' || plot.type === 'shrine_a'
                ? '#facc15'
                : '#38bdf8',
            dist: d,
          };
        }
      }
    }

    if (showObject) {
      for (const c of castles) {
        const d = Math.hypot(wx - c.position[0], wz - c.position[2]);
        if (d < 50 && (!best || d < best.dist)) {
          const isEnemy = c.faction === 'enemy';
          best = {
            name: c.name,
            subtitle: c.isMyCastle
              ? `👑 My Kingdom · ${c.power.toLocaleString()} Power`
              : isEnemy
                ? `⚔️ ${c.allianceTag} Enemy Citadel · ${c.owner}`
                : `🛡️ ${c.allianceTag} Alliance Kingdom · ${c.owner}`,
            x: c.position[0],
            z: c.position[2],
            categoryColor: c.isMyCastle ? '#10b981' : isEnemy ? '#ef4444' : '#60a5fa',
            dist: d,
          };
        }
      }
    }

    return best;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const { wx, wz } = canvasToWorld(cx, cy);
    setHoveredItem(findNearestStrategicNode(wx, wz));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const { wx, wz } = canvasToWorld(cx, cy);
    const nearest = findNearestStrategicNode(wx, wz);

    if (nearest) {
      onPanToLocation(nearest.x, nearest.z, nearest.name);
    } else {
      onPanToLocation(Math.round(wx), Math.round(wz));
    }
    onClose();
  };

  const myCastle = castles.find((c) => c.isMyCastle);

  const legendItems = [
    { label: 'MY KINGDOM', icon: '🏰', bg: '#059669', border: '#34d399', color: '#86efac' },
    { label: 'ALLIANCE COMMANDER', icon: '👑', bg: '#7e22ce', border: '#c084fc', color: '#f3e8ff' },
    { label: 'ALLIANCE KINGDOMS', icon: '🏰', bg: '#0284c7', border: '#38bdf8', color: '#bae6fd' },
    { label: 'ALLIANCE CENTER', icon: '🏛️', bg: '#1d4ed8', border: '#60a5fa', color: '#93c5fd' },
    { label: 'ENEMY ALLIANCE CENTER', icon: '🏯', bg: '#b91c1c', border: '#f87171', color: '#fca5a5' },
    { label: 'CONGRESS', icon: '👑', bg: '#ca8a04', border: '#fde047', color: '#fef08a' },
    { label: 'SHRINE', icon: '💎', bg: '#b45309', border: '#fbbf24', color: '#fde68a' },
  ];

  return (
    <div
      className="worldmap-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(4, 8, 18, 0.90)',
        display: 'grid',
        placeItems: 'center',
        padding: '10px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="worldmap-modal-shell"
        style={{
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '95dvh',
          background: 'linear-gradient(180deg, #111927 0%, #090e17 100%)',
          borderTop: '2px solid #dfba6e',
          borderLeft: '2px solid #dfba6e',
          borderRight: '2px solid #dfba6e',
          borderBottom: '5px solid #78350f',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar Matching Screenshot (Blue Back Arrow + Centered WORLDMAP) */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(250, 204, 21, 0.25)',
            background: '#162032',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              minWidth: '58px',
              minHeight: '38px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
              borderTop: '1.5px solid #bae6fd',
              borderLeft: '1.5px solid #bae6fd',
              borderRight: '1.5px solid #bae6fd',
              borderBottom: '3.5px solid #1e3a8a',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Back to World Map"
          >
            ⬅
          </button>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                font: "800 20px 'Barlow Condensed', sans-serif",
                color: '#f8fafc',
                letterSpacing: '0.12em',
              }}
            >
              WORLDMAP
            </div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              1600×1600 Continent · 1 Congress · 4 Shrine A · 12 Shrine B · 20 Shrine C · {castles.length} Castles
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              minWidth: '40px',
              minHeight: '38px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.9)',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              borderRight: '1px solid rgba(255,255,255,0.2)',
              borderBottom: '3px solid #0f172a',
              color: '#e2e8f0',
              fontSize: '16px',
              cursor: 'pointer',
            }}
            title="Close WorldMap"
          >
            ✕
          </button>
        </div>

        {/* Main Body: Parchment Map Grid + Right Layer Toggles & Legend */}
        <div className="worldmap-modal-grid">
          {/* Left: Parchment Strategic Canvas */}
          <div
            className="worldmap-canvas-wrap"
            style={{
              position: 'relative',
              background: '#1a130b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              overflow: 'hidden',
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerMove={handleCanvasPointerMove}
              onClick={handleCanvasClick}
              style={{
                width: '100%',
                maxWidth: '640px',
                maxHeight: '76dvh',
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                borderTop: '2px solid #d97706',
                borderLeft: '2px solid #d97706',
                borderRight: '2px solid #d97706',
                borderBottom: '3px solid #78350f',
                boxShadow: '0 10px 30px rgba(0,0,0,0.85)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            />

            {/* Top-left Quick Action Chips */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => onToggleStrategicFilter(!isStrategicFilterActive)}
                style={{
                  minHeight: '34px',
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: isStrategicFilterActive
                    ? 'linear-gradient(180deg, #059669, #065f46)'
                    : 'rgba(15, 23, 42, 0.9)',
                  borderTop: isStrategicFilterActive ? '1px solid #34d399' : '1px solid #38bdf8',
                  borderLeft: isStrategicFilterActive ? '1px solid #34d399' : '1px solid #38bdf8',
                  borderRight: isStrategicFilterActive ? '1px solid #34d399' : '1px solid #38bdf8',
                  borderBottom: isStrategicFilterActive ? '3px solid #064e3b' : '3px solid #0c4a6e',
                  color: '#fff',
                  font: "700 11px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                }}
              >
                🎯 3D Filter: {isStrategicFilterActive ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={onRelocateCastles}
                style={{
                  minHeight: '34px',
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #ca8a04, #854d0e)',
                  borderTop: '1px solid #fde047',
                  borderLeft: '1px solid #fde047',
                  borderRight: '1px solid #fde047',
                  borderBottom: '3px solid #713f12',
                  color: '#fef08a',
                  font: "700 11px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                }}
              >
                🎲 Relocate Castles
              </button>
            </div>

            {/* Hover Tooltip Banner */}
            {hoveredItem && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(9, 14, 26, 0.96)',
                  borderTop: `1.5px solid ${hoveredItem.categoryColor}`,
                  borderLeft: `1.5px solid ${hoveredItem.categoryColor}`,
                  borderRight: `1.5px solid ${hoveredItem.categoryColor}`,
                  borderBottom: `3px solid ${hoveredItem.categoryColor}`,
                  borderRadius: '8px',
                  padding: '6px 14px',
                  pointerEvents: 'none',
                  textAlign: 'center',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.85)',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ font: "800 13px 'Barlow Condensed', sans-serif", color: '#fef08a' }}>
                  {hoveredItem.name} · [{Math.round(hoveredItem.x)}, {Math.round(hoveredItem.z)}]
                </div>
                <div style={{ fontSize: '10.5px', color: '#bae6fd' }}>
                  {hoveredItem.subtitle} — Tap to focus 3D camera
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Eye Toggles + Screenshot Color Legend + Continent 1 Banner */}
          <div className="worldmap-sidebar">
            {/* Layer Visibility Toggles (Shrine, Object, Land, Level) */}
            <div
              style={{
                background: '#0f172a',
                borderTop: '1px solid rgba(250, 204, 21, 0.35)',
                borderLeft: '1px solid rgba(250, 204, 21, 0.35)',
                borderRight: '1px solid rgba(250, 204, 21, 0.35)',
                borderBottom: '3px solid #1e293b',
                borderRadius: '10px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {(
                [
                  { label: 'Shrine', active: showShrine, toggle: () => setShowShrine((v) => !v) },
                  { label: 'Object', active: showObject, toggle: () => setShowObject((v) => !v) },
                  { label: 'Land', active: showLand, toggle: () => setShowLand((v) => !v) },
                  { label: 'Level', active: showLevel, toggle: () => setShowLevel((v) => !v) },
                ] as const
              ).map((layer) => (
                <button
                  key={layer.label}
                  type="button"
                  onClick={layer.toggle}
                  style={{
                    minHeight: '38px',
                    padding: '4px 10px',
                    borderRadius: '7px',
                    background: layer.active ? 'rgba(20, 83, 45, 0.45)' : 'rgba(15, 23, 42, 0.8)',
                    borderTop: layer.active
                      ? '1px solid rgba(74, 222, 128, 0.55)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    borderLeft: layer.active
                      ? '1px solid rgba(74, 222, 128, 0.55)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRight: layer.active
                      ? '1px solid rgba(74, 222, 128, 0.55)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    borderBottom: layer.active ? '2.5px solid #14532d' : '2.5px solid #020617',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '32px',
                      height: '24px',
                      borderRadius: '6px',
                      background: layer.active ? '#e2e8f0' : '#1e293b',
                      color: layer.active ? '#0f172a' : '#475569',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '14px',
                    }}
                  >
                    {layer.active ? '👁️' : '—'}
                  </span>
                  <span
                    style={{
                      font: "800 14px 'Barlow Condensed', sans-serif",
                      color: layer.active ? '#4ade80' : '#64748b',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {layer.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Screenshot Color Legend */}
            <div
              style={{
                background: '#0f172a',
                borderTop: '1px solid rgba(148, 163, 184, 0.25)',
                borderLeft: '1px solid rgba(148, 163, 184, 0.25)',
                borderRight: '1px solid rgba(148, 163, 184, 0.25)',
                borderBottom: '3px solid #1e293b',
                borderRadius: '10px',
                padding: '9px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {legendItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      minWidth: '24px',
                      borderRadius: '5px',
                      background: item.bg,
                      borderTop: `1.5px solid ${item.border}`,
                      borderLeft: `1.5px solid ${item.border}`,
                      borderRight: `1.5px solid ${item.border}`,
                      borderBottom: `2.5px solid ${item.border}`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '12px',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span
                    style={{
                      font: "700 11.5px 'Barlow Condensed', sans-serif",
                      color: item.color,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Navigation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {myCastle && (
                  <button
                    type="button"
                    onClick={() => {
                      onPanToLocation(myCastle.position[0], myCastle.position[2], myCastle.name);
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      background: 'linear-gradient(180deg, #059669, #047857)',
                      borderTop: '1px solid #34d399',
                      borderLeft: '1px solid #34d399',
                      borderRight: '1px solid #34d399',
                      borderBottom: '3px solid #064e3b',
                      color: '#fff',
                      font: "800 11.5px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    🎯 My Castle
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEnterMyCastle();
                  }}
                  style={{
                    flex: 1,
                    minHeight: '38px',
                    padding: '6px 8px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #b45309, #78350f)',
                    borderTop: '1px solid #facc15',
                    borderLeft: '1px solid #facc15',
                    borderRight: '1px solid #facc15',
                    borderBottom: '3px solid #451a03',
                    color: '#fef08a',
                    font: "800 11.5px 'Barlow Condensed', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  🏰 Inside Kingdom
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onPanToLocation(800, 800, 'The Congress');
                  onClose();
                }}
                style={{
                  minHeight: '46px',
                  width: '100%',
                  borderRadius: '9px',
                  background: 'linear-gradient(180deg, #fde047 0%, #eab308 65%, #ca8a04 100%)',
                  borderTop: '2px solid #fef9c3',
                  borderLeft: '2px solid #fef9c3',
                  borderRight: '2px solid #fef9c3',
                  borderBottom: '4px solid #854d0e',
                  color: '#1e1b08',
                  font: "900 17px 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(234, 179, 8, 0.35)',
                }}
                title="Focus Camera on The Congress [800, 800]"
              >
                CONTINENT 1
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .worldmap-modal-grid {
          display: grid;
          grid-template-columns: 1fr 270px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .worldmap-sidebar {
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          background: #0c1320;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .worldmap-modal-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            overflow-y: auto;
          }
          .worldmap-canvas-wrap {
            padding: 8px !important;
          }
          .worldmap-sidebar {
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
          }
        }
      `}</style>
    </div>
  );
};
