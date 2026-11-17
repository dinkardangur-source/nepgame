import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WorldMap } from './game/WorldMap';
import { MapNavigationUI } from './components/MapNavigationUI';
import { WorldEntity, EntityAction, CastleSpawnData } from './game/WorldCoordinates';
import { InsideKingdomView } from './components/InsideKingdomView';
import { InsideKingdomState, MergeBuildingCategory } from './game/InsideKingdom3D';
import { StrategicWorldMapModal } from './components/StrategicWorldMapModal';

interface CombatFloater {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

interface BulletNotification {
  id: string;
  text: string;
  category: 'attack' | 'conquest' | 'monster' | 'rally';
  lane: number;
}

export const App: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const worldMapRef = useRef<WorldMap | null>(null);

  // View Mode: 'world' (World Map) or 'kingdom' (3D Walled Inside Kingdom Merge Courtyard)
  const [viewMode, setViewMode] = useState<'world' | 'kingdom'>('world');
  const [kingdomState, setKingdomState] = useState<InsideKingdomState | null>(null);

  // Randomized Castles (My Castle + 10 Alliance Member Castles + 6 Rival Enemy Castles) & Strategic WorldMap Modal / Filter
  const [castles, setCastles] = useState<CastleSpawnData[]>([]);
  const [conqueredPlots, setConqueredPlots] = useState<Record<string, 'neutral' | 'enemy' | 'alliance'>>({});
  const [isStrategicWorldMapOpen, setIsStrategicWorldMapOpen] = useState<boolean>(false);
  const [isStrategicFilterActive, setIsStrategicFilterActive] = useState<boolean>(false);

  // Live camera status (Default zoom 0.5016 corresponds to Zoom Out 84/100)
  const [cameraInfo, setCameraInfo] = useState<{ x: number; y: number; z: number; zoom: number }>({
    x: 800,
    y: 10.0,
    z: 768,
    zoom: 0.5016,
  });

  // Selected Entity and contextual screen anchor
  const [selectedEntity, setSelectedEntity] = useState<WorldEntity | null>(null);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Live Army State & 3D Coordinates
  const [armyPos, setArmyPos] = useState<[number, number, number]>([800, 10.0, 751]);
  const [armyStatusText, setArmyStatusText] = useState<string>('Garrisoned inside My Castle');
  const [armyProgressPct, setArmyProgressPct] = useState<number>(100);

  // Floating RPG Combat Numbers / Clash effects
  const [combatFloaters, setCombatFloaters] = useState<CombatFloater[]>([]);
  const [bulletNotifications, setBulletNotifications] = useState<BulletNotification[]>([]);
  const bulletLaneRef = useRef<number>(0);

