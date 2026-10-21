import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Resources,
  UnitCounts,
  ArmyState,
  InteractiveObject,
  TrainingQueueItem,
  KingdomBuilding,
  Blueprint,
  CombatFloater,
  ToastMessage,
} from './types/game';
import {
  INITIAL_RESOURCES,
  INITIAL_UNITS,
  PROVINCES,
  INITIAL_BUILDINGS,
  INITIAL_BLUEPRINTS,
} from './data/initialData';
import { Minimap } from './components/Minimap';
import { ObjectHud } from './components/ObjectHud';
import { RadialTroopDial } from './components/RadialTroopDial';
import { ScoutReportModal } from './components/ScoutReportModal';
import { BuildingsModal } from './components/BuildingsModal';
import { ImageStudioModal } from './components/ImageStudioModal';
import { VeoModal } from './components/VeoModal';
import { TacticalChatDock } from './components/TacticalChatDock';
import { WorldSearchRadar } from './components/WorldSearchRadar';
import { AllianceRallyModal } from './components/AllianceRallyModal';
import { GameCanvas } from './game/GameCanvas';

interface LogEntry {
  id: string;
  icon: string;
  title: string;
  desc: string;
  time: string;
}

export const App: React.FC = () => {
  // Core game states
  const [resources, setResources] = useState<Resources>(INITIAL_RESOURCES);
  const [units, setUnits] = useState<UnitCounts>(INITIAL_UNITS);
  const [armyHealth, setArmyHealth] = useState(100);
  const [armyState, setArmyState] = useState<ArmyState>('IDLE');
  const [armyPortraitUrl, setArmyPortraitUrl] = useState('/assets/images/magar_infantry_tpose.jpg');

  // Mission state
  const [missionDesc, setMissionDesc] = useState('Your army is awaiting orders at the citadel gate.');
  const [missionProgress, setMissionProgress] = useState(0);
  const [missionTimerText, setMissionTimerText] = useState('No active mission');
  const [activeTarget, setActiveTarget] = useState<InteractiveObject | null>(null);

  // Training queue
  const [trainingQueue, setTrainingQueue] = useState<TrainingQueueItem[]>([]);

  // Buildings & blueprints
  const [buildings, setBuildings] = useState<KingdomBuilding[]>(INITIAL_BUILDINGS);
  const [blueprints, setBlueprints] = useState<Blueprint[]>(INITIAL_BLUEPRINTS);

  // Selected territory & objects
  const [currentProvince, setCurrentProvince] = useState<string>('valley');
  const [selectedObject, setSelectedObject] = useState<InteractiveObject | null>(null);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [allObjects, setAllObjects] = useState<InteractiveObject[]>([]);

  // Camera & view controls
  const [cameraPan, setCameraPan] = useState<{ x: number; z: number }>({ x: 14, z: -10 });
  const [zoom, setZoom] = useState(1.0);

  // Minimap & UI toggles
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
  const [isPanelsVisible, setIsPanelsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<'attack' | 'gather'>('attack');
  const [isScoutReportOpen, setIsScoutReportOpen] = useState(false);
  const [isBuildingsOpen, setIsBuildingsOpen] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [isVeoOpen, setIsVeoOpen] = useState(false);
  const [isSearchRadarOpen, setIsSearchRadarOpen] = useState(false);
  const [isRallyModalOpen, setIsRallyModalOpen] = useState(false);
  const [rallyTarget, setRallyTarget] = useState<InteractiveObject | null>(null);
  const [lastCombatChatEvent, setLastCombatChatEvent] = useState<string | null>(null);

  // Floating feedback
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-0',
      icon: '✦',
      title: 'Realm Command Initialized',
      desc: 'Magar Vanguard regiment assembled under Lord Dangol.',
      time: 'NOW',
    },
  ]);
  const [combatFloaters, setCombatFloaters] = useState<CombatFloater[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const snapshotFnRef = useRef<(() => string | null) | null>(null);
  const damageMonsterIn3DRef = useRef<((monsterId: string, damage: number, forceFatal?: boolean) => { remainingHp: number; isDead: boolean }) | null>(null);

  // Calculate Army Power dynamically
  const armyPower = units.infantry * 85 + units.cavalry * 220 + units.archer * 140;

  // Add toast helper
  const addToast = useCallback((text: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Add log helper
  const addLog = useCallback((title: string, desc: string, icon = '✦') => {
    const id = `log-${Date.now()}-${Math.random()}`;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setLogs((prev) => [{ id, icon, title, desc, time: timeStr }, ...prev.slice(0, 19)]);
  }, []);

  // Add combat floater helper
  const addCombatFloater = useCallback((text: string, color = '#dfba6e', x = 0, y = 0) => {
    const id = `floater-${Date.now()}-${Math.random()}`;
    setCombatFloaters((prev) => [...prev, { id, text, color, x, y }]);
    setTimeout(() => {
      setCombatFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1800);
  }, []);

  // Check how many upgrades are currently affordable
  const readyUpgradesCount = buildings.filter((b) => {
    return (
      resources.wood >= b.cost.wood &&
      resources.stone >= b.cost.stone &&
      resources.iron >= b.cost.iron &&
      resources.food >= b.cost.food &&
      b.level < b.maxLevel
    );
  }).length;

  // Training queue recruitment tick
  useEffect(() => {
    if (trainingQueue.length === 0) return;

    const interval = setInterval(() => {
      setTrainingQueue((prev) => {
        if (prev.length === 0) return prev;
        const current = { ...prev[0] };
        current.timeRemaining -= 0.5;

        if (current.timeRemaining <= 0) {
          // Recruit complete!
          setUnits((u) => ({
            ...u,
            [current.unit]: u[current.unit] + current.count,
          }));
          addToast(`Training complete: +${current.count} ${current.name}!`);
          addLog(
            'Recruits Graduated',
            `+${current.count} ${current.name} deployed to Magar Vanguard.`,
            '⚔️'
          );
          return prev.slice(1);
        }
        return [current, ...prev.slice(1)];
      });
    }, 500);

    return () => clearInterval(interval);
  }, [trainingQueue, addToast, addLog]);

  // Passive resource income tick (every 8 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setResources((prev) => {
        // Compute passive income from buildings & blueprints
        const woodBonus = 8;
        const stoneBonus = 6;
        const ironBonus = 4;
        const foodBonus = 12;

        return {
          wood: prev.wood + woodBonus,
          stone: prev.stone + stoneBonus,
          iron: prev.iron + ironBonus,
          food: prev.food + foodBonus,
        };
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Train Recruits Handler
  const handleTrainUnit = (unit: 'infantry' | 'cavalry' | 'archer', count: number) => {
    const costMap = {
      infantry: { food: 60 * count, iron: 30 * count, wood: 0, stone: 0, name: 'Magar Infantry', time: 4 * count },
      cavalry: { food: 120 * count, iron: 75 * count, wood: 0, stone: 0, name: 'Mountain Cavalry', time: 7 * count },
      archer: { food: 80 * count, iron: 0, wood: 45 * count, stone: 0, name: 'Himalayan Archer', time: 5 * count },
    };

    const cost = costMap[unit];
    if (
      resources.food < cost.food ||
      resources.iron < cost.iron ||
      resources.wood < cost.wood
    ) {
      addToast('Insufficient resources for troop recruitment!');
      return;
    }

    // Deduct resources
    setResources((prev) => ({
      ...prev,
      food: prev.food - cost.food,
      iron: prev.iron - cost.iron,
      wood: prev.wood - cost.wood,
    }));

    const queueItem: TrainingQueueItem = {
      id: `train-${Date.now()}-${Math.random()}`,
      unit,
      count,
      name: cost.name,
      totalTime: cost.time,
      timeRemaining: cost.time,
    };

    setTrainingQueue((prev) => [...prev, queueItem]);
    addToast(`Queued ${count} ${cost.name} at Citadel Barracks`);
  };

  // Object Selection Handler
  const handleSelectObject = (
    obj: InteractiveObject | null,
    screenPos: { x: number; y: number } | null
  ) => {
    setSelectedObject(obj);
    setSelectedScreenPos(screenPos);
  };

  // Province change -> smooth camera pan
  const handleSelectProvince = (provId: string) => {
    setCurrentProvince(provId);
    const prov = PROVINCES[provId];
    if (prov) {
      setCameraPan({ x: -prov.center[0], z: -prov.center[2] });
      addToast(`Focused territory: ${prov.name}`);
    }
  };

  // Mission lifecycle
  const handleDispatchConfirm = (dispatched: UnitCounts) => {
    if (!selectedObject) return;
    setActiveTarget(selectedObject);

    // Frame camera between Citadel Gate and Target so player clearly witnesses troops departing and marching
    const midX = (-10.5 + selectedObject.position[0]) / 2;
    const midZ = (13.5 + selectedObject.position[2]) / 2;
    setCameraPan({ x: -midX, z: -midZ });

    if (dispatchMode === 'attack') {
      setArmyState('ATTACKING');
      setMissionDesc(`Marching to assault ${selectedObject.name}...`);
      setMissionProgress(5);
      setMissionTimerText('Marching');
      addToast(`Magar Vanguard battalion marching to assault ${selectedObject.name}!`);
      addLog(
        'Expedition Launched',
        `Assaulting ${selectedObject.name} (Lv.${selectedObject.level}) with ${dispatched.infantry + dispatched.cavalry + dispatched.archer} troops.`,
        '⚔️'
      );
      setLastCombatChatEvent(
        `Vanguard battalion dispatched to assault ${selectedObject.name} (Lv.${selectedObject.level}). Real-time strike imminent upon arrival!`
      );
    } else {
      setArmyState('GATHERING');
      setMissionDesc(`Marching to harvest at ${selectedObject.name}...`);
      setMissionProgress(5);
      setMissionTimerText('Marching');
      addToast(`Workforce deployed to harvest ${selectedObject.name}!`);
      addLog(
        'Harvest Commenced',
        `Workers deployed to gather at ${selectedObject.name} (Lv.${selectedObject.level}).`,
        '⛏️'
      );
      setLastCombatChatEvent(
        `Workforce deployed to harvest ${selectedObject.name} (Lv.${selectedObject.level}).`
      );
    }
  };

  // Radar Selection & Quick Dispatch
  const handleSelectAndLocate = (obj: InteractiveObject) => {
    handleSelectObject(obj, { x: window.innerWidth / 2, y: window.innerHeight / 2 - 30 });
    setCameraPan({ x: -obj.position[0], z: -obj.position[2] });
    addToast(`Radar locked onto ${obj.name} (Lv.${obj.level})`);
  };

  const handleQuickDispatchFromRadar = (obj: InteractiveObject, mode: 'attack' | 'gather') => {
    handleSelectObject(obj, { x: window.innerWidth / 2, y: window.innerHeight / 2 - 30 });
    setCameraPan({ x: -obj.position[0], z: -obj.position[2] });
    setDispatchMode(mode);
    setIsDispatchOpen(true);
  };


  // Quick strike damage trigger (testing damage white flash & zero HP smoke transformation)
  const handleQuickStrike = (targetObj: InteractiveObject) => {
    if (!damageMonsterIn3DRef.current) return;
    const res = damageMonsterIn3DRef.current(targetObj.id, 45, false);
    if (res.isDead) {
      addToast(`${targetObj.name} reached 0 HP and turned into smoke in the air!`);
      addLog('Monster Slain', `${targetObj.name} reached 0 HP - dissolved into 3D smoke in the air!`, '💨');
      setSelectedObject((prev) => (prev && prev.id === targetObj.id ? { ...prev, health: 0, isDefeated: true } : prev));
    } else {
      addToast(`${targetObj.name} took damage (-45 HP)! White flash triggered.`);
      setSelectedObject((prev) => (prev && prev.id === targetObj.id ? { ...prev, health: res.remainingHp } : prev));
    }
  };

  // Fast Scout reconnaissance mission
  const handleScoutTarget = () => {
    if (!selectedObject) return;
    addToast(`Scout rider dispatched to reconnoiter ${selectedObject.name}...`);
    addCombatFloater('👁️ SCOUT RIDER', '#4fa3d1', window.innerWidth / 2, window.innerHeight / 2);

    setTimeout(() => {
      setIsScoutReportOpen(true);
      addToast('Tactical intelligence report received!');
      addLog('Scout Report', `Recon completed on ${selectedObject.name}.`, '👁️');
    }, 1200);
  };

  // Alliance Rally Handler
  const handleOpenRallyModal = (target: InteractiveObject | null) => {
    if (!target) return;
    setRallyTarget(target);
    setIsRallyModalOpen(true);
  };

  const handleConfirmRally = (rallyData: { totalPower: number; captains: string[] }) => {
    if (!rallyTarget) return;
    setActiveTarget(rallyTarget);
    setArmyState('ATTACKING');

    // Frame camera between Citadel Gate and Target so player witnesses rally march
    const midX = (-10.5 + rallyTarget.position[0]) / 2;
    const midZ = (13.5 + rallyTarget.position[2]) / 2;
    setCameraPan({ x: -midX, z: -midZ });

    setMissionDesc(`Alliance War Rally marching to assault ${rallyTarget.name}...`);
    setMissionProgress(10);
    setMissionTimerText('Rally Marching');
    addToast(`🚩 ALLIANCE RALLY LAUNCHED! 3 Captains marching to assault ${rallyTarget.name}!`);
    addCombatFloater('🚩 ALLIANCE RALLY!', '#f59e0b', window.innerWidth / 2, window.innerHeight / 2 - 40);
    addLog(
      'Alliance Rally Dispatched',
      `Coordinated Alliance Rally launched against ${rallyTarget.name} (Lv.${rallyTarget.level}) with ${rallyData.totalPower} combined power (${rallyData.captains.join(', ')}).`,
      '🚩'
    );
    setLastCombatChatEvent(
      `🚩 ALLIANCE WAR RALLY DISPATCHED! All captains converged to assault ${rallyTarget.name} (Lv.${rallyTarget.level}). War horn sounded!`
    );
  };

  // Garrison Tower Handler
  const handleGarrisonTower = (target: InteractiveObject | null) => {
    if (!target) return;
    setActiveTarget(target);
    setArmyState('MARCHING');
    addToast(`Garrison reinforcement dispatched to fortify ${target.name}!`);
    addCombatFloater('🛡️ GARRISON DEPLOYED', '#38bdf8', window.innerWidth / 2, window.innerHeight / 2);
    setMissionDesc(`Reinforcements marching to garrison ${target.name}...`);
    setMissionProgress(20);
    setMissionTimerText('Garrisoning');
    addLog('Tower Fortified', `Sent Vanguard garrison to station at ${target.name}.`, '🛡️');
  };

  // Direct march order
  const handleMarchToTarget = () => {
    if (!selectedObject) {
      addToast('Select a destination coordinate or object first.');
      return;
    }
    setActiveTarget(selectedObject);
    setArmyState('MARCHING');
    setMissionDesc(`Force marching to coordinates (${selectedObject.position[0]}, ${selectedObject.position[2]})...`);
    setMissionProgress(40);
    setMissionTimerText('3.5s remaining');
    addToast(`Vanguard marching to ${selectedObject.name}!`);

    setTimeout(() => {
      setArmyState('IDLE');
      setMissionDesc(`Force arrived at ${selectedObject.name}.`);
      setMissionProgress(0);
      setMissionTimerText('Awaiting next order');
      addToast(`Force stationed at ${selectedObject.name}.`);
    }, 3500);
  };

  // Direct recall order
  const handleRecallArmy = () => {
    setActiveTarget(null);
    setArmyState('RETURNING');
    setMissionDesc('Vanguard recalled back to Gorkha Citadel.');
    setMissionProgress(50);
    setMissionTimerText('2.5s returning');
    addToast('Recalling all regiments to citadel!');

    setTimeout(() => {
      setArmyState('IDLE');
      setMissionDesc('Your army is awaiting orders at the citadel gate.');
      setMissionProgress(0);
      setMissionTimerText('No active mission');
      addToast('Army rallied at home citadel.');
    }, 2500);
  };

  // Building Upgrade
  const handleUpgradeBuilding = (buildingId: string) => {
    const b = buildings.find((x) => x.id === buildingId);
    if (!b) return;

    if (
      resources.wood < b.cost.wood ||
      resources.stone < b.cost.stone ||
      resources.iron < b.cost.iron ||
      resources.food < b.cost.food
    ) {
      addToast('Insufficient assets for structure upgrade!');
      return;
    }

    setResources((prev) => ({
      wood: prev.wood - b.cost.wood,
      stone: prev.stone - b.cost.stone,
      iron: prev.iron - b.cost.iron,
      food: prev.food - b.cost.food,
    }));

    setBuildings((prev) =>
      prev.map((item) =>
        item.id === buildingId
          ? {
              ...item,
              level: item.level + 1,
              cost: {
                wood: Math.floor(item.cost.wood * 1.25),
                stone: Math.floor(item.cost.stone * 1.25),
                iron: Math.floor(item.cost.iron * 1.25),
                food: Math.floor(item.cost.food * 1.25),
              },
            }
          : item
      )
    );

    addToast(`Upgraded ${b.name} to Level ${b.level + 1}!`);
    addLog('Architecture Upgraded', `${b.name} reached Level ${b.level + 1}.`, '🏛️');
  };

  // Blueprint Construction
  const handleConstructBlueprint = (blueprintId: string) => {
    const bp = blueprints.find((x) => x.id === blueprintId);
    if (!bp || bp.constructed) return;

    if (
      resources.wood < bp.cost.wood ||
      resources.stone < bp.cost.stone ||
      resources.iron < bp.cost.iron ||
      resources.food < bp.cost.food
    ) {
      addToast('Insufficient assets to construct blueprint!');
      return;
    }

    setResources((prev) => ({
      wood: prev.wood - bp.cost.wood,
      stone: prev.stone - bp.cost.stone,
      iron: prev.iron - bp.cost.iron,
      food: prev.food - bp.cost.food,
    }));

    setBlueprints((prev) =>
      prev.map((item) => (item.id === blueprintId ? { ...item, constructed: true } : item))
    );

    addToast(`Constructed ${bp.name}! Benefit activated.`);
    addLog('Blueprint Built', `Constructed ${bp.name}. Yield bonus: ${bp.benefit}.`, '🏗️');
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'm' || e.key === 'M') {
        handleMarchToTarget();
      } else if (e.key === 'g' || e.key === 'G') {
        if (selectedObject?.type === 'resource') {
          setDispatchMode('gather');
          setIsDispatchOpen(true);
        } else {
          addToast('Select a resource node to gather [G]');
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (selectedObject?.type === 'monster') {
          setDispatchMode('attack');
          setIsDispatchOpen(true);
        } else {
          addToast('Select a monster or threat to attack [A]');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handleRecallArmy();
      } else if (e.key === 'b' || e.key === 'B') {
        setIsBuildingsOpen((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setIsPanelsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObject]);

  return (
    <div className={`app-shell ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <main className="layout">
        <section className="map-area">
          <div className="map-toolbar">
            <div className="map-title">
              <span className="map-pin">⌖</span>
              <div>
                <h2>{PROVINCES[currentProvince]?.name || 'Himalayan Mainland Kingdom'}</h2>
                <p>{PROVINCES[currentProvince]?.subtitle || 'UNIFIED GREATER REALM'}</p>
              </div>
            </div>

            {/* Clear HUD Resources */}
            <div className="clear-hud-resources">
              <div className="resource">
                <span className="resource-icon wood">♣</span>
                <span>
                  <b>{resources.wood.toLocaleString()}</b>
                  <small>WOOD</small>
                </span>
              </div>
              <div className="resource">
                <span className="resource-icon stone">◆</span>
                <span>
                  <b>{resources.stone.toLocaleString()}</b>
                  <small>STONE</small>
                </span>
              </div>
              <div className="resource">
                <span className="resource-icon iron">⬟</span>
                <span>
                  <b>{resources.iron.toLocaleString()}</b>
                  <small>IRON</small>
                </span>
              </div>
              <div className="resource">
                <span className="resource-icon food">✦</span>
                <span>
                  <b>{resources.food.toLocaleString()}</b>
                  <small>FOOD</small>
                </span>
              </div>
            </div>

            {/* Permanent Clear Skies Atmosphere */}
            <div className="weather-widget permanent-clear" title="Atmosphere: Azure Sunshine across Unified Mainland">
              <span className="weather-icon">☀️</span>
              <div className="weather-details">
                <div className="weather-header">
                  <b>Clear Skies</b>
                  <span className="weather-tag">PERMANENT</span>
                </div>
                <small>Speed 100% · Gather 100%</small>
              </div>
            </div>

            <div className="map-tools">
              <button
                className="tool-action-btn"
                onClick={() => setIsBuildingsOpen(true)}
                title="Building Asset Requirements & Blueprints [B]"
              >
                <span>🏛️</span>
                <span>Buildings</span>
                {readyUpgradesCount > 0 && (
                  <span
                    className="badge-req"
                    style={{
                      marginLeft: '4px',
                      background: 'linear-gradient(135deg,#286e42,#174427)',
                    }}
                  >
                    {readyUpgradesCount}
                  </span>
                )}
              </button>

              <button
                className="tool-action-btn"
                onClick={() => setIsImageStudioOpen(true)}
                title="Create & Edit Character Art (Nano Banana 2.1)"
              >
                <span>🎨</span>
                <span>AI Art</span>
              </button>

              <button
                className="tool-action-btn"
                onClick={() => setIsVeoOpen(true)}
                title="Animate Video (Veo 3.1 Fast)"
              >
                <span>🎥</span>
                <span>Veo</span>
              </button>

              <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom out">
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))} title="Zoom in">
                +
              </button>
              <button
                onClick={() => {
                  setCameraPan({ x: 14, z: -10 });
                  setZoom(1.0);
                }}
                title="Reset view"
              >
                ⌂
              </button>
              <button onClick={() => setIsMinimapOpen(!isMinimapOpen)} title="Toggle Kingdom Minimap [M]">
                🗺️
              </button>
              <button
                className={`tool-action-btn ${isSearchRadarOpen ? 'active' : ''}`}
                onClick={() => setIsSearchRadarOpen(!isSearchRadarOpen)}
                title="Search Resources & Monsters Lv 1-5 (3D Radar)"
              >
                <span>🧭</span>
                <span>3D Radar</span>
              </button>

              <button
                className={`tool-action-btn ${armyState !== 'IDLE' ? 'active' : ''}`}
                onClick={() => {
                  if (activeTarget && armyState !== 'IDLE') {
                    const midX = (-10.5 + activeTarget.position[0]) / 2;
                    const midZ = (13.5 + activeTarget.position[2]) / 2;
                    setCameraPan({ x: -midX, z: -midZ });
                    addToast('Centered camera on marching Vanguard');
                  } else {
                    setCameraPan({ x: 10.5, z: -13.5 });
                    addToast('Centered on Citadel Gate & Vanguard');
                  }
                }}
                title="Track Magar Vanguard Troops across Map"
              >
                <span>🎖️</span>
                <span>Troops</span>
              </button>

              <button
                className="btn-tool-accent"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title="Fullscreen Realm [F]"
              >
                ⛶ Fullscreen
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 62px - 35px)' }}>
            <GameCanvas
              onSelectObject={handleSelectObject}
              armyState={armyState}
              activeTarget={activeTarget}
              onMissionProgressUpdate={(progress, desc, timerText) => {
                setMissionProgress(progress);
                setMissionDesc(desc);
                if (timerText) setMissionTimerText(timerText);
              }}
              onArmyReturnHome={() => {
                setArmyState('IDLE');
                setActiveTarget(null);
                setMissionDesc('Your army is awaiting orders at the citadel gate.');
                setMissionProgress(0);
                setMissionTimerText('No active mission');
              }}
              onMissionStepComplete={(res) => {
                if (res.type === 'attack') {
                  const bountyFood = (res.target.level || 1) * 65;
                  const bountyIron = (res.target.level || 1) * 35;
                  setResources((prev) => ({
                    ...prev,
                    food: prev.food + bountyFood,
                    iron: prev.iron + bountyIron,
                  }));
                  setArmyHealth((h) => Math.max(30, h - 5));
                  addToast(
                    `${res.target.name} eliminated! Dissolved into mountain smoke! Claimed +${bountyFood} Food, +${bountyIron} Iron!`
                  );
                  addLog(
                    'Victory in Battle',
                    `Vanquished ${res.target.name} (Lv.${res.target.level}). Reached 0 HP and dissolved into 3D smoke vapor. Loot: +${bountyFood} Food, +${bountyIron} Iron.`,
                    '🏆'
                  );
                  setLastCombatChatEvent(
                    `Vanguard eliminated ${res.target.name} (Lv.${res.target.level})! Reached 0 HP and dissolved into 3D smoke vapor!`
                  );
                  setArmyState('RETURNING');
                  setMissionDesc('Vanguard returning victorious to citadel gate.');
                } else if (res.type === 'gather') {
                  const sub = res.target.subtype;
                  const resKey: keyof Resources =
                    sub === 'wood'
                      ? 'wood'
                      : sub === 'farm'
                      ? 'food'
                      : sub === 'gold'
                      ? 'food'
                      : sub === 'stonecrystal' || sub === 'stone'
                      ? 'stone'
                      : 'iron';
                  const yieldAmt = res.target.yieldAmount || (res.target.level || 1) * 250;
                  setResources((prev) => ({
                    ...prev,
                    [resKey]: prev[resKey] + yieldAmt,
                  }));
                  addCombatFloater(`+${yieldAmt} ${resKey.toUpperCase()}`, '#dfba6e', window.innerWidth / 2, window.innerHeight / 2);
                  addToast(`Gathered +${yieldAmt} ${resKey.toUpperCase()} from ${res.target.name}!`);
                  addLog('Gather Complete', `Hauling +${yieldAmt} ${resKey.toUpperCase()} back to kingdom storage.`, '📦');
                  setLastCombatChatEvent(`Workers gathered +${yieldAmt} ${resKey.toUpperCase()} from ${res.target.name}.`);
                  setArmyState('RETURNING');
                  setMissionDesc('Workforce returning with harvested assets.');
                }
              }}
              cameraPan={cameraPan}
              zoom={zoom}
              onUpdateCamera={(pan, z) => {
                setCameraPan(pan);
                setZoom(z);
              }}
              onAddCombatFloater={addCombatFloater}
              registerObjectsRef={(objs) => setAllObjects(objs)}
              getCanvasSnapshotRef={(fn) => {
                snapshotFnRef.current = fn;
              }}
              selectedObject={selectedObject}
              registerDamageHandlerRef={(fn) => {
                damageMonsterIn3DRef.current = fn;
              }}
              onUpdateObjectHp={(objectId, newHp, isDead) => {
                setSelectedObject((prev) => {
                  if (prev && prev.id === objectId) {
                    return { ...prev, health: newHp, isDefeated: isDead };
                  }
                  return prev;
                });
                setAllObjects((prev) =>
                  prev.map((obj) => (obj.id === objectId ? { ...obj, health: newHp, isDefeated: isDead } : obj))
                );
              }}
            />

            {/* Floating On-Object HUD */}
            <ObjectHud
              selectedObject={selectedObject}
              screenPos={selectedScreenPos}
              onAttack={() => {
                setDispatchMode('attack');
                setIsDispatchOpen(true);
              }}
              onQuickStrike={() => {
                if (selectedObject && selectedObject.type === 'monster') {
                  handleQuickStrike(selectedObject);
                }
              }}
              onScout={handleScoutTarget}
              onMine={() => {
                setDispatchMode('gather');
                setIsDispatchOpen(true);
              }}
              onRally={() => handleOpenRallyModal(selectedObject)}
              onGarrison={() => handleGarrisonTower(selectedObject)}
              onInspect={() => setIsBuildingsOpen(true)}
            />

            {/* Interactive Minimap */}
            <Minimap
              objects={allObjects}
              armyPos={[-14, 0, 10]}
              cameraPan={cameraPan}
              zoom={zoom}
              onPanTo={(x, z) => setCameraPan({ x, z })}
              onCenterArmy={() => setCameraPan({ x: 14, z: -10 })}
              isExpanded={isMinimapExpanded}
              onToggleExpand={() => setIsMinimapExpanded(!isMinimapExpanded)}
              isOpen={isMinimapOpen}
              onToggleOpen={() => setIsMinimapOpen(!isMinimapOpen)}
            />

            {/* Floating combat floaters */}
            <div className="combat-floaters">
              {combatFloaters.map((f) => (
                <div
                  key={f.id}
                  className="combat-floater active"
                  style={{
                    color: f.color,
                    left: `${f.x}px`,
                    top: `${f.y}px`,
                  }}
                >
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          <div className="map-legend">
            <span>
              <i className="legend-dot friendly"></i> Friendly citadel
            </span>
            <span>
              <i className="legend-dot resource"></i> Resource node
            </span>
            <span>
              <i className="legend-dot monster"></i> Hostile monster
            </span>
            <span>
              <i className="legend-dot army"></i> Magar Vanguard
            </span>
            <span className="weather-legend-indicator">☀️ Clear Atmospheric Skies</span>
            <span className="legend-tip">
              Click object to select · Drag to pan · Scroll to zoom
            </span>
          </div>
        </section>
      </main>

      {/* 3D Radial Tactical Troop Dial */}
      <RadialTroopDial
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        target={selectedObject}
        mode={dispatchMode}
        availableUnits={units}
        targetScreenPos={selectedScreenPos}
        onConfirm={handleDispatchConfirm}
      />

      {/* Scout Report Modal */}
      <ScoutReportModal
        isOpen={isScoutReportOpen}
        onClose={() => setIsScoutReportOpen(false)}
        target={selectedObject}
        onDeployAssault={() => {
          setDispatchMode('attack');
          setIsDispatchOpen(true);
        }}
        onDeployMine={() => {
          setDispatchMode('gather');
          setIsDispatchOpen(true);
        }}
        onLaunchRally={() => {
          setIsScoutReportOpen(false);
          handleOpenRallyModal(selectedObject);
        }}
      />

      {/* Alliance War Rally Modal */}
      <AllianceRallyModal
        isOpen={isRallyModalOpen}
        onClose={() => setIsRallyModalOpen(false)}
        target={rallyTarget}
        onConfirmRally={handleConfirmRally}
      />

      {/* Buildings & Blueprints Modal */}
      <BuildingsModal
        isOpen={isBuildingsOpen}
        onClose={() => setIsBuildingsOpen(false)}
        buildings={buildings}
        blueprints={blueprints}
        resources={resources}
        onUpgradeBuilding={handleUpgradeBuilding}
        onConstructBlueprint={handleConstructBlueprint}
      />

      {/* AI Image Studio Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        onSetArmyPortrait={(url) => setArmyPortraitUrl(url)}
        onAddLog={addLog}
        onToast={addToast}
      />

      {/* Veo 3.1 Fast Video Animator Modal */}
      <VeoModal
        isOpen={isVeoOpen}
        onClose={() => setIsVeoOpen(false)}
        onAddLog={addLog}
        onToast={addToast}
        onCaptureCanvas={() => (snapshotFnRef.current ? snapshotFnRef.current() : null)}
      />

      {/* Floating Tactical Compass Search Radar (Resources & Monsters Lv 1-5) */}
      <WorldSearchRadar
        isOpen={isSearchRadarOpen}
        onToggle={() => setIsSearchRadarOpen(!isSearchRadarOpen)}
        objects={allObjects}
        playerBasePos={[-14, 0, 10]}
        onSelectAndLocate={handleSelectAndLocate}
        onQuickDispatch={handleQuickDispatchFromRadar}
      />

      {/* Bottom-Left Translucent Dual-Tab World & Alliance Chat Dock */}
      <TacticalChatDock
        lastCombatEvent={lastCombatChatEvent}
        onAddToast={addToast}
      />

      {/* Toast Notification Container */}
      <div className="toast" style={{ display: toasts.length > 0 ? 'block' : 'none' }}>
        {toasts[toasts.length - 1]?.text}
      </div>
    </div>
  );
};

export default App;
