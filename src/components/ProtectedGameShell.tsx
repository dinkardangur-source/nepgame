import React, { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { WorldMap } from '../game/WorldMap';
import { MapNavigationUI } from './MapNavigationUI';
import {
  WorldEntity,
  EntityAction,
  CastleSpawnData,
  WORLD_MONSTERS,
  WORLD_RESOURCES,
  RESERVED_PLOTS,
} from '../game/WorldCoordinates';
import { InsideKingdomSnapshot, InsideKingdomState, MergeBuildingCategory } from '../game/InsideKingdom3D';
import type {
  CommandHubTab,
  LiveCastleStatus,
  LiveMonsterStatus,
  LiveNodeStatus,
} from './CommandHubDrawer';
import { useAuth } from '../context/AuthContext';
import {
  loadKingdomProgressFromCloud,
  saveKingdomProgressToCloud,
} from '../services/playerAuthService';
import { offlineSyncService } from '../services/offlineSyncService';

const InsideKingdomView = lazy(() =>
  import('./InsideKingdomView').then((m) => ({ default: m.InsideKingdomView }))
);
const StrategicWorldMapModal = lazy(() =>
  import('./StrategicWorldMapModal').then((m) => ({ default: m.StrategicWorldMapModal }))
);
const CommandHubDrawer = lazy(() =>
  import('./CommandHubDrawer').then((m) => ({ default: m.CommandHubDrawer }))
);
const WorldMapTestMode = lazy(() =>
  import('./WorldMapTestMode').then((m) => ({ default: m.WorldMapTestMode }))
);
const AnimationTestModeModal = lazy(() =>
  import('./AnimationTestModeModal').then((m) => ({ default: m.AnimationTestModeModal }))
);
import {
  ActiveMarch,
  AllianceShrineRuleStatus,
  BattleReport,
  EquipmentItem,
  GameBalanceConfig,
  HospitalQueueItem,
  INITIAL_EQUIPMENT_CATALOG,
  InfantryGearSlot,
  InfantryGearState,
  KINGDOM_SIM_STORAGE_KEY,
  MAGAR_PROGRESSION_SPECS,
  MAX_INFANTRY_GEAR_RANK,
  PlayerAllianceIdentity,
  PlayerResources,
  ResearchState,
  ResourceKind,
  ShrineGarrisonState,
  StructureTierKey,
  TrainingQueueItem,
  TroopClassId,
  TroopInventory,
  TroopLevel,
  TroopStack,
  calculateArmyMetrics,
  calculateMarchTiming,
  calculateResourceGatherTiming,
  createEmptyTroopInventory,
  createInitialInfantryGear,
  createInitialTroopInventory,
  evaluateAllianceShrineRules,
  getCalculatedBonuses,
  getEnemyCastleMaxHp,
  getHeroById,
  getInfantryGearUpgradeCost,
  inferStructureKeyFromId,
  loadAllianceIdentity,
  loadBalanceConfig,
  normalizeAllianceTag,
  normalizeInfantryGear,
  resetBalanceConfig,
  resolveCastleSiegeCombat,
  resolveGarrisonDefenseBattle,
  resolveMonsterCombat,
  saveAllianceIdentity,
  saveBalanceConfig,
  validateAllianceAlias,
} from '../game/NepaleseBalanceConfig';

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

interface PersistedSimState {
  resources: PlayerResources;
  troopInventory: TroopInventory;
  woundedInventory: TroopInventory;
  trainingQueue: TrainingQueueItem[];
  hospitalQueue: HospitalQueueItem[];
  research: ResearchState;
  equipmentBag: EquipmentItem[];
  equippedIds: string[];
  shrineGarrisons: Record<string, ShrineGarrisonState>;
  activeMarches: ActiveMarch[];
  battleReports: BattleReport[];
  nodeStates: Record<string, LiveNodeStatus>;
  monsterStates: Record<string, LiveMonsterStatus>;
  castleStates?: Record<string, LiveCastleStatus>;
  infantryGear?: InfantryGearState;
  insideKingdomSnapshot?: InsideKingdomSnapshot;
  commanderXp: number;
}

const DEFAULT_RESOURCES: PlayerResources = {
  wood: 125400,
  stone: 98200,
  iron: 64500,
  food: 42800,
  crystal: 2400,
  gold: 18500,
  gems: 2450,
};

const DEFAULT_RESEARCH: ResearchState = {
  martialArts: 1,
  mountainLogistics: 1,
  alpineAgronomy: 1,
  fortressMedicine: 1,
};

function getStructureDisplayName(structureId: string, config: GameBalanceConfig): string {
  const plot = RESERVED_PLOTS.find((p) => p.id === structureId);
  if (plot) return plot.name;
  return config.structures[inferStructureKeyFromId(structureId)].label;
}

function mergeStacksIntoInventory(inv: TroopInventory, stacks: TroopStack[]): TroopInventory {
  const next: TroopInventory = {
    infantry: { ...inv.infantry },
    archer: { ...inv.archer },
    cavalry: { ...inv.cavalry },
  };
  for (const s of stacks) {
    if (s.count > 0) {
      next[s.classId][s.level] = (next[s.classId][s.level] || 0) + s.count;
    }
  }
  return next;
}

function addToStackList(list: TroopStack[], classId: TroopClassId, level: TroopLevel, count: number): TroopStack[] {
  if (count <= 0) return list;
  const next = list.map((s) => ({ ...s }));
  const existing = next.find((s) => s.classId === classId && s.level === level);
  if (existing) {
    existing.count += count;
  } else {
    next.push({ classId, level, count });
  }
  return next;
}

function buildInitialNodeStates(cfg: GameBalanceConfig, existing?: Record<string, LiveNodeStatus>): Record<string, LiveNodeStatus> {
  const out: Record<string, LiveNodeStatus> = { ...(existing || {}) };
  for (const res of WORLD_RESOURCES) {
    const lvCfg = cfg.resourcesByLevel[Math.max(0, Math.min(9, res.level - 1))];
    const rKind = (res.resourceType || 'food') as ResourceKind;
    const cap = lvCfg[rKind] ?? res.yieldAmount ?? 5000;
    if (!out[res.id]) {
      out[res.id] = { remainingYield: cap, maxYield: cap, respawnAt: null };
    } else {
      out[res.id] = { ...out[res.id], maxYield: cap, remainingYield: Math.min(out[res.id].remainingYield, cap) };
    }
  }
  const starterCaps: Record<string, number> = {
    starter_stone_quarry: 1200,
    starter_farm_food: 1200,
    starter_wooden_lumber: 1200,
    starter_gold_mine: 1800,
  };
  for (const [id, cap] of Object.entries(starterCaps)) {
    if (!out[id]) {
      out[id] = { remainingYield: cap, maxYield: cap, respawnAt: null };
    }
  }
  return out;
}

function buildInitialMonsterStates(
  cfg: GameBalanceConfig,
  existing?: Record<string, LiveMonsterStatus>
): Record<string, LiveMonsterStatus> {
  const out: Record<string, LiveMonsterStatus> = { ...(existing || {}) };
  for (const m of WORLD_MONSTERS) {
    const mCfg = cfg.monstersByLevel[Math.max(0, Math.min(9, m.level - 1))];
    if (!out[m.id]) {
      out[m.id] = {
        currentHp: mCfg.hp,
        maxHp: mCfg.hp,
        isDefeated: false,
        respawnAt: null,
      };
    } else {
      out[m.id] = {
        ...out[m.id],
        maxHp: mCfg.hp,
        currentHp: Math.min(out[m.id].currentHp, mCfg.hp),
      };
    }
  }
  return out;
}

function createDefaultStructureGarrison(
  structureId: string,
  structureKey: StructureTierKey,
  config: GameBalanceConfig
): ShrineGarrisonState {
  const req = config.structures[structureKey];
  const isStarterC1 = structureId === 'plot-shrine-c1' || structureId === 'shrine_c1';
  return {
    structureId,
    structureKey,
    name: getStructureDisplayName(structureId, config),
    ownerFaction: isStarterC1 ? 'alliance' : 'neutral',
    barrierActive: isStarterC1,
    barrierHp: req.barrierStrength,
    maxBarrierHp: req.barrierStrength,
    playerStacks: [],
    allianceReinforcements: [],
  };
}

function buildInitialShrineGarrisons(
  cfg: GameBalanceConfig,
  existing?: Record<string, ShrineGarrisonState>
): Record<string, ShrineGarrisonState> {
  const out: Record<string, ShrineGarrisonState> = { ...(existing || {}) };
  const featured: Array<[string, StructureTierKey]> = [
    ['plot-congress-center', 'congress'],
    ['plot-shrine-a1', 'shrine_a'],
    ['plot-shrine-b1', 'shrine_b'],
    ['plot-shrine-c1', 'shrine_c'],
  ];
  for (const [id, key] of featured) {
    if (!out[id]) {
      out[id] = createDefaultStructureGarrison(id, key, cfg);
    }
  }
  return out;
}

function getUserSimStorageKey(uid: string): string {
  return `${KINGDOM_SIM_STORAGE_KEY}_${uid}`;
}

function loadInitialSimState(cfg: GameBalanceConfig, uid: string): PersistedSimState {
  try {
    const raw =
      localStorage.getItem(getUserSimStorageKey(uid)) ??
      localStorage.getItem(KINGDOM_SIM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSimState>;
      return {
        resources: { ...DEFAULT_RESOURCES, ...(parsed.resources || {}) },
        troopInventory: parsed.troopInventory || createInitialTroopInventory(),
        woundedInventory: parsed.woundedInventory || createEmptyTroopInventory(),
        trainingQueue: Array.isArray(parsed.trainingQueue) ? parsed.trainingQueue : [],
        hospitalQueue: Array.isArray(parsed.hospitalQueue) ? parsed.hospitalQueue : [],
        research: { ...DEFAULT_RESEARCH, ...(parsed.research || {}) },
        equipmentBag:
          Array.isArray(parsed.equipmentBag) && parsed.equipmentBag.length > 0
            ? parsed.equipmentBag
            : INITIAL_EQUIPMENT_CATALOG.slice(0, 2),
        equippedIds: Array.isArray(parsed.equippedIds) ? parsed.equippedIds : ['eq_khukuri_steel'],
        shrineGarrisons: buildInitialShrineGarrisons(cfg, parsed.shrineGarrisons),
        activeMarches: Array.isArray(parsed.activeMarches) ? parsed.activeMarches : [],
        battleReports: Array.isArray(parsed.battleReports) ? parsed.battleReports : [],
        nodeStates: buildInitialNodeStates(cfg, parsed.nodeStates),
        monsterStates: buildInitialMonsterStates(cfg, parsed.monsterStates),
        castleStates: parsed.castleStates || {},
        infantryGear: normalizeInfantryGear(parsed.infantryGear),
        insideKingdomSnapshot: parsed.insideKingdomSnapshot,
        commanderXp: typeof parsed.commanderXp === 'number' ? parsed.commanderXp : 1450,
      };
    }
  } catch {
    // Fallback to clean initial state
  }
  return {
    resources: { ...DEFAULT_RESOURCES },
    troopInventory: createInitialTroopInventory(),
    woundedInventory: createEmptyTroopInventory(),
    trainingQueue: [],
    hospitalQueue: [],
    research: { ...DEFAULT_RESEARCH },
    equipmentBag: INITIAL_EQUIPMENT_CATALOG.slice(0, 2),
    equippedIds: ['eq_khukuri_steel'],
    shrineGarrisons: buildInitialShrineGarrisons(cfg),
    activeMarches: [],
    battleReports: [],
    nodeStates: buildInitialNodeStates(cfg),
    monsterStates: buildInitialMonsterStates(cfg),
    castleStates: {},
    infantryGear: createInitialInfantryGear(),
    commanderXp: 1450,
  };
}

interface ProtectedGameShellProps {
  uid: string;
  initialViewMode: 'world' | 'kingdom';
  commanderUsername?: string;
}

export const ProtectedGameShell: React.FC<ProtectedGameShellProps> = ({
  uid,
  initialViewMode,
  commanderUsername,
}) => {
  const { registerBeforeSignOutHook, welcomeBanner, clearWelcomeBanner } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const worldMapRef = useRef<WorldMap | null>(null);

  const [balanceConfig, setBalanceConfig] = useState<GameBalanceConfig>(() => loadBalanceConfig());
  const initialSim = useMemo(() => loadInitialSimState(balanceConfig, uid), [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Core Nepalese Strategy State
  const [resources, setResources] = useState<PlayerResources>(initialSim.resources);
  const [troopInventory, setTroopInventory] = useState<TroopInventory>(initialSim.troopInventory);
  const [woundedInventory, setWoundedInventory] = useState<TroopInventory>(initialSim.woundedInventory);
  const [trainingQueue, setTrainingQueue] = useState<TrainingQueueItem[]>(initialSim.trainingQueue);
  const [hospitalQueue, setHospitalQueue] = useState<HospitalQueueItem[]>(initialSim.hospitalQueue);
  const [research, setResearch] = useState<ResearchState>(initialSim.research);
  const [equipmentBag, setEquipmentBag] = useState<EquipmentItem[]>(initialSim.equipmentBag);
  const [equippedIds, setEquippedIds] = useState<string[]>(initialSim.equippedIds);
  const [shrineGarrisons, setShrineGarrisons] = useState<Record<string, ShrineGarrisonState>>(initialSim.shrineGarrisons);
  const [activeMarches, setActiveMarches] = useState<ActiveMarch[]>(initialSim.activeMarches);
  const [battleReports, setBattleReports] = useState<BattleReport[]>(initialSim.battleReports);
  const [nodeStates, setNodeStates] = useState<Record<string, LiveNodeStatus>>(initialSim.nodeStates);
  const [monsterStates, setMonsterStates] = useState<Record<string, LiveMonsterStatus>>(initialSim.monsterStates);
  const [castleStates, setCastleStates] = useState<Record<string, LiveCastleStatus>>(initialSim.castleStates || {});
  const [infantryGear, setInfantryGear] = useState<InfantryGearState>(
    () => normalizeInfantryGear(initialSim.infantryGear)
  );
  const [commanderXp, setCommanderXp] = useState<number>(initialSim.commanderXp);

  const [playerAlliance, setPlayerAlliance] = useState<PlayerAllianceIdentity>(() => loadAllianceIdentity());

  // Unified 8-Panel Command Hub UI state
  const [isHubOpen, setIsHubOpen] = useState<boolean>(false);
  const [hubTab, setHubTab] = useState<CommandHubTab>('resources');
  const [selectedStructureId, setSelectedStructureId] = useState<string>('plot-shrine-c1');

  // View Mode & Map States
  const [viewMode, setViewMode] = useState<'world' | 'kingdom'>(initialViewMode);
  const viewModeRef = useRef<'world' | 'kingdom'>(initialViewMode);
  viewModeRef.current = viewMode;
  const [kingdomState, setKingdomState] = useState<InsideKingdomState | null>(null);
  const [insideKingdomSnapshot, setInsideKingdomSnapshot] = useState<InsideKingdomSnapshot | undefined>(
    initialSim.insideKingdomSnapshot
  );
  const [castles, setCastles] = useState<CastleSpawnData[]>([]);
  const [conqueredPlots, setConqueredPlots] = useState<Record<string, 'neutral' | 'enemy' | 'alliance'>>(() => {
    const map: Record<string, 'neutral' | 'enemy' | 'alliance'> = {};
    for (const [id, g] of Object.entries(initialSim.shrineGarrisons)) {
      map[id] = g.ownerFaction;
    }
    return map;
  });
  const [isStrategicWorldMapOpen, setIsStrategicWorldMapOpen] = useState<boolean>(false);
  const [isStrategicFilterActive, setIsStrategicFilterActive] = useState<boolean>(false);
  const [isCollisionDebugVisible, setIsCollisionDebugVisible] = useState<boolean>(false);
  const [isAnimationLabOpen, setIsAnimationLabOpen] = useState<boolean>(false);
  const [worldTimeOfDay, setWorldTimeOfDay] = useState<'day' | 'dusk' | 'night'>('day');
  const [collisionDebugLayers, setCollisionDebugLayers] = useState<{
    building: boolean;
    monster: boolean;
    resource: boolean;
  }>({ building: true, monster: true, resource: true });
  const [isTestModeOpen, setIsTestModeOpen] = useState<boolean>(false);

  const [cameraInfo, setCameraInfo] = useState<{ x: number; y: number; z: number; zoom: number }>({
    x: 1600,
    y: 10.0,
    z: 1568,
    zoom: 0.5016,
  });

  const [selectedEntity, setSelectedEntity] = useState<WorldEntity | null>(null);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{ x: number; y: number } | null>(null);

  const [armyPos, setArmyPos] = useState<[number, number, number]>([1600, 10.0, 1551]);
  const [armyStatusText, setArmyStatusText] = useState<string>('Garrisoned inside My Castle');
  const [armyProgressPct, setArmyProgressPct] = useState<number>(100);

  const [combatFloaters, setCombatFloaters] = useState<CombatFloater[]>([]);
  const [bulletNotifications, setBulletNotifications] = useState<BulletNotification[]>([]);
  const bulletLaneRef = useRef<number>(0);

  const [toastText, setToastText] = useState<string | null>(null);
  const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(false);
  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState<boolean>(false);

  const bonuses = useMemo(
    () => getCalculatedBonuses(research, equippedIds, equipmentBag),
    [research, equippedIds, equipmentBag]
  );

  const shrineRuleStatus = useMemo<AllianceShrineRuleStatus>(() => {
    const conqueredAllianceIds = Object.entries(conqueredPlots)
      .filter(([, faction]) => faction === 'alliance')
      .map(([id]) => id);
    return evaluateAllianceShrineRules(shrineGarrisons, conqueredAllianceIds, balanceConfig);
  }, [shrineGarrisons, conqueredPlots, balanceConfig]);

  // Refs mirrored for clean 250ms simulation tick without resetting intervals
  const simSnapshotRef = useRef({
    balanceConfig,
    bonuses,
    research,
    equippedIds,
    equipmentBag,
    castles,
    activeMarches,
    trainingQueue,
    hospitalQueue,
    nodeStates,
    monsterStates,
    castleStates,
    shrineGarrisons,
    infantryGear,
  });
  simSnapshotRef.current = {
    balanceConfig,
    bonuses,
    research,
    equippedIds,
    equipmentBag,
    castles,
    activeMarches,
    trainingQueue,
    hospitalQueue,
    nodeStates,
    monsterStates,
    castleStates,
    shrineGarrisons,
    infantryGear,
  };

  const getMyCastlePosition = useCallback((): [number, number, number] => {
    const mine = castles.find((c) => c.isMyCastle);
    return mine ? mine.position : [1600, 10, 1568];
  }, [castles]);

  const buildSimPayload = useCallback((): PersistedSimState => {
    return {
      resources,
      troopInventory,
      woundedInventory,
      trainingQueue,
      hospitalQueue,
      research,
      equipmentBag,
      equippedIds,
      shrineGarrisons,
      activeMarches,
      battleReports: battleReports.slice(0, 40),
      nodeStates,
      monsterStates,
      castleStates,
      infantryGear,
      insideKingdomSnapshot,
      commanderXp,
    };
  }, [
    resources,
    troopInventory,
    woundedInventory,
    trainingQueue,
    hospitalQueue,
    research,
    equipmentBag,
    equippedIds,
    shrineGarrisons,
    activeMarches,
    battleReports,
    nodeStates,
    monsterStates,
    castleStates,
    infantryGear,
    insideKingdomSnapshot,
    commanderXp,
  ]);

  const initialHydrationDoneRef = useRef<boolean>(false);
  const lastSavedJsonRef = useRef<string>('');
  const syncRetryTimerRef = useRef<number | null>(null);

  const flushCloudSave = useCallback(async (): Promise<boolean> => {
    const payload = buildSimPayload();
    const serialized = JSON.stringify(payload);
    try {
      localStorage.setItem(getUserSimStorageKey(uid), serialized);
      lastSavedJsonRef.current = serialized;
    } catch {
      // Ignore storage quota errors
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      offlineSyncService.recordLocalSave(uid, { forceDirty: true });
      return false;
    }

    offlineSyncService.markSyncStarted(uid);
    try {
      await saveKingdomProgressToCloud(
        uid,
        payload.commanderXp,
        payload as unknown as Record<string, unknown>
      );
      offlineSyncService.markSyncSucceeded(uid, false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sync kingdom progress.';
      offlineSyncService.markSyncFailed(uid, msg);
      return false;
    }
  }, [buildSimPayload, uid]);

  useEffect(() => {
    const unregisterSync = offlineSyncService.registerSyncHandler(uid, flushCloudSave);
    return () => {
      unregisterSync();
      if (syncRetryTimerRef.current !== null) {
        window.clearTimeout(syncRetryTimerRef.current);
        syncRetryTimerRef.current = null;
      }
    };
  }, [flushCloudSave, uid]);

  useEffect(() => {
    registerBeforeSignOutHook(async () => {
      await flushCloudSave();
    });
    return () => registerBeforeSignOutHook(null);
  }, [flushCloudSave, registerBeforeSignOutHook]);

  // Hydrate cloud kingdom state on mount (preserving dirty offline mutations until synced!)
  useEffect(() => {
    let cancelled = false;
    initialHydrationDoneRef.current = false;

    if (offlineSyncService.hasPendingOfflineChanges(uid)) {
      initialHydrationDoneRef.current = true;
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void offlineSyncService.triggerSync(uid);
      }
      return () => {
        cancelled = true;
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      initialHydrationDoneRef.current = true;
      return () => {
        cancelled = true;
      };
    }

    void loadKingdomProgressFromCloud(uid)
      .then((cloudState) => {
        if (cancelled) return;
        if (!cloudState) {
          initialHydrationDoneRef.current = true;
          return;
        }
        // Double check we didn't accumulate offline mutations while fetch was in flight
        if (offlineSyncService.hasPendingOfflineChanges(uid)) {
          initialHydrationDoneRef.current = true;
          void offlineSyncService.triggerSync(uid);
          return;
        }
        const parsed = cloudState as Partial<PersistedSimState>;
        if (parsed.resources) setResources((prev) => ({ ...prev, ...parsed.resources }));
        if (parsed.troopInventory) setTroopInventory(parsed.troopInventory);
        if (parsed.woundedInventory) setWoundedInventory(parsed.woundedInventory);
        if (Array.isArray(parsed.trainingQueue)) setTrainingQueue(parsed.trainingQueue);
        if (Array.isArray(parsed.hospitalQueue)) setHospitalQueue(parsed.hospitalQueue);
        if (parsed.research) setResearch((prev) => ({ ...prev, ...parsed.research }));
        if (Array.isArray(parsed.equipmentBag) && parsed.equipmentBag.length > 0) {
          setEquipmentBag(parsed.equipmentBag);
        }
        if (Array.isArray(parsed.equippedIds)) setEquippedIds(parsed.equippedIds);
        if (parsed.shrineGarrisons) {
          const built = buildInitialShrineGarrisons(balanceConfig, parsed.shrineGarrisons);
          setShrineGarrisons(built);
          const nextPlots: Record<string, 'neutral' | 'enemy' | 'alliance'> = {};
          for (const [id, gar] of Object.entries(built)) {
            nextPlots[id] = gar.ownerFaction;
            if (gar.barrierActive) worldMapRef.current?.setStructureBarrierActive(id, true);
            if (gar.ownerFaction === 'alliance') worldMapRef.current?.conquerStructureById(id, true);
          }
          setConqueredPlots(nextPlots);
        }
        if (Array.isArray(parsed.activeMarches)) setActiveMarches(parsed.activeMarches);
        if (Array.isArray(parsed.battleReports)) setBattleReports(parsed.battleReports);
        if (parsed.infantryGear) setInfantryGear(normalizeInfantryGear(parsed.infantryGear));
        if (parsed.insideKingdomSnapshot) {
          setInsideKingdomSnapshot(parsed.insideKingdomSnapshot);
          worldMapRef.current?.restoreInsideKingdomState(parsed.insideKingdomSnapshot);
        }
        if (typeof parsed.commanderXp === 'number') setCommanderXp(parsed.commanderXp);
        offlineSyncService.markSyncSucceeded(uid, false);
        initialHydrationDoneRef.current = true;
      })
      .catch(() => {
        initialHydrationDoneRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist simulation state cleanly (localStorage + offline sync queue + debounced Firestore sync)
  useEffect(() => {
    const payload = buildSimPayload();
    const serialized = JSON.stringify(payload);
    if (!lastSavedJsonRef.current) {
      lastSavedJsonRef.current = serialized;
    }

    const hasActualChange = serialized !== lastSavedJsonRef.current;

    const localTimer = window.setTimeout(() => {
      if (!hasActualChange && initialHydrationDoneRef.current) return;
      try {
        localStorage.setItem(getUserSimStorageKey(uid), serialized);
        lastSavedJsonRef.current = serialized;
        if (initialHydrationDoneRef.current && hasActualChange) {
          offlineSyncService.recordLocalSave(uid, {
            forceDirty: typeof navigator !== 'undefined' && !navigator.onLine,
          });
        }
      } catch {
        // Ignore quota errors
      }
    }, 900);

    const cloudTimer = window.setTimeout(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (hasActualChange) {
          offlineSyncService.recordLocalSave(uid, { forceDirty: true });
        }
        return;
      }
      if (!hasActualChange && !offlineSyncService.hasPendingOfflineChanges(uid)) {
        return;
      }
      void offlineSyncService.triggerSync(uid).then((ok) => {
        if (!ok && navigator.onLine) {
          if (syncRetryTimerRef.current !== null) window.clearTimeout(syncRetryTimerRef.current);
          syncRetryTimerRef.current = window.setTimeout(() => {
            syncRetryTimerRef.current = null;
            if (navigator.onLine && offlineSyncService.hasPendingOfflineChanges(uid)) {
              void offlineSyncService.triggerSync(uid);
            }
          }, 12_000);
        }
      });
    }, 5000);

    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(cloudTimer);
    };
  }, [buildSimPayload, uid]);

  useEffect(() => {
    const flushLocalSync = () => {
      try {
        const payload = buildSimPayload();
        const serialized = JSON.stringify(payload);
        localStorage.setItem(getUserSimStorageKey(uid), serialized);
        if (serialized !== lastSavedJsonRef.current && (!navigator.onLine || offlineSyncService.hasPendingOfflineChanges(uid))) {
          offlineSyncService.recordLocalSave(uid, { forceDirty: true });
        }
      } catch {
        // Ignore quota errors
      }
    };
    window.addEventListener('pagehide', flushLocalSync);
    window.addEventListener('beforeunload', flushLocalSync);
    return () => {
      window.removeEventListener('pagehide', flushLocalSync);
      window.removeEventListener('beforeunload', flushLocalSync);
    };
  }, [buildSimPayload, uid]);

  const tryLockLandscape = useCallback(async (withFullscreen = false) => {
    try {
      const isTouchMobile =
        window.matchMedia('(pointer: coarse)').matches ||
        /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
      if (!isTouchMobile) return;
      if (withFullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock may require fullscreen or installed PWA on mobile browsers
    }
  }, []);

  useEffect(() => {
    const updateOrientationState = () => {
      const isTouchMobile =
        window.matchMedia('(pointer: coarse)').matches ||
        /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
      setIsMobilePortrait(isTouchMobile && window.innerHeight > window.innerWidth);
    };

    updateOrientationState();
    void tryLockLandscape(false);

    const handleFirstTouch = () => {
      void tryLockLandscape(false);
    };

    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', updateOrientationState);
    window.addEventListener('pointerdown', handleFirstTouch, { once: true, passive: true });

    return () => {
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', updateOrientationState);
      window.removeEventListener('pointerdown', handleFirstTouch);
    };
  }, [tryLockLandscape]);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  useEffect(() => {
    if (!welcomeBanner) return;
    showToast(welcomeBanner);
    clearWelcomeBanner();
  }, [welcomeBanner, showToast, clearWelcomeBanner]);

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
    showToast('🌍 Returned to Himalayan World Map');
  }, [showToast]);

  const handleToggleViewMode = useCallback(() => {
    const currentMode = viewModeRef.current;
    if (currentMode === 'world') {
      setSelectedEntity(null);
      setSelectedScreenPos(null);
      setViewMode('kingdom');
      worldMapRef.current?.setSceneMode('kingdom');
      showToast('🏰 Entered 3D Walled Imperial Citadel — Click matching 3D buildings to merge!');
    } else {
      setViewMode('world');
      worldMapRef.current?.setSceneMode('world');
      showToast('🌍 Returned to Himalayan World Map');
    }
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

  const handleToggleCollisionDebug = useCallback(
    (enabled?: boolean) => {
      setIsCollisionDebugVisible((prev) => {
        const next = typeof enabled === 'boolean' ? enabled : !prev;
        worldMapRef.current?.setDebugCollisionBoxes(next);
        showToast(
          next
            ? '📦 Collision Debug Wireframes ON (Yellow: Building · Red: Monster · Green: Resource)'
            : '📦 Collision Debug Wireframes OFF'
        );
        return next;
      });
    },
    [showToast]
  );

  const handleToggleCollisionLayer = useCallback(
    (layer: 'building' | 'monster' | 'resource') => {
      setCollisionDebugLayers((prev) => {
        const nextVal = !prev[layer];
        worldMapRef.current?.setDebugCollisionLayerVisible(layer, nextVal);
        return { ...prev, [layer]: nextVal };
      });
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handleToggleCollisionDebug();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleCollisionDebug]);

  const handleRelocateCastles = useCallback(() => {
    if (!worldMapRef.current) return;
    if (viewMode === 'kingdom') {
      setViewMode('world');
      worldMapRef.current.setSceneMode('world');
    }
    const updated = worldMapRef.current.relocateCastles(true);
    setCastles([...updated]);
    const resetCastleStates: Record<string, LiveCastleStatus> = {};
    for (const c of updated) {
      if (c.faction === 'enemy') {
        const maxHp = getEnemyCastleMaxHp(c.power, c.level);
        resetCastleStates[c.id] = {
          currentHp: maxHp,
          maxHp,
          isBurning: false,
          lastAttackedAt: null,
          teleportCount: 0,
        };
      }
    }
    setCastleStates(resetCastleStates);
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
      type: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'gems',
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

  const handleHarvestReward = useCallback(
    (resourceType: string, amount: number) => {
      setResources((prev) => ({
        ...prev,
        [resourceType]: (prev[resourceType as keyof PlayerResources] || 0) + amount,
      }));
      showToast(`📦 +${amount.toLocaleString()} ${resourceType.toUpperCase()} deposited into My Castle Vault!`);
    },
    [showToast]
  );

  const handleMonsterDefeated = useCallback(
    (monster: WorldEntity) => {
      setResources((prev) => ({
        ...prev,
        gold: prev.gold + 600,
        gems: prev.gems + 35,
      }));
      showToast(`💀 VICTORY! ${monster.name} defeated! +600 Gold and +35 Gems secured!`);
    },
    [showToast]
  );

  const checkStructureRuleBlock = useCallback(
    (structureId: string, structureKey: StructureTierKey): string | null => {
      const cur = shrineGarrisons[structureId];
      const isAlreadyHeld = cur?.ownerFaction === 'alliance' || conqueredPlots[structureId] === 'alliance';
      if (structureKey === 'congress' && !shrineRuleStatus.congressUnlocked) {
        return `🔒 Congress Locked! ${shrineRuleStatus.congressRequirementText}.`;
      }
      if (structureKey !== 'congress' && !isAlreadyHeld && shrineRuleStatus.atShrineCap) {
        return `⚠️ 5-Shrine Cap Reached (${shrineRuleStatus.totalShrinesHeld}/${shrineRuleStatus.maxShrinesPerAlliance}). Relinquish a Shrine first!`;
      }
      return null;
    },
    [conqueredPlots, shrineGarrisons, shrineRuleStatus]
  );

  const handleUpdateAllianceIdentity = useCallback(
    (rawTag: string, rawAlias: string): boolean => {
      const tag = normalizeAllianceTag(rawTag);
      const aliasCheck = validateAllianceAlias(rawAlias);
      if (!aliasCheck.valid) {
        showToast(`⚠️ ${aliasCheck.error || 'Alliance alias must be exactly 4 words.'}`);
        return false;
      }
      const next: PlayerAllianceIdentity = { tag, alias: aliasCheck.normalized };
      setPlayerAlliance(next);
      saveAllianceIdentity(next);
      worldMapRef.current?.setAllianceIdentity(next);
      const updatedCastles = worldMapRef.current?.getCastlesList();
      if (updatedCastles) {
        setCastles([...updatedCastles]);
      }
      showToast(`🛡️ Alliance Identity updated to [${next.tag}] ${next.alias}!`);
      return true;
    },
    [showToast]
  );

  const handleRelinquishStructure = useCallback(
    (structureId: string) => {
      const gar = shrineGarrisons[structureId];
      const tierKey = inferStructureKeyFromId(structureId);
      const label = gar?.name || getStructureDisplayName(structureId, balanceConfig);
      if (gar?.playerStacks?.length) {
        setTroopInventory((prev) => mergeStacksIntoInventory(prev, gar.playerStacks));
      }
      setShrineGarrisons((prev) => ({
        ...prev,
        [structureId]: {
          ...createDefaultStructureGarrison(structureId, tierKey, balanceConfig),
          ownerFaction: 'neutral',
          barrierActive: false,
          playerStacks: [],
          allianceReinforcements: [],
        },
      }));
      setConqueredPlots((prev) => ({ ...prev, [structureId]: 'neutral' }));
      worldMapRef.current?.setStructureBarrierActive(structureId, false);
      worldMapRef.current?.setStructureNeutral(structureId);
      showToast(`🏳️ Relinquished ${label}. Garrison returned to Barracks.`);
    },
    [balanceConfig, showToast, shrineGarrisons]
  );

  const handleStructureConquered = useCallback(
    (entity: WorldEntity, buffLabel: string) => {
      const tierKey = inferStructureKeyFromId(entity.id);
      const ruleBlock = checkStructureRuleBlock(entity.id, tierKey);
      if (ruleBlock) {
        worldMapRef.current?.setStructureNeutral(entity.id);
        showToast(ruleBlock);
        return;
      }
      setShrineGarrisons((prev) => {
        const base = prev[entity.id] || createDefaultStructureGarrison(entity.id, tierKey, balanceConfig);
        return {
          ...prev,
          [entity.id]: {
            ...base,
            ownerFaction: 'alliance',
          },
        };
      });
      setConqueredPlots((prev) => ({ ...prev, [entity.id]: 'alliance' }));
      setResources((prev) => ({
        ...prev,
        gold: prev.gold + (entity.subtype === 'congress' ? 5000 : 1500),
        gems: prev.gems + (entity.subtype === 'congress' ? 300 : 80),
      }));
      showToast(`👑 CONQUERED! ${entity.name} claimed for [${playerAlliance.tag}] ${playerAlliance.alias} (${buffLabel})!`);
      if (
        entity.type === 'shrine_c' ||
        entity.type === 'shrine_b' ||
        entity.type === 'shrine_a' ||
        entity.type === 'congress'
      ) {
        handlePushBullet({
          text: `👑 CAPTURED! [${playerAlliance.tag}] ${playerAlliance.alias} claimed ${entity.name} (${buffLabel})!`,
          category: 'conquest',
        });
      }
    },
    [balanceConfig, checkStructureRuleBlock, handlePushBullet, playerAlliance.alias, playerAlliance.tag, showToast]
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

  const handleArmyStatusUpdate = useCallback(
    (desc: string, progress: number, _timerText: string, updatedArmyPos?: [number, number, number]) => {
      if (simSnapshotRef.current.activeMarches.length > 0) return;
      setArmyStatusText(desc);
      setArmyProgressPct(progress);
      if (updatedArmyPos) {
        setArmyPos(updatedArmyPos);
      }
    },
    []
  );

  // Legacy bridge handler (also handles scout/upgrade/enemy castle)
  const handleExecuteAction = useCallback(
    (target: WorldEntity, action: EntityAction) => {
      if (!worldMapRef.current) return;
      if (
        (target.type === 'shrine_a' ||
          target.type === 'shrine_b' ||
          target.type === 'shrine_c' ||
          target.type === 'congress') &&
        (action === 'attack' || action === 'rally' || action === 'garrison')
      ) {
        const tierKey = inferStructureKeyFromId(target.id);
        const block = checkStructureRuleBlock(target.id, tierKey);
        if (block) {
          showToast(block);
          return;
        }
      }
      worldMapRef.current.dispatchTroops(target, action);
      if (action === 'scout') {
        showToast(`🦅 Falcon scout recon mission complete for ${target.name}!`);
      } else if (action === 'upgrade') {
        showToast(`🔨 Imperial architects scheduled upgrades for ${target.name}!`);
      } else if (action === 'attack' || action === 'rally') {
        showToast(`⚔️ Vanguard battalion dispatched toward ${target.name}!`);
      }
    },
    [checkStructureRuleBlock, showToast]
  );

  // ============================================================================
  // NEPALESE STRATEGY ENGINE HANDLERS
  // ============================================================================

  const handleOpenCommandHub = useCallback(
    (tab: CommandHubTab, structureId?: string) => {
      setHubTab(tab);
      if (structureId) {
        setSelectedStructureId(structureId);
      }
      setIsHubOpen(true);
    },
    []
  );

  const handleDispatchNepaleseMarch = useCallback(
    (
      target: WorldEntity,
      action: EntityAction,
      stacks: TroopStack[],
      heroId?: string,
      rallyMeta?: {
        captains?: string[];
        alliedOrigins?: Array<{ name: string; position: [number, number, number] }>;
      }
    ): boolean => {
      const cleanStacks = stacks.filter((s) => s.count > 0);
      if (action === 'scout' || action === 'upgrade' || target.type === 'alliance_castle' || target.type === 'my_castle') {
        worldMapRef.current?.dispatchTroops(target, action);
        if (action === 'scout') {
          showToast(`🦅 Recon scouts dispatched to ${target.name}.`);
        } else if (action === 'upgrade') {
          showToast(`🔨 Imperial upgrade ordered for ${target.name}.`);
        } else {
          showToast(`🛡️ Reinforcement command sent to ${target.name}.`);
        }
        return true;
      }

      const selectedHero = getHeroById(heroId);
      if (selectedHero) {
        const occupied = activeMarches.find((m) => m.heroId === selectedHero.id);
        if (occupied) {
          showToast(`⚠️ ${selectedHero.name} is already on march to ${occupied.targetName}.`);
          return false;
        }
      }

      if (cleanStacks.length === 0) {
        showToast('⚠️ Select at least 1 troop before dispatching a march!');
        return false;
      }

      if (activeMarches.length >= balanceConfig.maxSimultaneousMarches) {
        showToast(`⚠️ Max ${balanceConfig.maxSimultaneousMarches} simultaneous marches active. Recall or wait for return.`);
        return false;
      }

      // Validate inventory availability
      for (const s of cleanStacks) {
        const avail = troopInventory[s.classId][s.level] || 0;
        if (avail < s.count) {
          showToast(`⚠️ Not enough ${balanceConfig.troops[s.classId].name} Lv.${s.level} in Barracks.`);
          return false;
        }
      }

      const myCastlePos = getMyCastlePosition();
      const marchBonuses = getCalculatedBonuses(research, equippedIds, equipmentBag, selectedHero);
      const metrics = calculateArmyMetrics(cleanStacks, balanceConfig, marchBonuses, selectedHero, infantryGear);
      const timing = calculateMarchTiming(
        myCastlePos,
        target.position,
        metrics.marchSpeedTilesPerMin,
        balanceConfig
      );
      const now = Date.now();
      const heroLabel = selectedHero ? `${selectedHero.name} + ` : '';
      const dispatchTier = cleanStacks.reduce<TroopLevel>(
        (best, s) => (s.level > best ? s.level : best),
        cleanStacks.find((s) => s.classId === 'infantry')?.level || 1
      );
      worldMapRef.current?.setArmyEquipmentTier(
        dispatchTier,
        infantryGear[dispatchTier] || { weapon: 0, shield: 0, armor: 0 },
        selectedHero?.crestColor,
        selectedHero?.id ?? null
      );

      if (target.category === 'resource' || action === 'mine') {
        const live = nodeStates[target.id];
        if (live && (live.remainingYield <= 0 || live.respawnAt !== null)) {
          showToast(`⏳ ${target.name} is depleted and respawning.`);
          return false;
        }
        const lvCfg = balanceConfig.resourcesByLevel[Math.max(0, Math.min(9, target.level - 1))];
        const reqCap = target.requiredTroopCapacity ?? lvCfg?.requiredTroopCapacity ?? 0;
        if (metrics.totalLoad < reqCap) {
          showToast(
            `⚠️ Lv.${target.level} ${target.name} requires at least ${reqCap.toLocaleString()} Load capacity (Selected: ${metrics.totalLoad.toLocaleString()}).`
          );
          return false;
        }

        const rType = ((target.resourceType === 'gold' ? 'gold' : target.resourceType) || 'food') as ResourceKind;
        setTroopInventory((prev) => {
          const next: TroopInventory = {
            infantry: { ...prev.infantry },
            archer: { ...prev.archer },
            cavalry: { ...prev.cavalry },
          };
          for (const s of cleanStacks) next[s.classId][s.level] -= s.count;
          return next;
        });

        const march: ActiveMarch = {
          id: `march-${now}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'gather',
          targetId: target.id,
          targetName: target.name,
          targetLevel: target.level,
          targetPosition: [...target.position],
          resourceType: rType,
          heroId: selectedHero?.id,
          heroName: selectedHero?.name,
          stacks: cleanStacks,
          status: 'marching',
          distanceTiles: timing.distanceTiles,
          marchSpeedTilesPerMin: metrics.marchSpeedTilesPerMin,
          formulaMarchMinutes: timing.formulaMinutes,
          gatherSpeedPerMin: metrics.baseGatheringSpeedPerMin,
          maxCarryLoad: metrics.totalLoad,
          carriedAmount: 0,
          phaseStartedAt: now,
          phaseDurationMs: timing.realSeconds * 1000,
          lastTickAt: now,
        };
        setActiveMarches((prev) => [...prev, march]);
        showToast(
          `⛏️ ${heroLabel}${metrics.totalCount.toLocaleString()} troops marching to ${target.name} (${timing.distanceTiles} tiles · ${timing.formulaMinutes}m)`
        );
        return true;
      }

      if (target.type === 'enemy_castle' && (action === 'attack' || action === 'rally')) {
        setTroopInventory((prev) => {
          const next: TroopInventory = {
            infantry: { ...prev.infantry },
            archer: { ...prev.archer },
            cavalry: { ...prev.cavalry },
          };
          for (const s of cleanStacks) next[s.classId][s.level] -= s.count;
          return next;
        });

        const march: ActiveMarch = {
          id: `march-${now}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'attack_castle',
          targetId: target.id,
          targetName: target.name,
          targetLevel: target.level,
          targetPosition: [...target.position],
          heroId: selectedHero?.id,
          heroName: selectedHero?.name,
          stacks: cleanStacks,
          status: 'marching',
          distanceTiles: timing.distanceTiles,
          marchSpeedTilesPerMin: metrics.marchSpeedTilesPerMin,
          formulaMarchMinutes: timing.formulaMinutes,
          gatherSpeedPerMin: metrics.baseGatheringSpeedPerMin,
          maxCarryLoad: metrics.totalLoad,
          carriedAmount: 0,
          phaseStartedAt: now,
          phaseDurationMs: timing.realSeconds * 1000,
          lastTickAt: now,
        };
        setActiveMarches((prev) => [...prev, march]);
        showToast(
          `🔥 ${heroLabel}${metrics.totalCount.toLocaleString()} troops (${metrics.totalPower.toLocaleString()} PWR) marching to besiege ${target.name}!`
        );
        return true;
      }

      if (target.category === 'monster' || action === 'attack' || action === 'rally') {
        if (target.type === 'shrine_a' || target.type === 'shrine_b' || target.type === 'shrine_c' || target.type === 'congress') {
          const tierKey = inferStructureKeyFromId(target.id);
          const block = checkStructureRuleBlock(target.id, tierKey);
          if (block) {
            showToast(block);
            return false;
          }
          if (action === 'garrison') {
            // Fall through to garrison branch below
          } else {
            // Assaulting/rallying shrine or congress opens its garrison battle or dispatches reinforcement
            handleOpenCommandHub(tierKey === 'congress' ? 'congress' : 'shrines', target.id);
            showToast(`⛩️ Opened ${target.name} Garrison & Defense Console.`);
            return true;
          }
        } else {
          const mLive = monsterStates[target.id];
          if (mLive?.isDefeated) {
            showToast(`⏳ ${target.name} is already defeated and awaiting respawn.`);
            return false;
          }

          setTroopInventory((prev) => {
            const next: TroopInventory = {
              infantry: { ...prev.infantry },
              archer: { ...prev.archer },
              cavalry: { ...prev.cavalry },
            };
            for (const s of cleanStacks) next[s.classId][s.level] -= s.count;
            return next;
          });

          const isRally = action === 'rally' || Boolean(rallyMeta);
          const defaultAllied = castles
            .filter((c) => c.faction === 'alliance' && !c.isMyCastle)
            .sort(
              (a, b) =>
                Math.hypot(a.position[0] - target.position[0], a.position[2] - target.position[2]) -
                Math.hypot(b.position[0] - target.position[0], b.position[2] - target.position[2])
            )
            .slice(0, 3)
            .map((c) => ({ name: c.owner || c.name, position: c.position }));
          const alliedOrigins =
            isRally && rallyMeta?.alliedOrigins && rallyMeta.alliedOrigins.length > 0
              ? rallyMeta.alliedOrigins
              : isRally
                ? defaultAllied
                : undefined;
          const rallyCaptains =
            isRally && rallyMeta?.captains && rallyMeta.captains.length > 0
              ? rallyMeta.captains
              : alliedOrigins?.map((o) => o.name);

          const march: ActiveMarch = {
            id: `march-${now}-${Math.random().toString(36).slice(2, 6)}`,
            kind: 'attack_monster',
            targetId: target.id,
            targetName: target.name,
            targetLevel: target.level,
            targetPosition: [...target.position],
            targetSubtype: target.subtype,
            isRally,
            rallyCaptains,
            rallyBonusPower: isRally && alliedOrigins ? alliedOrigins.length * 28 : 0,
            alliedOrigins,
            heroId: selectedHero?.id,
            heroName: selectedHero?.name,
            stacks: cleanStacks,
            status: 'marching',
            distanceTiles: timing.distanceTiles,
            marchSpeedTilesPerMin: metrics.marchSpeedTilesPerMin,
            formulaMarchMinutes: timing.formulaMinutes,
            gatherSpeedPerMin: metrics.baseGatheringSpeedPerMin,
            maxCarryLoad: metrics.totalLoad,
            carriedAmount: 0,
            phaseStartedAt: now,
            phaseDurationMs: timing.realSeconds * 1000,
            lastTickAt: now,
          };
          setActiveMarches((prev) => [...prev, march]);
          showToast(
            isRally
              ? `🚩 Alliance Rally (${(alliedOrigins?.length || 0) + 1} columns) marching on ${target.name}!`
              : `⚔️ ${heroLabel}${metrics.totalCount.toLocaleString()} troops (${metrics.totalPower.toLocaleString()} PWR) marching to ${target.name}!`
          );
          return true;
        }
      }

      if (
        action === 'garrison' ||
        target.type === 'shrine_a' ||
        target.type === 'shrine_b' ||
        target.type === 'shrine_c' ||
        target.type === 'congress'
      ) {
        const tierKey = inferStructureKeyFromId(target.id);
        const block = checkStructureRuleBlock(target.id, tierKey);
        if (block) {
          showToast(block);
          return false;
        }
        const req = balanceConfig.structures[tierKey];
        const invalidLevel = cleanStacks.find((s) => s.level < req.requiredTroopLevel);
        if (invalidLevel) {
          showToast(`⚠️ ${req.label} requires Level ${req.requiredTroopLevel}+ troops.`);
          return false;
        }

        const existingGar =
          shrineGarrisons[target.id] || createDefaultStructureGarrison(target.id, tierKey, balanceConfig);
        const currentGarCount =
          existingGar.playerStacks.reduce((s, st) => s + st.count, 0) +
          existingGar.allianceReinforcements.reduce((s, st) => s + st.count, 0);
        if (currentGarCount + metrics.totalCount > req.totalCapacity) {
          showToast(
            `⚠️ Exceeds ${req.label} max capacity (${currentGarCount.toLocaleString()} + ${metrics.totalCount.toLocaleString()} > ${req.totalCapacity.toLocaleString()}).`
          );
          return false;
        }

        setTroopInventory((prev) => {
          const next: TroopInventory = {
            infantry: { ...prev.infantry },
            archer: { ...prev.archer },
            cavalry: { ...prev.cavalry },
          };
          for (const s of cleanStacks) next[s.classId][s.level] -= s.count;
          return next;
        });

        const march: ActiveMarch = {
          id: `march-${now}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'reinforce_structure',
          targetId: target.id,
          targetName: target.name,
          targetLevel: target.level,
          targetPosition: [...target.position],
          heroId: selectedHero?.id,
          heroName: selectedHero?.name,
          stacks: cleanStacks,
          status: 'marching',
          distanceTiles: timing.distanceTiles,
          marchSpeedTilesPerMin: metrics.marchSpeedTilesPerMin,
          formulaMarchMinutes: timing.formulaMinutes,
          gatherSpeedPerMin: metrics.baseGatheringSpeedPerMin,
          maxCarryLoad: metrics.totalLoad,
          carriedAmount: 0,
          phaseStartedAt: now,
          phaseDurationMs: timing.realSeconds * 1000,
          lastTickAt: now,
        };
        setActiveMarches((prev) => [...prev, march]);
        showToast(`🛡️ ${heroLabel}${metrics.totalCount.toLocaleString()} garrison troops marching to reinforce ${target.name}!`);
        return true;
      }

      return false;
    },
    [
      activeMarches,
      balanceConfig,
      castles,
      checkStructureRuleBlock,
      equipmentBag,
      equippedIds,
      getMyCastlePosition,
      handleOpenCommandHub,
      monsterStates,
      nodeStates,
      research,
      showToast,
      shrineGarrisons,
      troopInventory,
      infantryGear,
    ]
  );

  const handleRecallMarch = useCallback(
    (marchId: string) => {
      const now = Date.now();
      setActiveMarches((prev) =>
        prev.map((m) => {
          if (m.id !== marchId || m.status === 'returning') return m;
          const myCastlePos = getMyCastlePosition();
          const fullReturnMs =
            calculateMarchTiming(m.targetPosition, myCastlePos, m.marchSpeedTilesPerMin, balanceConfig).realSeconds *
            1000;
          let returnDuration = fullReturnMs;
          if (m.status === 'marching') {
            const frac = Math.max(0.15, Math.min(1, (now - m.phaseStartedAt) / Math.max(500, m.phaseDurationMs)));
            returnDuration = Math.max(1500, Math.round(fullReturnMs * frac));
          }
          return {
            ...m,
            status: 'returning',
            carriedAmount: Math.round(m.carriedAmount),
            phaseStartedAt: now,
            phaseDurationMs: returnDuration,
            lastTickAt: now,
          };
        })
      );
      showToast('↩️ Recalled expedition back to My Castle with carried resources.');
    },
    [balanceConfig, getMyCastlePosition, showToast]
  );

  const handleTrainTroops = useCallback(
    (classId: TroopClassId, level: TroopLevel, count: number) => {
      if (count <= 0) return;
      const row = balanceConfig.troops[classId].levels[level];
      const cost = {
        food: row.trainCost.food * count,
        wood: row.trainCost.wood * count,
        iron: row.trainCost.iron * count,
        crystal: row.trainCost.crystal * count,
      };
      if (
        resources.food < cost.food ||
        resources.wood < cost.wood ||
        resources.iron < cost.iron ||
        resources.crystal < cost.crystal
      ) {
        showToast('⚠️ Insufficient Food, Wood, Iron, or Crystal to train that batch.');
        return;
      }

      setResources((prev) => ({
        ...prev,
        food: prev.food - cost.food,
        wood: prev.wood - cost.wood,
        iron: prev.iron - cost.iron,
        crystal: prev.crystal - cost.crystal,
      }));

      const now = Date.now();
      const durationMs = Math.max(
        2000,
        Math.round(((row.trainSecondsPerUnit * count) / Math.max(1, balanceConfig.simulationTimeScale)) * 1000)
      );
      const item: TrainingQueueItem = {
        id: `train-${now}-${Math.random().toString(36).slice(2, 6)}`,
        classId,
        level,
        count,
        startedAt: now,
        completesAt: now + durationMs,
      };
      setTrainingQueue((prev) => [...prev, item]);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSyncService.queueOfflineActionLabel(uid, `Trained ${count} ${balanceConfig.troops[classId].name}`);
      }
      showToast(`⚔️ Training ${count.toLocaleString()} × ${balanceConfig.troops[classId].name} Lv.${level}!`);
    },
    [balanceConfig, resources, showToast, uid]
  );

  const handleInstantFinishTraining = useCallback(
    (id: string) => {
      const target = trainingQueue.find((t) => t.id === id);
      if (!target) return;
      const gemCost = Math.max(10, Math.ceil(target.count * 0.12));
      if (resources.gems < gemCost) {
        showToast(`⚠️ Need ${gemCost} Gems to finish training immediately.`);
        return;
      }
      setResources((prev) => ({ ...prev, gems: prev.gems - gemCost }));
      setTrainingQueue((prev) => prev.filter((t) => t.id !== id));
      setTroopInventory((prev) =>
        mergeStacksIntoInventory(prev, [{ classId: target.classId, level: target.level, count: target.count }])
      );
      showToast(
        `⚡ Instant muster complete: +${target.count.toLocaleString()} ${balanceConfig.troops[target.classId].name} Lv.${target.level}!`
      );
    },
    [balanceConfig.troops, resources.gems, showToast, trainingQueue]
  );

  const handleHealWounded = useCallback(
    (classId?: TroopClassId, level?: TroopLevel) => {
      const now = Date.now();
      const newJobs: HospitalQueueItem[] = [];
      const nextWounded: TroopInventory = {
        infantry: { ...woundedInventory.infantry },
        archer: { ...woundedInventory.archer },
        cavalry: { ...woundedInventory.cavalry },
      };

      const classes: TroopClassId[] = classId ? [classId] : ['infantry', 'archer', 'cavalry'];
      const levels: TroopLevel[] = level ? [level] : [1, 2, 3, 4, 5];
      let totalQueued = 0;

      for (const cls of classes) {
        for (const lv of levels) {
          const cnt = nextWounded[cls][lv] || 0;
          if (cnt <= 0) continue;
          nextWounded[cls][lv] = 0;
          totalQueued += cnt;
          const durMs = Math.max(
            1800,
            Math.round(
              ((cnt * balanceConfig.hospitalHealSecondsPerTroop) /
                (Math.max(1, balanceConfig.simulationTimeScale) * bonuses.healSpeedMult)) *
                1000
            )
          );
          newJobs.push({
            id: `heal-${now}-${cls}-${lv}-${Math.random().toString(36).slice(2, 5)}`,
            classId: cls,
            level: lv,
            count: cnt,
            startedAt: now,
            completesAt: now + durMs,
          });
        }
      }

      if (totalQueued === 0) {
        showToast('✅ No wounded warriors currently awaiting treatment.');
        return;
      }
      setWoundedInventory(nextWounded);
      setHospitalQueue((prev) => [...prev, ...newJobs]);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSyncService.queueOfflineActionLabel(uid, `Healed ${totalQueued} Troops`);
      }
      showToast(`🏥 Royal Hospital treating ${totalQueued.toLocaleString()} wounded troops!`);
    },
    [balanceConfig.hospitalHealSecondsPerTroop, balanceConfig.simulationTimeScale, bonuses.healSpeedMult, showToast, uid, woundedInventory]
  );

  const handleDeployStructureTroops = useCallback(
    (
      structureId: string,
      structureKey: StructureTierKey,
      classId: TroopClassId,
      level: TroopLevel,
      count: number
    ) => {
      if (count <= 0) return;
      const ruleBlock = checkStructureRuleBlock(structureId, structureKey);
      if (ruleBlock) {
        showToast(ruleBlock);
        return;
      }
      const req = balanceConfig.structures[structureKey];
      if (level < req.requiredTroopLevel) {
        showToast(`⚠️ ${req.label} requires Level ${req.requiredTroopLevel}+ troops.`);
        return;
      }
      const avail = troopInventory[classId][level] || 0;
      const sendCount = Math.min(avail, count);
      if (sendCount <= 0) {
        showToast(`⚠️ No ${balanceConfig.troops[classId].name} Lv.${level} available in Barracks.`);
        return;
      }

      const current =
        shrineGarrisons[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
      const currentTotal =
        current.playerStacks.reduce((s, st) => s + st.count, 0) +
        current.allianceReinforcements.reduce((s, st) => s + st.count, 0);
      const space = Math.max(0, req.totalCapacity - currentTotal);
      const actual = Math.min(sendCount, space);
      if (actual <= 0) {
        showToast(`⚠️ ${current.name} garrison is already at ${req.totalCapacity.toLocaleString()} max capacity.`);
        return;
      }

      setTroopInventory((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], [level]: prev[classId][level] - actual },
      }));
      setShrineGarrisons((prev) => {
        const base = prev[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
        return {
          ...prev,
          [structureId]: {
            ...base,
            ownerFaction: 'alliance',
            playerStacks: addToStackList(base.playerStacks, classId, level, actual),
          },
        };
      });
      const wasOwned = current.ownerFaction === 'alliance';
      setConqueredPlots((prev) => ({ ...prev, [structureId]: 'alliance' }));
      if (!wasOwned) {
        worldMapRef.current?.conquerStructureById(structureId);
      }
      worldMapRef.current?.triggerStructureEffect(structureId, 'garrison');
      showToast(`🛡️ Deployed ${actual.toLocaleString()} ${balanceConfig.troops[classId].name} Lv.${level} to ${current.name}.`);
    },
    [balanceConfig, checkStructureRuleBlock, showToast, shrineGarrisons, troopInventory]
  );

  const handleWithdrawStructureTroops = useCallback(
    (structureId: string, classId: TroopClassId, level: TroopLevel, count: number) => {
      if (count <= 0) return;
      const base = shrineGarrisons[structureId];
      if (!base) return;
      const found = base.playerStacks.find((s) => s.classId === classId && s.level === level);
      if (!found || found.count <= 0) return;
      const pull = Math.min(found.count, count);

      setShrineGarrisons((prev) => {
        const cur = prev[structureId];
        if (!cur) return prev;
        const nextStacks = cur.playerStacks
          .map((s) =>
            s.classId === classId && s.level === level ? { ...s, count: s.count - pull } : s
          )
          .filter((s) => s.count > 0);
        return {
          ...prev,
          [structureId]: { ...cur, playerStacks: nextStacks },
        };
      });
      setTroopInventory((prev) =>
        mergeStacksIntoInventory(prev, [{ classId, level, count: pull }])
      );
      showToast(`↩️ Withdrew ${pull.toLocaleString()} ${balanceConfig.troops[classId].name} Lv.${level} to Barracks.`);
    },
    [balanceConfig.troops, showToast, shrineGarrisons]
  );

  const handleAutoFillStructure = useCallback(
    (structureId: string, structureKey: StructureTierKey) => {
      const ruleBlock = checkStructureRuleBlock(structureId, structureKey);
      if (ruleBlock) {
        showToast(ruleBlock);
        return;
      }
      const req = balanceConfig.structures[structureKey];
      const lv = req.requiredTroopLevel;
      const base = shrineGarrisons[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
      const usedCap =
        base.playerStacks.reduce((s, st) => s + st.count, 0) +
        base.allianceReinforcements.reduce((s, st) => s + st.count, 0);
      let remCap = Math.max(0, req.totalCapacity - usedCap);
      if (remCap <= 0) {
        showToast(`✅ ${base.name} garrison is already at full capacity!`);
        return;
      }

      const needed: Array<[TroopClassId, number]> = [
        ['infantry', req.requiredInfantry],
        ['archer', req.requiredArcher],
        ['cavalry', req.requiredCavalry],
      ];

      let nextPlayerStacks = base.playerStacks.map((s) => ({ ...s }));
      const nextInv: TroopInventory = {
        infantry: { ...troopInventory.infantry },
        archer: { ...troopInventory.archer },
        cavalry: { ...troopInventory.cavalry },
      };

      let deployedTotal = 0;
      for (const [cls, targetQty] of needed) {
        const already = nextPlayerStacks
          .filter((s) => s.classId === cls)
          .reduce((s, st) => s + st.count, 0);
        const deficit = Math.max(0, targetQty - already);
        const avail = nextInv[cls][lv] || 0;
        const add = Math.min(deficit, avail, remCap);
        if (add > 0) {
          nextInv[cls][lv] -= add;
          nextPlayerStacks = addToStackList(nextPlayerStacks, cls, lv, add);
          remCap -= add;
          deployedTotal += add;
        }
      }

      if (deployedTotal <= 0) {
        showToast(`⚠️ Need Lv.${lv} Magar/Limbu/Thakuri troops in Barracks to auto-fill ${req.label}.`);
        return;
      }

      setTroopInventory(nextInv);
      setShrineGarrisons((prev) => ({
        ...prev,
        [structureId]: {
          ...base,
          ownerFaction: 'alliance',
          barrierActive: true,
          playerStacks: nextPlayerStacks,
        },
      }));
      const wasOwned = base.ownerFaction === 'alliance';
      setConqueredPlots((prev) => ({ ...prev, [structureId]: 'alliance' }));
      if (!wasOwned) {
        worldMapRef.current?.conquerStructureById(structureId);
      }
      worldMapRef.current?.setStructureBarrierActive(structureId, true);
      worldMapRef.current?.triggerStructureEffect(structureId, 'garrison');
      showToast(`⚡ Auto-filled ${deployedTotal.toLocaleString()} Lv.${lv} Nepalese troops into ${base.name}!`);
    },
    [balanceConfig, checkStructureRuleBlock, showToast, shrineGarrisons, troopInventory]
  );

  const handleAllianceReinforceStructure = useCallback(
    (structureId: string, structureKey: StructureTierKey) => {
      const ruleBlock = checkStructureRuleBlock(structureId, structureKey);
      if (ruleBlock) {
        showToast(ruleBlock);
        return;
      }
      const req = balanceConfig.structures[structureKey];
      const base = shrineGarrisons[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
      const currentTotal =
        base.playerStacks.reduce((s, st) => s + st.count, 0) +
        base.allianceReinforcements.reduce((s, st) => s + st.count, 0);
      const space = Math.max(0, req.totalCapacity - currentTotal);
      if (space <= 0) {
        showToast(`⚠️ ${base.name} garrison is already at ${req.totalCapacity.toLocaleString()} max capacity.`);
        return;
      }

      const lv = req.requiredTroopLevel;
      const chunk = Math.min(space, Math.round(req.totalCapacity * 0.25));
      const inf = Math.round(chunk * 0.5);
      const arc = Math.round(chunk * 0.3);
      const cav = Math.max(0, chunk - inf - arc);

      setShrineGarrisons((prev) => {
        const cur = prev[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
        let nextAllies = cur.allianceReinforcements.map((s) => ({ ...s }));
        nextAllies = addToStackList(nextAllies, 'infantry', lv, inf);
        nextAllies = addToStackList(nextAllies, 'archer', lv, arc);
        nextAllies = addToStackList(nextAllies, 'cavalry', lv, cav);
        return {
          ...prev,
          [structureId]: {
            ...cur,
            ownerFaction: 'alliance',
            allianceReinforcements: nextAllies,
          },
        };
      });
      const wasOwned = base.ownerFaction === 'alliance';
      setConqueredPlots((prev) => ({ ...prev, [structureId]: 'alliance' }));
      if (!wasOwned) {
        worldMapRef.current?.conquerStructureById(structureId);
      }
      worldMapRef.current?.triggerStructureEffect(structureId, 'garrison');
      showToast(`🤝 Alliance allies reinforced ${base.name} with +${(inf + arc + cav).toLocaleString()} Lv.${lv} troops!`);
    },
    [balanceConfig, checkStructureRuleBlock, showToast, shrineGarrisons]
  );

  const handleToggleStructureBarrier = useCallback(
    (structureId: string, structureKey: StructureTierKey) => {
      if (structureKey === 'congress' && !shrineRuleStatus.congressUnlocked) {
        showToast(`🔒 Congress Locked! ${shrineRuleStatus.congressRequirementText}.`);
        return;
      }
      const cur = shrineGarrisons[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
      const nextActive = !cur.barrierActive;
      setShrineGarrisons((prev) => ({
        ...prev,
        [structureId]: {
          ...cur,
          barrierActive: nextActive,
          barrierHp: nextActive ? cur.maxBarrierHp : cur.barrierHp,
        },
      }));
      worldMapRef.current?.setStructureBarrierActive(structureId, nextActive);
      showToast(
        nextActive
          ? `🛡️ Protection Barrier ACTIVATED on ${cur.name} (${cur.maxBarrierHp.toLocaleString()} Shield HP)!`
          : `🔓 Protection Barrier lowered on ${cur.name}.`
      );
    },
    [balanceConfig, showToast, shrineGarrisons, shrineRuleStatus.congressRequirementText, shrineRuleStatus.congressUnlocked]
  );

  const handleSimulateStructureDefense = useCallback(
    (structureId: string, structureKey: StructureTierKey) => {
      if (structureKey === 'congress' && !shrineRuleStatus.congressUnlocked) {
        showToast(`🔒 Congress Locked! ${shrineRuleStatus.congressRequirementText}.`);
        return;
      }
      const req = balanceConfig.structures[structureKey];
      const cur = shrineGarrisons[structureId] || createDefaultStructureGarrison(structureId, structureKey, balanceConfig);
      const combinedGarrison = [...cur.playerStacks, ...cur.allianceReinforcements].filter((s) => s.count > 0);
      if (combinedGarrison.length === 0) {
        showToast(`⚠️ Deploy or reinforce troops inside ${cur.name} before running a defense battle!`);
        return;
      }

      // Scaled rival siege army so player experiences mixed-class defense & single-class elimination rules
      const lv = req.requiredTroopLevel;
      const atkScale = 0.72;
      const attackerStacks: TroopStack[] = [
        { classId: 'infantry', level: lv, count: Math.max(50, Math.round(req.requiredInfantry * atkScale)) },
        { classId: 'archer', level: lv, count: Math.max(40, Math.round(req.requiredArcher * atkScale)) },
        { classId: 'cavalry', level: lv, count: Math.max(30, Math.round(req.requiredCavalry * atkScale)) },
      ];

      const effectiveBonuses = cur.barrierActive
        ? { ...bonuses, hpMult: bonuses.hpMult * 1.18 }
        : bonuses;

      const result = resolveGarrisonDefenseBattle(
        combinedGarrison,
        attackerStacks,
        balanceConfig,
        effectiveBonuses,
        infantryGear
      );

      // Map survival ratio back to player vs alliance garrison proportionally
      const survMap = new Map<string, number>();
      for (const s of result.defenderSurviving) {
        const k = `${s.classId}-${s.level}`;
        survMap.set(k, (survMap.get(k) || 0) + s.count);
      }
      const totalByKey = new Map<string, number>();
      for (const s of combinedGarrison) {
        const k = `${s.classId}-${s.level}`;
        totalByKey.set(k, (totalByKey.get(k) || 0) + s.count);
      }

      const nextPlayerStacks: TroopStack[] = [];
      const nextAllianceStacks: TroopStack[] = [];
      for (const s of cur.playerStacks) {
        const k = `${s.classId}-${s.level}`;
        const tot = totalByKey.get(k) || 1;
        const surv = survMap.get(k) || 0;
        const ratio = Math.min(1, surv / tot);
        const kept = Math.round(s.count * ratio);
        if (kept > 0) nextPlayerStacks.push({ ...s, count: kept });
      }
      for (const s of cur.allianceReinforcements) {
        const k = `${s.classId}-${s.level}`;
        const tot = totalByKey.get(k) || 1;
        const surv = survMap.get(k) || 0;
        const ratio = Math.min(1, surv / tot);
        const kept = Math.round(s.count * ratio);
        if (kept > 0) nextAllianceStacks.push({ ...s, count: kept });
      }

      // Send player's share of wounded troops to Hospital
      const playerCount = cur.playerStacks.reduce((s, st) => s + st.count, 0);
      const totalGarCount = combinedGarrison.reduce((s, st) => s + st.count, 0);
      const playerShare = totalGarCount > 0 ? playerCount / totalGarCount : 0;

      const woundedForHospital: TroopStack[] = [];
      const woundedByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
      const lostByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
      const survivingByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };

      for (const w of result.defenderWounded) {
        woundedByClass[w.classId] += w.count;
        const pW = Math.round(w.count * playerShare);
        if (pW > 0) woundedForHospital.push({ ...w, count: pW });
      }
      for (const l of result.defenderLost) lostByClass[l.classId] += l.count;
      for (const sv of result.defenderSurviving) survivingByClass[sv.classId] += sv.count;

      if (woundedForHospital.length > 0) {
        setWoundedInventory((prev) => mergeStacksIntoInventory(prev, woundedForHospital));
      }

      const summary = `${result.defenderWon ? 'DEFENSE VICTORY' : 'GARRISON BREACHED'} in ${result.rounds} rounds · ${result.notes[0] || ''}`;
      setShrineGarrisons((prev) => ({
        ...prev,
        [structureId]: {
          ...cur,
          ownerFaction: result.defenderWon ? 'alliance' : 'enemy',
          barrierHp: result.defenderWon
            ? Math.max(0, Math.round(cur.barrierHp * (cur.barrierActive ? 0.85 : 1)))
            : 0,
          playerStacks: nextPlayerStacks,
          allianceReinforcements: nextAllianceStacks,
          lastBattleSummary: summary,
        },
      }));
      setConqueredPlots((prev) => ({ ...prev, [structureId]: result.defenderWon ? 'alliance' : 'enemy' }));

      if (result.defenderWon) {
        if (cur.ownerFaction !== 'alliance') {
          worldMapRef.current?.conquerStructureById(structureId);
        }
        setResources((prev) => ({
          ...prev,
          crystal: prev.crystal + (structureKey === 'congress' ? 250 : 60),
          gold: prev.gold + (structureKey === 'congress' ? 2500 : 800),
        }));
      }
      worldMapRef.current?.triggerCombatVfxAtTarget(
        structureId,
        result.defenderWon ? '🛡️ GARRISON HELD!' : '💥 GARRISON BREACHED!',
        result.defenderWon ? '#34d399' : '#f87171',
        true
      );

      const report: BattleReport = {
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        kind: structureKey === 'congress' ? 'congress' : 'shrine',
        targetId: structureId,
        targetName: cur.name,
        targetLevel: req.requiredTroopLevel,
        victory: result.defenderWon,
        rounds: result.rounds,
        targetRemainingHp: result.attackerRemainingCount,
        targetMaxHp: attackerStacks.reduce((s, st) => s + st.count, 0),
        deployedCount: totalGarCount,
        woundedByClass,
        lostByClass,
        survivingByClass,
        rewards: result.defenderWon
          ? {
              gold: structureKey === 'congress' ? 2500 : 800,
              crystal: structureKey === 'congress' ? 250 : 60,
              xp: structureKey === 'congress' ? 1800 : 650,
            }
          : {},
        notes: result.notes,
      };
      setBattleReports((prev) => [report, ...prev.slice(0, 39)]);
      if (result.defenderWon) {
        setCommanderXp((xp) => xp + (structureKey === 'congress' ? 1800 : 650));
      }
      showToast(summary);
    },
    [balanceConfig, bonuses, infantryGear, showToast, shrineGarrisons, shrineRuleStatus.congressRequirementText, shrineRuleStatus.congressUnlocked]
  );

  const handleUpgradeInfantryGear = useCallback(
    (level: TroopLevel, slot: InfantryGearSlot) => {
      const currentRank = infantryGear[level]?.[slot] ?? 0;
      if (currentRank >= MAX_INFANTRY_GEAR_RANK) {
        showToast(`⚒️ Lv.${level} Magar ${slot} is already forged to Master Rank +${MAX_INFANTRY_GEAR_RANK}.`);
        return;
      }
      const cost = getInfantryGearUpgradeCost(level, slot, currentRank);
      if (!cost) return;
      if (
        resources.wood < cost.wood ||
        resources.iron < cost.iron ||
        resources.gold < cost.gold ||
        resources.crystal < cost.crystal
      ) {
        showToast(
          `⚠️ Need ${cost.wood.toLocaleString()} Wood, ${cost.iron.toLocaleString()} Iron, ${cost.gold.toLocaleString()} Gold${cost.crystal > 0 ? ` & ${cost.crystal.toLocaleString()} Crystal` : ''}.`
        );
        return;
      }

      setResources((prev) => ({
        ...prev,
        wood: prev.wood - cost.wood,
        iron: prev.iron - cost.iron,
        gold: prev.gold - cost.gold,
        crystal: prev.crystal - cost.crystal,
      }));

      const nextRank = currentRank + 1;
      const nextTierRanks = {
        ...infantryGear[level],
        [slot]: nextRank,
      };
      setInfantryGear((prev) => ({
        ...prev,
        [level]: nextTierRanks,
      }));
      worldMapRef.current?.setArmyEquipmentTier(level, nextTierRanks);

      const spec = MAGAR_PROGRESSION_SPECS[level];
      const itemLabel =
        slot === 'weapon' ? spec.weaponName : slot === 'shield' ? spec.shieldName : spec.armorName;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSyncService.queueOfflineActionLabel(uid, `Forged ${itemLabel}`);
      }
      showToast(`⚒️ Forged Lv.${level} ${spec.tierName} · ${itemLabel} to +${nextRank}!`);
    },
    [infantryGear, resources.crystal, resources.gold, resources.iron, resources.wood, showToast, uid]
  );

  const handleUpgradeResearch = useCallback(
    (key: keyof ResearchState) => {
      const lv = research[key];
      if (lv >= 10) {
        showToast('🎓 This Imperial Research doctrine is already at Master Level 10.');
        return;
      }
      const foodCost = 3500 * (lv + 1);
      const crystalCost = 120 * (lv + 1);
      if (resources.food < foodCost || resources.crystal < crystalCost) {
        showToast(`⚠️ Need ${foodCost.toLocaleString()} Food & ${crystalCost.toLocaleString()} Crystal.`);
        return;
      }
      setResources((prev) => ({
        ...prev,
        food: prev.food - foodCost,
        crystal: prev.crystal - crystalCost,
      }));
      setResearch((prev) => ({ ...prev, [key]: prev[key] + 1 }));
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSyncService.queueOfflineActionLabel(uid, `Researched ${key} Lv.${lv + 1}`);
      }
      showToast(`🎓 Upgraded ${key} to Level ${lv + 1}!`);
    },
    [research, resources.crystal, resources.food, showToast, uid]
  );

  const handleToggleEquipItem = useCallback(
    (itemId: string) => {
      const item = equipmentBag.find((e) => e.id === itemId);
      if (!item) return;
      setEquippedIds((prev) => {
        if (prev.includes(itemId)) {
          showToast(`🔓 Unequipped ${item.name}.`);
          return prev.filter((id) => id !== itemId);
        }
        // Replace any other equipped item in the same slot
        const kept = prev.filter((id) => {
          const existing = equipmentBag.find((e) => e.id === id);
          return !existing || existing.slot !== item.slot;
        });
        showToast(`⚒️ Equipped ${item.name} (${item.slot.toUpperCase()})!`);
        return [...kept, itemId];
      });
    },
    [equipmentBag, showToast]
  );

  const handleUpdateBalanceConfig = useCallback(
    (next: GameBalanceConfig) => {
      setBalanceConfig(next);
      saveBalanceConfig(next);
      setNodeStates((prev) => buildInitialNodeStates(next, prev));
      setMonsterStates((prev) => buildInitialMonsterStates(next, prev));
    },
    []
  );

  const handleResetBalanceConfig = useCallback(() => {
    const def = resetBalanceConfig();
    setBalanceConfig(def);
    setNodeStates((prev) => buildInitialNodeStates(def, prev));
    setMonsterStates((prev) => buildInitialMonsterStates(def, prev));
    showToast('↺ Balance configuration reset to Nepalese Kingdom defaults.');
  }, [showToast]);

  // ============================================================================
  // MASTER REAL-TIME SIMULATION LOOP (250ms tick)
  // ============================================================================
  const lastArmyHudRef = useRef<{
    statusText: string;
    progressPct: number;
    posKey: string;
  }>({
    statusText: 'Garrisoned inside My Castle',
    progressPct: 100,
    posKey: '1600,1551',
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();

      const snap = simSnapshotRef.current;
      const cfg = snap.balanceConfig;
      const bn = snap.bonuses;
      const myCastlePos =
        snap.castles.find((c) => c.isMyCastle)?.position || ([1600, 10, 1568] as [number, number, number]);

      // 1. Complete Training Queue
      if (snap.trainingQueue.length > 0) {
        const done = snap.trainingQueue.filter((t) => now >= t.completesAt);
        if (done.length > 0) {
          setTrainingQueue((prev) => prev.filter((t) => now < t.completesAt));
          setTroopInventory((prev) =>
            mergeStacksIntoInventory(
              prev,
              done.map((d) => ({ classId: d.classId, level: d.level, count: d.count }))
            )
          );
          const totalDone = done.reduce((s, d) => s + d.count, 0);
          showToast(`⚔️ Training complete: +${totalDone.toLocaleString()} Nepalese troops ready in Barracks!`);
        }
      }

      // 2. Complete Hospital Healing Queue
      if (snap.hospitalQueue.length > 0) {
        const healed = snap.hospitalQueue.filter((h) => now >= h.completesAt);
        if (healed.length > 0) {
          setHospitalQueue((prev) => prev.filter((h) => now < h.completesAt));
          setTroopInventory((prev) =>
            mergeStacksIntoInventory(
              prev,
              healed.map((h) => ({ classId: h.classId, level: h.level, count: h.count }))
            )
          );
          const totalHealed = healed.reduce((s, h) => s + h.count, 0);
          showToast(`🏥 Hospital recovery complete: +${totalHealed.toLocaleString()} warriors returned to duty!`);
        }
      }

      // 3. Process Node Respawns
      let nodeChanged = false;
      const nextNodes: Record<string, LiveNodeStatus> = { ...snap.nodeStates };
      for (const [id, st] of Object.entries(nextNodes)) {
        if (st.respawnAt !== null && now >= st.respawnAt) {
          nextNodes[id] = { remainingYield: st.maxYield, maxYield: st.maxYield, respawnAt: null };
          nodeChanged = true;
          worldMapRef.current?.updateEntityLiveState(id, { yieldAmount: st.maxYield, isDefeated: false });
        }
      }

      // 4. Process Monster Respawns
      let monsterChanged = false;
      const nextMonsters: Record<string, LiveMonsterStatus> = { ...snap.monsterStates };
      for (const [id, m] of Object.entries(nextMonsters)) {
        if (m.respawnAt !== null && now >= m.respawnAt) {
          nextMonsters[id] = { currentHp: m.maxHp, maxHp: m.maxHp, isDefeated: false, respawnAt: null };
          monsterChanged = true;
          worldMapRef.current?.updateEntityLiveState(id, {
            health: m.maxHp,
            maxHealth: m.maxHp,
            isDefeated: false,
          });
        }
      }

      // 5. Process Active Marches (Marching -> Gathering / Monster Combat / Castle Siege -> Returning -> Vault Deposit)
      let castleStateChanged = false;
      const nextCastles: Record<string, LiveCastleStatus> = { ...snap.castleStates };

      if (snap.activeMarches.length > 0) {
        let marchesChanged = false;
        const remainingMarches: ActiveMarch[] = [];

        for (const m of snap.activeMarches) {
          const march = { ...m };
          const elapsed = now - march.phaseStartedAt;

          if (march.status === 'marching') {
            if (elapsed >= march.phaseDurationMs) {
              marchesChanged = true;
              if (march.kind === 'gather') {
                const node = nextNodes[march.targetId] || {
                  remainingYield: 5000,
                  maxYield: 5000,
                  respawnAt: null,
                };
                const rType = march.resourceType || 'food';
                const targetPull = Math.min(node.remainingYield, march.maxCarryLoad - march.carriedAmount);
                if (targetPull <= 0) {
                  march.status = 'returning';
                  march.phaseStartedAt = now;
                  march.phaseDurationMs =
                    calculateMarchTiming(march.targetPosition, myCastlePos, march.marchSpeedTilesPerMin, cfg)
                      .realSeconds * 1000;
                  march.lastTickAt = now;
                } else {
                  const gatherTiming = calculateResourceGatherTiming(targetPull, rType, march.gatherSpeedPerMin, cfg);
                  march.status = 'gathering';
                  march.phaseStartedAt = now;
                  march.phaseDurationMs = gatherTiming.realSeconds * 1000;
                  march.lastTickAt = now;
                  worldMapRef.current?.triggerCombatVfxAtTarget(march.targetId, '⛏️ GATHERING', '#34d399');
                }
                remainingMarches.push(march);
              } else if (march.kind === 'attack_monster') {
                const mCfg = cfg.monstersByLevel[Math.max(0, Math.min(9, march.targetLevel - 1))];
                const curMonster = nextMonsters[march.targetId] || {
                  currentHp: mCfg.hp,
                  maxHp: mCfg.hp,
                  isDefeated: false,
                  respawnAt: null,
                };
                const marchHero = getHeroById(march.heroId);
                const marchBonuses = marchHero
                  ? getCalculatedBonuses(snap.research, snap.equippedIds, snap.equipmentBag, marchHero)
                  : bn;
                const battleRes = resolveMonsterCombat(
                  march.stacks,
                  march.targetLevel,
                  curMonster.currentHp,
                  cfg,
                  marchBonuses,
                  {
                    isRally: march.isRally,
                    alliedColumnCount: march.alliedOrigins?.length ?? march.rallyCaptains?.length ?? 0,
                    monsterSubtype: march.targetSubtype,
                  },
                  snap.infantryGear
                );

                monsterChanged = true;
                if (battleRes.victory) {
                  nextMonsters[march.targetId] = {
                    currentHp: 0,
                    maxHp: mCfg.hp,
                    isDefeated: true,
                    respawnAt: now + mCfg.respawnSeconds * 1000,
                  };
                  worldMapRef.current?.updateEntityLiveState(march.targetId, {
                    health: 0,
                    isDefeated: true,
                    respawnAt: now + mCfg.respawnSeconds * 1000,
                  });
                  worldMapRef.current?.triggerCombatVfxAtTarget(
                    march.targetId,
                    `💀 VICTORY! +${mCfg.suggestedReward}`,
                    '#fde047',
                    true
                  );
                } else {
                  nextMonsters[march.targetId] = {
                    currentHp: battleRes.monsterRemainingHp,
                    maxHp: mCfg.hp,
                    isDefeated: false,
                    respawnAt: null,
                  };
                  worldMapRef.current?.updateEntityLiveState(march.targetId, {
                    health: battleRes.monsterRemainingHp,
                    isDefeated: false,
                  });
                  worldMapRef.current?.triggerCombatVfxAtTarget(
                    march.targetId,
                    `💥 ${battleRes.monsterRemainingHp.toLocaleString()} HP LEFT`,
                    '#f87171',
                    true
                  );
                }

                // Move wounded to Hospital
                if (battleRes.woundedStacks.length > 0) {
                  setWoundedInventory((prev) => mergeStacksIntoInventory(prev, battleRes.woundedStacks));
                }

                // Grant victory rewards + XP + rare equipment
                if (battleRes.victory) {
                  const r = battleRes.rewards;
                  setResources((prev) => ({
                    ...prev,
                    food: prev.food + (r.food || 0),
                    wood: prev.wood + (r.wood || 0),
                    stone: prev.stone + (r.stone || 0),
                    iron: prev.iron + (r.iron || 0),
                    crystal: prev.crystal + (r.crystal || 0),
                    gold: prev.gold + (r.gold || 0),
                  }));
                  setCommanderXp((xp) => xp + r.xp);
                  const drop = r.equipmentDrop;
                  if (drop) {
                    setEquipmentBag((prev) => (prev.some((e) => e.id === drop.id) ? prev : [...prev, drop]));
                  }
                  showToast(
                    `💀 ${march.targetName} defeated! +${r.xp} XP, +${r.crystal || 0} Crystal${drop ? ` & ${drop.name}` : ''}!`
                  );
                } else {
                  showToast(`🛡️ Defeat vs ${march.targetName} (${battleRes.monsterRemainingHp.toLocaleString()} HP remaining).`);
                }

                // Log BattleReport
                const report: BattleReport = {
                  id: `rep-${now}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: now,
                  kind: 'monster',
                  targetId: march.targetId,
                  targetName: march.targetName,
                  targetLevel: march.targetLevel,
                  heroId: march.heroId,
                  heroName: march.heroName,
                  victory: battleRes.victory,
                  rounds: battleRes.rounds,
                  targetRemainingHp: battleRes.monsterRemainingHp,
                  targetMaxHp: mCfg.hp,
                  deployedCount: march.stacks.reduce((s, st) => s + st.count, 0),
                  woundedByClass: battleRes.woundedByClass,
                  lostByClass: battleRes.lostByClass,
                  survivingByClass: battleRes.survivingByClass,
                  rewards: battleRes.rewards,
                  notes: battleRes.notes,
                };
                setBattleReports((prev) => [report, ...prev.slice(0, 39)]);

                const survCount = battleRes.survivingStacks.reduce((s, st) => s + st.count, 0);
                if (survCount > 0) {
                  march.stacks = battleRes.survivingStacks;
                  march.status = 'returning';
                  march.phaseStartedAt = now;
                  march.phaseDurationMs =
                    calculateMarchTiming(march.targetPosition, myCastlePos, march.marchSpeedTilesPerMin, cfg)
                      .realSeconds * 1000;
                  march.lastTickAt = now;
                  remainingMarches.push(march);
                }
              } else if (march.kind === 'attack_castle') {
                const targetCastle = snap.castles.find((c) => c.id === march.targetId);
                const maxHp = getEnemyCastleMaxHp(targetCastle?.power ?? 160000, march.targetLevel);
                const prevCastle = nextCastles[march.targetId] || {
                  currentHp: maxHp,
                  maxHp,
                  isBurning: false,
                  lastAttackedAt: null,
                  teleportCount: 0,
                };
                const marchHero = getHeroById(march.heroId);
                const marchBonuses = marchHero
                  ? getCalculatedBonuses(snap.research, snap.equippedIds, snap.equipmentBag, marchHero)
                  : bn;
                const siegeRes = resolveCastleSiegeCombat(
                  march.stacks,
                  march.targetLevel,
                  prevCastle.currentHp,
                  maxHp,
                  targetCastle?.power ?? 160000,
                  cfg,
                  marchBonuses,
                  marchHero,
                  snap.infantryGear
                );

                if (siegeRes.woundedStacks.length > 0) {
                  setWoundedInventory((prev) => mergeStacksIntoInventory(prev, siegeRes.woundedStacks));
                }

                worldMapRef.current?.triggerCombatVfxAtTarget(
                  march.targetId,
                  siegeRes.breached
                    ? '🔥 0 HP · TELEPORTED!'
                    : `🔥 -${siegeRes.damageDealt.toLocaleString()} HP`,
                  siegeRes.breached ? '#38bdf8' : '#fb923c',
                  true
                );

                castleStateChanged = true;
                if (siegeRes.breached) {
                  const newCoords = worldMapRef.current?.teleportEnemyCastle(march.targetId);
                  nextCastles[march.targetId] = {
                    currentHp: maxHp,
                    maxHp,
                    isBurning: false,
                    lastAttackedAt: now,
                    teleportCount: prevCastle.teleportCount + 1,
                  };

                  const r = siegeRes.rewards;
                  setResources((prev) => ({
                    ...prev,
                    food: prev.food + (r.food || 0),
                    wood: prev.wood + (r.wood || 0),
                    stone: prev.stone + (r.stone || 0),
                    iron: prev.iron + (r.iron || 0),
                    crystal: prev.crystal + (r.crystal || 0),
                    gold: prev.gold + (r.gold || 0),
                    gems: prev.gems + (r.gems || 0),
                  }));
                  setCommanderXp((xp) => xp + r.xp);
                  const drop = r.equipmentDrop;
                  if (drop) {
                    setEquipmentBag((prev) => (prev.some((e) => e.id === drop.id) ? prev : [...prev, drop]));
                  }

                  const coordTxt = newCoords ? `[${Math.round(newCoords[0])}, ${Math.round(newCoords[2])}]` : 'a random sector';
                  showToast(
                    `🌀 ${march.targetName} hit 0 HP and teleported to ${coordTxt}! +${(r.gold || 0).toLocaleString()} Gold, +${r.gems || 0} Gems!`
                  );

                  setSelectedEntity((prevSel) => (prevSel?.id === march.targetId ? null : prevSel));
                } else {
                  nextCastles[march.targetId] = {
                    currentHp: siegeRes.castleRemainingHp,
                    maxHp,
                    isBurning: true,
                    lastAttackedAt: now,
                    teleportCount: prevCastle.teleportCount,
                  };
                  worldMapRef.current?.setCastleBurningState(
                    march.targetId,
                    true,
                    siegeRes.castleRemainingHp,
                    maxHp
                  );
                  const r = siegeRes.rewards;
                  setResources((prev) => ({
                    ...prev,
                    gold: prev.gold + (r.gold || 0),
                  }));
                  setCommanderXp((xp) => xp + r.xp);
                  showToast(
                    `🔥 ${march.targetName} is BURNING! (${siegeRes.castleRemainingHp.toLocaleString()} / ${maxHp.toLocaleString()} HP remaining)`
                  );
                }

                const report: BattleReport = {
                  id: `rep-${now}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: now,
                  kind: 'castle',
                  targetId: march.targetId,
                  targetName: march.targetName,
                  targetLevel: march.targetLevel,
                  heroId: march.heroId,
                  heroName: march.heroName,
                  victory: siegeRes.breached,
                  rounds: siegeRes.rounds,
                  targetRemainingHp: siegeRes.castleRemainingHp,
                  targetMaxHp: maxHp,
                  deployedCount: march.stacks.reduce((s, st) => s + st.count, 0),
                  woundedByClass: siegeRes.woundedByClass,
                  lostByClass: siegeRes.lostByClass,
                  survivingByClass: siegeRes.survivingByClass,
                  rewards: siegeRes.rewards,
                  notes: siegeRes.notes,
                };
                setBattleReports((prev) => [report, ...prev.slice(0, 39)]);

                const survCount = siegeRes.survivingStacks.reduce((s, st) => s + st.count, 0);
                if (survCount > 0) {
                  march.stacks = siegeRes.survivingStacks;
                  march.status = 'returning';
                  march.phaseStartedAt = now;
                  march.phaseDurationMs =
                    calculateMarchTiming(march.targetPosition, myCastlePos, march.marchSpeedTilesPerMin, cfg)
                      .realSeconds * 1000;
                  march.lastTickAt = now;
                  remainingMarches.push(march);
                }
              } else if (march.kind === 'reinforce_structure') {
                const tierKey = inferStructureKeyFromId(march.targetId);
                const wasOwned =
                  (simSnapshotRef.current.shrineGarrisons[march.targetId]?.ownerFaction ?? 'neutral') === 'alliance';
                setShrineGarrisons((prev) => {
                  const base = prev[march.targetId] || createDefaultStructureGarrison(march.targetId, tierKey, cfg);
                  let nextStacks = base.playerStacks.map((s) => ({ ...s }));
                  for (const st of march.stacks) {
                    nextStacks = addToStackList(nextStacks, st.classId, st.level, st.count);
                  }
                  return {
                    ...prev,
                    [march.targetId]: {
                      ...base,
                      ownerFaction: 'alliance',
                      playerStacks: nextStacks,
                    },
                  };
                });
                setConqueredPlots((prev) => ({ ...prev, [march.targetId]: 'alliance' }));
                if (!wasOwned) {
                  worldMapRef.current?.conquerStructureById(march.targetId);
                }
                worldMapRef.current?.triggerStructureEffect(march.targetId, 'garrison');
                showToast(`🛡️ Troops arrived & reinforced ${march.targetName}!`);
              }
            } else {
              remainingMarches.push(march);
            }
          } else if (march.status === 'gathering') {
            marchesChanged = true;
            const dtSec = Math.max(0.05, (now - march.lastTickAt) / 1000);
            const rType = march.resourceType || 'food';
            const resBonus = cfg.resourceGatheringBonuses[rType] ?? 0;
            const ratePerRealSec =
              ((march.gatherSpeedPerMin * (1 + resBonus)) / 60) * cfg.simulationTimeScale;
            const node = nextNodes[march.targetId] || {
              remainingYield: 5000,
              maxYield: 5000,
              respawnAt: null,
            };
            const roomLeft = Math.max(0, march.maxCarryLoad - march.carriedAmount);
            const pulled = Math.min(ratePerRealSec * dtSec, node.remainingYield, roomLeft);

            if (pulled > 0) {
              march.carriedAmount += pulled;
              const remNode = Math.max(0, node.remainingYield - pulled);
              const lvCfg = cfg.resourcesByLevel[Math.max(0, Math.min(9, march.targetLevel - 1))];
              const depleted = remNode <= 0.5;
              nextNodes[march.targetId] = {
                remainingYield: depleted ? 0 : Math.round(remNode),
                maxYield: node.maxYield,
                respawnAt: depleted ? now + (lvCfg?.respawnSeconds || 60) * 1000 : null,
              };
              nodeChanged = true;
              if (depleted) {
                worldMapRef.current?.updateEntityLiveState(march.targetId, {
                  yieldAmount: 0,
                  isDefeated: true,
                  respawnAt: nextNodes[march.targetId].respawnAt ?? undefined,
                });
              } else {
                worldMapRef.current?.updateEntityLiveState(march.targetId, {
                  yieldAmount: Math.round(remNode),
                });
              }
            }
            march.lastTickAt = now;

            if (Math.floor(elapsed / 1200) !== Math.floor((elapsed - dtSec * 1000) / 1200)) {
              worldMapRef.current?.triggerCombatVfxAtTarget(
                march.targetId,
                `+${Math.max(1, Math.round(pulled))} ${rType.toUpperCase()}`,
                '#34d399'
              );
            }

            const nodeEmptyNow = (nextNodes[march.targetId]?.remainingYield ?? 0) <= 0;
            const bagFullNow = march.carriedAmount >= march.maxCarryLoad - 0.5;
            if (nodeEmptyNow || bagFullNow) {
              march.carriedAmount = Math.round(march.carriedAmount);
              march.status = 'returning';
              march.phaseStartedAt = now;
              march.phaseDurationMs =
                calculateMarchTiming(march.targetPosition, myCastlePos, march.marchSpeedTilesPerMin, cfg)
                  .realSeconds * 1000;
            }
            remainingMarches.push(march);
          } else if (march.status === 'returning') {
            if (elapsed >= march.phaseDurationMs) {
              marchesChanged = true;
              setTroopInventory((prev) => mergeStacksIntoInventory(prev, march.stacks));
              const cargo = Math.round(march.carriedAmount);
              const heroDoneTxt = march.heroName ? ` (${march.heroName} Ready)` : '';
              if (cargo > 0 && march.resourceType) {
                const rt = march.resourceType;
                setResources((prev) => ({
                  ...prev,
                  [rt]: (prev[rt as keyof PlayerResources] || 0) + cargo,
                }));
                showToast(`📦 Returned with +${cargo.toLocaleString()} ${rt.toUpperCase()} into My Castle Vault${heroDoneTxt}!`);
              } else {
                showToast(`🏰 Expedition returned to My Castle from ${march.targetName}${heroDoneTxt}.`);
              }
            } else {
              remainingMarches.push(march);
            }
          }
        }

        if (marchesChanged) {
          setActiveMarches(remainingMarches);
        }

        // Drive 3D Map battalion visual & top-left HUD bar from primary march
        const lead = remainingMarches[0];
        if (lead) {
          const leadInfTier = lead.stacks.reduce<TroopLevel>(
            (best, s) => (s.classId === 'infantry' && s.level > best ? s.level : best),
            1
          );
          const leadTierFromAll = lead.stacks.reduce<TroopLevel>(
            (best, s) => (s.level > best ? s.level : best),
            leadInfTier
          );
          const leadHero = getHeroById(lead.heroId);
          worldMapRef.current?.setArmyEquipmentTier(
            leadTierFromAll,
            snap.infantryGear[leadTierFromAll] || { weapon: 0, shield: 0, armor: 0 },
            leadHero?.crestColor,
            lead.heroId ?? null
          );
          const frac = Math.max(0, Math.min(1, (now - lead.phaseStartedAt) / Math.max(500, lead.phaseDurationMs)));
          let nextStatus = '';
          let nextPct = 100;
          let nextPos: [number, number, number] = [myCastlePos[0], 10, myCastlePos[2] - 17];
          if (lead.status === 'marching') {
            worldMapRef.current?.setMarchVisual({
              from: myCastlePos,
              to: lead.targetPosition,
              progress01: frac,
              label: `Marching to ${lead.targetName}`,
            });
            nextStatus = `Marching to ${lead.targetName}`;
            nextPct = Math.round(frac * 100);
            nextPos = [
              myCastlePos[0] + (lead.targetPosition[0] - myCastlePos[0]) * frac,
              10,
              myCastlePos[2] + (lead.targetPosition[2] - myCastlePos[2]) * frac,
            ];
          } else if (lead.status === 'gathering') {
            worldMapRef.current?.setMarchVisual({
              from: myCastlePos,
              to: lead.targetPosition,
              progress01: 1,
              label: `Gathering ${lead.targetName}`,
              inCombatOrGathering: true,
              resourceType: lead.resourceType,
            });
            nextPct = Math.min(100, Math.round((lead.carriedAmount / Math.max(1, lead.maxCarryLoad)) * 100));
            nextStatus = `Gathering ${lead.targetName} (${Math.round(lead.carriedAmount).toLocaleString()}/${lead.maxCarryLoad.toLocaleString()})`;
            nextPos = lead.targetPosition;
          } else {
            worldMapRef.current?.setMarchVisual({
              from: lead.targetPosition,
              to: myCastlePos,
              progress01: frac,
              label: `Returning to My Castle`,
              isReturning: true,
            });
            nextStatus =
              lead.carriedAmount > 0
                ? `Returning (+${Math.round(lead.carriedAmount).toLocaleString()} ${lead.resourceType?.toUpperCase()})`
                : `Returning from ${lead.targetName}`;
            nextPct = Math.round(frac * 100);
            nextPos = [
              lead.targetPosition[0] + (myCastlePos[0] - lead.targetPosition[0]) * frac,
              10,
              lead.targetPosition[2] + (myCastlePos[2] - lead.targetPosition[2]) * frac,
            ];
          }
          if (lastArmyHudRef.current.statusText !== nextStatus) {
            lastArmyHudRef.current.statusText = nextStatus;
            setArmyStatusText(nextStatus);
          }
          if (lastArmyHudRef.current.progressPct !== nextPct) {
            lastArmyHudRef.current.progressPct = nextPct;
            setArmyProgressPct(nextPct);
          }
          const posKey = `${Math.round(nextPos[0])},${Math.round(nextPos[2])}`;
          if (lastArmyHudRef.current.posKey !== posKey) {
            lastArmyHudRef.current.posKey = posKey;
            setArmyPos(nextPos);
          }
        } else {
          worldMapRef.current?.setMarchVisual(null);
          if (worldMapRef.current?.armyState === 'IDLE') {
            const idleStatus = 'Garrisoned inside My Castle';
            const idlePosKey = `${Math.round(myCastlePos[0])},${Math.round(myCastlePos[2] - 17)}`;
            if (lastArmyHudRef.current.statusText !== idleStatus) {
              lastArmyHudRef.current.statusText = idleStatus;
              setArmyStatusText(idleStatus);
            }
            if (lastArmyHudRef.current.progressPct !== 100) {
              lastArmyHudRef.current.progressPct = 100;
              setArmyProgressPct(100);
            }
            if (lastArmyHudRef.current.posKey !== idlePosKey) {
              lastArmyHudRef.current.posKey = idlePosKey;
              setArmyPos([myCastlePos[0], 10, myCastlePos[2] - 17]);
            }
          }
        }
        // Sync 3D Allied Rally March Columns for every active rally march
        const alliedColumnsPayload: Array<{
          id: string;
          from: [number, number, number];
          to: [number, number, number];
          progress01: number;
          isReturning?: boolean;
        }> = [];
        for (const m of remainingMarches) {
          if (m.isRally && m.alliedOrigins && m.alliedOrigins.length > 0) {
            const mFrac = Math.max(0, Math.min(1, (now - m.phaseStartedAt) / Math.max(500, m.phaseDurationMs)));
            m.alliedOrigins.forEach((origin, oIdx) => {
              alliedColumnsPayload.push({
                id: `${m.id}-ally-${oIdx}`,
                from: m.status === 'returning' ? m.targetPosition : origin.position,
                to: m.status === 'returning' ? origin.position : m.targetPosition,
                progress01: m.status === 'gathering' ? 1 : mFrac,
                isReturning: m.status === 'returning',
              });
            });
          }
        }
        worldMapRef.current?.setAlliedRallyColumns(alliedColumnsPayload);
      } else if (worldMapRef.current?.armyState === 'IDLE') {
        worldMapRef.current?.setMarchVisual(null);
        worldMapRef.current?.setAlliedRallyColumns([]);
      }

      if (nodeChanged) setNodeStates(nextNodes);
      if (monsterChanged) setMonsterStates(nextMonsters);
      if (castleStateChanged) setCastleStates(nextCastles);
    }, 250);

    return () => window.clearInterval(timer);
  }, [showToast]);

  const worldMapCallbacksRef = useRef({
    onAddCombatFloater: handleAddCombatFloater,
    onArmyStatusUpdate: handleArmyStatusUpdate,
    onHarvestReward: handleHarvestReward,
    onMonsterDefeated: handleMonsterDefeated,
    onStructureConquered: handleStructureConquered,
    onEnemyCastleDefeated: handleEnemyCastleDefeated,
    onBulletNotify: handlePushBullet,
    onEnterKingdom: handleEnterKingdom,
  });
  worldMapCallbacksRef.current = {
    onAddCombatFloater: handleAddCombatFloater,
    onArmyStatusUpdate: handleArmyStatusUpdate,
    onHarvestReward: handleHarvestReward,
    onMonsterDefeated: handleMonsterDefeated,
    onStructureConquered: handleStructureConquered,
    onEnemyCastleDefeated: handleEnemyCastleDefeated,
    onBulletNotify: handlePushBullet,
    onEnterKingdom: handleEnterKingdom,
  };

  // Initialize Three.js WorldMap after first paint so boot splash renders instantaneously
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const dismissBootSplash = () => {
      const splash = document.getElementById('app-boot-splash');
      if (!splash || splash.dataset.dismissed === '1') return;
      splash.dataset.dismissed = '1';
      splash.style.opacity = '0';
      window.setTimeout(() => {
        splash.remove();
      }, 320);
    };

    const statusEl = document.getElementById('app-boot-status');
    if (statusEl) {
      statusEl.textContent = 'Entering Royal Citadel...';
    }

    const fallbackTimer = window.setTimeout(dismissBootSplash, 1800);
    let cancelled = false;
    let wmInstance: WorldMap | null = null;
    let lastCamPushMs = 0;
    let camTrailingTimer: number | null = null;
    let latestCamInfo: { x: number; y: number; z: number; zoom: number } | null = null;

    const rafId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const wm = new WorldMap({
        container,
        onCameraUpdate: (info) => {
          latestCamInfo = info;
          const now = performance.now();
          if (now - lastCamPushMs >= 120) {
            lastCamPushMs = now;
            setCameraInfo(info);
          } else if (camTrailingTimer === null) {
            camTrailingTimer = window.setTimeout(() => {
              camTrailingTimer = null;
              if (!cancelled && latestCamInfo) {
                lastCamPushMs = performance.now();
                setCameraInfo(latestCamInfo);
              }
            }, 125);
          }
        },
        onSelectEntity: (entity, screenPos) => {
          setSelectedEntity(entity);
          setSelectedScreenPos(screenPos);
        },
        onAddCombatFloater: (text, color, x, y) => {
          worldMapCallbacksRef.current.onAddCombatFloater(text, color, x, y);
        },
        onArmyStatusUpdate: (desc, progress, timerText, armyPosNext) => {
          worldMapCallbacksRef.current.onArmyStatusUpdate(desc, progress, timerText, armyPosNext);
        },
        onHarvestReward: (resourceType, amount) => {
          worldMapCallbacksRef.current.onHarvestReward(resourceType, amount);
        },
        onMonsterDefeated: (monster) => {
          worldMapCallbacksRef.current.onMonsterDefeated(monster);
        },
        onStructureConquered: (entity, buffLabel) => {
          worldMapCallbacksRef.current.onStructureConquered(entity, buffLabel);
        },
        onEnemyCastleDefeated: (castleEntity) => {
          worldMapCallbacksRef.current.onEnemyCastleDefeated(castleEntity);
        },
        onBulletNotify: (msg) => {
          worldMapCallbacksRef.current.onBulletNotify(msg);
        },
        onEnterKingdom: () => {
          worldMapCallbacksRef.current.onEnterKingdom();
        },
        onInsideKingdomStateChange: (state) => {
          setKingdomState(state);
          setInsideKingdomSnapshot({
            keepLevel: state.keepLevel,
            keepPower: state.keepPower,
            selectedPlotId: state.selectedPlotId,
            slots: state.plots.map((p) =>
              p.building
                ? {
                    slotIndex: p.slotIndex,
                    category: p.building.category,
                    level: p.building.level,
                  }
                : null
            ),
          });
        },
        onCastlesUpdated: (updatedCastles) => {
          setCastles([...updatedCastles]);
          setCastleStates((prev) => {
            const merged: Record<string, LiveCastleStatus> = { ...prev };
            let changed = false;
            for (const c of updatedCastles) {
              if (c.faction !== 'enemy') continue;
              const maxHp = getEnemyCastleMaxHp(c.power, c.level);
              if (!merged[c.id]) {
                changed = true;
                merged[c.id] = {
                  currentHp: maxHp,
                  maxHp,
                  isBurning: false,
                  lastAttackedAt: null,
                  teleportCount: 0,
                };
              } else if (merged[c.id].maxHp !== maxHp) {
                changed = true;
                merged[c.id] = {
                  ...merged[c.id],
                  maxHp,
                  currentHp: Math.min(merged[c.id].currentHp, maxHp),
                };
              }
            }
            return changed ? merged : prev;
          });
        },
        initialSceneMode: initialViewMode,
        onSceneReady: () => {
          dismissBootSplash();
        },
      });

      wmInstance = wm;
      worldMapRef.current = wm;
      const spawnedCastles = [...wm.getCastlesList()];
      setCastles(spawnedCastles);

      setCastleStates((prev) => {
        const merged: Record<string, LiveCastleStatus> = { ...prev };
        for (const c of spawnedCastles) {
          if (c.faction !== 'enemy') continue;
          const maxHp = getEnemyCastleMaxHp(c.power, c.level);
          if (!merged[c.id]) {
            merged[c.id] = {
              currentHp: maxHp,
              maxHp,
              isBurning: false,
              lastAttackedAt: null,
              teleportCount: 0,
            };
          } else {
            merged[c.id] = {
              ...merged[c.id],
              maxHp,
              currentHp: Math.min(merged[c.id].currentHp, maxHp),
            };
            if (merged[c.id].isBurning) {
              wm.setCastleBurningState(c.id, true, merged[c.id].currentHp, maxHp);
            }
          }
        }
        return merged;
      });

      // Apply persisted barrier domes, monster/node live states & conquered factions
      for (const [id, gar] of Object.entries(initialSim.shrineGarrisons)) {
        if (gar.barrierActive) {
          wm.setStructureBarrierActive(id, true);
        }
        if (gar.ownerFaction === 'alliance') {
          wm.conquerStructureById(id, true);
        }
      }
      for (const [id, m] of Object.entries(initialSim.monsterStates)) {
        wm.updateEntityLiveState(id, {
          health: m.currentHp,
          maxHealth: m.maxHp,
          isDefeated: m.isDefeated,
          respawnAt: m.respawnAt ?? undefined,
        });
      }
      for (const [id, n] of Object.entries(initialSim.nodeStates)) {
        wm.updateEntityLiveState(id, {
          yieldAmount: n.remainingYield,
          isDefeated: n.remainingYield <= 0,
          respawnAt: n.respawnAt ?? undefined,
        });
      }
      if (initialSim.insideKingdomSnapshot) {
        wm.restoreInsideKingdomState(initialSim.insideKingdomSnapshot);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackTimer);
      if (camTrailingTimer !== null) window.clearTimeout(camTrailingTimer);
      wmInstance?.dispose();
      worldMapRef.current = null;
    };
  }, [initialSim]);

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
        <Suspense fallback={null}>
          <InsideKingdomView
            kingdomState={kingdomState}
            resources={resources}
            onSpendResources={handleSpendResources}
            onGrantReward={handleGrantInnerReward}
            onSelectPlot={(plotId) => worldMapRef.current?.selectInsidePlot(plotId)}
            onMergeSelected={() => {
              const merged = worldMapRef.current?.mergeSelectedInsideBuilding() || false;
              if (merged && typeof navigator !== 'undefined' && !navigator.onLine) {
                offlineSyncService.queueOfflineActionLabel(uid, 'Merged Courtyard Building');
              }
              return merged;
            }}
            onAutoMergeAll={() => {
              const count = worldMapRef.current?.autoMergeInsideKingdom() || 0;
              if (count > 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
                offlineSyncService.queueOfflineActionLabel(uid, `Auto-Merged ${count} Pairs`);
              }
              return count;
            }}
            onConstructBuilding={(cat: MergeBuildingCategory, prefPlotId?: string) => {
              const built = Boolean(worldMapRef.current?.constructInsideBuilding(cat, prefPlotId));
              if (built && typeof navigator !== 'undefined' && !navigator.onLine) {
                offlineSyncService.queueOfflineActionLabel(uid, `Built ${cat}`);
              }
              return built;
            }}
            onUpgradeKeep={() => {
              const upgraded = worldMapRef.current?.upgradeInsideImperialKeep() || false;
              if (upgraded && typeof navigator !== 'undefined' && !navigator.onLine) {
                offlineSyncService.queueOfflineActionLabel(uid, 'Upgraded Imperial Keep');
              }
              return upgraded;
            }}
            onShowToast={showToast}
            onReturnToWorld={handleReturnToWorld}
          />
        </Suspense>
      )}

      {/* 2B. Strategic WorldMap Modal */}
      {isStrategicWorldMapOpen && (
        <Suspense fallback={null}>
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
            playerAlliance={playerAlliance}
            shrineRuleStatus={shrineRuleStatus}
          />
        </Suspense>
      )}

      {/* 3. Strategy Game HUD & Contextual Nepalese Battalion Popup */}
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
        balanceConfig={balanceConfig}
        bonuses={bonuses}
        troopInventory={troopInventory}
        activeMarches={activeMarches}
        activeMarchesCount={activeMarches.length}
        battleReportsCount={battleReports.length}
        nodeStates={nodeStates}
        monsterStates={monsterStates}
        castleStates={castleStates}
        onRecallMarch={handleRecallMarch}
        onSelectWorldTarget={(entityId, x, z) => {
          if (viewMode === 'kingdom') {
            setViewMode('world');
            worldMapRef.current?.setSceneMode('world');
          }
          const matched = worldMapRef.current?.selectEntityById(entityId);
          if (!matched) {
            worldMapRef.current?.panTo(x, z);
          }
        }}
        onDispatchNepaleseMarch={handleDispatchNepaleseMarch}
        onOpenCommandHub={handleOpenCommandHub}
        playerAlliance={playerAlliance}
        onUpdateAllianceIdentity={handleUpdateAllianceIdentity}
        shrineRuleStatus={shrineRuleStatus}
        shrineGarrisons={shrineGarrisons}
        onRelinquishStructure={handleRelinquishStructure}
        infantryGear={infantryGear}
        isCollisionDebugVisible={isCollisionDebugVisible}
        collisionDebugLayers={collisionDebugLayers}
        onToggleCollisionDebug={handleToggleCollisionDebug}
        onToggleCollisionLayer={handleToggleCollisionLayer}
        onOpenTestMode={() => setIsTestModeOpen(true)}
        onOpenAnimationLab={() => setIsAnimationLabOpen(true)}
        timeOfDay={worldTimeOfDay}
        onCycleTimeOfDay={() => {
          const next = worldMapRef.current?.cycleTimeOfDay() ?? (worldTimeOfDay === 'day' ? 'dusk' : worldTimeOfDay === 'dusk' ? 'night' : 'day');
          setWorldTimeOfDay(next);
          showToast(`World Lighting: ${next.toUpperCase()}`);
        }}
        commanderNameOverride={commanderUsername ? commanderUsername.toUpperCase() : undefined}
        syncUid={uid}
      />

      {/* 3B. Unified 8-Panel Kingdom Command Hub Drawer */}
      {isHubOpen && (
        <Suspense fallback={null}>
          <CommandHubDrawer
            isOpen={isHubOpen}
            activeTab={hubTab}
            onSelectTab={setHubTab}
            onClose={() => setIsHubOpen(false)}
            resources={resources}
            balanceConfig={balanceConfig}
            bonuses={bonuses}
            troopInventory={troopInventory}
            woundedInventory={woundedInventory}
            trainingQueue={trainingQueue}
            hospitalQueue={hospitalQueue}
            research={research}
            equipmentBag={equipmentBag}
            equippedIds={equippedIds}
            shrineGarrisons={shrineGarrisons}
            selectedStructureId={selectedStructureId}
            onSelectStructureId={setSelectedStructureId}
            activeMarches={activeMarches}
            battleReports={battleReports}
            nodeStates={nodeStates}
            monsterStates={monsterStates}
            commanderXp={commanderXp}
            onPanTo={(x, z) => {
              if (viewMode === 'kingdom') {
                setViewMode('world');
                worldMapRef.current?.setSceneMode('world');
              }
              worldMapRef.current?.panTo(x, z);
              setIsHubOpen(false);
            }}
            onTrainTroops={handleTrainTroops}
            onInstantFinishTraining={handleInstantFinishTraining}
            onHealWounded={handleHealWounded}
            onDeployStructureTroops={handleDeployStructureTroops}
            onWithdrawStructureTroops={handleWithdrawStructureTroops}
            onAutoFillStructure={handleAutoFillStructure}
            onAllianceReinforceStructure={handleAllianceReinforceStructure}
            onToggleStructureBarrier={handleToggleStructureBarrier}
            onSimulateStructureDefense={handleSimulateStructureDefense}
            onRecallMarch={handleRecallMarch}
            onUpgradeResearch={handleUpgradeResearch}
            onToggleEquipItem={handleToggleEquipItem}
            onUpdateBalanceConfig={handleUpdateBalanceConfig}
            onResetBalanceConfig={handleResetBalanceConfig}
            playerAlliance={playerAlliance}
            onUpdateAllianceIdentity={handleUpdateAllianceIdentity}
            shrineRuleStatus={shrineRuleStatus}
            onRelinquishStructure={handleRelinquishStructure}
            infantryGear={infantryGear}
            onUpgradeInfantryGear={handleUpgradeInfantryGear}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {/* 3C. Isolated World Map Test Mode (Grid, Dimensions, Spacing & 13 Acceptance Tests) */}
      {isTestModeOpen && (
        <Suspense fallback={null}>
          <WorldMapTestMode isOpen={isTestModeOpen} onClose={() => setIsTestModeOpen(false)} />
        </Suspense>
      )}

      {/* 3D. Interactive 3D Animation & VFX Test Lab (Section 13) */}
      {isAnimationLabOpen && (
        <Suspense fallback={null}>
          <AnimationTestModeModal onClose={() => setIsAnimationLabOpen(false)} />
        </Suspense>
      )}

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

      {/* 4B. Live Scrolling Bullet Notification Ticker */}
      {bulletNotifications.length > 0 && (
        <div
          className="bullet-ticker-lane"
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

      {/* 5B. Non-blocking Mobile Portrait -> Landscape Quick Switcher */}
      {isMobilePortrait && !landscapeHintDismissed && (
        <div
          style={{
            position: 'fixed',
            top: '54px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 105,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(10, 16, 28, 0.94)',
            border: '1.5px solid #dfba6e',
            borderRadius: '9px',
            padding: '5px 8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.75)',
          }}
        >
          <button
            type="button"
            onClick={() => void tryLockLandscape(true)}
            style={{
              background: 'linear-gradient(180deg, #b45309 0%, #78350f 100%)',
              border: '1px solid #fde047',
              borderRadius: '6px',
              color: '#fef08a',
              font: "800 11px 'Barlow Condensed', sans-serif",
              letterSpacing: '0.04em',
              padding: '5px 10px',
              cursor: 'pointer',
              touchAction: 'manipulation',
              whiteSpace: 'nowrap',
            }}
          >
            📱↻ LOCK LANDSCAPE
          </button>
          <button
            type="button"
            onClick={() => setLandscapeHintDismissed(true)}
            aria-label="Dismiss landscape hint"
            style={{
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '12px',
              padding: '4px 7px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* CSS Keyframes for Combat Floaters & Scrolling Bullet Ticker */}
      <style>{`
        @media (max-height: 540px) {
          .bullet-ticker-lane {
            top: 66px !important;
            height: 60px !important;
          }
        }
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