  // Player Resource Vault
  const [resources, setResources] = useState({
    wood: 125400,
    stone: 98200,
    iron: 64500,
    food: 42800,
    gold: 18500,
    gems: 2450,
  });

  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const handlePushBullet = useCallback(
    (msg: { text: string; category: 'attack' | 'conquest' | 'monster' | 'rally' }) => {
      const id = `bullet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const lane = bulletLaneRef.current % 3;
      bulletLaneRef.current += 1;
      setBulletNotifications((prev) => [...prev.slice(-3), { id, ...msg, lane }]);
      setTimeout(() => {
        setBulletNotifications((prev) => prev.filter((b) => b.id !== id));
      }, 7200);
    },
    []
  );

  const handleEnterKingdom = useCallback(() => {
    setSelectedEntity(null);
    setSelectedScreenPos(null);
    setViewMode('kingdom');
    worldMapRef.current?.setSceneMode('kingdom');
    showToast('🏰 Entered 3D Walled Imperial Citadel — Click matching 3D buildings to merge!');
  }, [showToast]);

  const handleReturnToWorld = useCallback(() => {
    setViewMode('world');
    worldMapRef.current?.setSceneMode('world');
    showToast('🌍 Returned to Himalayan World Map (Zoom Out 85)');
  }, [showToast]);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      if (prev === 'world') {
        setSelectedEntity(null);
        setSelectedScreenPos(null);
        worldMapRef.current?.setSceneMode('kingdom');
        showToast('🏰 Entered 3D Walled Imperial Citadel — Click matching 3D buildings to merge!');
        return 'kingdom';
      } else {
        worldMapRef.current?.setSceneMode('world');
        showToast('🌍 Returned to Himalayan World Map (Zoom Out 85)');
        return 'world';
      }
    });
  }, [showToast]);

  const handleToggleStrategicFilter = useCallback(
    (enabled: boolean) => {
      setIsStrategicFilterActive(enabled);
      worldMapRef.current?.setStrategicFilterMode(enabled);
      showToast(
        enabled
          ? '🎯 3D World Filter ON: Showing ONLY The Congress, Shrines (A/B/C), Alliance Castles & My Castle!'
          : '🌍 3D World Filter OFF: Showing all Realm Monsters, Resources, Shrines & Castles'
      );
    },
    [showToast]
  );

  const handleRelocateCastles = useCallback(() => {
    if (!worldMapRef.current) return;
    if (viewMode === 'kingdom') {
      setViewMode('world');
      worldMapRef.current.setSceneMode('world');
    }
    const updated = worldMapRef.current.relocateCastles(true);
    setCastles([...updated]);
    const myCastle = updated.find((c) => c.isMyCastle);
    if (myCastle) {
      showToast(
        `🎲 Castles Relocated! My Castle spawned at [${myCastle.position[0]}, ${myCastle.position[2]}] alongside 10 Alliance Castles.`
      );
    }
  }, [viewMode, showToast]);

  const handleSpendResources = useCallback(
    (cost: { wood: number; stone: number; iron: number; food: number }): boolean => {
      if (
        resources.wood < cost.wood ||
        resources.stone < cost.stone ||
        resources.iron < cost.iron ||
        resources.food < cost.food
      ) {
        return false;
      }
      setResources((prev) => ({
        ...prev,
        wood: prev.wood - cost.wood,
        stone: prev.stone - cost.stone,
        iron: prev.iron - cost.iron,
        food: prev.food - cost.food,
      }));
      return true;
    },
    [resources]
  );

  const handleGrantInnerReward = useCallback(
    (
      type: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems',
      amount: number,
      buildingName: string
    ) => {
      setResources((prev) => ({
        ...prev,
        [type]: prev[type] + amount,
      }));
      showToast(`📦 Collected +${amount.toLocaleString()} ${type.toUpperCase()} from ${buildingName}!`);
    },
    [showToast]
  );

  const handleAddCombatFloater = useCallback((text: string, color: string, x: number, y: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    setCombatFloaters((prev) => [...prev, { id, text, color, x, y }]);
    setTimeout(() => {
      setCombatFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1600);
  }, []);

  const handleHarvestReward = useCallback((resourceType: string, amount: number) => {
    setResources((prev) => ({
      ...prev,
      [resourceType]: (prev[resourceType as keyof typeof prev] || 0) + amount,
    }));
    showToast(`📦 +${amount} ${resourceType.toUpperCase()} safely deposited into My Castle Vault!`);
  }, [showToast]);

  const handleMonsterDefeated = useCallback((monster: WorldEntity) => {
    setResources((prev) => ({
      ...prev,
      gold: prev.gold + 600,
      gems: prev.gems + 35,
    }));
    showToast(`💀 VICTORY! ${monster.name} defeated! +600 Gold and +35 Gems secured!`);
  }, [showToast]);

  const handleStructureConquered = useCallback(
    (entity: WorldEntity, buffLabel: string) => {
      setConqueredPlots((prev) => ({ ...prev, [entity.id]: 'alliance' }));
      setResources((prev) => ({
        ...prev,
        gold: prev.gold + (entity.subtype === 'congress' ? 5000 : 1500),
        gems: prev.gems + (entity.subtype === 'congress' ? 300 : 80),
      }));
      showToast(`👑 CONQUERED! ${entity.name} claimed for Alliance (${buffLabel})!`);
    },
    [showToast]
  );

  const handleEnemyCastleDefeated = useCallback(
    (castleEntity: WorldEntity) => {
      setResources((prev) => ({
        ...prev,
        wood: prev.wood + 8000,
        stone: prev.stone + 6500,
        gold: prev.gold + 2500,
        gems: prev.gems + 120,
      }));
      showToast(`🔥 PLUNDERED! ${castleEntity.name} fallen! +2,500 Gold, +120 Gems & War Spoils seized!`);
    },
    [showToast]
  );

  const handleArmyStatusUpdate = useCallback((desc: string, progress: number, _timerText: string, updatedArmyPos?: [number, number, number]) => {
    setArmyStatusText(desc);
    setArmyProgressPct(progress);
    if (updatedArmyPos) {
      setArmyPos(updatedArmyPos);
    }
  }, []);

  // Troop action dispatcher: Attack, Mine, Rally, Scout, Garrison, Upgrade
  const handleExecuteAction = useCallback((target: WorldEntity, action: EntityAction) => {
    if (!worldMapRef.current) return;

    worldMapRef.current.dispatchTroops(target, action);

    if (action === 'attack' || action === 'rally') {
      showToast(`⚔️ Dispatched Vanguard battalion from My Castle to assault ${target.name}!`);
    } else if (action === 'mine') {
      showToast(`⛏️ Work party mobilized from My Castle to harvest ${target.name}!`);
    } else if (action === 'scout') {
      showToast(`🦅 Falcon scout recon mission complete for ${target.name}!`);
    } else if (action === 'garrison') {
      showToast(`🛡️ Royal guard reinforced at ${target.name}!`);
    } else if (action === 'upgrade') {
      showToast(`🔨 Imperial architects scheduled upgrades for ${target.name}!`);
    }
  }, [showToast]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Initialize the master 3D WorldMap
    const wm = new WorldMap({
      container,
      onCameraUpdate: (info) => {
        setCameraInfo(info);
      },
      onSelectEntity: (entity, screenPos) => {
        setSelectedEntity(entity);
        setSelectedScreenPos(screenPos);
      },
      onAddCombatFloater: handleAddCombatFloater,
      onArmyStatusUpdate: handleArmyStatusUpdate,
      onHarvestReward: handleHarvestReward,
      onMonsterDefeated: handleMonsterDefeated,
      onStructureConquered: handleStructureConquered,
      onEnemyCastleDefeated: handleEnemyCastleDefeated,
      onBulletNotify: handlePushBullet,
      onEnterKingdom: handleEnterKingdom,
      onInsideKingdomStateChange: (state) => {
        setKingdomState(state);
      },
      onCastlesUpdated: (updatedCastles) => {
        setCastles([...updatedCastles]);
      },
    });

    worldMapRef.current = wm;
    setKingdomState(wm.getInsideKingdomState());
    setCastles([...wm.getCastlesList()]);

    return () => {
      wm.dispose();
      worldMapRef.current = null;
    };
  }, [
    handleAddCombatFloater,
    handleArmyStatusUpdate,
    handleHarvestReward,
    handleMonsterDefeated,
    handleStructureConquered,
    handleEnemyCastleDefeated,
    handlePushBullet,
    handleEnterKingdom,
  ]);

  return (
    <div
      className="strategy-game-app"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#0a0e14',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* 1. Main 3D WebGL Canvas Container */}
      <div
        ref={mapContainerRef}
        id="worldCanvasContainer"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: 'grab',
          touchAction: 'none',
        }}
      />

      {/* 2. 3D Inside Kingdom Merge Courtyard HUD (When in Kingdom View) */}
      {viewMode === 'kingdom' && (
        <InsideKingdomView
          kingdomState={kingdomState}
          resources={resources}
          onSpendResources={handleSpendResources}
          onGrantReward={handleGrantInnerReward}
          onSelectPlot={(plotId) => worldMapRef.current?.selectInsidePlot(plotId)}
          onMergeSelected={() => worldMapRef.current?.mergeSelectedInsideBuilding() || false}
          onAutoMergeAll={() => worldMapRef.current?.autoMergeInsideKingdom() || 0}
          onConstructBuilding={(cat: MergeBuildingCategory, prefPlotId?: string) =>
            Boolean(worldMapRef.current?.constructInsideBuilding(cat, prefPlotId))
          }
          onUpgradeKeep={() => worldMapRef.current?.upgradeInsideImperialKeep() || false}
          onShowToast={showToast}
          onReturnToWorld={handleReturnToWorld}
        />
      )}

      {/* 2B. Strategic WorldMap Modal (Shows ONLY Towers, Shrines, Emperor Congress Citadel, Alliance Castles & My Castle) */}
      <StrategicWorldMapModal
        isOpen={isStrategicWorldMapOpen}
        onClose={() => setIsStrategicWorldMapOpen(false)}
        castles={castles}
        conqueredPlots={conqueredPlots}
        cameraInfo={cameraInfo}
        isStrategicFilterActive={isStrategicFilterActive}
        onToggleStrategicFilter={handleToggleStrategicFilter}
        onRelocateCastles={handleRelocateCastles}
        onPanToLocation={(x, z, label) => {
          if (viewMode === 'kingdom') {
            setViewMode('world');
            worldMapRef.current?.setSceneMode('world');
          }
          worldMapRef.current?.panTo(x, z);
          if (label) {
            showToast(`🎯 Camera focused on ${label} [${Math.round(x)}, ${Math.round(z)}]`);
          }
        }}
        onEnterMyCastle={handleEnterKingdom}
      />

      {/* 3. Strategy Game HUD, Single Castle/World Button, WorldMap Button, Zoom Out 100 & 1x1 Troop Selector Overlay */}
      <MapNavigationUI
        cameraInfo={cameraInfo}
        onPanTo={(x, z) => {
          if (viewMode === 'kingdom') {
            setViewMode('world');
            worldMapRef.current?.setSceneMode('world');
          }
          worldMapRef.current?.panTo(x, z);
        }}
        onZoomIn={() => worldMapRef.current?.zoomIn()}
        onZoomOut={() => worldMapRef.current?.zoomOut()}
        onZoomOut100={() => {
          if (viewMode === 'kingdom') {
            setViewMode('world');
            worldMapRef.current?.setSceneMode('world');
          }
          worldMapRef.current?.zoomOutTo100();
          showToast('🔍 Zoom Out 100: Full Himalayan Realm Strategic Overview');
        }}
        onResetHome={() => {
          if (viewMode === 'kingdom') {
            worldMapRef.current?.focusInsideKingdom();
          } else {
            worldMapRef.current?.resetCamera();
          }
        }}
        onSetZoom={(z) => worldMapRef.current?.setZoom(z)}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        castles={castles}
        isStrategicFilterActive={isStrategicFilterActive}
        onToggleStrategicFilter={handleToggleStrategicFilter}
        onOpenStrategicWorldMap={() => setIsStrategicWorldMapOpen(true)}
        onRelocateCastles={handleRelocateCastles}
        selectedEntity={selectedEntity}
        selectedScreenPos={selectedScreenPos}
        onExecuteAction={handleExecuteAction}
        onCloseSelection={() => {
          setSelectedEntity(null);
          setSelectedScreenPos(null);
        }}
        armyPos={armyPos}
        armyStatusText={armyStatusText}
        armyProgressPct={armyProgressPct}
        resources={resources}
        conqueredPlots={conqueredPlots}
        onGrantReward={handleGrantInnerReward}
        onShowToast={showToast}
      />

      {/* 4. Floating Combat Hit Numbers & Clash Sparks Overlay */}
      {combatFloaters.map((floater) => (
        <div
          key={floater.id}
          style={{
            position: 'absolute',
            left: `${floater.x}px`,
            top: `${floater.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 75,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: '15px',
            color: floater.color,
            textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.8)',
            letterSpacing: '0.04em',
            animation: 'combatFloatUp 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {floater.text}
        </div>
      ))}

      {/* 4B. Live Scrolling Bullet Notification Ticker (Battle, Rally, Monster & Conquest Feed) */}
      {bulletNotifications.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '112px',
            left: 0,
            right: 0,
            height: '86px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 70,
          }}
        >
          {bulletNotifications.map((item) => {
            const accent =
              item.category === 'conquest'
                ? '#10b981'
                : item.category === 'rally'
                  ? '#facc15'
                  : item.category === 'attack'
                    ? '#ef4444'
                    : '#f97316';
            const textCol =
              item.category === 'conquest'
                ? '#a7f3d0'
                : item.category === 'rally'
                  ? '#fef08a'
                  : '#fecaca';
            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  top: `${item.lane * 28}px`,
                  left: 0,
                  whiteSpace: 'nowrap',
                  background: 'rgba(10, 16, 28, 0.88)',
                  borderLeft: `3px solid ${accent}`,
                  borderTop: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.14)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '4px',
                  padding: '3px 12px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.03em',
                  color: textCol,
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.95)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.55)',
                  animation: 'bulletGlide 7.1s linear forwards',
                }}
              >
                {item.text}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Floating Toast Notification */}
      {toastText && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #dfba6e',
            color: '#fef08a',
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 99,
            pointerEvents: 'none',
            transition: 'bottom 0.25s ease',
          }}
        >
          {toastText}
        </div>
      )}

      {/* CSS Keyframes for Combat Floaters & Scrolling Bullet Ticker */}
      <style>{`
        @keyframes combatFloatUp {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -18px) scale(1.15);
          }
          75% {
            opacity: 0.9;
            transform: translate(-50%, -42px) scale(1.0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -64px) scale(0.9);
          }
        }
        @keyframes bulletGlide {
          0% {
            transform: translateX(100vw);
            opacity: 0.95;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            transform: translateX(-110%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default App;

