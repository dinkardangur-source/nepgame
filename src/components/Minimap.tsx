import React, { useRef, useEffect, useState } from 'react';
import { InteractiveObject } from '../types/game';

interface MinimapProps {
  objects: InteractiveObject[];
  armyPos: [number, number, number];
  cameraPan: { x: number; z: number };
  zoom: number;
  onPanTo: (x: number, z: number) => void;
  onCenterArmy: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  objects,
  armyPos,
  cameraPan,
  zoom,
  onPanTo,
  onCenterArmy,
  isExpanded,
  onToggleExpand,
  isOpen,
  onToggleOpen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'resources' | 'buildings' | 'army' | 'threats'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const isDraggingRef = useRef(false);

  // Map world bounds: roughly -75 to +75 in X, -60 to +60 in Z
  const WORLD_MIN_X = -75;
  const WORLD_MAX_X = 75;
  const WORLD_MIN_Z = -60;
  const WORLD_MAX_Z = 60;

  const worldToCanvas = (wx: number, wz: number, w: number, h: number) => {
    const cx = ((wx - WORLD_MIN_X) / (WORLD_MAX_X - WORLD_MIN_X)) * w;
    const cy = ((wz - WORLD_MIN_Z) / (WORLD_MAX_Z - WORLD_MIN_Z)) * h;
    return { cx, cy };
  };

  const canvasToWorld = (cx: number, cy: number, w: number, h: number) => {
    const wx = WORLD_MIN_X + (cx / w) * (WORLD_MAX_X - WORLD_MIN_X);
    const wz = WORLD_MIN_Z + (cy / h) * (WORLD_MAX_Z - WORLD_MIN_Z);
    return { wx, wz };
  };

  // Draw minimap loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background terrain
    ctx.fillStyle = '#1c2826';
    ctx.fillRect(0, 0, w, h);

    // River curve
    ctx.strokeStyle = '#39575e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const rStart = worldToCanvas(-40, -10, w, h);
    const rMid = worldToCanvas(0, -6, w, h);
    const rEnd = worldToCanvas(45, 15, w, h);
    ctx.moveTo(rStart.cx, rStart.cy);
    ctx.quadraticCurveTo(rMid.cx, rMid.cy, rEnd.cx, rEnd.cy);
    ctx.stroke();

    // Objects
    objects.forEach((obj) => {
      const isRes = obj.type === 'resource';
      const isBldg = obj.type === 'citadel' || obj.type === 'fort';
      const isThreat = obj.type === 'monster';

      if (filter === 'resources' && !isRes) return;
      if (filter === 'buildings' && !isBldg) return;
      if (filter === 'threats' && !isThreat) return;

      const { cx, cy } = worldToCanvas(obj.position[0], obj.position[2], w, h);

      if (isBldg) {
        ctx.fillStyle = '#dfba6e';
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      } else if (isRes) {
        if (obj.subtype === 'wood') ctx.fillStyle = '#48a85a';
        else if (obj.subtype === 'stone') ctx.fillStyle = '#a6b0a8';
        else if (obj.subtype === 'iron') ctx.fillStyle = '#6f92ab';
        else ctx.fillStyle = '#f5c842';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isThreat) {
        ctx.fillStyle = '#e8453c';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Army position
    if (filter === 'all' || filter === 'army') {
      const { cx, cy } = worldToCanvas(armyPos[0], armyPos[2], w, h);
      ctx.fillStyle = '#429bf5';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Camera view frustum indicator
    const camPos = worldToCanvas(-cameraPan.x, -cameraPan.z, w, h);
    const boxW = Math.max(16, (40 / zoom) * (w / (WORLD_MAX_X - WORLD_MIN_X)));
    const boxH = Math.max(12, (30 / zoom) * (h / (WORLD_MAX_Z - WORLD_MIN_Z)));
    ctx.strokeStyle = '#f5dfa2';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camPos.cx - boxW / 2, camPos.cy - boxH / 2, boxW, boxH);
  }, [objects, armyPos, cameraPan, zoom, filter, isOpen, isExpanded]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { wx, wz } = canvasToWorld(cx, cy, canvas.width, canvas.height);
    onPanTo(-wx, -wz);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  if (!isOpen) {
    return (
      <button
        className="minimap-restore-btn"
        onClick={onToggleOpen}
        title="Open Kingdom Minimap [M]"
      >
        <span>🧭</span>
        <b>MINIMAP</b>
      </button>
    );
  }

  return (
    <div className={`minimap-overlay ${isExpanded ? 'expanded' : ''}`}>
      <div className="minimap-header">
        <div className="minimap-title-wrap">
          <span className="minimap-crest">🧭</span>
          <div className="minimap-headings">
            <span className="minimap-title">KINGDOM MINIMAP</span>
            <span className="minimap-coords">
              X: {Math.round(-cameraPan.x)} · Z: {Math.round(-cameraPan.z)}
            </span>
          </div>
        </div>

        <div className="minimap-actions">
          <button
            className="minimap-btn"
            onClick={onCenterArmy}
            title="Center camera on Magar Vanguard Army"
          >
            <span>🛡️</span>
          </button>
          <button
            className="minimap-btn"
            onClick={() => setShowFilters(!showFilters)}
            title="Filter Layers"
          >
            <span>👁️</span>
          </button>
          <button
            className="minimap-btn"
            onClick={onToggleExpand}
            title="Toggle Expanded / Standard Minimap View"
          >
            <span>{isExpanded ? '⤡' : '⤢'}</span>
          </button>
          <button className="minimap-btn" onClick={onToggleOpen} title="Minimize Minimap">
            <span>▾</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="minimap-filter-bar" style={{ display: 'flex' }}>
          {(['all', 'resources', 'buildings', 'army', 'threats'] as const).map((mode) => (
            <button
              key={mode}
              className={`minimap-filter-btn ${filter === mode ? 'active' : ''}`}
              onClick={() => setFilter(mode)}
            >
              {mode === 'all'
                ? 'All'
                : mode === 'resources'
                ? 'Nodes ♣'
                : mode === 'buildings'
                ? 'Bldgs 🏛️'
                : mode === 'army'
                ? 'Army 🛡️'
                : 'Threats ⚔️'}
            </button>
          ))}
        </div>
      )}

      <div className="minimap-canvas-container">
        <canvas
          ref={canvasRef}
          width={isExpanded ? 340 : 240}
          height={isExpanded ? 260 : 180}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        />
        <span className="minimap-compass comp-n">▲ NORTH GLACIER</span>
        <span className="minimap-compass comp-s">▼ SOUTH TERRACES</span>
        <span className="minimap-compass comp-w">◄ WEST</span>
        <span className="minimap-compass comp-e">EAST GATE ►</span>
      </div>

      <div className="minimap-footer">
        <div className="minimap-legend-pills">
          <span className="m-pill m-army">
            <i className="m-dot dot-army"></i> Army
          </span>
          <span className="m-pill m-wood">
            <i className="m-dot dot-wood"></i> Wood
          </span>
          <span className="m-pill m-stone">
            <i className="m-dot dot-stone"></i> Stone
          </span>
          <span className="m-pill m-iron">
            <i className="m-dot dot-iron"></i> Iron
          </span>
          <span className="m-pill m-gold">
            <i className="m-dot dot-gold"></i> Gold
          </span>
          <span className="m-pill m-threat">
            <i className="m-dot dot-monster"></i> Threat
          </span>
        </div>
        <span className="minimap-help-hint">Click/Drag to Pan</span>
      </div>
    </div>
  );
};
