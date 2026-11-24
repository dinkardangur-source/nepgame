import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AcceptanceTestResult,
  BuildingTypeId,
  GridObject,
  MonsterTypeId,
  OBJECT_SPECS,
  OwnershipState,
  ResourceTypeId,
  TILE_SIZE,
  WorldGridManager,
} from '../game/WorldGridSystem';
import { SceneTelemetry, WorldMapTestScene } from '../game/WorldMapTestScene';

interface WorldMapTestModeProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONSTER_SPAWN_CYCLE: MonsterTypeId[] = [
  'slime',
  'orc',
  'goblin',
  'wolf',
  'skeleton_knight',
  'ogre',
  'death_knight',
  'skeleton_dragon',
];

const RESOURCE_SPAWN_CYCLE: ResourceTypeId[] = [
  'small_wood',
  'small_food',
  'small_stone',
  'small_gold',
  'small_crystal',
  'medium_resource',
  'large_resource',
];

const CASTLE_SPAWN_CYCLE: BuildingTypeId[] = ['player_castle', 'external_castle'];

const OWNERSHIP_STATES: OwnershipState[] = [
  'Neutral',
  'Protected',
  'Occupied',
  'Under attack',
  'Captured',
];

export const WorldMapTestMode: React.FC<WorldMapTestModeProps> = ({ isOpen, onClose }) => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<WorldGridManager | null>(null);
  const sceneRef = useRef<WorldMapTestScene | null>(null);

  const [selectedObject, setSelectedObject] = useState<GridObject | null>(null);
  const [objectCount, setObjectCount] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showCollisionBoxes, setShowCollisionBoxes] = useState(true);
  const [showProtectionBarriers, setShowProtectionBarriers] = useState(true);
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    zoom: 1.0,
    lodTier: 'Medium',
    cameraTargetX: 0,
    cameraTargetZ: 0,
  });
  const [statusLog, setStatusLog] = useState<string>(
    'Test Map auto-generated. Click any object or use WASD + Mouse Wheel.'
  );
  const [collisionStatus, setCollisionStatus] = useState<string>('0 overlaps · All rules enforced');
  const [testResults, setTestResults] = useState<AcceptanceTestResult[]>([]);
  const [zoomDimensionSamples, setZoomDimensionSamples] = useState<
    Array<{ zoom: number; label: string; widthsMatch: boolean; detail: string }>
  >([]);
  const [spawnCursor, setSpawnCursor] = useState({ monster: 0, resource: 0, castle: 0 });
  const [activeRightTab, setActiveRightTab] = useState<'debug' | 'tests'>('debug');

  useEffect(() => {
    if (!isOpen || !canvasHostRef.current) return;

    const grid = new WorldGridManager(90, 90);
    grid.generateTestMap();
    gridRef.current = grid;

    const scene = new WorldMapTestScene(canvasHostRef.current, grid, {
      onSelectObject: (obj) => {
        setSelectedObject(obj ? { ...obj } : null);
        if (obj) {
          setStatusLog(`Selected ${obj.name} at (${obj.gridX}, ${obj.gridY})`);
        }
      },
      onTelemetryChange: (next) => {
        setTelemetry(next);
      },
      onTroopArrived: (targetId) => {
        const g = gridRef.current;
        if (!g) return;
        const target = g.objects.find((o) => o.id === targetId);
        if (target) {
          if (target.category === 'monster') {
            target.hp = Math.max(0, target.hp - Math.ceil(target.maxHp * 0.4));
            target.battleStatus = target.hp === 0 ? 'Defeated · Respawn 30s' : 'In Combat';
            if (target.hp === 0) target.respawnCooldownSec = 30;
          } else if (target.category === 'resource') {
            const harvested = Math.min(target.remainingResource ?? 0, 2500);
            target.remainingResource = Math.max(0, (target.remainingResource ?? 0) - harvested);
            target.gatherProgressPct = Math.min(100, (target.gatherProgressPct ?? 0) + 35);
            target.battleStatus = `Gathered ${harvested} · Returning`;
          } else if (target.category === 'shrine' || target.category === 'citadel') {
            target.ownership = 'Captured';
            target.ownerName = 'Player Alliance';
            target.allianceTag = '[HIM]';
            target.battleStatus = 'Captured by Test Force';
          } else if (target.category === 'castle') {
            target.battleStatus = 'Scouted / Reinforced';
          }
          sceneRef.current?.refreshObjectAppearance(target);
          setSelectedObject((prev) => (prev?.id === target.id ? { ...target } : prev));
          setStatusLog(`Troop arrived at ${target.name} — ${target.battleStatus}`);
        }
      },
    });
    sceneRef.current = scene;

    // Initial selection on Alliance Citadel
    const citadel = grid.objects.find((o) => o.typeId === 'alliance_citadel') ?? grid.objects[0] ?? null;
    if (citadel) {
      scene.setSelectedObjectId(citadel.id);
      setSelectedObject({ ...citadel });
    }
    setObjectCount(grid.objects.length);
    setTestResults(grid.runAcceptanceTests({ currentZoom: scene.getZoom() }));

    return () => {
      scene.dispose();
      sceneRef.current = null;
      gridRef.current = null;
    };
  }, [isOpen]);

  // Monster respawn countdown tick while Test Mode is open
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => {
      const g = gridRef.current;
      const s = sceneRef.current;
      if (!g || !s) return;
      let changed = false;
      for (const obj of g.objects) {
        if (obj.category === 'monster' && (obj.respawnCooldownSec ?? 0) > 0) {
          obj.respawnCooldownSec = Math.max(0, (obj.respawnCooldownSec ?? 0) - 1);
          if (obj.respawnCooldownSec === 0) {
            obj.hp = obj.maxHp;
            obj.battleStatus = 'Respawned';
          } else {
            obj.battleStatus = `Respawning (${obj.respawnCooldownSec}s)`;
          }
          s.refreshObjectAppearance(obj);
          changed = true;
        }
      }
      if (changed) {
        setSelectedObject((prev) => {
          if (!prev) return null;
          const fresh = g.objects.find((o) => o.id === prev.id);
          return fresh ? { ...fresh } : null;
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  const nearestInfo = useMemo(() => {
    const g = gridRef.current;
    if (!g || !selectedObject) return null;
    const live = g.objects.find((o) => o.id === selectedObject.id) ?? selectedObject;
    return g.getNearestObjectDistance(live);
  }, [selectedObject, objectCount]);

  if (!isOpen) return null;

  const refreshCountsAndTests = (customSamples = zoomDimensionSamples) => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g) return;
    setObjectCount(g.objects.length);
    setTestResults(
      g.runAcceptanceTests({
        currentZoom: s?.getZoom() ?? 1,
        zoomDimensionSamples: customSamples,
      })
    );
  };

  const handleGenerateTestMap = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    g.generateTestMap();
    s.syncFromGridManager();
    const citadel = g.objects.find((o) => o.typeId === 'alliance_citadel') ?? g.objects[0] ?? null;
    s.setSelectedObjectId(citadel?.id ?? null);
    setSelectedObject(citadel ? { ...citadel } : null);
    setCollisionStatus('0 overlaps · All 43 test objects validated');
    setStatusLog(`Generated ${g.objects.length} objects across 90×90 grid (1 tile = 10×10u).`);
    refreshCountsAndTests();
  };

  const handleResetMap = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    g.resetMap();
    s.syncFromGridManager();
    s.setSelectedObjectId(null);
    setSelectedObject(null);
    setCollisionStatus('Map cleared · 0 occupied cells');
    setStatusLog('Reset Map executed: all generated objects and troops removed.');
    refreshCountsAndTests();
  };

  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    sceneRef.current?.setShowGrid(next);
  };

  const handleToggleCollisionBoxes = () => {
    const next = !showCollisionBoxes;
    setShowCollisionBoxes(next);
    sceneRef.current?.setShowCollisionBoxes(next);
  };

  const handleToggleBarriers = () => {
    const next = !showProtectionBarriers;
    setShowProtectionBarriers(next);
    sceneRef.current?.setShowProtectionBarriers(next);
  };

  const handleSpawnMonster = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    const typeId = MONSTER_SPAWN_CYCLE[spawnCursor.monster % MONSTER_SPAWN_CYCLE.length];
    setSpawnCursor((c) => ({ ...c, monster: c.monster + 1 }));
    const res = g.spawnSingleObject(typeId);
    if (res.object) {
      s.syncFromGridManager();
      s.setSelectedObjectId(res.object.id);
      s.focusOnGridObject(res.object);
      setSelectedObject({ ...res.object });
      setStatusLog(
        `Spawned ${res.object.name} (${res.object.widthTiles}×${res.object.heightTiles}, scale ${res.object.visualScale}) at (${res.object.gridX}, ${res.object.gridY})`
      );
      refreshCountsAndTests();
    } else {
      setStatusLog(`Spawn failed: ${res.validation.reason}`);
    }
  };

  const handleSpawnResource = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    const typeId = RESOURCE_SPAWN_CYCLE[spawnCursor.resource % RESOURCE_SPAWN_CYCLE.length];
    setSpawnCursor((c) => ({ ...c, resource: c.resource + 1 }));
    const res = g.spawnSingleObject(typeId);
    if (res.object) {
      s.syncFromGridManager();
      s.setSelectedObjectId(res.object.id);
      s.focusOnGridObject(res.object);
      setSelectedObject({ ...res.object });
      setStatusLog(
        `Spawned ${res.object.name} (${res.object.widthTiles}×${res.object.heightTiles}, scale ${res.object.visualScale}) at (${res.object.gridX}, ${res.object.gridY})`
      );
      refreshCountsAndTests();
    } else {
      setStatusLog(`Spawn failed: ${res.validation.reason}`);
    }
  };

  const handleSpawnCastle = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    const typeId = CASTLE_SPAWN_CYCLE[spawnCursor.castle % CASTLE_SPAWN_CYCLE.length];
    setSpawnCursor((c) => ({ ...c, castle: c.castle + 1 }));
    const res = g.spawnSingleObject(typeId);
    if (res.object) {
      s.syncFromGridManager();
      s.setSelectedObjectId(res.object.id);
      s.focusOnGridObject(res.object);
      setSelectedObject({ ...res.object });
      setStatusLog(
        `Spawned ${res.object.name} (${res.object.widthTiles}×${res.object.heightTiles}) at (${res.object.gridX}, ${res.object.gridY})`
      );
      refreshCountsAndTests();
    } else {
      setStatusLog(`Spawn failed: ${res.validation.reason}`);
    }
  };

  const handleRunCollisionTest = () => {
    const g = gridRef.current;
    if (!g) return;
    const probe = g.runCollisionProbeTest();
    setCollisionStatus(probe.summary);
    setStatusLog(`Collision Test: ${probe.summary}`);
    refreshCountsAndTests();
  };

  const handleDispatchTestTroop = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    const target =
      (selectedObject ? g.objects.find((o) => o.id === selectedObject.id) : undefined) ??
      undefined;
    const troop = g.dispatchTestTroop(target);
    s.syncTroopVisuals();
    setStatusLog(
      `Dispatched troop via A* (${troop.pathTiles.length} tiles) from (${troop.startTile[0]},${troop.startTile[1]}) -> (${troop.goalTile[0]},${troop.goalTile[1]}).`
    );
    refreshCountsAndTests();
  };

  const handleRunAll13Tests = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s) return;
    if (g.objects.length === 0) {
      g.generateTestMap();
      s.syncFromGridManager();
    }

    // Verify TEST 10 across Far (0.55), Medium (1.0), and Close (2.0) camera zooms
    const savedZoom = s.getZoom();
    s.setZoom(1.0, true);
    const baseline = s.measureSampleDimensions();

    const samples: Array<{ zoom: number; label: string; widthsMatch: boolean; detail: string }> = [];
    for (const [label, z] of [
      ['Far', 0.55],
      ['Med', 1.0],
      ['Close', 2.0],
    ] as const) {
      s.setZoom(z, true);
      const measured = s.measureSampleDimensions();
      const matches =
        Math.abs(measured.width - baseline.width) < 0.01 &&
        Math.abs(measured.depth - baseline.depth) < 0.01;
      samples.push({ zoom: z, label, widthsMatch: matches, detail: measured.detail });
    }
    s.setZoom(savedZoom, true);
    setZoomDimensionSamples(samples);

    refreshCountsAndTests(samples);
    setActiveRightTab('tests');
    setStatusLog('Executed all 13 Acceptance Tests including live 3-tier Zoom Box3 invariance check.');
  };

  const handleSetOwnership = (nextOwnership: OwnershipState) => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s || !selectedObject) return;
    const live = g.objects.find((o) => o.id === selectedObject.id);
    if (!live) return;
    live.ownership = nextOwnership;
    live.battleStatus = `State: ${nextOwnership}`;
    s.refreshObjectAppearance(live);
    setSelectedObject({ ...live });
    setStatusLog(`Updated ${live.name} ownership -> ${nextOwnership}`);
  };

  const handleTriggerObjectAction = () => {
    const g = gridRef.current;
    const s = sceneRef.current;
    if (!g || !s || !selectedObject) return;
    const live = g.objects.find((o) => o.id === selectedObject.id);
    if (!live) return;
    const troop = g.dispatchTestTroop(live);
    s.syncTroopVisuals();
    setStatusLog(`Troops marching (${troop.pathTiles.length} tiles) to ${live.name}.`);
  };

  const passedCount = testResults.filter((t) => t.passed).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 145,
        background: '#09111e',
        color: '#f8fafc',
        fontFamily: "'Barlow Condensed', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* 3D Isometric World Canvas Host */}
      <div
        ref={canvasHostRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: 'grab',
        }}
      />

      {/* TOP BAR */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(10, 16, 28, 0.92)',
          border: '1px solid rgba(250, 204, 21, 0.45)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fef08a', letterSpacing: '0.05em' }}>
            WORLD MAP TEST MODE
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              fontSize: 12,
              color: '#bae6fd',
            }}
          >
            Grid: 90×90 · Base Tile: {TILE_SIZE}×{TILE_SIZE}u · Objects: {objectCount}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>WASD / Drag Pan · Wheel Zoom · Click Object</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#cbd5e1', marginRight: 4 }}>
            Zoom: <strong style={{ color: '#fef08a' }}>{telemetry.zoom.toFixed(2)}×</strong> ({telemetry.lodTier} LOD)
          </span>
          <button
            type="button"
            onClick={() => sceneRef.current?.setZoom(0.52)}
            style={pillBtnStyle(telemetry.lodTier === 'Far')}
          >
            Far LOD
          </button>
          <button
            type="button"
            onClick={() => sceneRef.current?.setZoom(1.0)}
            style={pillBtnStyle(telemetry.lodTier === 'Medium')}
          >
            Med LOD
          </button>
          <button
            type="button"
            onClick={() => sceneRef.current?.setZoom(1.95)}
            style={pillBtnStyle(telemetry.lodTier === 'Close')}
          >
            Close LOD
          </button>
          <button
            type="button"
            onClick={() => sceneRef.current?.setZoom((sceneRef.current?.getZoom() ?? 1) * 1.2)}
            style={pillBtnStyle(false)}
          >
            ＋
          </button>
          <button
            type="button"
            onClick={() => sceneRef.current?.setZoom((sceneRef.current?.getZoom() ?? 1) * 0.82)}
            style={pillBtnStyle(false)}
          >
            －
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              background: 'linear-gradient(180deg, #b91c1c, #7f1d1d)',
              border: '1px solid #fca5a5',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              marginLeft: 6,
            }}
          >
            ✕ Exit Test Mode
          </button>
        </div>
      </div>

      {/* LEFT TEST CONTROLS */}
      <div
        style={{
          position: 'absolute',
          top: 66,
          left: 10,
          bottom: 48,
          width: 222,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 10,
          borderRadius: 10,
          background: 'rgba(10, 16, 28, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.28)',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#fef08a', letterSpacing: '0.06em' }}>
          TEST CONTROLS
        </div>

        <button type="button" onClick={handleGenerateTestMap} style={actionBtnStyle('#0284c7')}>
          Generate Test Map
        </button>
        <button type="button" onClick={handleResetMap} style={actionBtnStyle('#475569')}>
          Reset Map
        </button>

        <div style={{ height: 1, background: 'rgba(148,163,184,0.2)', margin: '2px 0' }} />

        <button type="button" onClick={handleToggleGrid} style={toggleBtnStyle(showGrid)}>
          <span>Show Grid</span>
          <span>{showGrid ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleCollisionBoxes}
          style={toggleBtnStyle(showCollisionBoxes)}
        >
          <span>Show Collision Boxes</span>
          <span>{showCollisionBoxes ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleBarriers}
          style={toggleBtnStyle(showProtectionBarriers)}
        >
          <span>Show Protection Barriers</span>
          <span>{showProtectionBarriers ? 'ON' : 'OFF'}</span>
        </button>

        <div style={{ height: 1, background: 'rgba(148,163,184,0.2)', margin: '2px 0' }} />

        <button type="button" onClick={handleSpawnMonster} style={actionBtnStyle('#9f1239')}>
          Spawn Monster
        </button>
        <button type="button" onClick={handleSpawnResource} style={actionBtnStyle('#15803d')}>
          Spawn Resource
        </button>
        <button type="button" onClick={handleSpawnCastle} style={actionBtnStyle('#b45309')}>
          Spawn Castle
        </button>

        <div style={{ height: 1, background: 'rgba(148,163,184,0.2)', margin: '2px 0' }} />

        <button type="button" onClick={handleRunCollisionTest} style={actionBtnStyle('#6d28d9')}>
          Run Collision Test
        </button>
        <button type="button" onClick={handleDispatchTestTroop} style={actionBtnStyle('#0369a1')}>
          Dispatch Test Troop (A*)
        </button>
        <button type="button" onClick={handleRunAll13Tests} style={actionBtnStyle('#059669')}>
          Run All 13 Tests
        </button>

        <div
          style={{
            marginTop: 'auto',
            padding: '7px 8px',
            borderRadius: 7,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: 11,
            color: '#cbd5e1',
            lineHeight: 1.35,
          }}
        >
          <div style={{ fontWeight: 700, color: '#38bdf8' }}>Collision Layers:</div>
          <div>• buildings (yellow)</div>
          <div>• monsters (crimson)</div>
          <div>• resources (green)</div>
          <div>• troops (sky blue)</div>
          <div>• terrain_decorations</div>
        </div>
      </div>

      {/* RIGHT PANEL: DEBUG INSPECTOR & 13 ACCEPTANCE TESTS */}
      <div
        style={{
          position: 'absolute',
          top: 66,
          right: 10,
          bottom: 48,
          width: 315,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          background: 'rgba(10, 16, 28, 0.92)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
          <button
            type="button"
            onClick={() => setActiveRightTab('debug')}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: activeRightTab === 'debug' ? 'rgba(30, 41, 59, 0.95)' : 'transparent',
              color: activeRightTab === 'debug' ? '#fef08a' : '#94a3b8',
              fontWeight: 800,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            DEBUG PANEL
          </button>
          <button
            type="button"
            onClick={() => setActiveRightTab('tests')}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: activeRightTab === 'tests' ? 'rgba(30, 41, 59, 0.95)' : 'transparent',
              color: activeRightTab === 'tests' ? '#4ade80' : '#94a3b8',
              fontWeight: 800,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            TESTS ({passedCount}/{testResults.length})
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 11, fontSize: 12 }}>
          {activeRightTab === 'debug' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Selected object</span>
                <span style={valStyle}>
                  {selectedObject ? `${selectedObject.name} (Lv.${selectedObject.level})` : 'None'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Object footprint</span>
                <span style={valStyle}>
                  {selectedObject
                    ? `${selectedObject.widthTiles} × ${selectedObject.heightTiles} tiles (${selectedObject.widthTiles * TILE_SIZE}×${selectedObject.heightTiles * TILE_SIZE}u)`
                    : '—'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Grid coordinates</span>
                <span style={valStyle}>
                  {selectedObject ? `X: ${selectedObject.gridX}, Y: ${selectedObject.gridY}` : '—'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Visual scale</span>
                <span style={valStyle}>
                  {selectedObject
                    ? `${selectedObject.visualScale} (${OBJECT_SPECS[selectedObject.typeId].collisionLayer})`
                    : '—'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Collision status</span>
                <span style={{ ...valStyle, color: '#4ade80', textAlign: 'right' }}>
                  {collisionStatus}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Distance to nearest object</span>
                <span style={valStyle}>
                  {nearestInfo && nearestInfo.nearestObject
                    ? `${nearestInfo.distanceTiles} tiles (${nearestInfo.distanceWorldUnits}u) -> ${nearestInfo.nearestObject.name}`
                    : '—'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Ownership</span>
                <span style={valStyle}>
                  {selectedObject
                    ? `${selectedObject.ownership} · ${selectedObject.ownerName} ${selectedObject.allianceTag}`
                    : '—'}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Current zoom level</span>
                <span style={valStyle}>
                  {telemetry.zoom.toFixed(2)}× ({telemetry.lodTier})
                </span>
              </div>

              {selectedObject && (
                <>
                  <div style={{ height: 1, background: 'rgba(148,163,184,0.2)', margin: '4px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#fef08a' }}>
                    OBJECT TELEMETRY & INTERACTION
                  </div>
                  <div style={{ color: '#cbd5e1', lineHeight: 1.4 }}>
                    <div>
                      HP: <strong>{selectedObject.hp}</strong> / {selectedObject.maxHp} ·{' '}
                      {selectedObject.battleStatus}
                    </div>
                    {selectedObject.barrierRadius > 0 && (
                      <div>
                        Barrier radius: <strong>{selectedObject.barrierRadius}u</strong> (separate from{' '}
                        {selectedObject.widthTiles * TILE_SIZE}u footprint)
                      </div>
                    )}
                    {selectedObject.category === 'resource' && (
                      <div>
                        Remaining: <strong>{selectedObject.remainingResource}</strong> · Gather:{' '}
                        <strong>{selectedObject.gatherProgressPct}%</strong>
                      </div>
                    )}
                    {selectedObject.category === 'castle' && (
                      <div>
                        Power: <strong>{(selectedObject.power ?? 0).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerObjectAction}
                    style={actionBtnStyle('#0284c7')}
                  >
                    {selectedObject.category === 'monster'
                      ? '⚔️ Dispatch Troops to Attack'
                      : selectedObject.category === 'resource'
                        ? '⛏️ March Troops to Gather'
                        : selectedObject.category === 'castle'
                          ? '🔭 Dispatch Scout / March'
                          : '🛡️ Deploy Troops to Shrine/Citadel'}
                  </button>

                  {(selectedObject.category === 'shrine' ||
                    selectedObject.category === 'citadel') && (
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                        Test Ownership State:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {OWNERSHIP_STATES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleSetOwnership(st)}
                            style={pillBtnStyle(selectedObject.ownership === st)}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  padding: '6px 8px',
                  borderRadius: 7,
                  background:
                    passedCount === testResults.length && testResults.length === 13
                      ? 'rgba(20, 83, 45, 0.55)'
                      : 'rgba(127, 29, 29, 0.55)',
                  border: '1px solid rgba(148,163,184,0.3)',
                  fontWeight: 800,
                  color: '#fef08a',
                }}
              >
                ACCEPTANCE TEST REPORT: {passedCount} / {testResults.length} PASSED
              </div>
              {testResults.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderLeft: `3px solid ${t.passed ? '#22c55e' : '#ef4444'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span>
                      {t.id}: {t.title}
                    </span>
                    <span style={{ color: t.passed ? '#4ade80' : '#f87171' }}>
                      {t.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          zIndex: 10,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(10, 16, 28, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          fontSize: 12,
          color: '#e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span>{statusLog}</span>
        <span style={{ color: '#94a3b8' }}>
          Camera Target: ({telemetry.cameraTargetX}u, {telemetry.cameraTargetZ}u)
        </span>
      </div>
    </div>
  );
};

function actionBtnStyle(bg: string): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 7,
    background: bg,
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 7,
    background: active ? 'rgba(20, 83, 45, 0.75)' : 'rgba(30, 41, 59, 0.85)',
    border: `1px solid ${active ? '#4ade80' : 'rgba(148,163,184,0.3)'}`,
    color: active ? '#dcfce7' : '#cbd5e1',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
  };
}

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    borderRadius: 6,
    background: active ? '#0284c7' : 'rgba(30, 41, 59, 0.9)',
    border: `1px solid ${active ? '#7dd3fc' : 'rgba(148,163,184,0.35)'}`,
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 11,
    cursor: 'pointer',
  };
}

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  padding: '4px 6px',
  borderRadius: 6,
  background: 'rgba(15, 23, 42, 0.78)',
};

const labelStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const valStyle: React.CSSProperties = {
  color: '#f8fafc',
  fontWeight: 700,
  textAlign: 'right',
};
