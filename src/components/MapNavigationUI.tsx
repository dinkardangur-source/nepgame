import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  WorldEntity,
  EntityAction,
  WORLD_MONSTERS,
  WORLD_RESOURCES,
  RESERVED_PLOTS,
  WorldCoordinates,
  CastleSpawnData,
  NILE_DELTA_FORK_Z,
  getNileMainX,
  getNileWestDeltaX,
  getNileEastDeltaX,
} from '../game/WorldCoordinates';
import {
  ActiveMarch,
  AllianceShrineRuleStatus,
  CalculatedBonuses,
  GameBalanceConfig,
  InfantryGearState,
  NEPALESE_HEROES,
  PlayerAllianceIdentity,
  PlayerResources,
  ResourceKind,
  ShrineGarrisonState,
  StructureTierKey,
  TroopClassId,
  TroopInventory,
  TroopLevel,
  TroopStack,
  calculateArmyMetrics,
  calculateMarchTiming,
  calculateResourceGatherTiming,
  getEnemyCastleMaxHp,
  getHeroById,
  getRecommendedMonsterBand,
} from '../game/NepaleseBalanceConfig';
import type { CommandHubTab, LiveCastleStatus, LiveMonsterStatus, LiveNodeStatus } from './CommandHubDrawer';
import { MonsterPortrait } from './MonsterPortrait';
import { HeroPortrait } from './HeroPortrait';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { Hud3DPedestalDock, Hud3DSnapshotBadge } from './Hud3DPedestalDock';
import { QuestBoardModal, QuestBoardCategory, QuestBoardItem } from './QuestBoardModal';
import { AllianceHeadquartersModal, AllianceHqTab } from './AllianceHeadquartersModal';
import { CommanderProfileModal } from './CommanderProfileModal';
import { Profile3DBadge } from './Profile3DEmblems';
import { getHeroPortraitUrl } from '../game/HeroPortraits';
import { SimCountdownText } from '../game/simClockStore';
import { AndroidApkModal } from './AndroidApkModal';
import { OfflineReconnectBanner, SyncStatusButton } from './SyncStatusIndicator';

interface MapNavigationUIProps {
  cameraInfo: { x: number; y: number; z: number; zoom: number };
  onPanTo: (x: number, z: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomOut100: () => void;
  onResetHome: () => void;
  onSetZoom: (zoom: number) => void;
  viewMode: 'world' | 'kingdom';
  onToggleViewMode: () => void;
  castles: CastleSpawnData[];
  isStrategicFilterActive: boolean;
  onToggleStrategicFilter: (enabled: boolean) => void;
  onOpenStrategicWorldMap: () => void;
  onRelocateCastles: () => void;
  selectedEntity: WorldEntity | null;
  selectedScreenPos: { x: number; y: number } | null;
  onExecuteAction: (target: WorldEntity, action: EntityAction) => void;
  onCloseSelection: () => void;
  armyPos: [number, number, number];
  armyStatusText: string;
  armyProgressPct: number;
  resources: PlayerResources;
  conqueredPlots?: Record<string, 'neutral' | 'enemy' | 'alliance'>;
  onGrantReward?: (
    type: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'gems',
    amount: number,
    label: string
  ) => void;
  onShowToast?: (msg: string) => void;
  balanceConfig: GameBalanceConfig;
  bonuses: CalculatedBonuses;
  troopInventory: TroopInventory;
  activeMarches: ActiveMarch[];
  activeMarchesCount: number;
  battleReportsCount: number;
  nodeStates: Record<string, LiveNodeStatus>;
  monsterStates: Record<string, LiveMonsterStatus>;
  castleStates: Record<string, LiveCastleStatus>;
  onDispatchNepaleseMarch: (
    target: WorldEntity,
    action: EntityAction,
    stacks: TroopStack[],
    heroId?: string,
    rallyMeta?: {
      captains?: string[];
      alliedOrigins?: Array<{ name: string; position: [number, number, number] }>;
    }
  ) => boolean;
  onOpenCommandHub: (tab: CommandHubTab, structureId?: string) => void;
  playerAlliance: PlayerAllianceIdentity;
  onUpdateAllianceIdentity: (tag: string, alias: string) => boolean;
  shrineRuleStatus: AllianceShrineRuleStatus;
  shrineGarrisons: Record<string, ShrineGarrisonState>;
  onRelinquishStructure: (structureId: string) => void;
  infantryGear?: InfantryGearState;
  onRecallMarch?: (marchId: string) => void;
  onSelectWorldTarget?: (entityId: string, x: number, z: number) => void;
  isCollisionDebugVisible?: boolean;
  collisionDebugLayers?: { building: boolean; monster: boolean; resource: boolean };
  onToggleCollisionDebug?: (enabled?: boolean) => void;
  onToggleCollisionLayer?: (layer: 'building' | 'monster' | 'resource') => void;
  onOpenTestMode?: () => void;
  onOpenAnimationLab?: () => void;
  timeOfDay?: 'day' | 'dusk' | 'night';
  onCycleTimeOfDay?: () => void;
  commanderNameOverride?: string;
  syncUid?: string | null;
}

interface BookmarkPin {
  id: string;
  name: string;
  x: number;
  y: number;
  category: 'favorite' | 'alliance' | 'enemy' | 'shrine';
  createdAt: number;
}

const BOOKMARKS_STORAGE_KEY = 'himalayan_realm_bookmarks_v3';

const DEFAULT_BOOKMARKS: BookmarkPin[] = [
  { id: 'bm-shrine-a1', name: 'Shrine A1 Sanctum', x: 1352, y: 1352, category: 'shrine', createdAt: 1 },
  { id: 'bm-congress', name: 'The Congress Citadel', x: 1600, y: 1600, category: 'shrine', createdAt: 2 },
  { id: 'bm-drago-boss', name: 'Drago · World Boss (Lv.10)', x: 240, y: 2960, category: 'enemy', createdAt: 3 },
];

interface InventoryItemData {
  id: string;
  name: string;
  category: 'resources' | 'relics' | 'speedups';
  rarity: 'legendary' | 'epic' | 'rare';
  count: number;
  desc: string;
  rewardType: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems';
  rewardAmount: number;
  iconType: 'chest_gold' | 'crystal_gems' | 'timber_bundle' | 'granite_crate' | 'iron_ingot' | 'chrono_hourglass';
}

interface MailMessageData {
  id: string;
  category: 'system' | 'battle' | 'alliance';
  title: string;
  sender: string;
  time: string;
  body: string;
  coords?: [number, number];
  read: boolean;
  claimed: boolean;
  rewardType: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems';
  rewardAmount: number;
  bonusGems: number;
}

export const MapNavigationUI: React.FC<MapNavigationUIProps> = ({
  cameraInfo,
  onPanTo,
  onZoomIn,
  onZoomOut,
  onZoomOut100,
  onResetHome,
  onSetZoom,
  viewMode,
  onToggleViewMode,
  castles,
  isStrategicFilterActive,
  onToggleStrategicFilter,
  onOpenStrategicWorldMap,
  onRelocateCastles,
  selectedEntity,
  selectedScreenPos,
  onExecuteAction,
  onCloseSelection,
  armyPos,
  armyStatusText,
  armyProgressPct,
  resources,
  conqueredPlots,
  onGrantReward,
  onShowToast,
  balanceConfig,
  bonuses,
  troopInventory,
  activeMarches,
  activeMarchesCount,
  battleReportsCount,
  nodeStates,
  monsterStates,
  castleStates,
  onDispatchNepaleseMarch,
  onOpenCommandHub,
  playerAlliance,
  onUpdateAllianceIdentity,
  shrineRuleStatus,
  shrineGarrisons,
  onRelinquishStructure,
  infantryGear,
  onRecallMarch,
  onSelectWorldTarget,
  isCollisionDebugVisible,
  collisionDebugLayers,
  onToggleCollisionDebug,
  onToggleCollisionLayer,
  onOpenTestMode,
  onOpenAnimationLab,
  timeOfDay = 'day',
  onCycleTimeOfDay,
  commanderNameOverride,
  syncUid = null,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMinimapDraggingRef = useRef<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Android / PWA Install & Offline Status
  const { isInstallable, isInstalled, isIOS, isAndroid, install: installPWA } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  // Tactile Spring Pop & Rune Sparkle Animations
  const [springPopKey, setSpringPopKey] = useState<string | null>(null);

  const triggerTouchVfx = (_e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>, key: string) => {
    setSpringPopKey(key);
    window.setTimeout(() => {
      setSpringPopKey((prev) => (prev === key ? null : prev));
    }, 460);
  };

  // Coordinate Bookmark State & Persistence
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [bookmarkNameInput, setBookmarkNameInput] = useState('');
  const [bookmarkCategoryInput, setBookmarkCategoryInput] = useState<BookmarkPin['category']>('favorite');
  const [bookmarks, setBookmarks] = useState<BookmarkPin[]>(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_BOOKMARKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // Ignore storage write errors
    }
  }, [bookmarks]);

  // Nepalese Contextual Battalion & Lead Hero Selector State (Magar Inf / Limbu Arc / Thakuri Cav Lv 1-5)
  const [selectedHeroId, setSelectedHeroId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('himalayan_selected_hero_v1');
      if (saved && getHeroById(saved)) return saved;
    } catch {
      // Ignore storage read errors
    }
    return NEPALESE_HEROES[0].id;
  });

  useEffect(() => {
    try {
      localStorage.setItem('himalayan_selected_hero_v1', selectedHeroId);
    } catch {
      // Ignore storage write errors
    }
  }, [selectedHeroId]);

  const [selectedTroopLv, setSelectedTroopLv] = useState<TroopLevel>(3);
  const [marchCounts, setMarchCounts] = useState<Record<TroopClassId, number>>({
    infantry: 500,
    archer: 300,
    cavalry: 200,
  });

  const occupiedHeroMap = useMemo(() => {
    const map = new Map<string, ActiveMarch>();
    for (const m of activeMarches) {
      if (m.heroId) map.set(m.heroId, m);
    }
    return map;
  }, [activeMarches]);

  const activeHero = useMemo(() => {
    const chosen = getHeroById(selectedHeroId);
    if (chosen && !occupiedHeroMap.has(chosen.id)) return chosen;
    return NEPALESE_HEROES.find((h) => !occupiedHeroMap.has(h.id)) || null;
  }, [selectedHeroId, occupiedHeroMap]);

  const effectiveBonuses = useMemo<CalculatedBonuses>(() => {
    if (!activeHero) return bonuses;
    const classAttackMults = {
      ...(bonuses.classAttackMults || { infantry: 1, archer: 1, cavalry: 1 }),
    };
    classAttackMults[activeHero.classBonusClass] =
      (classAttackMults[activeHero.classBonusClass] ?? 1) + activeHero.classAttackPct;
    return {
      ...bonuses,
      attackMult: bonuses.attackMult + activeHero.attackPct,
      hpMult: bonuses.hpMult + activeHero.hpPct,
      powerMult: bonuses.powerMult + (activeHero.attackPct + activeHero.hpPct) * 0.5,
      loadMult: bonuses.loadMult + activeHero.loadPct,
      gatherMult: bonuses.gatherMult + activeHero.gatherPct,
      marchMult: bonuses.marchMult + activeHero.marchPct,
      siegeDamageMult: (bonuses.siegeDamageMult ?? 1) + activeHero.siegeDamagePct,
      classAttackMults,
    };
  }, [bonuses, activeHero]);

  // Dock Toggles
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<'world' | 'alliance'>('world');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      channel: 'world' | 'alliance';
      sender: string;
      tag: string;
      text: string;
      time: string;
      sharedTarget?: {
        entityId: string;
        name: string;
        level: number;
        category: string;
        x: number;
        y: number;
      };
    }>
  >([
    {
      id: '1',
      channel: 'world',
      sender: 'Lord Kazi',
      tag: 'Vanguard',
      text: 'Ironcrest Pass is secured. Watch for Death Knight & Orc patrols.',
      time: '14:22',
    },
    {
      id: '2',
      channel: 'alliance',
      sender: 'Lady Maya',
      tag: 'Alliance',
      text: 'Ready to join Alliance Rally marches on Golden Goblin & Death Knight targets!',
      time: '14:25',
    },
    {
      id: '3',
      channel: 'world',
      sender: 'Herald Gorkha',
      tag: 'System',
      text: 'Lv.10 Drago World Boss spotted roosting in the Southwest Highlands!',
      time: '14:28',
      sharedTarget: {
        entityId: 'm_drago_boss_sw',
        name: 'Drago',
        level: 10,
        category: 'monster',
        x: 240,
        y: 2960,
      },
    },
  ]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<
    'all' | 'monsters' | 'farm' | 'wood' | 'stone' | 'iron' | 'gold' | 'crystal'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarchTooltipId, setSelectedMarchTooltipId] = useState<string | null>(null);
  const [openShareKey, setOpenShareKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMarchTooltipId && !activeMarches.some((m) => m.id === selectedMarchTooltipId)) {
      setSelectedMarchTooltipId(null);
    }
  }, [activeMarches, selectedMarchTooltipId]);

  useEffect(() => {
    setOpenShareKey(null);
  }, [selectedEntity?.id]);

  // Profile, Alliance HQ & Quest Board Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [commanderName, setCommanderName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('himalayan_commander_name_v1');
      if (saved && saved.trim().length >= 2) return saved.trim().toUpperCase().slice(0, 18);
    } catch {
      // Ignore storage read errors
    }
    return 'LORD DANGOL';
  });
  useEffect(() => {
    try {
      localStorage.setItem('himalayan_commander_name_v1', commanderName);
    } catch {
      // Ignore storage write errors
    }
  }, [commanderName]);

  const MAX_ACTION_POINTS = 190;
  const [actionPoints, setActionPoints] = useState<number>(190);
  const handleReplenishActionPoints = () => {
    if (actionPoints >= MAX_ACTION_POINTS) {
      onShowToast?.('Action Points are already full (190 / 190)!');
      return;
    }
    setActionPoints((prev) => Math.min(MAX_ACTION_POINTS, prev + 35));
    onShowToast?.('Used Royal Elixir: +35 Action Points restored!');
  };

  const [isAllianceOpen, setIsAllianceOpen] = useState(false);
  const [allianceTab, setAllianceTab] = useState<AllianceHqTab>('overview');
  const [questBoardTab, setQuestBoardTab] = useState<QuestBoardCategory>('daily');
  const [unclaimedQuestsCount, setUnclaimedQuestsCount] = useState<number>(0);

  // 3D Inventory, Quests & Mail Modals State
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'resources' | 'relics' | 'speedups'>('all');
  const [inventoryItems, setInventoryItems] = useState<InventoryItemData[]>([
    {
      id: 'inv-gold-chest',
      name: 'Emperor Congress Gold Coffer',
      category: 'resources',
      rarity: 'legendary',
      count: 3,
      desc: 'Heavy 3D gilded coffer forged in the Congress Citadel. Grants +8,500 Treasury Gold.',
      rewardType: 'gold',
      rewardAmount: 8500,
      iconType: 'chest_gold',
    },
    {
      id: 'inv-crystal-shard',
      name: 'Arcane Blue Crystal Reliquary',
      category: 'relics',
      rarity: 'legendary',
      count: 2,
      desc: 'Pure Himalayan shrine crystal core pulsating with starlight. Grants +250 Sacred Gems.',
      rewardType: 'gems',
      rewardAmount: 250,
      iconType: 'crystal_gems',
    },
    {
      id: 'inv-wood-bundle',
      name: 'Imperial Deodar Timber Crate',
      category: 'resources',
      rarity: 'epic',
      count: 4,
      desc: 'Seasoned alpine pine beams for 3D courtyard merges. Grants +25,000 Wood.',
      rewardType: 'wood',
      rewardAmount: 25000,
      iconType: 'timber_bundle',
    },
    {
      id: 'inv-stone-crate',
      name: 'Citadel Granite Ashlar Block',
      category: 'resources',
      rarity: 'epic',
      count: 4,
      desc: 'Cut Himalayan fortress blocks for defense towers. Grants +22,000 Stone.',
      rewardType: 'stone',
      rewardAmount: 22000,
      iconType: 'granite_crate',
    },
    {
      id: 'inv-iron-pack',
      name: 'Gorkha Meteoric Iron Ingots',
      category: 'resources',
      rarity: 'rare',
      count: 3,
      desc: 'Smelted weapon-grade iron for Vanguard battalions. Grants +18,000 Iron.',
      rewardType: 'iron',
      rewardAmount: 18000,
      iconType: 'iron_ingot',
    },
    {
      id: 'inv-speedup-chrono',
      name: 'Chrono-Crystal March Accelerator',
      category: 'speedups',
      rarity: 'epic',
      count: 2,
      desc: 'Infuses imperial banners with temporal energy and grants +5,000 Gold tribute.',
      rewardType: 'gold',
      rewardAmount: 5000,
      iconType: 'chrono_hourglass',
    },
  ]);

  const [isQuestsOpen, setIsQuestsOpen] = useState(false);

  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mailTab, setMailTab] = useState<'all' | 'system' | 'battle' | 'alliance'>('all');
  const [mailMessages, setMailMessages] = useState<MailMessageData[]>([
    {
      id: 'mail-1',
      category: 'system',
      title: '👑 The Congress Awaits at [1600, 1600]',
      sender: 'Imperial High Council',
      time: 'Just now',
      body: 'The central Arcane Blue Crystal & Gold Congress Citadel stands at [1600, 1600]! Hold at least 2 C Shrines, 1 B Shrine, and 1 A Shrine within your 5-Shrine alliance cap before claiming The Congress.',
      coords: [1600, 1600],
      read: false,
      claimed: false,
      rewardType: 'gold',
      rewardAmount: 10000,
      bonusGems: 200,
    },
    {
      id: 'mail-2',
      category: 'alliance',
      title: '🏰 Alliance Castles Deployed Across Realm',
      sender: `Commander Kazi [${playerAlliance.tag}]`,
      time: '8m ago',
      body: 'My Lord, all 10 Alliance Member Castles have established fortifications across the 3200×3200 continent alongside My Castle. Use the WorldMap at any time to jump to allied strongholds or relocate positions.',
      coords: [1600, 1568],
      read: false,
      claimed: false,
      rewardType: 'wood',
      rewardAmount: 18000,
      bonusGems: 85,
    },
    {
      id: 'mail-3',
      category: 'battle',
      title: '⚔️ Shrine A1 Inner Sanctum Recon Report',
      sender: 'Falcon Scout Corps',
      time: '19m ago',
      body: 'Our scouts surveyed Inner Sanctum Shrine A1 at [1352, 1352] and linking Mid-Ring Shrine B1 at [856, 856]. Arcane mana conduits are at 100% capacity. Claim recovered war spoils below.',
      coords: [1352, 1352],
      read: false,
      claimed: false,
      rewardType: 'iron',
      rewardAmount: 16000,
      bonusGems: 75,
    },
    {
      id: 'mail-4',
      category: 'system',
      title: '✨ 3D Citadel Merge Courtyard Supply Drop',
      sender: 'Royal Quartermaster',
      time: '35m ago',
      body: 'To accelerate your 3D Barracks, Watchtower, Resource Mill, and Shrine merges inside the walled Citadel courtyard, the Quartermaster has dispatched a shipment of dressed granite.',
      coords: [1600, 1600],
      read: true,
      claimed: false,
      rewardType: 'stone',
      rewardAmount: 20000,
      bonusGems: 60,
    },
  ]);
  const [selectedMailId, setSelectedMailId] = useState<string>('mail-1');

  // Scout & Rally Modals
  const [scoutModalTarget, setScoutModalTarget] = useState<WorldEntity | null>(null);
  const [rallyModalTarget, setRallyModalTarget] = useState<WorldEntity | null>(null);
  const [rallyTimer, setRallyTimer] = useState<number>(0);
  const [selectedRallyAllyIds, setSelectedRallyAllyIds] = useState<string[]>([]);

  const rallyCandidateCastles = useMemo(() => {
    if (!rallyModalTarget) return [];
    return castles
      .filter((c) => c.faction !== 'enemy' && !c.isMyCastle)
      .sort(
        (a, b) =>
          Math.hypot(a.position[0] - rallyModalTarget.position[0], a.position[2] - rallyModalTarget.position[2]) -
          Math.hypot(b.position[0] - rallyModalTarget.position[0], b.position[2] - rallyModalTarget.position[2])
      )
      .slice(0, 4);
  }, [castles, rallyModalTarget]);

  useEffect(() => {
    if (rallyModalTarget) {
      setSelectedRallyAllyIds(rallyCandidateCastles.slice(0, 3).map((c) => c.id));
    }
  }, [rallyModalTarget, rallyCandidateCastles]);

  // Helper to open one dock panel cleanly while closing conflicting floating drawers
  const openExclusiveDockPanel = (
    panel: 'inventory' | 'quests' | 'alliance' | 'mail' | 'search' | 'chat' | 'bookmarks'
  ) => {
    setIsProfileOpen(false);
    setIsInventoryOpen(panel === 'inventory' ? !isInventoryOpen : false);
    setIsQuestsOpen(panel === 'quests' ? !isQuestsOpen : false);
    setIsAllianceOpen(panel === 'alliance' ? !isAllianceOpen : false);
    setIsMailOpen(panel === 'mail' ? !isMailOpen : false);
    setIsSearchOpen(panel === 'search' ? !isSearchOpen : false);
    setIsChatOpen(panel === 'chat' ? !isChatOpen : false);
    setIsBookmarksOpen(panel === 'bookmarks' ? !isBookmarksOpen : false);
    setOpenShareKey(null);
  };

  const handleSaveCurrentBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    const x = Math.round(cameraInfo.x);
    const y = Math.round(cameraInfo.z);
    const label = bookmarkNameInput.trim() || `Sector [${x}, ${y}]`;
    const newPin: BookmarkPin = {
      id: `bm-${Date.now()}`,
      name: label,
      x,
      y,
      category: bookmarkCategoryInput,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [newPin, ...prev]);
    setBookmarkNameInput('');
    onShowToast?.(`🔖 Bookmarked "${label}" at X:${x} · Y:${y}`);
  };

  const handleDeleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const isTargetBookmarked = (x: number, y: number) => {
    const rx = Math.round(x);
    const ry = Math.round(y);
    return bookmarks.some((b) => Math.abs(Math.round(b.x) - rx) <= 2 && Math.abs(Math.round(b.y) - ry) <= 2);
  };

  const toggleEntityBookmark = (target: {
    id: string;
    name: string;
    level?: number;
    category: string;
    x: number;
    y: number;
  }) => {
    const rx = Math.round(target.x);
    const ry = Math.round(target.y);
    const existing = bookmarks.find(
      (b) => Math.abs(Math.round(b.x) - rx) <= 2 && Math.abs(Math.round(b.y) - ry) <= 2
    );
    if (existing) {
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      onShowToast?.(`Bookmark removed: "${existing.name}"`);
      return;
    }
    const pinCategory: BookmarkPin['category'] =
      target.category === 'shrine' ||
      target.category === 'congress' ||
      target.category === 'shrine_a' ||
      target.category === 'shrine_b' ||
      target.category === 'shrine_c'
        ? 'shrine'
        : target.category === 'enemy' || target.category === 'monster' || target.category === 'enemy_castle'
          ? 'enemy'
          : target.category === 'alliance' || target.category === 'castle'
            ? 'alliance'
            : 'favorite';
    const displayLabel = target.level ? `${target.name} (Lv.${target.level})` : target.name;
    const newPin: BookmarkPin = {
      id: `bm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: displayLabel,
      x: rx,
      y: ry,
      category: pinCategory,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [newPin, ...prev]);
    onShowToast?.(`Bookmarked "${displayLabel}" at X:${rx} · Y:${ry}`);
  };

  const shareEntityToChat = (
    target: {
      entityId: string;
      name: string;
      level: number;
      category: string;
      x: number;
      y: number;
    },
    channel: 'world' | 'alliance'
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const rx = Math.round(target.x);
    const ry = Math.round(target.y);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `share-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        channel,
        sender: 'Emperor Dangol',
        tag: channel === 'world' ? 'Monarch' : playerAlliance.tag,
        text: `Shared target coordinates:`,
        time: timeStr,
        sharedTarget: {
          entityId: target.entityId,
          name: target.name,
          level: target.level,
          category: target.category,
          x: rx,
          y: ry,
        },
      },
    ]);
    setChatChannel(channel);
    setOpenShareKey(null);
    onShowToast?.(
      `Shared "${target.name}" [X:${rx}, Y:${ry}] to ${channel === 'world' ? 'World' : 'Alliance'} Chat`
    );
  };

  const totalInventoryCount = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + item.count, 0),
    [inventoryItems]
  );

  const unreadOrUnclaimedMailCount = useMemo(
    () => mailMessages.filter((m) => !m.read || !m.claimed).length,
    [mailMessages]
  );

  const handleUseInventoryItem = (itemId: string) => {
    const target = inventoryItems.find((i) => i.id === itemId);
    if (!target || target.count <= 0) return;
    setInventoryItems((prev) =>
      prev
        .map((item) => (item.id === itemId ? { ...item, count: item.count - 1 } : item))
        .filter((item) => item.count > 0)
    );
    onGrantReward?.(target.rewardType, target.rewardAmount, target.name);
  };

  const handleClaimMail = (mailId: string) => {
    const m = mailMessages.find((item) => item.id === mailId);
    if (!m || m.claimed) return;
    setMailMessages((prev) =>
      prev.map((item) =>
        item.id === mailId ? { ...item, claimed: true, read: true } : item
      )
    );
    onGrantReward?.(m.rewardType, m.rewardAmount, m.title);
    if (m.bonusGems > 0) {
      onGrantReward?.('gems', m.bonusGems, `${m.title} Seal`);
    }
  };

  const handleClaimAllMail = () => {
    const unclaimed = mailMessages.filter((m) => !m.claimed);
    if (unclaimed.length === 0) {
      onShowToast?.('✉️ All Imperial Mail attachments have already been claimed.');
      return;
    }
    setMailMessages((prev) => prev.map((m) => ({ ...m, claimed: true, read: true })));
    unclaimed.forEach((m) => {
      onGrantReward?.(m.rewardType, m.rewardAmount, m.title);
      if (m.bonusGems > 0) {
        onGrantReward?.('gems', m.bonusGems, m.title);
      }
    });
    onShowToast?.(`✉️ Claimed rewards from ${unclaimed.length} Imperial Dispatches!`);
  };

  // Sculpted 3D Isometric SVG Models for Inventory, Quests, Alliance, Mail, Search, Chat, Hub
  const render3DModelIcon = (
    type: 'inventory' | 'quests' | 'alliance' | 'mail' | 'search' | 'chat' | 'hub',
    size = 28
  ) => {
    switch (type) {
      case 'hub':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="12" ry="3" fill="rgba(0,0,0,0.55)" />
            <polygon points="18,4 29,11 29,24 18,30 7,24 7,11" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.4" />
            <polygon points="18,7 26,12 26,22 18,26.5 10,22 10,12" fill="#0284c7" stroke="#fef08a" strokeWidth="1" />
            <circle cx="18" cy="17" r="4" fill="#fde047" />
          </svg>
        );
      case 'inventory':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="13" ry="3.5" fill="rgba(0,0,0,0.55)" />
            <polygon points="5,15 18,21 18,30 5,24" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
            <polygon points="31,15 18,21 18,30 31,24" fill="#92400e" stroke="#fbbf24" strokeWidth="1" />
            <polygon points="5,15 18,8 31,15 18,21" fill="url(#invLidGrad)" stroke="#fef08a" strokeWidth="1.2" />
            <line x1="11.5" y1="11.5" x2="24.5" y2="18" stroke="#fef08a" strokeWidth="1.5" />
            <polygon points="18,17 21.5,20.5 18,25 14.5,20.5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1" />
            <defs>
              <linearGradient id="invLidGrad" x1="5" y1="8" x2="31" y2="21" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'quests':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="12" ry="3.2" fill="rgba(0,0,0,0.55)" />
            <polygon
              points="18,4 29,9 26,23 18,30 10,23 7,9"
              fill="#0c4a6e"
              stroke="#38bdf8"
              strokeWidth="1.3"
            />
            <polygon
              points="18,6 26.5,10 24,21.5 18,27.5 12,21.5 9.5,10"
              fill="url(#questShieldGrad)"
              stroke="#facc15"
              strokeWidth="1.1"
            />
            <rect x="8" y="6" width="20" height="3.2" rx="1.6" fill="#facc15" stroke="#78350f" strokeWidth="0.9" />
            <polygon
              points="18,10.5 19.9,14.6 24.4,15.1 21,18.1 21.9,22.5 18,20.2 14.1,22.5 15,18.1 11.6,15.1 16.1,14.6"
              fill="#fef08a"
              stroke="#b45309"
              strokeWidth="0.9"
            />
            <defs>
              <linearGradient id="questShieldGrad" x1="9" y1="6" x2="27" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'mail':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="13" ry="3.2" fill="rgba(0,0,0,0.55)" />
            <polygon points="4,13 32,13 30,27 6,27" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
            <polygon points="5,10 31,10 29,24 7,24" fill="url(#mailFaceGrad)" stroke="#fef08a" strokeWidth="1.2" />
            <polygon points="5,10 18,19.5 31,10" fill="#d97706" stroke="#fef08a" strokeWidth="1.1" />
            <circle cx="18" cy="18.5" r="4.5" fill="#dc2626" stroke="#fef08a" strokeWidth="1.3" />
            <polygon points="18,15.8 20.2,18.5 18,21.2 15.8,18.5" fill="#38bdf8" />
            <defs>
              <linearGradient id="mailFaceGrad" x1="5" y1="10" x2="31" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        );
      case 'search':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="11" ry="2.8" fill="rgba(0,0,0,0.55)" />
            <circle cx="15.5" cy="15.5" r="9" fill="#0f172a" stroke="#facc15" strokeWidth="2.1" />
            <circle cx="15.5" cy="15.5" r="6" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1.2" />
            <path d="M12.5 12.5C13.6 11.4 15.2 11 16.8 11.4" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="22" x2="29" y2="29" stroke="#d97706" strokeWidth="3.6" strokeLinecap="round" />
            <line x1="22" y1="22" x2="29" y2="29" stroke="#fef08a" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        );
      case 'alliance':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="12" ry="3.2" fill="rgba(0,0,0,0.55)" />
            <line x1="8" y1="27" x2="28" y2="7" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="28" y1="27" x2="8" y2="7" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
            <polygon
              points="18,6 27,10.5 25,22 18,28.5 11,22 9,10.5"
              fill="#065f46"
              stroke="#34d399"
              strokeWidth="1.4"
            />
            <polygon
              points="18,9.5 24,12.5 22.5,20.5 18,25 13.5,20.5 12,12.5"
              fill="#059669"
              stroke="#fef08a"
              strokeWidth="1.1"
            />
            <polygon
              points="18,12 20,16 18,20.5 16,16"
              fill="#fde047"
              stroke="#78350f"
              strokeWidth="0.7"
            />
          </svg>
        );
      case 'chat':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="12" ry="3" fill="rgba(0,0,0,0.55)" />
            <path
              d="M7 11C7 8.8 8.8 7 11 7H25C27.2 7 29 8.8 29 11V20C29 22.2 27.2 24 25 24H15L9 28.5V24H11C8.8 24 7 22.2 7 20V11Z"
              fill="#1e3a8a"
              stroke="#38bdf8"
              strokeWidth="1.4"
            />
            <line x1="12" y1="13" x2="24" y2="13" stroke="#fef08a" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="12" y1="17.5" x2="20" y2="17.5" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
    }
  };

  // Crisp inline SVG resource & navigation icons (eliminates OS font missing-glyph boxes)
  const renderResourceSvg = (res: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'gems') => {
    switch (res) {
      case 'wood':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <polygon points="10,2 16,10 13,10 17,15 3,15 7,10 4,10" fill="#22c55e" stroke="#86efac" strokeWidth="1" />
            <rect x="8.5" y="15" width="3" height="3.5" fill="#92400e" />
          </svg>
        );
      case 'stone':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <polygon points="4,15 6,6 12,4 16,9 15,16 6,17" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1.1" />
            <polygon points="6,6 12,4 11,11 4,15" fill="#cbd5e1" opacity="0.65" />
          </svg>
        );
      case 'iron':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <polygon points="3,13 7,7 17,7 14,13" fill="#60a5fa" stroke="#dbeafe" strokeWidth="1.1" />
            <polygon points="3,13 14,13 13,16 2,16" fill="#2563eb" />
          </svg>
        );
      case 'food':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 17V5" stroke="#facc15" strokeWidth="1.4" strokeLinecap="round" />
            <ellipse cx="7.5" cy="7.5" rx="2.2" ry="1.3" transform="rotate(-30 7.5 7.5)" fill="#fde047" />
            <ellipse cx="12.5" cy="7.5" rx="2.2" ry="1.3" transform="rotate(30 12.5 7.5)" fill="#eab308" />
            <ellipse cx="7.5" cy="11.5" rx="2.2" ry="1.3" transform="rotate(-30 7.5 11.5)" fill="#fde047" />
            <ellipse cx="12.5" cy="11.5" rx="2.2" ry="1.3" transform="rotate(30 12.5 11.5)" fill="#eab308" />
          </svg>
        );
      case 'crystal':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <polygon points="10,2 16,8 13,18 7,18 4,8" fill="#06b6d4" stroke="#a5f3fc" strokeWidth="1.2" />
            <polygon points="10,2 16,8 10,13 4,8" fill="#67e8f9" opacity="0.7" />
          </svg>
        );
      case 'gold':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" fill="#eab308" stroke="#fef08a" strokeWidth="1.3" />
            <circle cx="10" cy="10" r="4.2" fill="#ca8a04" stroke="#fde047" strokeWidth="0.8" />
          </svg>
        );
      case 'gems':
        return (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <polygon points="6,4 14,4 18,9 10,17 2,9" fill="#a855f7" stroke="#f3e8ff" strokeWidth="1.1" />
            <polygon points="6,4 14,4 10,9" fill="#d8b4fe" opacity="0.7" />
          </svg>
        );
    }
  };

  // Standing Kingdom Army Power + Selected Battalion Calculations
  const standingPower = useMemo(() => {
    const allStacks: TroopStack[] = [];
    for (const cls of ['infantry', 'archer', 'cavalry'] as TroopClassId[]) {
      for (const lv of [1, 2, 3, 4, 5] as TroopLevel[]) {
        const count = troopInventory[cls]?.[lv] || 0;
        if (count > 0) allStacks.push({ classId: cls, level: lv, count });
      }
    }
    return calculateArmyMetrics(allStacks, balanceConfig, bonuses, undefined, infantryGear).totalPower;
  }, [troopInventory, balanceConfig, bonuses, infantryGear]);

  const selectedBattalionStacks = useMemo<TroopStack[]>(() => {
    return (['infantry', 'archer', 'cavalry'] as TroopClassId[])
      .map((cls) => ({
        classId: cls,
        level: selectedTroopLv,
        count: Math.min(marchCounts[cls] || 0, troopInventory[cls]?.[selectedTroopLv] || 0),
      }))
      .filter((s) => s.count > 0);
  }, [marchCounts, selectedTroopLv, troopInventory]);

  const selectedBattalionMetrics = useMemo(
    () => calculateArmyMetrics(selectedBattalionStacks, balanceConfig, effectiveBonuses, activeHero, infantryGear),
    [selectedBattalionStacks, balanceConfig, effectiveBonuses, activeHero, infantryGear]
  );

  const applyBattalionRatio = (ratio: number) => {
    setMarchCounts({
      infantry: Math.round((troopInventory.infantry?.[selectedTroopLv] || 0) * ratio),
      archer: Math.round((troopInventory.archer?.[selectedTroopLv] || 0) * ratio),
      cavalry: Math.round((troopInventory.cavalry?.[selectedTroopLv] || 0) * ratio),
    });
  };

  const applyRecommendedPreset = (target: WorldEntity) => {
    const targetLv = target.level || 1;
    const recLv: TroopLevel =
      target.category === 'monster'
        ? targetLv <= 2
          ? 1
          : targetLv <= 3
            ? 2
            : targetLv <= 5
              ? 3
              : targetLv <= 7
                ? 4
                : 5
        : targetLv >= 7
          ? 4
          : targetLv >= 4
            ? 3
            : 1;
    setSelectedTroopLv(recLv);
    const reqCap = target.requiredTroopCapacity || (target.category === 'monster' ? targetLv * 220 : 400);
    const availInf = troopInventory.infantry?.[recLv] || 0;
    const availArc = troopInventory.archer?.[recLv] || 0;
    const availCav = troopInventory.cavalry?.[recLv] || 0;
    setMarchCounts({
      infantry: Math.min(availInf, Math.ceil(reqCap * 0.5)),
      archer: Math.min(availArc, Math.ceil(reqCap * 0.3)),
      cavalry: Math.min(availCav, Math.ceil(reqCap * 0.25)),
    });
  };

  const myCastleCoords = useMemo<[number, number]>(() => {
    const mc = castles.find((c) => c.isMyCastle);
    return mc ? [mc.position[0], mc.position[2]] : [1600, 1568];
  }, [castles]);

  // Target distance, march formula, and gathering formula from My Castle
  const targetDistanceInfo = useMemo(() => {
    if (!selectedEntity) {
      return { dist: 0, distanceTiles: 0, seconds: 0, formulaMinutes: 0, gatherSpeedPerMin: 0, gatherMinutes: 0 };
    }
    const dist = Math.round(
      Math.hypot(
        selectedEntity.position[0] - myCastleCoords[0],
        selectedEntity.position[2] - myCastleCoords[1]
      )
    );
    const timing = calculateMarchTiming(
      [myCastleCoords[0], 0, myCastleCoords[1]],
      selectedEntity.position,
      selectedBattalionMetrics.marchSpeedTilesPerMin,
      balanceConfig
    );
    let gatherSpeedPerMin = 0;
    let gatherMinutes = 0;
    if (selectedEntity.category === 'resource') {
      const rKind = (
        selectedEntity.resourceType === 'gold' || !selectedEntity.resourceType
          ? selectedEntity.subtype === 'farm'
            ? 'food'
            : selectedEntity.subtype === 'crystal'
              ? 'crystal'
              : 'food'
          : selectedEntity.resourceType
      ) as ResourceKind;
      const liveYield = nodeStates[selectedEntity.id]?.remainingYield ?? selectedEntity.yieldAmount ?? 5000;
      const targetCollect = Math.min(liveYield, Math.max(1, selectedBattalionMetrics.totalLoad));
      const gTiming = calculateResourceGatherTiming(
        targetCollect,
        rKind,
        Math.max(1, selectedBattalionMetrics.baseGatheringSpeedPerMin),
        balanceConfig
      );
      gatherSpeedPerMin = gTiming.effectiveGatherSpeedPerMin;
      gatherMinutes = gTiming.formulaMinutes;
    }
    return {
      dist,
      distanceTiles: timing.distanceTiles,
      seconds: Math.round(timing.realSeconds),
      formulaMinutes: timing.formulaMinutes,
      gatherSpeedPerMin,
      gatherMinutes,
    };
  }, [selectedEntity, myCastleCoords, selectedBattalionMetrics, balanceConfig, nodeStates]);

  // ============================================================
  // 1. RENDER FIXED 2x2 SQUARE MINIMAP (112x112 Compact, 3200x3200 Green Continent)
  // ============================================================
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 112;

    // 1. Lush Emerald Highland Loam Base
    ctx.fillStyle = '#1f4428';
    ctx.fillRect(0, 0, size, size);

    // 2. Full Green Highland Corner Coverage Across All 4 Outer Corners (No Snow)
    for (const [sx, sy] of [
      [0, 0],
      [size, 0],
      [0, size],
      [size, size],
    ] as const) {
      const greenGrad = ctx.createRadialGradient(sx, sy, 4, sx, sy, size * 0.4);
      greenGrad.addColorStop(0, 'rgba(74, 150, 72, 0.72)');
      greenGrad.addColorStop(0.6, 'rgba(46, 108, 52, 0.34)');
      greenGrad.addColorStop(1, 'rgba(46, 108, 52, 0)');
      ctx.fillStyle = greenGrad;
      ctx.fillRect(0, 0, size, size);
    }

    // 3. Paved Imperial Cobblestone Highways (Centered at [1600, 1600])
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.6;

    const h1Start = WorldCoordinates.worldToMinimap(1600, 360, size, size);
    const h1End = WorldCoordinates.worldToMinimap(1600, 2840, size, size);
    ctx.beginPath();
    ctx.moveTo(h1Start.mx, h1Start.my);
    ctx.lineTo(h1End.mx, h1End.my);
    ctx.stroke();

    const h2Start = WorldCoordinates.worldToMinimap(360, 1600, size, size);
    const h2End = WorldCoordinates.worldToMinimap(2840, 1600, size, size);
    ctx.beginPath();
    ctx.moveTo(h2Start.mx, h2Start.my);
    ctx.lineTo(h2End.mx, h2End.my);
    ctx.stroke();

    // 3b. Winding South-to-North Nile River, Fertile Banks & Northern Delta on Minimap
    const drawMinimapRiver = (
      xFn: (z: number) => number,
      zStart: number,
      zEnd: number,
      strokeCol: string,
      width: number
    ) => {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const z = zStart + (zEnd - zStart) * (i / steps);
        const pt = WorldCoordinates.worldToMinimap(xFn(z), z, size, size);
        if (i === 0) ctx.moveTo(pt.mx, pt.my);
        else ctx.lineTo(pt.mx, pt.my);
      }
      ctx.stroke();
    };

    // Fertile green floodplain glow along Nile course & delta
    drawMinimapRiver(getNileMainX, 3200, NILE_DELTA_FORK_Z, 'rgba(34, 197, 94, 0.25)', 5.2);
    drawMinimapRiver(getNileWestDeltaX, NILE_DELTA_FORK_Z, 0, 'rgba(34, 197, 94, 0.22)', 4.2);
    drawMinimapRiver(getNileEastDeltaX, NILE_DELTA_FORK_Z, 0, 'rgba(34, 197, 94, 0.22)', 4.2);

    // Crisp azure Nile River channel & Northern Delta fork
    drawMinimapRiver(getNileMainX, 3200, NILE_DELTA_FORK_Z, 'rgba(14, 165, 233, 0.9)', 2.1);
    drawMinimapRiver(getNileWestDeltaX, NILE_DELTA_FORK_Z, 0, 'rgba(56, 189, 248, 0.85)', 1.5);
    drawMinimapRiver(getNileEastDeltaX, NILE_DELTA_FORK_Z, 0, 'rgba(56, 189, 248, 0.85)', 1.5);

    // 4. Fixed 2x2 Sector Quadrant Grid Lines (Dividing at center 1600)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.0;

    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Quadrant Corner Labels
    ctx.fillStyle = 'rgba(220, 252, 231, 0.78)';
    ctx.font = "700 6px 'Barlow Condensed', sans-serif";
    ctx.fillText('SW LAND', 4, size - 4);
    ctx.fillText('SE LAND', size - 27, size - 4);
    ctx.fillText('NW LAND', 4, 8);
    ctx.fillText('NE LAND', size - 27, 8);

    // 5. Continent 1 Network: The Congress + 36 Shrines (A1-A4, B1-B12, C1-C20)
    for (const plot of RESERVED_PLOTS) {
      const { mx, my } = WorldCoordinates.worldToMinimap(plot.position[0], plot.position[2], size, size);
      const isConquered = conqueredPlots?.[plot.id] === 'alliance';
      if (isConquered) {
        ctx.fillStyle = '#10b981';
        const rad = plot.type === 'congress' ? 4.2 : plot.type === 'shrine_a' ? 2.8 : 2.1;
        ctx.beginPath();
        ctx.arc(mx, my, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else if (plot.type === 'congress') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(mx - 4, my - 4, 8, 8);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(mx - 4, my - 4, 8, 8);
      } else if (plot.type === 'shrine_a') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(mx, my, 2.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (plot.type === 'shrine_b') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(mx, my, 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5b. Randomized Castles (My Castle + 10 Alliance Member Castles + 6 Rival Enemy Castles)
    for (const castle of castles) {
      const { mx, my } = WorldCoordinates.worldToMinimap(castle.position[0], castle.position[2], size, size);
      if (castle.isMyCastle) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(mx - 3.2, my - 3.2, 6.4, 6.4);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(mx - 3.2, my - 3.2, 6.4, 6.4);
      } else if (castle.faction === 'enemy') {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(mx - 2.3, my - 2.3, 4.6, 4.6);
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(mx - 2.3, my - 2.3, 4.6, 4.6);
      } else {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(mx - 2, my - 2, 4, 4);
      }
    }

    // 6. Monsters & 7. Resources (Hidden when 3D Strategic Filter is active)
    if (!isStrategicFilterActive) {
      for (const m of WORLD_MONSTERS) {
        if (m.isDefeated) continue;
        const { mx, my } = WorldCoordinates.worldToMinimap(m.position[0], m.position[2], size, size);
        ctx.fillStyle = m.subtype === 'boss' ? '#dc2626' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(mx, my - 2.2);
        ctx.lineTo(mx + 2.2, my);
        ctx.lineTo(mx, my + 2.2);
        ctx.lineTo(mx - 2.2, my);
        ctx.closePath();
        ctx.fill();
      }

      for (const r of WORLD_RESOURCES) {
        const { mx, my } = WorldCoordinates.worldToMinimap(r.position[0], r.position[2], size, size);
        if (r.subtype === 'gold') {
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (r.subtype === 'wood') {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (r.subtype === 'farm') {
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (r.subtype === 'stone') {
          ctx.fillStyle = '#a1a1aa';
          ctx.beginPath();
          ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (r.subtype === 'crystal') {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 8. Army Squad Blip (Moving Cyan Indicator)
    if (armyPos) {
      const armyM = WorldCoordinates.worldToMinimap(armyPos[0], armyPos[2], size, size);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(armyM.mx, armyM.my, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // 9. Camera View Frustum Box (scaled to 3200x3200 continent)
    const camCenter = WorldCoordinates.worldToMinimap(cameraInfo.x, cameraInfo.z, size, size);
    const frustumW = Math.max(8, (70 / cameraInfo.zoom) * (size / 3200));
    const frustumH = Math.max(6, (54 / cameraInfo.zoom) * (size / 3200));

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(camCenter.mx - frustumW / 2, camCenter.my - frustumH / 2, frustumW, frustumH);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(camCenter.mx - 1.5, camCenter.my - 1.5, 3, 3);
  }, [cameraInfo, armyPos, castles, conqueredPlots, isStrategicFilterActive]);

  const panMinimapFromClient = (clientX: number, clientY: number) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = Math.max(0, Math.min(canvas.width, ((clientX - rect.left) / rect.width) * canvas.width));
    const my = Math.max(0, Math.min(canvas.height, ((clientY - rect.top) / rect.height) * canvas.height));

    const { wx, wz } = WorldCoordinates.minimapToWorld(mx, my, canvas.width, canvas.height);
    onPanTo(wx, wz);
  };

  const handleMinimapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    isMinimapDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    panMinimapFromClient(e.clientX, e.clientY);
  };

  const handleMinimapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMinimapDraggingRef.current) return;
    e.stopPropagation();
    panMinimapFromClient(e.clientX, e.clientY);
  };

  const handleMinimapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isMinimapDraggingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        channel: chatChannel,
        sender: 'Emperor Dangol',
        tag: chatChannel === 'world' ? 'Monarch' : playerAlliance.tag,
        text: chatInput.trim(),
        time: timeStr,
      },
    ]);
    setChatInput('');
  };

  // Alliance territory stats & castle groupings
  const allianceMemberCastles = useMemo(
    () => castles.filter((c) => c.faction !== 'enemy'),
    [castles]
  );
  const enemyCastles = useMemo(
    () => castles.filter((c) => c.faction === 'enemy'),
    [castles]
  );
  const allianceTerritoryStats = useMemo(() => {
    let cCount = 0;
    let bCount = 0;
    let aCount = 0;
    let hasCongress = false;
    for (const plot of RESERVED_PLOTS) {
      if (conqueredPlots?.[plot.id] === 'alliance') {
        if (plot.type === 'shrine_c') cCount += 1;
        else if (plot.type === 'shrine_b') bCount += 1;
        else if (plot.type === 'shrine_a') aCount += 1;
        else if (plot.type === 'congress') hasCongress = true;
      }
    }
    const capturedTotal = cCount + bCount + aCount + (hasCongress ? 1 : 0);
    const totalPower = allianceMemberCastles.reduce((sum, c) => sum + c.power, 0);
    const attackBuff = aCount * 12 + (hasCongress ? 20 : 0);
    const marchBuff = bCount * 8 + (hasCongress ? 20 : 0);
    const yieldBuff = cCount * 5 + (hasCongress ? 20 : 0);
    return {
      cCount,
      bCount,
      aCount,
      hasCongress,
      capturedTotal,
      totalPower,
      attackBuff,
      marchBuff,
      yieldBuff,
    };
  }, [conqueredPlots, allianceMemberCastles]);

  // Strictly Resources & Monsters within 100 km (100 tiles = 1,000 world units) from My Castle
  const searchTargetItems = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      level: number;
      category: 'monster' | 'resource';
      subtype: string;
      position: [number, number, number];
      distWorld: number;
      distanceKm: number;
      remainingYield?: number;
    }> = [];

    for (const m of WORLD_MONSTERS) {
      if (m.isDefeated || monsterStates[m.id]?.isDefeated) continue;
      const distWorld = Math.hypot(m.position[0] - myCastleCoords[0], m.position[2] - myCastleCoords[1]);
      const distanceKm = Math.round(distWorld / 10);
      if (distanceKm <= 100) {
        items.push({
          id: m.id,
          name: m.name,
          level: m.level,
          category: 'monster',
          subtype: m.subtype,
          position: m.position,
          distWorld,
          distanceKm,
        });
      }
    }

    for (const r of WORLD_RESOURCES) {
      const remYield = nodeStates[r.id]?.remainingYield ?? r.yieldAmount ?? 1;
      if (remYield <= 0) continue;
      const distWorld = Math.hypot(r.position[0] - myCastleCoords[0], r.position[2] - myCastleCoords[1]);
      const distanceKm = Math.round(distWorld / 10);
      if (distanceKm <= 100) {
        items.push({
          id: r.id,
          name: r.name,
          level: r.level,
          category: 'resource',
          subtype: r.subtype,
          position: r.position,
          distWorld,
          distanceKm,
          remainingYield: remYield,
        });
      }
    }

    return items.sort((a, b) => a.distWorld - b.distWorld);
  }, [myCastleCoords, monsterStates, nodeStates]);

  const filteredSearchEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return searchTargetItems.filter((ent) => {
      if (searchCategory === 'monsters' && ent.category !== 'monster') return false;
      if (searchCategory !== 'all' && searchCategory !== 'monsters' && ent.subtype !== searchCategory) {
        return false;
      }
      if (!q) return true;
      return (
        ent.name.toLowerCase().includes(q) ||
        ent.subtype.toLowerCase().includes(q) ||
        `lv.${ent.level}`.includes(q) ||
        `lv ${ent.level}`.includes(q)
      );
    });
  }, [searchTargetItems, searchCategory, searchQuery]);

  const channelChatMessages = useMemo(
    () => chatMessages.filter((m) => m.channel === chatChannel),
    [chatMessages, chatChannel]
  );
  const latestChatMessage =
    channelChatMessages[channelChatMessages.length - 1] || chatMessages[chatMessages.length - 1];
  const zoomOutScore = Math.min(
    100,
    Math.max(0, Math.round(((3.2 - cameraInfo.zoom) / (3.2 - 0.023)) * 100))
  );

  const activeTooltipMarch = useMemo(
    () => activeMarches.find((m) => m.id === selectedMarchTooltipId) || null,
    [activeMarches, selectedMarchTooltipId]
  );

  const renderMarchQueueSvg = (kind: ActiveMarch['kind'], isRally?: boolean) => {
    if (isRally) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 20V5" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M5 5.5L19 9L5 14V5.5Z" fill="#f59e0b" stroke="#fde047" strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="17" cy="17.5" r="2.2" fill="#38bdf8" />
        </svg>
      );
    }
    if (kind === 'gather') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 19L15 9" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 5C15.5 5 18.5 8 18.5 11.5L13.5 9.5L12 5Z" fill="#34d399" stroke="#a7f3d0" strokeWidth="1.2" />
          <rect x="13" y="14" width="7" height="6" rx="1.2" fill="#b45309" stroke="#fef08a" strokeWidth="1.1" />
        </svg>
      );
    }
    if (kind === 'reinforce_structure') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polygon points="12,3 20,6.5 18.5,15 12,21 5.5,15 4,6.5" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M12 7.5V16M8.5 11.5L12 8L15.5 11.5" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 19L18 6M15 5H19V9" stroke="#fca5a5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 19L6 6M9 5H5V9" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. TOP-LEFT: PROFILE -> MINIMAP -> X/Y + BOOKMARK + WORLDMAP */}
      {/* ============================================================ */}
      <div
        className="hud-top-left-stack"
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 55,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        {/* User Profile Banner — 3D Royal Crowned Plaque + VIP Hanging Pennant */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '3px',
          }}
        >
          <div
            className="hud-profile-card"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              paddingTop: '10px',
              paddingLeft: '4px',
              paddingRight: '4px',
            }}
          >
            {/* Left Crimson Cloak + Gold-Beveled Square Frame + Overhanging 3D Royal Crown */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              title="Open 3D Commander Profile Dashboard"
              style={{
                position: 'relative',
                zIndex: 4,
                width: '52px',
                height: '52px',
                minWidth: '52px',
                padding: '3px',
                borderRadius: '8px',
                background: 'linear-gradient(180deg, #fef08a 0%, #eab308 42%, #b45309 100%)',
                border: '1.5px solid #fef9c3',
                boxShadow: '0 6px 16px rgba(0,0,0,0.85), -4px 4px 0 #991b1b',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {/* 3D Royal Crown Seated on Frame Top */}
              <div
                style={{
                  position: 'absolute',
                  top: '-22px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                <Profile3DBadge iconKey="royal_crown" size={34} />
              </div>

              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  border: '1px solid #78350f',
                }}
              >
                <img
                  src={getHeroPortraitUrl(selectedHeroId)}
                  alt="Commander Avatar"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center 18%',
                    display: 'block',
                  }}
                />
              </div>

              {/* Bottom Sapphire Diamond Clasp */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  bottom: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '9px',
                  height: '9px',
                  background: 'linear-gradient(135deg, #bae6fd, #0284c7)',
                  border: '1px solid #fef08a',
                  boxShadow: '0 0 8px rgba(56, 189, 248, 0.85)',
                }}
              />
            </button>

            {/* Center Dual-Tier Sapphire Nameplate + Slate Power & AP Plate */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              title="Open Commander Profile, Account & Hero Mastery"
              style={{
                position: 'relative',
                zIndex: 2,
                marginLeft: '-6px',
                marginRight: '-6px',
                minWidth: '154px',
                padding: '0',
                background: 'linear-gradient(180deg, #1b2434 0%, #0f1520 100%)',
                borderTop: '2.5px solid #eab308',
                borderBottom: '2.5px solid #b45309',
                borderLeft: 'none',
                borderRight: 'none',
                boxShadow: '0 6px 18px rgba(0,0,0,0.78)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                textAlign: 'left',
              }}
            >
              {/* Upper Sapphire Name Ribbon */}
              <div
                style={{
                  width: '100%',
                  padding: '2px 12px',
                  background: 'linear-gradient(180deg, #1d4e89 0%, #0d2b52 100%)',
                  borderBottom: '1.5px solid rgba(250, 204, 21, 0.55)',
                }}
              >
                <span
                  style={{
                    font: "800 12.5px 'Cinzel', serif",
                    color: '#fefce8',
                    letterSpacing: '0.05em',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {commanderNameOverride || commanderName}
                </span>
              </div>

              {/* Lower Power + Glowing Orange AP Track */}
              <div
                style={{
                  padding: '3px 10px 4px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Profile3DBadge iconKey="crossed_swords" size={16} />
                  <span
                    style={{
                      font: "800 13.5px 'Plus Jakarta Sans', sans-serif",
                      fontVariantNumeric: 'tabular-nums',
                      color: '#fde047',
                      textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                      lineHeight: 1.05,
                    }}
                  >
                    {standingPower.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Profile3DBadge iconKey="xp_star" size={13} />
                  <div
                    style={{
                      flex: 1,
                      height: '7px',
                      borderRadius: '4px',
                      background: '#080d16',
                      border: '1px solid rgba(234, 179, 8, 0.45)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round((actionPoints / MAX_ACTION_POINTS) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ea580c 0%, #f59e0b 55%, #fde047 100%)',
                        boxShadow: '0 0 8px rgba(245, 158, 11, 0.7)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </button>

            {/* Right Hanging Royal Blue & Gold VIP Pennant Banner */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              title="VIP Level 4 · Open Profile"
              style={{
                position: 'relative',
                zIndex: 3,
                width: '40px',
                height: '58px',
                padding: '6px 2px 10px',
                border: '2px solid #facc15',
                borderTop: '3px solid #fef08a',
                background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 58%, #1e3a8a 100%)',
                clipPath: 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)',
                boxShadow: '0 6px 14px rgba(0,0,0,0.85)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                flexShrink: 0,
              }}
            >
              <Profile3DBadge iconKey="banner_crown" size={22} />
              <span
                style={{
                  font: "900 12px 'Cinzel', serif",
                  fontVariantNumeric: 'tabular-nums',
                  color: '#fde047',
                  lineHeight: 1,
                  textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                }}
              >
                4
              </span>
            </button>
          </div>

          {/* Compact Alliance & Shrines Quick Link Bar */}
          <button
            type="button"
            className="hud-alliance-subbar"
            onClick={() => {
              setAllianceTab('overview');
              setIsAllianceOpen(true);
            }}
            title="Open Alliance Headquarters & Territory"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(10, 16, 28, 0.88)',
              border: '1px solid rgba(218, 165, 32, 0.45)',
              borderRadius: '6px',
              padding: '2px 8px',
              marginLeft: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              color: '#cbd5e1',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 10px rgba(0,0,0,0.55)',
            }}
          >
            <span style={{ color: '#a7f3d0', fontWeight: 700 }}>[{playerAlliance.tag}]</span>
            <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
            <span style={{ maxWidth: '115px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {playerAlliance.alias}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
            <span style={{ color: shrineRuleStatus.atShrineCap ? '#fca5a5' : '#86efac', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              Shrines {shrineRuleStatus.totalShrinesHeld}/{shrineRuleStatus.maxShrinesPerAlliance}
            </span>
          </button>
        </div>

        {/* Minimap Directly Below Profile */}
        <div
          className="hud-minimap-box"
          style={{
            position: 'relative',
            width: '112px',
            height: '112px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1.5px solid rgba(218, 165, 32, 0.72)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.85)',
            background: '#0f172a',
          }}
        >
          <canvas
            ref={minimapCanvasRef}
            width={112}
            height={112}
            onPointerDown={handleMinimapPointerDown}
            onPointerMove={handleMinimapPointerMove}
            onPointerUp={handleMinimapPointerUp}
            onPointerCancel={handleMinimapPointerUp}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              left: '4px',
              fontSize: '7px',
              color: '#fef08a',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.03em',
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              pointerEvents: 'none',
            }}
          >
            3200×3200 · C1
          </div>
        </div>

        {/* X & Y Coordinates + Bookmark Button + Small WorldMap Icon Directly Below Minimap */}
        <div
          className="hud-coords-bookmark-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <div
            style={{
              background: 'rgba(12, 17, 26, 0.95)',
              borderTop: '1px solid rgba(218, 165, 32, 0.5)',
              borderLeft: '1px solid rgba(218, 165, 32, 0.5)',
              borderRight: '1px solid rgba(218, 165, 32, 0.5)',
              borderBottom: '3px solid #78350f',
              borderRadius: '7px',
              padding: '4px 8px',
              font: "700 11px 'Barlow Condensed', sans-serif",
              fontVariantNumeric: 'tabular-nums',
              color: '#cbd5e1',
              boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
            }}
            title="Live Camera Map Axis (X and Y)"
          >
            <span style={{ color: '#94a3b8' }}>X:</span>{' '}
            <span style={{ color: '#fef08a' }}>{Math.round(cameraInfo.x)}</span>
            <span style={{ color: 'rgba(255,255,255,0.22)', margin: '0 4px' }}>·</span>
            <span style={{ color: '#94a3b8' }}>Y:</span>{' '}
            <span style={{ color: '#fef08a' }}>{Math.round(cameraInfo.z)}</span>
          </div>

          {/* Bookmark Toggle Button */}
          <button
            type="button"
            onClick={() => openExclusiveDockPanel('bookmarks')}
            style={{
              position: 'relative',
              height: '28px',
              minWidth: '30px',
              padding: '0 7px',
              borderRadius: '7px',
              background: isBookmarksOpen
                ? 'linear-gradient(180deg, #b45309, #78350f)'
                : 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: isBookmarksOpen ? '1.5px solid #fde047' : '1px solid rgba(218, 165, 32, 0.55)',
              borderLeft: isBookmarksOpen ? '1.5px solid #fde047' : '1px solid rgba(218, 165, 32, 0.55)',
              borderRight: isBookmarksOpen ? '1.5px solid #fde047' : '1px solid rgba(218, 165, 32, 0.55)',
              borderBottom: '3px solid #78350f',
              boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
              color: '#fef08a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
            }}
            title="Bookmark Coordinates (Save & Jump to Map Pins)"
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 3.5C5 2.7 5.7 2 6.5 2H13.5C14.3 2 15 2.7 15 3.5V18L10 14.5L5 18V3.5Z"
                fill={isBookmarksOpen ? '#fef08a' : '#f59e0b'}
                stroke="#fef08a"
                strokeWidth="1.2"
              />
            </svg>
            <span style={{ font: "700 10px 'Barlow Condensed'", fontVariantNumeric: 'tabular-nums' }}>
              {bookmarks.length}
            </span>
          </button>

          {/* Small WorldMap Icon Button Beside Bookmark */}
          <button
            type="button"
            onClick={onOpenStrategicWorldMap}
            style={{
              height: '28px',
              width: '30px',
              padding: 0,
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #0369a1, #1e3a8a)',
              borderTop: '1px solid #38bdf8',
              borderLeft: '1px solid #38bdf8',
              borderRight: '1px solid #38bdf8',
              borderBottom: '3px solid #082f49',
              boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
              color: '#e0f2fe',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Open Continent 1 Parchment WorldMap"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <polygon points="3,6 9,4 15,6 21,4 21,18 15,20 9,18 3,20" fill="#0ea5e9" stroke="#e0f2fe" strokeWidth="1.4" />
              <line x1="9" y1="4" x2="9" y2="18" stroke="#bae6fd" strokeWidth="1.1" />
              <line x1="15" y1="6" x2="15" y2="20" stroke="#bae6fd" strokeWidth="1.1" />
              <circle cx="12" cy="12" r="2" fill="#facc15" />
            </svg>
          </button>
        </div>

        {/* March Icon Queue Directly Below X & Y Axis */}
        {activeMarches.length > 0 && (
          <div className="hud-march-queue-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
            <div
              className="hud-march-queue-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexWrap: 'wrap',
              }}
            >
              {activeMarches.map((march) => {
                const isSelected = selectedMarchTooltipId === march.id;
                const marchTargetMs = march.phaseStartedAt + march.phaseDurationMs;
                const isGather = march.kind === 'gather';
                const isReinf = march.kind === 'reinforce_structure';
                const isRallyMarch = Boolean(march.isRally);
                const kindLabel = isGather ? 'GATHER' : isReinf ? 'REINF' : isRallyMarch ? 'RALLY' : 'ATTACK';
                const borderCol = isGather ? '#34d399' : isReinf ? '#38bdf8' : isRallyMarch ? '#f59e0b' : '#f87171';
                const bevelCol = isGather ? '#064e3b' : isReinf ? '#0c4a6e' : isRallyMarch ? '#78350f' : '#7f1d1d';
                const marchHero = getHeroById(march.heroId);

                return (
                  <button
                    key={march.id}
                    type="button"
                    onClick={() => {
                      onPanTo(march.targetPosition[0], march.targetPosition[2]);
                      setSelectedMarchTooltipId((prev) => (prev === march.id ? null : march.id));
                    }}
                    style={{
                      minHeight: '40px',
                      minWidth: '54px',
                      padding: '4px 7px',
                      borderRadius: '8px',
                      background: isSelected
                        ? isGather
                          ? 'linear-gradient(180deg, #065f46, #022c22)'
                          : isReinf
                            ? 'linear-gradient(180deg, #0369a1, #082f49)'
                            : isRallyMarch
                              ? 'linear-gradient(180deg, #b45309, #451a03)'
                              : 'linear-gradient(180deg, #991b1b, #450a0a)'
                        : 'rgba(12, 17, 26, 0.94)',
                      borderTop: `1.5px solid ${borderCol}`,
                      borderLeft: `1.5px solid ${borderCol}`,
                      borderRight: `1.5px solid ${borderCol}`,
                      borderBottom: `3px solid ${bevelCol}`,
                      boxShadow: isSelected
                        ? `0 0 12px ${borderCol}66`
                        : '0 4px 12px rgba(0, 0, 0, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      color: '#f8fafc',
                    }}
                    title={`${kindLabel}: ${march.targetName}${marchHero ? ` · ${marchHero.name}` : ''} (${march.status}) · Tap to pan & inspect`}
                  >
                    {marchHero && <HeroPortrait hero={marchHero} size={24} rounded={5} />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {renderMarchQueueSvg(march.kind, isRallyMarch)}
                        <span
                          style={{
                            font: "800 8.5px 'Barlow Condensed', sans-serif",
                            color: borderCol,
                            letterSpacing: '0.03em',
                            lineHeight: 1,
                          }}
                        >
                          {kindLabel}
                        </span>
                      </div>
                      <span
                        style={{
                          font: "700 9.5px 'Barlow Condensed', sans-serif",
                          fontVariantNumeric: 'tabular-nums',
                          color: '#fef08a',
                          lineHeight: 1,
                        }}
                      >
                        <SimCountdownText targetMs={marchTargetMs} format="mmss" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeTooltipMarch && (() => {
              const tx = Math.round(activeTooltipMarch.targetPosition[0]);
              const ty = Math.round(activeTooltipMarch.targetPosition[2]);
              const statusBadge =
                activeTooltipMarch.status === 'marching'
                  ? 'Marching'
                  : activeTooltipMarch.status === 'gathering'
                    ? 'Gathering'
                    : 'Returning';
              const kindTitle =
                activeTooltipMarch.kind === 'gather'
                  ? 'Gather March'
                  : activeTooltipMarch.kind === 'reinforce_structure'
                    ? 'Reinforcement March'
                    : activeTooltipMarch.isRally
                      ? `Alliance Rally (${(activeTooltipMarch.alliedOrigins?.length || 0) + 1} Columns)`
                      : 'Attack March';
              return (
                <div
                  className="hud-march-tooltip"
                  style={{
                    width: '256px',
                    maxWidth: 'calc(100vw - 24px)',
                    background: 'rgba(10, 16, 28, 0.97)',
                    borderTop: '1.5px solid #dfba6e',
                    borderLeft: '1.5px solid #dfba6e',
                    borderRight: '1.5px solid #dfba6e',
                    borderBottom: '3.5px solid #78350f',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    boxShadow: '0 10px 26px rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      {renderMarchQueueSvg(activeTooltipMarch.kind, activeTooltipMarch.isRally)}
                      <span
                        style={{
                          font: "800 12px 'Barlow Condensed', sans-serif",
                          color: '#fef08a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activeTooltipMarch.targetName} (Lv.{activeTooltipMarch.targetLevel})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMarchTooltipId(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '2px 4px',
                      }}
                      title="Close Tooltip"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {kindTitle} · <strong style={{ color: '#38bdf8' }}>{statusBadge}</strong>
                    </span>
                    <span style={{ color: '#86efac', fontWeight: 700 }}>
                      <SimCountdownText
                        targetMs={activeTooltipMarch.phaseStartedAt + activeTooltipMarch.phaseDurationMs}
                        format="mmss"
                      />
                    </span>
                  </div>

                  <div style={{ fontSize: '9.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {activeTooltipMarch.heroId && (
                        <HeroPortrait
                          hero={getHeroById(activeTooltipMarch.heroId)}
                          heroId={activeTooltipMarch.heroId}
                          heroName={activeTooltipMarch.heroName}
                          size={26}
                          rounded={6}
                        />
                      )}
                      <span>Hero: <strong style={{ color: '#e2e8f0' }}>{activeTooltipMarch.heroName || 'Vanguard'}</strong></span>
                    </div>
                    <span>[X:{tx}, Y:{ty}]</span>
                  </div>

                  {activeTooltipMarch.isRally && activeTooltipMarch.rallyCaptains && activeTooltipMarch.rallyCaptains.length > 0 && (
                    <div style={{ fontSize: '9.5px', color: '#fde047', lineHeight: 1.35 }}>
                      Allies Marching: {activeTooltipMarch.rallyCaptains.join(', ')} (+{activeTooltipMarch.rallyBonusPower || 0}% PWR)
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectWorldTarget) {
                          onSelectWorldTarget(activeTooltipMarch.targetId, tx, ty);
                        } else {
                          onPanTo(tx, ty);
                        }
                      }}
                      style={{
                        flex: 1,
                        minHeight: '30px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: 'rgba(2, 132, 199, 0.25)',
                        border: '1px solid #38bdf8',
                        color: '#bae6fd',
                        font: "700 10.5px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Pan Target
                    </button>
                    {activeTooltipMarch.status !== 'returning' && onRecallMarch && (
                      <button
                        type="button"
                        onClick={() => onRecallMarch(activeTooltipMarch.id)}
                        style={{
                          flex: 1,
                          minHeight: '30px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          background: 'rgba(185, 28, 28, 0.28)',
                          border: '1px solid #f87171',
                          color: '#fca5a5',
                          font: "700 10.5px 'Barlow Condensed', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Recall
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenCommandHub('marches')}
                      style={{
                        minHeight: '30px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'rgba(180, 83, 9, 0.3)',
                        border: '1px solid #f59e0b',
                        color: '#fef08a',
                        font: "700 10.5px 'Barlow Condensed', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Marches
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Coordinate Bookmark Popover (Directly below X/Y + Bookmark row) */}
        {isBookmarksOpen && (
          <div
            className="hud-bookmark-popover"
            style={{
              width: '270px',
              maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(10, 16, 28, 0.98)',
              borderTop: '1.5px solid #dfba6e',
              borderLeft: '1.5px solid #dfba6e',
              borderRight: '1.5px solid #dfba6e',
              borderBottom: '4px solid #78350f',
              borderRadius: '10px',
              padding: '10px',
              boxShadow: '0 14px 36px rgba(0,0,0,0.88)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
              <span style={{ font: "800 12.5px 'Barlow Condensed'", color: '#fef08a', letterSpacing: '0.04em' }}>
                COORDINATE BOOKMARKS
              </span>
              <button
                type="button"
                onClick={() => setIsBookmarksOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
              >
                ✕
              </button>
            </div>

            {/* Save Current X/Y Form */}
            <form onSubmit={handleSaveCurrentBookmark} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  type="text"
                  value={bookmarkNameInput}
                  onChange={(e) => setBookmarkNameInput(e.target.value)}
                  placeholder={`Pin X:${Math.round(cameraInfo.x)} Y:${Math.round(cameraInfo.z)}...`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(218, 165, 32, 0.4)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: '#f8fafc',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'linear-gradient(180deg, #16a34a, #15803d)',
                    borderTop: '1px solid #86efac',
                    borderLeft: '1px solid #86efac',
                    borderRight: '1px solid #86efac',
                    borderBottom: '2.5px solid #14532d',
                    color: '#fef08a',
                    font: "800 11px 'Barlow Condensed'",
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Save Pin
                </button>
              </div>

              {/* Pin Category Selector */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(
                  [
                    { id: 'favorite', label: 'Favorite' },
                    { id: 'alliance', label: 'Alliance' },
                    { id: 'shrine', label: 'Shrine' },
                    { id: 'enemy', label: 'Enemy' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBookmarkCategoryInput(cat.id)}
                    style={{
                      flex: 1,
                      padding: '3px 4px',
                      borderRadius: '5px',
                      background: bookmarkCategoryInput === cat.id ? '#b45309' : 'rgba(255,255,255,0.06)',
                      border: bookmarkCategoryInput === cat.id ? '1px solid #fde047' : '1px solid rgba(255,255,255,0.1)',
                      color: bookmarkCategoryInput === cat.id ? '#fef08a' : '#94a3b8',
                      font: "700 10px 'Barlow Condensed'",
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </form>

            {/* Quick Realm Presets + Saved Custom Pins */}
            <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', paddingRight: '2px' }}>
              {[
                { id: 'preset-castle', name: 'My Castle', x: Math.round(myCastleCoords[0]), y: Math.round(myCastleCoords[1]), tag: 'HOME', isPreset: true },
                { id: 'preset-congress', name: 'The Congress', x: 1600, y: 1600, tag: 'CENTER', isPreset: true },
                ...bookmarks.map((b) => ({
                  id: b.id,
                  name: b.name,
                  x: b.x,
                  y: b.y,
                  tag: b.category.toUpperCase(),
                  isPreset: false,
                })),
              ].map((pin) => (
                <div
                  key={pin.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: 'rgba(30, 41, 59, 0.72)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPanTo(pin.x, pin.y);
                      setIsBookmarksOpen(false);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ font: "700 11.5px 'Barlow Condensed'", color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pin.name}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#7dd3fc', fontVariantNumeric: 'tabular-nums' }}>
                      {pin.tag} · X:{pin.x} · Y:{pin.y}
                    </div>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenShareKey((prev) => (prev === `bm-${pin.id}` ? null : `bm-${pin.id}`))
                      }
                      style={{
                        background: 'rgba(2, 132, 199, 0.22)',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        borderRadius: '4px',
                        color: '#bae6fd',
                        fontSize: '10px',
                        padding: '3px 6px',
                        cursor: 'pointer',
                      }}
                      title="Share Bookmark Coordinate to World or Alliance Chat"
                    >
                      Share
                    </button>
                    {!pin.isPreset && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(pin.id)}
                        style={{
                          background: 'rgba(220, 38, 38, 0.2)',
                          border: '1px solid rgba(248, 113, 113, 0.4)',
                          borderRadius: '4px',
                          color: '#fca5a5',
                          fontSize: '10px',
                          padding: '3px 6px',
                          cursor: 'pointer',
                        }}
                        title="Delete Bookmark"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {openShareKey?.startsWith('bm-') && (() => {
                const targetPinId = openShareKey.slice(3);
                const targetPin = [
                  { id: 'preset-castle', name: 'My Castle', x: Math.round(myCastleCoords[0]), y: Math.round(myCastleCoords[1]), tag: 'HOME' },
                  { id: 'preset-congress', name: 'The Congress', x: 1600, y: 1600, tag: 'CENTER' },
                  ...bookmarks.map((b) => ({ id: b.id, name: b.name, x: b.x, y: b.y, tag: b.category })),
                ].find((p) => p.id === targetPinId);
                if (!targetPin) return null;
                return (
                  <div style={{ display: 'flex', gap: '6px', padding: '4px 6px', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)' }}>
                    <button
                      type="button"
                      onClick={() =>
                        shareEntityToChat(
                          { entityId: targetPin.id, name: targetPin.name, level: 1, category: targetPin.tag, x: targetPin.x, y: targetPin.y },
                          'world'
                        )
                      }
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '5px',
                        background: 'linear-gradient(180deg, #b45309, #78350f)',
                        border: '1px solid #facc15',
                        color: '#fef08a',
                        font: "700 10.5px 'Barlow Condensed'",
                        cursor: 'pointer',
                      }}
                    >
                      Share to World
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        shareEntityToChat(
                          { entityId: targetPin.id, name: targetPin.name, level: 1, category: targetPin.tag, x: targetPin.x, y: targetPin.y },
                          'alliance'
                        )
                      }
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '5px',
                        background: 'linear-gradient(180deg, #059669, #064e3b)',
                        border: '1px solid #34d399',
                        color: '#ecfdf5',
                        font: "700 10.5px 'Barlow Condensed'",
                        cursor: 'pointer',
                      }}
                    >
                      Share to Alliance
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. TOP-RIGHT: RESOURCES BAR + COMPACT CAMERA TOOLBAR BELOW   */}
      {/* ============================================================ */}
      <div
        className="hud-top-right-stack"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 55,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        {/* Row 1: Resource Amounts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div
            className="hud-resource-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(12, 17, 26, 0.96)',
              borderTop: '1px solid rgba(218, 165, 32, 0.5)',
              borderLeft: '1px solid rgba(218, 165, 32, 0.5)',
              borderRight: '1px solid rgba(218, 165, 32, 0.5)',
              borderBottom: '3px solid #78350f',
              borderRadius: '8px',
              padding: '5px 10px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
              fontVariantNumeric: 'tabular-nums',
              flexWrap: 'nowrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Wood Reserves">
              {renderResourceSvg('wood')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#86efac' }}>{resources.wood.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Stone Reserves">
              {renderResourceSvg('stone')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#cbd5e1' }}>{resources.stone.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Iron Reserves">
              {renderResourceSvg('iron')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#93c5fd' }}>{resources.iron.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Food Reserves">
              {renderResourceSvg('food')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#fde68a' }}>{resources.food.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Himalayan Crystal Reserves">
              {renderResourceSvg('crystal')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#22d3ee' }}>{resources.crystal.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Treasury Gold">
              {renderResourceSvg('gold')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#fde047' }}>{resources.gold.toLocaleString()}</span>
            </div>
            <div style={{ width: '1px', height: '13px', background: 'rgba(255,255,255,0.14)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Sacred Gems">
              {renderResourceSvg('gems')}
              <span style={{ font: "700 11.5px 'Barlow Condensed'", color: '#d8b4fe' }}>{resources.gems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Compact Camera & Realm Toolbar Directly Below Resources */}
        <div
          className="hud-camera-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onResetHome}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: '1px solid #dfba6e',
              borderLeft: '1px solid #dfba6e',
              borderRight: '1px solid #dfba6e',
              borderBottom: '3px solid #b45309',
              boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
              color: '#fef08a',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              whiteSpace: 'nowrap',
            }}
            title="Reset Camera to My Castle"
          >
            <span>⌂</span>
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              triggerTouchVfx(e, 'settings');
              setIsSettingsOpen(true);
            }}
            className={`hud-pressable${springPopKey === 'settings' ? ' hud-spring-pop' : ''}`}
            style={{
              padding: '4px 8px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: '1px solid rgba(218, 165, 32, 0.45)',
              borderLeft: '1px solid rgba(218, 165, 32, 0.45)',
              borderRight: '1px solid rgba(218, 165, 32, 0.45)',
              borderBottom: '3px solid #334155',
              boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
              color: '#f8fafc',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
            title="Strategy Settings, Keybinds & Android APK"
          >
            ⚙️
          </button>

          <button
            type="button"
            onClick={(e) => {
              triggerTouchVfx(e, 'install-app');
              setShowAndroidModal(true);
            }}
            className={`hud-pressable${springPopKey === 'install-app' ? ' hud-spring-pop' : ''}`}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #059669, #065f46)',
              borderTop: '1px solid #34d399',
              borderLeft: '1px solid #34d399',
              borderRight: '1px solid #34d399',
              borderBottom: '3px solid #022c22',
              boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
              color: '#ecfdf5',
              font: "800 11px 'Barlow Condensed'",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
            title="Download Empire-of-the-Rising-Towers.apk or Install Android App"
          >
            <span>📲</span>
            <span>APK</span>
          </button>

          <SyncStatusButton uid={syncUid} onShowToast={onShowToast} />

          <button
            type="button"
            onClick={onZoomIn}
            style={{
              padding: '4px 8px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: '1px solid rgba(56, 189, 248, 0.5)',
              borderLeft: '1px solid rgba(56, 189, 248, 0.5)',
              borderRight: '1px solid rgba(56, 189, 248, 0.5)',
              borderBottom: '3px solid #0369a1',
              color: '#e0f2fe',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
            }}
            title="Zoom In (+)"
          >
            ＋
          </button>

          <button
            type="button"
            onClick={onZoomOut}
            style={{
              padding: '4px 8px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: '1px solid rgba(56, 189, 248, 0.5)',
              borderLeft: '1px solid rgba(56, 189, 248, 0.5)',
              borderRight: '1px solid rgba(56, 189, 248, 0.5)',
              borderBottom: '3px solid #0369a1',
              color: '#e0f2fe',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
            }}
            title="Zoom Out (-)"
          >
            －
          </button>

          <button
            type="button"
            onClick={onZoomOut100}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #0284c7, #0369a1)',
              borderTop: '1px solid #38bdf8',
              borderLeft: '1px solid #38bdf8',
              borderRight: '1px solid #38bdf8',
              borderBottom: '3px solid #0c4a6e',
              boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
              color: '#fff',
              font: "700 11px 'Barlow Condensed'",
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            title={`Zoom Out 100 (Current Zoom Out: ${zoomOutScore}/100)`}
          >
            <span>🔍</span>
            <span>Zoom 100</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleStrategicFilter(!isStrategicFilterActive)}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: isStrategicFilterActive
                ? 'linear-gradient(180deg, #059669, #065f46)'
                : 'linear-gradient(180deg, #1e293b, #0f172a)',
              borderTop: isStrategicFilterActive ? '1.5px solid #34d399' : '1px solid #38bdf8',
              borderLeft: isStrategicFilterActive ? '1.5px solid #34d399' : '1px solid #38bdf8',
              borderRight: isStrategicFilterActive ? '1.5px solid #34d399' : '1px solid #38bdf8',
              borderBottom: isStrategicFilterActive ? '3px solid #064e3b' : '3px solid #0f172a',
              boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
              color: isStrategicFilterActive ? '#fef08a' : '#bae6fd',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            title="Filter 3D World Map to show ONLY Shrines, The Congress, Alliance Castles & My Castle"
          >
            <span>🎯</span>
            <span>{isStrategicFilterActive ? '3D Filter: ON' : '3D Filter'}</span>
          </button>

          <button
            type="button"
            onClick={onRelocateCastles}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: 'linear-gradient(180deg, #ca8a04, #854d0e)',
              borderTop: '1px solid #fde047',
              borderLeft: '1px solid #fde047',
              borderRight: '1px solid #fde047',
              borderBottom: '3px solid #713f12',
              boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
              color: '#fef08a',
              font: "700 11px 'Barlow Condensed'",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            title="Randomize Locations of My Castle & 10 Alliance Member Castles"
          >
            <span>🎲</span>
            <span>Relocate</span>
          </button>

          {onToggleCollisionDebug && (
            <button
              type="button"
              onClick={() => onToggleCollisionDebug()}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                background: isCollisionDebugVisible
                  ? 'linear-gradient(180deg, #b45309, #78350f)'
                  : 'linear-gradient(180deg, #1e293b, #0f172a)',
                borderTop: isCollisionDebugVisible ? '1.5px solid #facc15' : '1px solid rgba(250, 204, 21, 0.45)',
                borderLeft: isCollisionDebugVisible ? '1.5px solid #facc15' : '1px solid rgba(250, 204, 21, 0.45)',
                borderRight: isCollisionDebugVisible ? '1.5px solid #facc15' : '1px solid rgba(250, 204, 21, 0.45)',
                borderBottom: isCollisionDebugVisible ? '3px solid #451a03' : '3px solid #0f172a',
                boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                color: isCollisionDebugVisible ? '#fef08a' : '#e2e8f0',
                font: "800 11px 'Barlow Condensed'",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Toggle 3D Wireframe Collision Boxes (Shortcut: B) — Yellow: Buildings, Red: Monsters, Green: Resources"
            >
              <span>📦</span>
              <span>{isCollisionDebugVisible ? 'Colliders: ON' : 'Colliders'}</span>
            </button>
          )}

          {onOpenTestMode && (
            <button
              type="button"
              onClick={onOpenTestMode}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                background: 'linear-gradient(180deg, #7c3aed, #4c1d95)',
                borderTop: '1px solid #c4b5fd',
                borderLeft: '1px solid #c4b5fd',
                borderRight: '1px solid #c4b5fd',
                borderBottom: '3px solid #2e1065',
                boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                color: '#f5f3ff',
                font: "800 11px 'Barlow Condensed'",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Launch Dedicated World Map Test Mode (Grid, Footprint & Collision Prototype)"
            >
              <span>🧪</span>
              <span>Test Mode</span>
            </button>
          )}

          {onOpenAnimationLab && (
            <button
              type="button"
              onClick={onOpenAnimationLab}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                background: 'linear-gradient(180deg, #0284c7, #0c4a6e)',
                borderTop: '1px solid #7dd3fc',
                borderLeft: '1px solid #7dd3fc',
                borderRight: '1px solid #7dd3fc',
                borderBottom: '3px solid #082f49',
                boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                color: '#f0f9ff',
                font: "800 11px 'Barlow Condensed'",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Open 3D Animation & VFX Test Lab (Troops, Monsters, Shrines, Citadel & Shaders)"
            >
              <span>🎭</span>
              <span>Anim Lab</span>
            </button>
          )}

          {onCycleTimeOfDay && (
            <button
              type="button"
              onClick={onCycleTimeOfDay}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                background:
                  timeOfDay === 'night'
                    ? 'linear-gradient(180deg, #1e1b4b, #0f172a)'
                    : timeOfDay === 'dusk'
                      ? 'linear-gradient(180deg, #c2410c, #7c2d12)'
                      : 'linear-gradient(180deg, #0ea5e9, #0369a1)',
                borderTop: '1px solid rgba(255,255,255,0.45)',
                borderLeft: '1px solid rgba(255,255,255,0.45)',
                borderRight: '1px solid rgba(255,255,255,0.45)',
                borderBottom: '3px solid #0f172a',
                boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                color: '#f8fafc',
                font: "800 11px 'Barlow Condensed'",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Cycle World Map Lighting (Day / Dusk / Night)"
            >
              <span>{timeOfDay === 'night' ? '🌙' : timeOfDay === 'dusk' ? '🌅' : '☀️'}</span>
              <span>{timeOfDay === 'night' ? 'Night' : timeOfDay === 'dusk' ? 'Dusk' : 'Day'}</span>
            </button>
          )}
        </div>

        {isCollisionDebugVisible && collisionDebugLayers && onToggleCollisionLayer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 7px',
              borderRadius: '7px',
              background: 'rgba(10, 16, 28, 0.92)',
              border: '1px solid rgba(250, 204, 21, 0.45)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
            }}
          >
            {(
              [
                { key: 'building', label: 'Buildings', color: '#facc15' },
                { key: 'monster', label: 'Monsters', color: '#f43f5e' },
                { key: 'resource', label: 'Resources', color: '#22c55e' },
              ] as const
            ).map((item) => {
              const active = collisionDebugLayers[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onToggleCollisionLayer(item.key)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: active ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${active ? item.color : 'rgba(148, 163, 184, 0.3)'}`,
                    color: active ? '#f8fafc' : '#64748b',
                    font: "700 10px 'Barlow Condensed'",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: active ? 1 : 0.65,
                  }}
                  title={`Toggle ${item.label} wireframe collision boxes`}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      border: `2px solid ${item.color}`,
                      display: 'inline-block',
                    }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM-LEFT: 100 KM SEARCH ABOVE LIVE CHAT PREVIEW BAR    */}
      {/* ============================================================ */}
      <button
        className="hud-bottom-left-search"
        type="button"
        onClick={() => openExclusiveDockPanel('search')}
        style={{
          position: 'absolute',
          bottom: '70px',
          left: '12px',
          zIndex: 55,
          height: '44px',
          minWidth: '116px',
          padding: '5px 12px',
          borderRadius: '10px',
          background: isSearchOpen
            ? 'linear-gradient(180deg, #059669 0%, #064e3b 100%)'
            : 'rgba(10, 16, 28, 0.94)',
          borderTop: isSearchOpen ? '1.5px solid #34d399' : '1.5px solid rgba(250, 204, 21, 0.6)',
          borderLeft: isSearchOpen ? '1.5px solid #34d399' : '1.5px solid rgba(250, 204, 21, 0.6)',
          borderRight: isSearchOpen ? '1.5px solid #34d399' : '1.5px solid rgba(250, 204, 21, 0.6)',
          borderBottom: isSearchOpen ? '3.5px solid #022c22' : '3.5px solid #78350f',
          boxShadow: isSearchOpen
            ? '0 4px 18px rgba(52, 211, 153, 0.4)'
            : '0 8px 20px rgba(0, 0, 0, 0.78)',
          color: '#f8fafc',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          pointerEvents: 'auto',
          transition: 'all 0.15s ease',
        }}
        title="Search Resources & Monsters within 100 km of My Castle"
      >
        <div style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))' }}>
          {render3DModelIcon('search', 23)}
        </div>
        <div className="hud-search-btn-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
          <span style={{ font: "800 11px 'Barlow Condensed'", color: '#fef08a', letterSpacing: '0.04em' }}>
            SEARCH
          </span>
          <span style={{ font: "700 8.5px 'Barlow Condensed'", color: '#86efac', fontVariantNumeric: 'tabular-nums' }}>
            100 KM · {searchTargetItems.length}
          </span>
        </div>
      </button>

      <button
        className="hud-bottom-left-chat"
        type="button"
        onClick={() => openExclusiveDockPanel('chat')}
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 55,
          maxWidth: '300px',
          height: '50px',
          borderRadius: '10px',
          background: isChatOpen
            ? 'linear-gradient(180deg, #1e3a8a 0%, #0f172a 100%)'
            : 'rgba(10, 16, 28, 0.94)',
          borderTop: isChatOpen ? '1.5px solid #60a5fa' : '1.5px solid rgba(218, 165, 32, 0.5)',
          borderLeft: isChatOpen ? '1.5px solid #60a5fa' : '1.5px solid rgba(218, 165, 32, 0.5)',
          borderRight: isChatOpen ? '1.5px solid #60a5fa' : '1.5px solid rgba(218, 165, 32, 0.5)',
          borderBottom: isChatOpen ? '3.5px solid #172554' : '3.5px solid #451a03',
          boxShadow: '0 8px 22px rgba(0,0,0,0.75)',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          textAlign: 'left',
        }}
        title="Open Kingdom & Alliance Chat"
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {render3DModelIcon('chat', 28)}
          {chatMessages.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '15px',
                height: '15px',
                padding: '0 3px',
                borderRadius: '999px',
                background: '#2563eb',
                border: '1.5px solid #fef08a',
                color: '#fff',
                font: "800 8.5px 'Barlow Condensed'",
                fontVariantNumeric: 'tabular-nums',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {chatMessages.length}
            </span>
          )}
        </div>

        <div className="hud-chat-preview-text" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ font: "800 10.5px 'Barlow Condensed'", color: '#60a5fa', letterSpacing: '0.04em' }}>
              {chatChannel === 'world' ? 'WORLD CHAT' : 'ALLIANCE'}
            </span>
            <span style={{ fontSize: '9px', color: '#64748b' }}>·</span>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {latestChatMessage?.time || 'Now'}
            </span>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
            }}
          >
            <strong style={{ color: '#fef08a' }}>{latestChatMessage?.sender}:</strong>{' '}
            {latestChatMessage?.sharedTarget
              ? `[${latestChatMessage.sharedTarget.name} X:${latestChatMessage.sharedTarget.x} Y:${latestChatMessage.sharedTarget.y}]`
              : latestChatMessage?.text}
          </div>
        </div>
      </button>

      {/* ============================================================ */}
      {/* 4b. MIDDLE-BOTTOM: CASTLE RANGE COMPASS (KM + BEARING)       */}
      {/* ============================================================ */}
      {(() => {
        const targetX = selectedEntity ? selectedEntity.position[0] : cameraInfo.x;
        const targetZ = selectedEntity ? selectedEntity.position[2] : cameraInfo.z;
        const dx = targetX - myCastleCoords[0];
        const dz = targetZ - myCastleCoords[1];
        const distWorld = Math.hypot(dx, dz);
        const worldUnitsPerKm = Math.max(1, balanceConfig.worldUnitsPerTile || 16);
        const rangeKm = distWorld / worldUnitsPerKm;
        const bearingDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
        const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
        const cardinal = distWorld < 8 ? 'CASTLE' : cardinals[Math.round(bearingDeg / 45) % 8];
        const areaLabel = selectedEntity ? selectedEntity.name : 'Castle → View Area';
        const isAtCastle = Math.hypot(cameraInfo.x - myCastleCoords[0], cameraInfo.z - myCastleCoords[1]) < 14;

        return (
          <button
            type="button"
            className="hud-bottom-compass hud-compass-pressable"
            onClick={(e) => {
              triggerTouchVfx(e, 'compass');
              if (selectedEntity && isAtCastle) {
                onPanTo(selectedEntity.position[0], selectedEntity.position[2]);
              } else {
                onPanTo(myCastleCoords[0], myCastleCoords[1]);
              }
            }}
            title={
              selectedEntity
                ? `Range from My Castle to ${selectedEntity.name}: ${rangeKm.toFixed(1)} km (${cardinal}). Click to return to Castle.`
                : `Range from My Castle to View Center: ${rangeKm.toFixed(1)} km (${cardinal}). Click to center on My Castle.`
            }
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              zIndex: 55,
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              minHeight: '48px',
              maxWidth: '240px',
              padding: '6px 13px 6px 8px',
              borderRadius: '12px',
              background: 'rgba(10, 16, 28, 0.94)',
              borderTop: '1.5px solid rgba(218, 165, 32, 0.65)',
              borderLeft: '1.5px solid rgba(218, 165, 32, 0.65)',
              borderRight: '1.5px solid rgba(218, 165, 32, 0.65)',
              borderBottom: '4px solid #451a03',
              boxShadow: '0 10px 26px rgba(0, 0, 0, 0.85)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              touchAction: 'manipulation',
              textAlign: 'left',
            }}
          >
            {/* Brass Compass Rose Icon with Live Rotating Bearing Needle */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 40 40"
              aria-hidden="true"
              style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.75))' }}
            >
              <defs>
                <radialGradient id="hudCompassDial" cx="50%" cy="45%" r="55%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#090d16" />
                </radialGradient>
                <linearGradient id="hudCompassBrass" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="18.2" fill="url(#hudCompassDial)" stroke="url(#hudCompassBrass)" strokeWidth="2.1" />
              <circle cx="20" cy="20" r="14.2" fill="none" stroke="rgba(250, 204, 21, 0.25)" strokeWidth="0.9" strokeDasharray="2 2" />
              {/* Cardinal ticks */}
              <path d="M20 3.2 L20 6.2 M20 33.8 L20 36.8 M3.2 20 L6.2 20 M33.8 20 L36.8 20" stroke="#facc15" strokeWidth="1.4" strokeLinecap="round" />
              <text x="20" y="9.2" textAnchor="middle" fill="#fef08a" fontSize="5.2" fontWeight="800" fontFamily="Barlow Condensed, sans-serif">N</text>
              {/* Rotating Magnetic Needle pointing from Castle toward target/view */}
              <g
                style={{
                  transform: `rotate(${Math.round(bearingDeg)}deg)`,
                  transformOrigin: '20px 20px',
                  transition: 'transform 0.16s ease-out',
                }}
              >
                <polygon points="20,6.5 23.2,20 20,18.2 16.8,20" fill="#ef4444" stroke="#fecaca" strokeWidth="0.5" />
                <polygon points="20,33.5 22.8,20 20,21.8 17.2,20" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
              </g>
              <circle cx="20" cy="20" r="2.6" fill="#facc15" stroke="#451a03" strokeWidth="0.9" />
            </svg>

            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ font: "800 14px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.03em', lineHeight: 1 }}>
                  {rangeKm.toFixed(1)} km
                </span>
                <span style={{ font: "700 10.5px 'Barlow Condensed', sans-serif", color: '#38bdf8', letterSpacing: '0.05em', lineHeight: 1 }}>
                  · {cardinal}
                </span>
              </div>
              <div
                className="hud-compass-area-label"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: selectedEntity ? '#fde68a' : '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '158px',
                  lineHeight: 1.2,
                }}
              >
                {areaLabel}
              </div>
            </div>
          </button>
        );
      })()}

      {/* ============================================================ */}
      {/* 5. BOTTOM-RIGHT: LIVE 3D PEDESTAL HUD ACTION ICONS           */}
      {/* ============================================================ */}
      <Hud3DPedestalDock
        slots={[
          {
            key: 'command',
            label: 'COMMAND',
            isActive: false,
            badgeCount: activeMarchesCount > 0 ? activeMarchesCount : battleReportsCount,
            badgeColor: activeMarchesCount > 0 ? '#0284c7' : '#d97706',
            title: 'Open 8-Panel Nepalese Kingdom Command Hub (Barracks, Shrines, Congress, Marches & Config)',
            onClick: (e) => {
              triggerTouchVfx(e, 'hub');
              onOpenCommandHub('barracks');
            },
          },
          {
            key: 'inventory',
            label: 'INVENTORY',
            isActive: isInventoryOpen,
            badgeCount: totalInventoryCount,
            badgeColor: '#d97706',
            title: 'Open 3D Royal Inventory',
            onClick: (e) => {
              triggerTouchVfx(e, 'inventory');
              openExclusiveDockPanel('inventory');
            },
          },
          {
            key: 'quests',
            label: 'QUESTS',
            isActive: isQuestsOpen,
            badgeCount: unclaimedQuestsCount,
            badgeColor: '#16a34a',
            title: 'Open Ornate Quest Board & Daily Activity',
            onClick: (e) => {
              triggerTouchVfx(e, 'quests');
              setQuestBoardTab('daily');
              openExclusiveDockPanel('quests');
            },
          },
          {
            key: 'alliance',
            label: 'ALLIANCE',
            isActive: isAllianceOpen,
            badgeCount: allianceTerritoryStats.capturedTotal > 0 ? allianceTerritoryStats.capturedTotal : enemyCastles.length,
            badgeColor: allianceTerritoryStats.capturedTotal > 0 ? '#10b981' : '#dc2626',
            title: 'Open Alliance Headquarters, Territory & Technology',
            onClick: (e) => {
              triggerTouchVfx(e, 'alliance');
              setAllianceTab('overview');
              openExclusiveDockPanel('alliance');
            },
          },
          {
            key: 'mail',
            label: 'MAIL',
            isActive: isMailOpen,
            badgeCount: unreadOrUnclaimedMailCount,
            badgeColor: '#dc2626',
            title: 'Open 3D Royal Mail & Battle Dispatches',
            onClick: (e) => {
              triggerTouchVfx(e, 'mail');
              openExclusiveDockPanel('mail');
            },
          },
          {
            key: 'castle',
            label: viewMode === 'world' ? 'CASTLE' : 'WORLD',
            isActive: viewMode === 'kingdom',
            title: viewMode === 'world' ? 'Enter Inside Kingdom (3D Citadel Courtyard)' : 'Return to World Map',
            onClick: (e) => {
              triggerTouchVfx(e, 'castle');
              onToggleViewMode();
            },
          },
        ]}
        renderFallbackSvg={(k, size) => render3DModelIcon(k === 'command' ? 'hub' : k === 'castle' ? 'hub' : k, size)}
      />

      {/* ============================================================ */}
      {/* 5B. RIGHT-SIDE NEPALESE BATTALION COMMANDER POPUP            */}
      {/* ============================================================ */}
      {viewMode === 'world' && selectedEntity && (() => {
        const isMonster = selectedEntity.category === 'monster';
        const isResource = selectedEntity.category === 'resource';
        const isEnemyCastle = selectedEntity.type === 'enemy_castle';
        const isStructure =
          selectedEntity.type === 'shrine_c' ||
          selectedEntity.type === 'shrine_b' ||
          selectedEntity.type === 'shrine_a' ||
          selectedEntity.type === 'congress';
        const canLeadWithHero = isMonster || isResource || isEnemyCastle || isStructure;

        const liveMon = monsterStates[selectedEntity.id];
        const liveNode = nodeStates[selectedEntity.id];
        const liveCastle = castleStates[selectedEntity.id];
        const mCfg = isMonster
          ? balanceConfig.monstersByLevel[Math.max(0, Math.min(9, (selectedEntity.level || 1) - 1))]
          : null;
        const rCfg = isResource
          ? balanceConfig.resourcesByLevel[Math.max(0, Math.min(9, (selectedEntity.level || 1) - 1))]
          : null;

        const curHp = liveMon?.currentHp ?? selectedEntity.health ?? mCfg?.hp ?? 0;
        const maxHp = liveMon?.maxHp ?? selectedEntity.maxHealth ?? mCfg?.hp ?? 0;
        const castleMaxHp =
          liveCastle?.maxHp ??
          selectedEntity.maxHealth ??
          getEnemyCastleMaxHp(selectedEntity.power || 160000, selectedEntity.level || 1);
        const castleCurHp = liveCastle?.currentHp ?? selectedEntity.health ?? castleMaxHp;
        const castleHpPct = castleMaxHp > 0 ? Math.max(0, Math.min(100, (castleCurHp / castleMaxHp) * 100)) : 100;
        const castleBurning = Boolean(liveCastle?.isBurning || castleCurHp < castleMaxHp);
        const remYield = liveNode?.remainingYield ?? selectedEntity.yieldAmount ?? 0;
        const maxYield = liveNode?.maxYield ?? selectedEntity.maxYieldAmount ?? selectedEntity.yieldAmount ?? 0;
        const reqCap = selectedEntity.requiredTroopCapacity || rCfg?.requiredTroopCapacity || 0;
        const belowReqCap = isResource && reqCap > 0 && selectedBattalionMetrics.totalCount < reqCap;
        const [recMinM, recMaxM] = getRecommendedMonsterBand(selectedTroopLv);
        const isMonsterMatch = isMonster && selectedEntity.level >= recMinM && selectedEntity.level <= recMaxM;

        return (
          <div
            className="bottom-1x1-troop-card"
            style={{
              position: 'absolute',
              right: '14px',
              bottom: '84px',
              width: '330px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: '62dvh',
              overflowY: 'auto',
              zIndex: 65,
              background: 'rgba(10, 16, 26, 0.97)',
              borderTop: '1.5px solid #dfba6e',
              borderLeft: '1.5px solid #dfba6e',
              borderRight: '1.5px solid #dfba6e',
              borderBottom: '4px solid #78350f',
              borderRadius: '12px',
              padding: '9px 11px',
              boxShadow: '0 6px 0 rgba(0, 0, 0, 0.6), 0 16px 36px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              pointerEvents: 'auto',
              animation: 'slideUpCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {/* Target Summary Header with Bookmark & Share Icons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                {isMonster && (
                  <MonsterPortrait
                    subtype={selectedEntity.subtype}
                    level={selectedEntity.level}
                    name={selectedEntity.name}
                    size={42}
                    rounded={8}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "800 13px 'Barlow Condensed'", color: '#fef08a', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedEntity.name} (Lv.{selectedEntity.level})
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                    {targetDistanceInfo.distanceTiles} km · [X:{Math.round(selectedEntity.position[0])}, Y:{Math.round(selectedEntity.position[2])}] · {targetDistanceInfo.seconds}s march
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {(() => {
                    const pinned = isTargetBookmarked(selectedEntity.position[0], selectedEntity.position[2]);
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          toggleEntityBookmark({
                            id: selectedEntity.id,
                            name: selectedEntity.name,
                            level: selectedEntity.level,
                            category: selectedEntity.type || selectedEntity.category,
                            x: selectedEntity.position[0],
                            y: selectedEntity.position[2],
                          })
                        }
                        style={{
                          minWidth: '34px',
                          minHeight: '34px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '6px',
                          background: pinned ? 'rgba(180, 83, 9, 0.45)' : 'rgba(30, 41, 59, 0.9)',
                          border: pinned ? '1px solid #facc15' : '1px solid rgba(148,163,184,0.35)',
                          color: '#fef08a',
                          cursor: 'pointer',
                        }}
                        title={pinned ? 'Remove Bookmark' : 'Bookmark Target Tag'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M5 3.5C5 2.7 5.7 2 6.5 2H13.5C14.3 2 15 2.7 15 3.5V18L10 14.5L5 18V3.5Z"
                            fill={pinned ? '#facc15' : 'none'}
                            stroke="#fef08a"
                            strokeWidth="1.4"
                          />
                        </svg>
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenShareKey((prev) => (prev === 'selected-target' ? null : 'selected-target'))
                    }
                    style={{
                      minWidth: '34px',
                      minHeight: '34px',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '6px',
                      background: openShareKey === 'selected-target' ? 'rgba(2, 132, 199, 0.45)' : 'rgba(30, 41, 59, 0.9)',
                      border: openShareKey === 'selected-target' ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.35)',
                      color: '#bae6fd',
                      cursor: 'pointer',
                    }}
                    title="Share Target Tag to World or Alliance Chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="18" cy="5" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                      <circle cx="6" cy="12" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                      <circle cx="18" cy="19" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                      <line x1="8.3" y1="10.8" x2="15.7" y2="6.2" stroke="#bae6fd" strokeWidth="1.6" />
                      <line x1="8.3" y1="13.2" x2="15.7" y2="17.8" stroke="#bae6fd" strokeWidth="1.6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onCloseSelection}
                    style={{
                      minWidth: '34px',
                      minHeight: '34px',
                      background: 'rgba(30, 41, 59, 0.9)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      color: '#cbd5e1',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                    title="Close Target"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {openShareKey === 'selected-target' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      shareEntityToChat(
                        {
                          entityId: selectedEntity.id,
                          name: selectedEntity.name,
                          level: selectedEntity.level,
                          category: selectedEntity.type || selectedEntity.category,
                          x: selectedEntity.position[0],
                          y: selectedEntity.position[2],
                        },
                        'world'
                      )
                    }
                    style={{
                      flex: 1,
                      minHeight: '32px',
                      borderRadius: '6px',
                      background: 'linear-gradient(180deg, #b45309, #78350f)',
                      border: '1px solid #facc15',
                      color: '#fef08a',
                      font: "800 11px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    Share to World
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareEntityToChat(
                        {
                          entityId: selectedEntity.id,
                          name: selectedEntity.name,
                          level: selectedEntity.level,
                          category: selectedEntity.type || selectedEntity.category,
                          x: selectedEntity.position[0],
                          y: selectedEntity.position[2],
                        },
                        'alliance'
                      )
                    }
                    style={{
                      flex: 1,
                      minHeight: '32px',
                      borderRadius: '6px',
                      background: 'linear-gradient(180deg, #059669, #064e3b)',
                      border: '1px solid #34d399',
                      color: '#ecfdf5',
                      font: "800 11px 'Barlow Condensed', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    Share to Alliance
                  </button>
                </div>
              )}
            </div>

            {/* Target Live Stats Row */}
            {isMonster && mCfg && (
              <div style={{ fontSize: '10.5px', color: '#e2e8f0', background: 'rgba(220,38,38,0.12)', padding: '5px 8px', borderRadius: '6px' }}>
                <div>
                  HP: <strong style={{ color: '#fca5a5' }}>{curHp.toLocaleString()}/{maxHp.toLocaleString()}</strong> · ATK {mCfg.attack.toLocaleString()} · DEF {mCfg.defense.toLocaleString()}
                </div>
                <div style={{ fontSize: '9.5px', color: isMonsterMatch ? '#34d399' : '#fbbf24' }}>
                  Reward ~{mCfg.suggestedReward.toLocaleString()} + XP {mCfg.xpReward} · Lv.{selectedTroopLv} Ideal Band: Lv.{recMinM}–{recMaxM}
                </div>
              </div>
            )}

            {isResource && (
              <div style={{ fontSize: '10.5px', color: '#e2e8f0', background: 'rgba(16,185,129,0.1)', padding: '5px 8px', borderRadius: '6px' }}>
                <div>
                  Yield: <strong style={{ color: '#86efac' }}>{remYield.toLocaleString()}/{maxYield.toLocaleString()}</strong> {(selectedEntity.resourceType || selectedEntity.subtype).toUpperCase()} · Diff {(selectedEntity.difficulty || 1).toFixed(2)}×
                </div>
                <div style={{ fontSize: '9.5px', color: belowReqCap ? '#f87171' : '#38bdf8' }}>
                  Req. Capacity: {reqCap.toLocaleString()} troops · Gather Rate: {targetDistanceInfo.gatherSpeedPerMin.toLocaleString()}/m (~{targetDistanceInfo.gatherMinutes}m)
                </div>
              </div>
            )}

            {isEnemyCastle && (
              <div
                style={{
                  fontSize: '10.5px',
                  color: '#e2e8f0',
                  background: castleBurning ? 'rgba(185, 28, 28, 0.22)' : 'rgba(220, 38, 38, 0.12)',
                  border: castleBurning ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(248, 113, 113, 0.2)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <span>
                    Fortress HP:{' '}
                    <strong style={{ color: '#fca5a5' }}>
                      {castleCurHp.toLocaleString()}/{castleMaxHp.toLocaleString()}
                    </strong>
                  </span>
                  {castleBurning ? (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(220, 38, 38, 0.4)',
                        border: '1px solid #f87171',
                        color: '#fef08a',
                        font: "800 9.5px 'Barlow Condensed'",
                        letterSpacing: '0.05em',
                      }}
                    >
                      🔥 BURNING
                    </span>
                  ) : (
                    <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                      PWR {(selectedEntity.power || 160000).toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${castleHpPct}%`,
                      height: '100%',
                      background: castleBurning
                        ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
                        : 'linear-gradient(90deg, #dc2626, #fb7185)',
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#cbd5e1' }}>
                  <span>0 HP triggers random realm teleport</span>
                  <span style={{ color: '#fbbf24' }}>Teleports: {liveCastle?.teleportCount || 0}</span>
                </div>
              </div>
            )}

            {isStructure && (() => {
              const sType = selectedEntity.type as StructureTierKey;
              const isHeldByAlliance = conqueredPlots?.[selectedEntity.id] === 'alliance' || shrineRuleStatus.heldIds.has(selectedEntity.id);
              const isCongressTarget = sType === 'congress';
              const lockMsg =
                isCongressTarget && !shrineRuleStatus.congressUnlocked
                  ? shrineRuleStatus.congressRequirementText
                  : !isCongressTarget && !isHeldByAlliance && shrineRuleStatus.atShrineCap
                    ? `5-Shrine Cap Reached (${shrineRuleStatus.totalShrinesHeld}/${shrineRuleStatus.maxShrinesPerAlliance}) — Relinquish a Shrine first`
                    : null;

              return (
                <div style={{ fontSize: '10.5px', color: '#bae6fd', background: 'rgba(2,132,199,0.14)', padding: '6px 8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <div>
                      <div>Garrison Cap: {balanceConfig.structures[sType].totalCapacity.toLocaleString()}</div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                        Req Lv.{balanceConfig.structures[sType].requiredTroopLevel}+ Mixed Classes · Shrines {shrineRuleStatus.totalShrinesHeld}/{shrineRuleStatus.maxShrinesPerAlliance}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isHeldByAlliance && (
                        <button
                          type="button"
                          onClick={() => {
                            onRelinquishStructure(selectedEntity.id);
                            onCloseSelection();
                          }}
                          style={{
                            minHeight: '34px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(153, 27, 27, 0.55)',
                            border: '1px solid #f87171',
                            color: '#fecaca',
                            font: "700 10.5px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          Relinquish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenCommandHub(
                            isCongressTarget ? 'congress' : 'shrines',
                            selectedEntity.id
                          );
                          onCloseSelection();
                        }}
                        style={{
                          minHeight: '34px',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          border: '1px solid #38bdf8',
                          color: '#fff',
                          font: "700 10.5px 'Barlow Condensed'",
                          cursor: 'pointer',
                        }}
                      >
                        Open Garrison Hub
                      </button>
                    </div>
                  </div>
                  {lockMsg && (
                    <div style={{ fontSize: '9.5px', color: '#fbbf24', fontWeight: 700 }}>
                      ⚠️ {lockMsg}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Lead Hero Commander Selector (Locked while leading an active march) */}
            {canLeadWithHero && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  padding: '6px 7px',
                  borderRadius: '7px',
                  border: '1px solid rgba(250, 204, 21, 0.28)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px' }}>
                  <span style={{ font: "800 10.5px 'Barlow Condensed'", color: '#fde047', letterSpacing: '0.04em' }}>
                    LEAD HERO COMMANDER
                  </span>
                  <span style={{ color: activeHero ? '#86efac' : '#f87171', fontWeight: 700 }}>
                    {activeHero ? `${activeHero.name} Ready` : 'All 5 Heroes On March'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px' }}>
                  {NEPALESE_HEROES.map((hero) => {
                    const lockedMarch = occupiedHeroMap.get(hero.id);
                    const isLocked = Boolean(lockedMarch);
                    const isSelected = activeHero?.id === hero.id;
                    const shortName = hero.name.split(' ')[0];
                    const buffTag =
                      hero.specialty === 'gather'
                        ? `+${Math.round(hero.gatherPct * 100)}% GATH`
                        : hero.specialty === 'siege'
                          ? `+${Math.round(hero.siegeDamagePct * 100)}% SIEGE`
                          : `+${Math.round(hero.classAttackPct * 100)}% ${hero.classBonusClass.slice(0, 3).toUpperCase()}`;

                    return (
                      <button
                        key={hero.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setSelectedHeroId(hero.id)}
                        title={
                          isLocked
                            ? `${hero.name} is on march to ${lockedMarch?.targetName}`
                            : `${hero.name} — ${hero.title}`
                        }
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          padding: '4px 2px',
                          borderRadius: '6px',
                          background: isLocked
                            ? 'rgba(30, 41, 59, 0.45)'
                            : isSelected
                              ? 'rgba(180, 83, 9, 0.42)'
                              : 'rgba(30, 41, 59, 0.85)',
                          border: isSelected
                            ? '1.5px solid #fde047'
                            : isLocked
                              ? '1px solid rgba(100, 116, 139, 0.25)'
                              : `1px solid ${hero.crestColor}55`,
                          color: isLocked ? '#64748b' : '#f8fafc',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          opacity: isLocked ? 0.65 : 1,
                        }}
                      >
                        <HeroPortrait
                          hero={hero}
                          size={38}
                          rounded={7}
                          isSelected={isSelected}
                          isLocked={isLocked}
                        />
                        <span style={{ font: "700 9.5px 'Barlow Condensed'", lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {shortName}
                        </span>
                        <span style={{ fontSize: '8px', color: isLocked ? '#f87171' : hero.crestColor, fontWeight: 700, lineHeight: 1 }}>
                          {isLocked ? 'BUSY' : buffTag}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeHero ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', paddingTop: '2px' }}>
                    <HeroPortrait hero={activeHero} size={28} rounded={6} isSelected />
                    <div style={{ fontSize: '9px', color: '#cbd5e1', lineHeight: 1.25 }}>
                      <strong style={{ color: activeHero.crestColor }}>{activeHero.title}</strong> · ATK +{Math.round(activeHero.attackPct * 100)}% · HP +{Math.round(activeHero.hpPct * 100)}% · Gather +{Math.round(activeHero.gatherPct * 100)}% · Load +{Math.round(activeHero.loadPct * 100)}% · March +{Math.round(activeHero.marchPct * 100)}% · Siege +{Math.round(activeHero.siegeDamagePct * 100)}%
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '9px', color: '#fbbf24' }}>
                    All Nepalese commanders are currently leading expeditions. Troops may still march unled.
                  </div>
                )}
              </div>
            )}

            {/* Troop Level Selector (Lv 1..5) + Quick Fill Presets */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {([1, 2, 3, 4, 5] as TroopLevel[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setSelectedTroopLv(lv)}
                  style={{
                    flex: 1,
                    minHeight: '28px',
                    borderRadius: '5px',
                    background: selectedTroopLv === lv ? '#b45309' : 'rgba(30,41,59,0.85)',
                    border: selectedTroopLv === lv ? '1px solid #fde047' : '1px solid rgba(148,163,184,0.2)',
                    color: selectedTroopLv === lv ? '#fef08a' : '#cbd5e1',
                    font: "700 10px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  Lv.{lv}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyRecommendedPreset(selectedEntity)}
                style={{
                  minHeight: '28px',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  background: 'rgba(16,185,129,0.2)',
                  border: '1px solid #34d399',
                  color: '#86efac',
                  font: "700 10px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                REC
              </button>
            </div>

            {/* 3 Nepalese Troop Class Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: '7px', border: '1px solid rgba(56,189,248,0.28)' }}>
              {(['infantry', 'archer', 'cavalry'] as TroopClassId[]).map((cls) => {
                const avail = troopInventory[cls]?.[selectedTroopLv] || 0;
                const val = Math.min(marchCounts[cls] || 0, avail);
                const label = cls === 'infantry' ? 'Magar Inf' : cls === 'archer' ? 'Limbu Arc' : 'Thakuri Cav';
                return (
                  <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px' }}>
                    <span style={{ width: '68px', color: '#e2e8f0', fontWeight: 700 }}>{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, avail)}
                      value={val}
                      onChange={(e) =>
                        setMarchCounts((prev) => ({ ...prev, [cls]: Number(e.target.value) || 0 }))
                      }
                      style={{ flex: 1, accentColor: cls === 'infantry' ? '#34d399' : cls === 'archer' ? '#38bdf8' : '#f59e0b' }}
                    />
                    <span style={{ width: '66px', textAlign: 'right', color: '#fef08a' }}>
                      {val}/{avail}
                    </span>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: '#94a3b8', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Power: <strong style={{ color: '#facc15' }}>{selectedBattalionMetrics.totalPower.toLocaleString()}</strong> · Load: <strong style={{ color: '#86efac' }}>{selectedBattalionMetrics.totalLoad.toLocaleString()}</strong></span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[0.25, 0.5, 1.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => applyBattalionRatio(r)}
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: '#1e293b',
                        border: '1px solid rgba(148,163,184,0.3)',
                        color: '#cbd5e1',
                        font: "700 9px 'Barlow Condensed'",
                        cursor: 'pointer',
                      }}
                    >
                      {r === 1 ? 'MAX' : `${r * 100}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Dispatch Row */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {selectedEntity.actions.includes('mine') && (
                <button
                  onClick={() => {
                    if (onDispatchNepaleseMarch(selectedEntity, 'mine', selectedBattalionStacks, activeHero?.id)) {
                      onCloseSelection();
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #16a34a 0%, #166534 100%)',
                    border: '1px solid #4ade80',
                    color: '#fff',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  ⛏️ GATHER ({targetDistanceInfo.seconds}s)
                </button>
              )}

              {selectedEntity.actions.includes('attack') && (
                <button
                  onClick={() => {
                    if (onDispatchNepaleseMarch(selectedEntity, 'attack', selectedBattalionStacks, activeHero?.id)) {
                      onCloseSelection();
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
                    border: '1px solid #f87171',
                    color: '#fff',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  {isEnemyCastle ? `🔥 SIEGE (${targetDistanceInfo.seconds}s)` : `⚔️ ATTACK (${targetDistanceInfo.seconds}s)`}
                </button>
              )}

              {selectedEntity.actions.includes('rally') && (
                <button
                  onClick={() => {
                    setRallyModalTarget(selectedEntity);
                    onCloseSelection();
                  }}
                  style={{
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #d97706 0%, #92400e 100%)',
                    border: '1px solid #fbbf24',
                    color: '#fff',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  🚩 RALLY
                </button>
              )}

              {selectedEntity.actions.includes('scout') && (
                <button
                  onClick={() => {
                    setScoutModalTarget(selectedEntity);
                    onCloseSelection();
                  }}
                  style={{
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                    border: '1px solid #38bdf8',
                    color: '#fff',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  🦅 SCOUT
                </button>
              )}

              {selectedEntity.actions.includes('garrison') && !isStructure && (
                <button
                  onClick={() => {
                    onExecuteAction(selectedEntity, 'garrison');
                    onCloseSelection();
                  }}
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #4f46e5 0%, #3730a3 100%)',
                    border: '1px solid #818cf8',
                    color: '#fff',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  🛡️ GARRISON
                </button>
              )}

              {selectedEntity.actions.includes('upgrade') && (
                <button
                  onClick={() => {
                    onExecuteAction(selectedEntity, 'upgrade');
                    onCloseSelection();
                  }}
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'linear-gradient(180deg, #ca8a04 0%, #854d0e 100%)',
                    border: '1px solid #facc15',
                    color: '#fef08a',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  🔨 UPGRADE
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 6. EXPEDITION MARCH PROGRESS FLOATER                         */}
      {/* ============================================================ */}
      {armyProgressPct < 100 && (
        <div
          style={{
            position: 'absolute',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 48,
            background: 'rgba(12, 17, 26, 0.94)',
            border: '1px solid #38bdf8',
            borderRadius: '10px',
            padding: '8px 16px',
            minWidth: '320px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#e0f2fe', marginBottom: '4px' }}>
            <span>{armyStatusText}</span>
            <span style={{ fontWeight: 700, color: '#fef08a' }}>{armyProgressPct}%</span>
          </div>
          <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${armyProgressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                transition: 'width 0.25s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. 100 KM RESOURCE & MONSTER SEARCH PANEL (ABOVE SEARCH BTN) */}
      {/* ============================================================ */}
      {isSearchOpen && (
        <div
          className="hud-floating-drawer hud-search-drawer"
          style={{
            position: 'absolute',
            bottom: '122px',
            left: '12px',
            width: '350px',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: '420px',
            background: 'rgba(12, 17, 26, 0.98)',
            border: '1px solid #dfba6e',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ font: "800 13.5px 'Barlow Condensed'", color: '#fef08a', letterSpacing: '0.03em' }}>
                SEARCH RESOURCES &amp; MONSTERS (100 KM)
              </div>
              <div style={{ fontSize: '9.5px', color: '#86efac' }}>
                Within 100 km of My Castle [X:{Math.round(myCastleCoords[0])}, Y:{Math.round(myCastleCoords[1])}]
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '8px 12px 4px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter monster or resource (e.g. orc, skeleton, goblin, death knight, drago, lv.5)..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(218, 165, 32, 0.4)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '11px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {(['all', 'monsters', 'crystal', 'gold', 'iron', 'stone', 'wood', 'farm'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSearchCategory(cat)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: searchCategory === cat ? '#b45309' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: searchCategory === cat ? '#fef08a' : '#cbd5e1',
                  font: "700 10.5px 'Barlow Condensed'",
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredSearchEntities.length === 0 ? (
              <div style={{ padding: '18px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                No active resources or monsters within 100 km match this filter.
              </div>
            ) : (
              filteredSearchEntities.map((ent) => {
                const pinned = isTargetBookmarked(ent.position[0], ent.position[2]);
                const shareOpen = openShareKey === `search-${ent.id}`;
                return (
                  <div
                    key={ent.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '7px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectWorldTarget) {
                            onSelectWorldTarget(ent.id, ent.position[0], ent.position[2]);
                          } else {
                            onPanTo(ent.position[0], ent.position[2]);
                          }
                          setIsSearchOpen(false);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {ent.category === 'monster' && (
                          <MonsterPortrait
                            subtype={ent.subtype}
                            level={ent.level}
                            name={ent.name}
                            size={34}
                            rounded={6}
                          />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              font: "700 12px 'Barlow Condensed'",
                              color: ent.category === 'monster' ? '#f87171' : '#86efac',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ent.name} (Lv.{ent.level})
                          </div>
                          <div style={{ fontSize: '9.5px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            [X:{Math.round(ent.position[0])}, Y:{Math.round(ent.position[2])}] · {ent.subtype.toUpperCase()} · {ent.distanceKm} km
                          </div>
                        </div>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() =>
                            toggleEntityBookmark({
                              id: ent.id,
                              name: ent.name,
                              level: ent.level,
                              category: ent.category,
                              x: ent.position[0],
                              y: ent.position[2],
                            })
                          }
                          style={{
                            minWidth: '30px',
                            minHeight: '30px',
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '5px',
                            background: pinned ? 'rgba(180, 83, 9, 0.4)' : 'rgba(30, 41, 59, 0.85)',
                            border: pinned ? '1px solid #facc15' : '1px solid rgba(148,163,184,0.3)',
                            cursor: 'pointer',
                          }}
                          title={pinned ? 'Remove Bookmark' : 'Bookmark Target'}
                        >
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                            <path
                              d="M5 3.5C5 2.7 5.7 2 6.5 2H13.5C14.3 2 15 2.7 15 3.5V18L10 14.5L5 18V3.5Z"
                              fill={pinned ? '#facc15' : 'none'}
                              stroke="#fef08a"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenShareKey((prev) => (prev === `search-${ent.id}` ? null : `search-${ent.id}`))
                          }
                          style={{
                            minWidth: '30px',
                            minHeight: '30px',
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '5px',
                            background: shareOpen ? 'rgba(2, 132, 199, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                            border: shareOpen ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.3)',
                            cursor: 'pointer',
                          }}
                          title="Share to World or Alliance Chat"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="18" cy="5" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                            <circle cx="6" cy="12" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                            <circle cx="18" cy="19" r="2.5" stroke="#bae6fd" strokeWidth="1.8" />
                            <line x1="8.3" y1="10.8" x2="15.7" y2="6.2" stroke="#bae6fd" strokeWidth="1.6" />
                            <line x1="8.3" y1="13.2" x2="15.7" y2="17.8" stroke="#bae6fd" strokeWidth="1.6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {shareOpen && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() =>
                            shareEntityToChat(
                              {
                                entityId: ent.id,
                                name: ent.name,
                                level: ent.level,
                                category: ent.category,
                                x: ent.position[0],
                                y: ent.position[2],
                              },
                              'world'
                            )
                          }
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '5px',
                            background: 'linear-gradient(180deg, #b45309, #78350f)',
                            border: '1px solid #facc15',
                            color: '#fef08a',
                            font: "700 10.5px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          Share to World
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            shareEntityToChat(
                              {
                                entityId: ent.id,
                                name: ent.name,
                                level: ent.level,
                                category: ent.category,
                                x: ent.position[0],
                                y: ent.position[2],
                              },
                              'alliance'
                            )
                          }
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '5px',
                            background: 'linear-gradient(180deg, #059669, #064e3b)',
                            border: '1px solid #34d399',
                            color: '#ecfdf5',
                            font: "700 10.5px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          Share to Alliance
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. CHAT POPUP (ANCHORED ABOVE BOTTOM-LEFT SEARCH & CHAT)     */}
      {/* ============================================================ */}
      {isChatOpen && (
        <div
          className="hud-floating-drawer hud-chat-drawer"
          style={{
            position: 'absolute',
            bottom: '122px',
            left: '12px',
            width: '320px',
            maxWidth: 'calc(100vw - 24px)',
            height: '340px',
            background: 'rgba(12, 17, 26, 0.98)',
            border: '1px solid #dfba6e',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setChatChannel('world')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: chatChannel === 'world' ? '#b45309' : 'transparent',
                  border: 'none',
                  color: chatChannel === 'world' ? '#fef08a' : '#94a3b8',
                  font: "700 11px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                World
              </button>
              <button
                type="button"
                onClick={() => setChatChannel('alliance')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: chatChannel === 'alliance' ? '#059669' : 'transparent',
                  border: 'none',
                  color: chatChannel === 'alliance' ? '#ecfdf5' : '#94a3b8',
                  font: "700 11px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                Alliance
              </button>
            </div>
            <button type="button" onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {channelChatMessages.map((msg) => (
              <div key={msg.id} style={{ fontSize: '11px', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '9px', marginRight: '4px' }}>[{msg.time}]</span>
                  <span style={{ color: '#fef08a', fontWeight: 700, marginRight: '4px' }}>{msg.sender}:</span>
                  <span style={{ color: '#e2e8f0' }}>{msg.text}</span>
                </div>
                {msg.sharedTarget && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectWorldTarget) {
                        onSelectWorldTarget(
                          msg.sharedTarget!.entityId,
                          msg.sharedTarget!.x,
                          msg.sharedTarget!.y
                        );
                      } else {
                        onPanTo(msg.sharedTarget!.x, msg.sharedTarget!.y);
                      }
                      setIsChatOpen(false);
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(2, 132, 199, 0.22)',
                      border: '1px solid rgba(56, 189, 248, 0.55)',
                      color: '#bae6fd',
                      font: "700 10.5px 'Barlow Condensed', sans-serif",
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                    }}
                    title="Jump camera to shared target"
                  >
                    📍 {msg.sharedTarget.name} (Lv.{msg.sharedTarget.level}) · X:{msg.sharedTarget.x} Y:{msg.sharedTarget.y} ↗
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Message ${chatChannel === 'world' ? 'World' : 'Alliance'} channel...`}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '11px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#b45309',
                border: 'none',
                color: '#fff',
                font: "700 11px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. SCOUT RECON INTEL MODAL                                   */}
      {/* ============================================================ */}
      {scoutModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            pointerEvents: 'auto',
          }}
          onClick={() => setScoutModalTarget(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ font: "700 17px 'Barlow Condensed'", color: '#38bdf8' }}>
                🦅 FALCON SCOUT RECON REPORT
              </div>
              <button
                onClick={() => setScoutModalTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              {scoutModalTarget.category === 'monster' && (
                <MonsterPortrait
                  subtype={scoutModalTarget.subtype}
                  level={scoutModalTarget.level}
                  name={scoutModalTarget.name}
                  size={56}
                  rounded={10}
                />
              )}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fef08a', marginBottom: '3px' }}>
                  {scoutModalTarget.name} (Lv.{scoutModalTarget.level})
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Sector Coordinates: [{Math.round(scoutModalTarget.position[0])}, {Math.round(scoutModalTarget.position[2])}]
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '16px' }}>
              {scoutModalTarget.description}
            </div>

            <button
              onClick={() => setScoutModalTarget(null)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: '#1e3a8a',
                border: '1px solid #38bdf8',
                color: '#fff',
                font: "700 13px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              Close Intel Report
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 10. ALLIANCE RALLY MODAL                                     */}
      {/* ============================================================ */}
      {rallyModalTarget && (() => {
        const isDragoBoss = rallyModalTarget.subtype === 'boss' || (rallyModalTarget.level >= 10 && rallyModalTarget.type === 'monster');
        const isGoldenGoblin = rallyModalTarget.subtype === 'goblin';
        const isMonsterOrEnemy = rallyModalTarget.type === 'monster' || rallyModalTarget.type === 'enemy_castle';
        const selectedAllies = rallyCandidateCastles.filter((c) => selectedRallyAllyIds.includes(c.id));
        const boostPct = selectedAllies.length * 28;
        const monsterLive = rallyModalTarget.type === 'monster' ? monsterStates[rallyModalTarget.id] : undefined;
        const castleLive = rallyModalTarget.type === 'enemy_castle' ? castleStates[rallyModalTarget.id] : undefined;
        const hpCurrent = monsterLive?.currentHp ?? castleLive?.currentHp;
        const hpMax = monsterLive?.maxHp ?? castleLive?.maxHp;

        const accentColor = isDragoBoss ? '#ef4444' : isGoldenGoblin ? '#fbbf24' : '#f59e0b';
        const badgeText = isDragoBoss
          ? '🐉 APEX WORLD BOSS RALLY'
          : isGoldenGoblin
          ? '💰 GOLDEN GOBLIN TREASURE RALLY'
          : '🚩 ALLIANCE WAR RALLY';

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.78)',
              zIndex: 100,
              display: 'grid',
              placeItems: 'center',
              padding: '20px',
              pointerEvents: 'auto',
            }}
            onClick={() => setRallyModalTarget(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '470px',
                background: isDragoBoss
                  ? 'linear-gradient(180deg, rgba(45,10,16,0.98) 0%, rgba(15,23,42,0.98) 100%)'
                  : '#0f172a',
                border: `1.5px solid ${accentColor}`,
                borderRadius: '12px',
                padding: '20px',
                boxShadow: isDragoBoss
                  ? '0 24px 60px rgba(220,38,38,0.35)'
                  : '0 24px 60px rgba(0,0,0,0.85)',
                color: '#f8fafc',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ font: "700 17px 'Barlow Condensed'", color: isDragoBoss ? '#fca5a5' : '#fef08a', letterSpacing: '0.04em' }}>
                  {badgeText}
                </div>
                <button
                  onClick={() => setRallyModalTarget(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {rallyModalTarget.category === 'monster' && (
                  <MonsterPortrait
                    subtype={rallyModalTarget.subtype}
                    level={rallyModalTarget.level}
                    name={rallyModalTarget.name}
                    size={58}
                    rounded={10}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>
                      {rallyModalTarget.name} (Lv.{rallyModalTarget.level})
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      [{Math.round(rallyModalTarget.position[0])}, {Math.round(rallyModalTarget.position[2])}]
                    </span>
                  </div>
                  {hpCurrent !== undefined && hpMax !== undefined && (
                    <div style={{ fontSize: '11px', color: isDragoBoss ? '#fca5a5' : '#cbd5e1', marginBottom: '4px' }}>
                      HP: <b>{Math.round(hpCurrent).toLocaleString()}</b> / {Math.round(hpMax).toLocaleString()}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {activeHero && <HeroPortrait hero={activeHero} size={30} rounded={6} isSelected />}
                    <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                      Commander: <b style={{ color: activeHero?.crestColor || '#fef08a' }}>{activeHero ? activeHero.name : 'Unled Vanguard'}</b> ·{' '}
                      {selectedBattalionMetrics.totalCount.toLocaleString()} troops ({selectedBattalionMetrics.totalPower.toLocaleString()} PWR)
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px', fontWeight: 700 }}>
                    Alliance Rally Bonus: +{boostPct}% Attack Power ({selectedAllies.length} Allied Columns)
                  </div>
                </div>
              </div>

              {/* Select Lead Hero Commander inside Alliance Rally Modal */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Select Rally Lead Hero
                  </span>
                  <span style={{ fontSize: '10.5px', color: activeHero ? activeHero.crestColor : '#f87171', fontWeight: 700 }}>
                    {activeHero ? `${activeHero.name} · ${activeHero.title}` : 'All Heroes Marching'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
                  {NEPALESE_HEROES.map((hero) => {
                    const lockedMarch = occupiedHeroMap.get(hero.id);
                    const isLocked = Boolean(lockedMarch);
                    const isSelected = activeHero?.id === hero.id;
                    const shortName = hero.name.split(' ')[0];
                    const specialtyStat =
                      hero.specialty === 'gather'
                        ? `+${Math.round(hero.gatherPct * 100)}% GATH`
                        : hero.specialty === 'siege'
                          ? `+${Math.round(hero.siegeDamagePct * 100)}% SIEGE`
                          : `+${Math.round(hero.classAttackPct * 100)}% ${hero.classBonusClass.slice(0, 3).toUpperCase()}`;

                    return (
                      <button
                        key={hero.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setSelectedHeroId(hero.id)}
                        title={
                          isLocked
                            ? `${hero.name} is marching on ${lockedMarch?.targetName}`
                            : `${hero.name} — ${hero.title}`
                        }
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '5px 4px',
                          borderRadius: '8px',
                          background: isLocked
                            ? 'rgba(30, 41, 59, 0.4)'
                            : isSelected
                              ? 'rgba(180, 83, 9, 0.42)'
                              : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected
                            ? '1.5px solid #fde047'
                            : isLocked
                              ? '1px solid rgba(100, 116, 139, 0.25)'
                              : `1px solid ${hero.crestColor}55`,
                          color: isLocked ? '#64748b' : '#f8fafc',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          opacity: isLocked ? 0.65 : 1,
                        }}
                      >
                        <HeroPortrait
                          hero={hero}
                          size={44}
                          rounded={8}
                          isSelected={isSelected}
                          isLocked={isLocked}
                        />
                        <span style={{ font: "700 10.5px 'Barlow Condensed', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {shortName}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: isLocked ? '#f87171' : hero.crestColor }}>
                          {isLocked ? 'BUSY' : specialtyStat}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Allied March Columns */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Converging Alliance Castles ({selectedAllies.length}/{rallyCandidateCastles.length} Selected)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '165px', overflowY: 'auto' }}>
                  {rallyCandidateCastles.map((ally) => {
                    const isChecked = selectedRallyAllyIds.includes(ally.id);
                    const distKm = Math.round(
                      Math.hypot(
                        ally.position[0] - rallyModalTarget.position[0],
                        ally.position[2] - rallyModalTarget.position[2]
                      )
                    );
                    return (
                      <button
                        key={ally.id}
                        type="button"
                        onClick={() =>
                          setSelectedRallyAllyIds((prev) =>
                            prev.includes(ally.id)
                              ? prev.filter((id) => id !== ally.id)
                              : [...prev, ally.id]
                          )
                        }
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          background: isChecked ? 'rgba(30, 58, 138, 0.55)' : 'rgba(255,255,255,0.03)',
                          border: isChecked ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>
                            {isChecked ? '☑ ' : '☐ '}
                            [{ally.allianceTag}] {ally.owner}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {ally.name} · Lv.{ally.level}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fde047' }}>
                            {(ally.power / 1000).toFixed(0)}k PWR
                          </div>
                          <div style={{ fontSize: '10px', color: '#38bdf8' }}>{distKm} km</div>
                        </div>
                      </button>
                    );
                  })}
                  {rallyCandidateCastles.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', padding: '8px' }}>
                      No nearby allied castles available; solo vanguard rally will deploy.
                    </div>
                  )}
                </div>
              </div>

              {/* Rally Assembly Timing */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {[
                  { mins: 0, label: 'Instant Rally' },
                  { mins: 5, label: '5m Prep' },
                  { mins: 10, label: '10m Prep' },
                  { mins: 15, label: '15m Prep' },
                ].map((opt) => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => setRallyTimer(opt.mins)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '6px',
                      background: rallyTimer === opt.mins ? '#b45309' : 'rgba(255,255,255,0.05)',
                      border: rallyTimer === opt.mins ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      color: rallyTimer === opt.mins ? '#fef08a' : '#cbd5e1',
                      font: "700 11px 'Barlow Condensed'",
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const alliedOrigins = selectedAllies.map((c) => ({
                    name: c.owner,
                    position: c.position,
                  }));
                  const captains = selectedAllies.map((c) => c.owner);

                  if (isMonsterOrEnemy) {
                    const dispatched = onDispatchNepaleseMarch(
                      rallyModalTarget,
                      'rally',
                      selectedBattalionStacks,
                      activeHero?.id,
                      { captains, alliedOrigins }
                    );
                    if (dispatched) {
                      const now = new Date();
                      const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
                      setChatMessages((prev) => [
                        ...prev,
                        {
                          id: String(Date.now()),
                          channel: 'alliance',
                          sender: 'Emperor Dangol',
                          tag: playerAlliance.tag,
                          text: `🚩 Launched Alliance Rally (+${boostPct}% PWR, ${selectedAllies.length} allies) on ${rallyModalTarget.name} (Lv.${rallyModalTarget.level})!`,
                          time: timeStr,
                          sharedTarget: {
                            entityId: rallyModalTarget.id,
                            name: rallyModalTarget.name,
                            level: rallyModalTarget.level,
                            category: rallyModalTarget.type,
                            x: Math.round(rallyModalTarget.position[0]),
                            y: Math.round(rallyModalTarget.position[2]),
                          },
                        },
                      ]);
                      setRallyModalTarget(null);
                    }
                  } else {
                    onExecuteAction(rallyModalTarget, 'rally');
                    setRallyModalTarget(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: isDragoBoss
                    ? 'linear-gradient(135deg, #b91c1c, #7f1d1d)'
                    : 'linear-gradient(135deg, #b45309, #78350f)',
                  border: `1px solid ${accentColor}`,
                  color: '#fff',
                  font: "700 14px 'Barlow Condensed'",
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {isDragoBoss
                  ? `🐉 Launch World Boss Rally (+${boostPct}% PWR)`
                  : `🚩 Launch Alliance Rally (+${boostPct}% PWR)`}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 11. STRATEGY SETTINGS MODAL                                  */}
      {/* ============================================================ */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            pointerEvents: 'auto',
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0f172a',
              border: '1px solid #dfba6e',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ font: "700 18px 'Barlow Condensed'", margin: 0, color: '#fef08a' }}>
                ⚙️ STRATEGY SETTINGS & KEYBINDS
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
              <div><b style={{ color: '#fff' }}>W, A, S, D / Arrows</b>: Pan Camera</div>
              <div><b style={{ color: '#fff' }}>Left-Click + Drag</b>: Pan View</div>
              <div><b style={{ color: '#fff' }}>Right-Click + Drag / Q, E</b>: Orbit Angle</div>
              <div><b style={{ color: '#fff' }}>Mouse Wheel / + / -</b>: Smooth Zoom</div>
              <div><b style={{ color: '#fff' }}>Home / H</b>: Reset Screen Focus</div>
              <div><b style={{ color: '#fff' }}>Click Target</b>: Auto-Focus + 1x1 Card</div>
            </div>

            {/* Android App Install & APK Packaging Panel */}
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: "800 14px 'Barlow Condensed'", color: '#34d399' }}>
                  📱 ANDROID APP & APK PACKAGING
                </span>
                <span style={{ fontSize: '10.5px', color: isOnline ? '#86efac' : '#fbbf24' }}>
                  {isOnline ? '● Online & PWA Ready' : '● Offline Cached Mode'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
                Install directly on Android Chrome in fullscreen standalone mode or compile the included Capacitor Android Gradle project into a signed/debug <code>.apk</code>.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!isInstalled && isInstallable && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await installPWA();
                      if (ok) {
                        setIsSettingsOpen(false);
                        onShowToast?.('📱 Empire of the Rising Towers installed on Home Screen!');
                      }
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'linear-gradient(180deg, #059669, #065f46)',
                      borderTop: '1px solid #34d399',
                      borderLeft: '1px solid #34d399',
                      borderRight: '1px solid #34d399',
                      borderBottom: '3px solid #022c22',
                      color: '#fff',
                      font: "800 12px 'Barlow Condensed'",
                      cursor: 'pointer',
                    }}
                  >
                    📲 Install Android App Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowAndroidModal(true);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    borderTop: '1px solid #38bdf8',
                    borderLeft: '1px solid #38bdf8',
                    borderRight: '1px solid #38bdf8',
                    borderBottom: '3px solid #0c4a6e',
                    color: '#bae6fd',
                    font: "800 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  📦 Download Empire-of-the-Rising-Towers.apk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 12. 3D ROYAL INVENTORY MODAL                                 */}
      {/* ============================================================ */}
      {isInventoryOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            zIndex: 105,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            pointerEvents: 'auto',
          }}
          onClick={() => setIsInventoryOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '2px solid #facc15',
              borderLeft: '2px solid #facc15',
              borderRight: '2px solid #facc15',
              borderBottom: '5px solid #78350f',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(250,204,21,0.25)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Hud3DSnapshotBadge iconKey="inventory" size={38} fallback={render3DModelIcon('inventory', 34)} />
                <div>
                  <h2 style={{ margin: 0, font: "800 20px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.04em' }}>
                    3D IMPERIAL VAULT & INVENTORY
                  </h2>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    Use 3D Resource Coffers, Arcane Crystal Relics & Speedups to replenish My Castle Vault immediately
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInventoryOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(
                [
                  { id: 'all', label: 'All 3D Items' },
                  { id: 'resources', label: 'Resource Coffers' },
                  { id: 'relics', label: 'Crystal Relics' },
                  { id: 'speedups', label: 'Chrono Speedups' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInventoryFilter(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background:
                      inventoryFilter === tab.id
                        ? 'linear-gradient(180deg, #d97706, #78350f)'
                        : 'rgba(30, 41, 59, 0.75)',
                    borderTop:
                      inventoryFilter === tab.id
                        ? '1.5px solid #fef08a'
                        : '1px solid rgba(255,255,255,0.12)',
                    borderLeft:
                      inventoryFilter === tab.id
                        ? '1.5px solid #fef08a'
                        : '1px solid rgba(255,255,255,0.12)',
                    borderRight:
                      inventoryFilter === tab.id
                        ? '1.5px solid #fef08a'
                        : '1px solid rgba(255,255,255,0.12)',
                    borderBottom: inventoryFilter === tab.id ? '3px solid #451a03' : '3px solid #0f172a',
                    color: inventoryFilter === tab.id ? '#fef08a' : '#cbd5e1',
                    font: "700 12px 'Barlow Condensed', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 3D Inventory Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '10px',
                maxHeight: '360px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {inventoryItems
                .filter((item) => inventoryFilter === 'all' || item.category === inventoryFilter)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      borderTop:
                        item.rarity === 'legendary'
                          ? '1.5px solid #facc15'
                          : item.rarity === 'epic'
                          ? '1.5px solid #38bdf8'
                          : '1.5px solid #94a3b8',
                      borderLeft:
                        item.rarity === 'legendary'
                          ? '1.5px solid #facc15'
                          : item.rarity === 'epic'
                          ? '1.5px solid #38bdf8'
                          : '1.5px solid #94a3b8',
                      borderRight:
                        item.rarity === 'legendary'
                          ? '1.5px solid #facc15'
                          : item.rarity === 'epic'
                          ? '1.5px solid #38bdf8'
                          : '1.5px solid #94a3b8',
                      borderBottom:
                        item.rarity === 'legendary'
                          ? '4px solid #78350f'
                          : item.rarity === 'epic'
                          ? '4px solid #0c4a6e'
                          : '4px solid #334155',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.55)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {/* 3D Pedestal Icon Box */}
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          minWidth: '54px',
                          borderRadius: '10px',
                          background:
                            item.rarity === 'legendary'
                              ? 'radial-gradient(circle, #78350f 0%, #0f172a 100%)'
                              : 'radial-gradient(circle, #0c4a6e 0%, #0f172a 100%)',
                          borderTop: '1.5px solid rgba(250, 204, 21, 0.6)',
                          borderLeft: '1.5px solid rgba(250, 204, 21, 0.6)',
                          borderRight: '1.5px solid rgba(250, 204, 21, 0.6)',
                          borderBottom: '3px solid #451a03',
                          display: 'grid',
                          placeItems: 'center',
                          position: 'relative',
                        }}
                      >
                        {render3DModelIcon(
                          item.iconType === 'crystal_gems'
                            ? 'quests'
                            : item.iconType === 'chrono_hourglass'
                            ? 'search'
                            : 'inventory',
                          34
                        )}
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            background: '#0f172a',
                            border: '1px solid #facc15',
                            color: '#fef08a',
                            font: "800 10px 'Barlow Condensed'",
                            padding: '1px 5px',
                            borderRadius: '6px',
                          }}
                        >
                          x{item.count}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ font: "800 14px 'Barlow Condensed'", color: '#fef08a' }}>
                            {item.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px', lineHeight: 1.35 }}>
                          {item.desc}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                      <span style={{ font: "700 12px 'Barlow Condensed'", color: '#38bdf8' }}>
                        +{item.rewardAmount.toLocaleString()} {item.rewardType.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUseInventoryItem(item.id)}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '7px',
                          background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
                          borderTop: '1px solid #86efac',
                          borderLeft: '1px solid #86efac',
                          borderRight: '1px solid #86efac',
                          borderBottom: '3px solid #14532d',
                          color: '#fef08a',
                          font: "800 12px 'Barlow Condensed'",
                          cursor: 'pointer',
                        }}
                      >
                        ✨ USE 3D ITEM
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 13. ORNATE QUEST BOARD (5 TABS + DAILY ACTIVITY CHESTS)      */}
      {/* ============================================================ */}
      <QuestBoardModal
        isOpen={isQuestsOpen}
        initialCategory={questBoardTab}
        onClose={() => setIsQuestsOpen(false)}
        resources={resources}
        troopInventory={troopInventory}
        standingPower={standingPower}
        shrinesHeldCount={shrineRuleStatus.totalShrinesHeld}
        hasCongress={allianceTerritoryStats.hasCongress}
        battleReportsCount={battleReportsCount}
        activeMarchesCount={activeMarchesCount}
        isStrategicFilterActive={isStrategicFilterActive}
        infantryGear={infantryGear}
        onGrantReward={onGrantReward}
        onShowToast={onShowToast}
        onOpenCommandHub={onOpenCommandHub}
        onUnclaimedCountChange={setUnclaimedQuestsCount}
        onExecuteGoAction={(action: NonNullable<QuestBoardItem['goAction']>) => {
          if (action === 'enter_kingdom') {
            if (viewMode === 'world') onToggleViewMode();
          } else if (action === 'open_worldmap') {
            onOpenStrategicWorldMap();
          } else if (action === 'relocate') {
            onRelocateCastles();
          } else if (action === 'filter_3d') {
            onToggleStrategicFilter(!isStrategicFilterActive);
          } else if (action === 'open_barracks') {
            onOpenCommandHub('barracks');
          } else if (action === 'open_research') {
            onOpenCommandHub('reports_config');
          } else if (action === 'open_shrines') {
            onOpenCommandHub('shrines');
          } else if (action === 'open_gear') {
            onOpenCommandHub('troops');
          } else if (action === 'open_search_wood') {
            setSearchCategory('wood');
            setIsSearchOpen(true);
          } else if (action === 'open_search_monster') {
            setSearchCategory('monsters');
            setIsSearchOpen(true);
          }
        }}
      />

      {/* ============================================================ */}
      {/* 14. 3D ROYAL MAIL & BATTLE DISPATCHES MODAL                  */}
      {/* ============================================================ */}
      {isMailOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            zIndex: 105,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            pointerEvents: 'auto',
          }}
          onClick={() => setIsMailOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '2px solid #f59e0b',
              borderLeft: '2px solid #f59e0b',
              borderRight: '2px solid #f59e0b',
              borderBottom: '5px solid #78350f',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(245,158,11,0.25)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Hud3DSnapshotBadge iconKey="mail" size={38} fallback={render3DModelIcon('mail', 34)} />
                <div>
                  <h2 style={{ margin: 0, font: "800 20px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.04em' }}>
                    3D IMPERIAL MAIL & BATTLE REPORTS
                  </h2>
                  <div style={{ fontSize: '11.5px', color: '#fed7aa' }}>
                    Official Congress Citadel Dispatches, Alliance Coordinations & Recon Spoils
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleClaimAllMail}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
                    borderTop: '1.5px solid #86efac',
                    borderLeft: '1.5px solid #86efac',
                    borderRight: '1.5px solid #86efac',
                    borderBottom: '3px solid #14532d',
                    color: '#fef08a',
                    font: "800 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  ✨ CLAIM ALL ATTACHMENTS
                </button>
                <button
                  type="button"
                  onClick={() => setIsMailOpen(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(
                [
                  { id: 'all', label: 'All Dispatches' },
                  { id: 'system', label: 'Congress System' },
                  { id: 'alliance', label: 'Alliance Castles' },
                  { id: 'battle', label: 'Tower & Recon Logs' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMailTab(tab.id)}
                  style={{
                    padding: '5px 13px',
                    borderRadius: '8px',
                    background:
                      mailTab === tab.id
                        ? 'linear-gradient(180deg, #b45309, #78350f)'
                        : 'rgba(30, 41, 59, 0.75)',
                    borderTop: mailTab === tab.id ? '1.5px solid #fde047' : '1px solid rgba(255,255,255,0.12)',
                    borderLeft: mailTab === tab.id ? '1.5px solid #fde047' : '1px solid rgba(255,255,255,0.12)',
                    borderRight: mailTab === tab.id ? '1.5px solid #fde047' : '1px solid rgba(255,255,255,0.12)',
                    borderBottom: mailTab === tab.id ? '3px solid #451a03' : '3px solid #0f172a',
                    color: mailTab === tab.id ? '#fef08a' : '#cbd5e1',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Master-Detail Split View */}
            <div className="hud-mail-grid" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '12px', minHeight: '290px' }}>
              {/* Left Message List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto', paddingRight: '4px' }}>
                {mailMessages
                  .filter((m) => mailTab === 'all' || m.category === mailTab)
                  .map((m) => {
                    const isSelected = m.id === selectedMailId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMailId(m.id);
                          setMailMessages((prev) =>
                            prev.map((item) => (item.id === m.id ? { ...item, read: true } : item))
                          );
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '9px 10px',
                          borderRadius: '10px',
                          background: isSelected
                            ? 'linear-gradient(180deg, rgba(180, 83, 9, 0.45), rgba(30, 41, 59, 0.95))'
                            : 'rgba(15, 23, 42, 0.85)',
                          border: isSelected
                            ? '1.5px solid #facc15'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ font: "700 10px 'Barlow Condensed'", color: '#38bdf8' }}>
                            {m.sender}
                          </span>
                          {!m.claimed && (
                            <span
                              style={{
                                fontSize: '9px',
                                background: '#dc2626',
                                color: '#fff',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              GIFT
                            </span>
                          )}
                        </div>
                        <div style={{ font: "800 12.5px 'Barlow Condensed'", color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{m.time}</div>
                      </button>
                    );
                  })}
              </div>

              {/* Right Selected Mail Body & 3D Supply Crate */}
              {(() => {
                const activeMail = mailMessages.find((m) => m.id === selectedMailId) || mailMessages[0];
                if (!activeMail) return null;
                return (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.92)',
                      border: '1.5px solid rgba(250, 204, 21, 0.35)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                        <div>
                          <div style={{ font: "800 16px 'Barlow Condensed'", color: '#fef08a' }}>
                            {activeMail.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#7dd3fc', marginTop: '2px' }}>
                            From: {activeMail.sender} · {activeMail.time}
                          </div>
                        </div>
                        {activeMail.coords && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMailOpen(false);
                              onPanTo(activeMail.coords![0], activeMail.coords![1]);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'rgba(2, 132, 199, 0.35)',
                              border: '1px solid #38bdf8',
                              color: '#e0f2fe',
                              font: "700 11px 'Barlow Condensed'",
                              cursor: 'pointer',
                            }}
                          >
                            📍 [{activeMail.coords[0]}, {activeMail.coords[1]}]
                          </button>
                        )}
                      </div>

                      <p style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.55, marginTop: '12px' }}>
                        {activeMail.body}
                      </p>
                    </div>

                    {/* Attached 3D Tribute Package */}
                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.85)',
                        border: '1px solid rgba(250, 204, 21, 0.45)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {render3DModelIcon('inventory', 30)}
                        <div>
                          <div style={{ font: "800 12px 'Barlow Condensed'", color: '#fef08a' }}>
                            ATTACHED IMPERIAL SUPPLY DROP
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#86efac', fontWeight: 700 }}>
                            +{activeMail.rewardAmount.toLocaleString()} {activeMail.rewardType.toUpperCase()} · +{activeMail.bonusGems} GEMS
                          </div>
                        </div>
                      </div>

                      {!activeMail.claimed ? (
                        <button
                          type="button"
                          onClick={() => handleClaimMail(activeMail.id)}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '8px',
                            background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
                            borderTop: '1.5px solid #86efac',
                            borderLeft: '1.5px solid #86efac',
                            borderRight: '1.5px solid #86efac',
                            borderBottom: '3.5px solid #14532d',
                            color: '#fef08a',
                            font: "800 12.5px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          🎁 CLAIM ATTACHMENT
                        </button>
                      ) : (
                        <span style={{ font: "700 12px 'Barlow Condensed'", color: '#94a3b8' }}>
                          ✓ DEPOSITED IN VAULT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* 15. ORNATE ALLIANCE HEADQUARTERS & COMMANDER PROFILE         */}
      {/* ============================================================ */}
      <AllianceHeadquartersModal
        isOpen={isAllianceOpen}
        initialTab={allianceTab}
        onClose={() => setIsAllianceOpen(false)}
        playerAlliance={playerAlliance}
        onUpdateAllianceIdentity={onUpdateAllianceIdentity}
        shrineRuleStatus={shrineRuleStatus}
        shrineGarrisons={shrineGarrisons}
        conqueredPlots={conqueredPlots}
        castles={castles}
        resources={resources}
        balanceConfig={balanceConfig}
        bonuses={bonuses}
        onPanTo={onPanTo}
        onOpenCommandHub={onOpenCommandHub}
        onRelinquishStructure={onRelinquishStructure}
        onGrantReward={onGrantReward}
        onShowToast={onShowToast}
      />

      <CommanderProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        commanderName={commanderName}
        onChangeCommanderName={setCommanderName}
        vipLevel={4}
        commanderLevel={Math.max(18, Math.round(standingPower / 3500))}
        standingPower={standingPower}
        actionPoints={actionPoints}
        maxActionPoints={MAX_ACTION_POINTS}
        onReplenishActionPoints={handleReplenishActionPoints}
        selectedHeroId={selectedHeroId}
        onSelectHeroId={setSelectedHeroId}
        playerAlliance={playerAlliance}
        shrinesHeldCount={shrineRuleStatus.totalShrinesHeld}
        hasCongress={allianceTerritoryStats.hasCongress}
        battleReportsCount={battleReportsCount}
        troopInventory={troopInventory}
        castles={castles}
        bonuses={bonuses}
        infantryGear={infantryGear}
        isStrategicFilterActive={isStrategicFilterActive}
        onToggleStrategicFilter={onToggleStrategicFilter}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        onOpenStrategicWorldMap={onOpenStrategicWorldMap}
        onOpenAlliance={() => {
          setAllianceTab('overview');
          setIsAllianceOpen(true);
        }}
        onOpenAchievements={() => {
          setQuestBoardTab('achievements');
          setIsQuestsOpen(true);
        }}
        onOpenInventory={() => {
          setIsInventoryOpen(true);
        }}
        onOpenCommandHub={onOpenCommandHub}
        onShowToast={onShowToast}
      />

      {/* ============================================================ */}
      {/* 16. ANDROID APK DOWNLOAD MODAL + OFFLINE INDICATOR           */}
      {/* ============================================================ */}
      <AndroidApkModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onInstallPWA={installPWA}
        onShowToast={onShowToast}
      />

      <OfflineReconnectBanner uid={syncUid} onShowToast={onShowToast} />

      {/* Animation Keyframes & Mobile Responsive HUD Styles */}
      <style>{`
        @keyframes slideUpCard {
          0% {
            opacity: 0;
            transform: translateY(24px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes hudSpringPop {
          0% {
            transform: scale(0.88);
          }
          45% {
            transform: scale(1.09);
          }
          75% {
            transform: scale(0.97);
          }
          100% {
            transform: scale(1);
          }
        }
        .hud-spring-pop {
          animation: hudSpringPop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .hud-pressable {
          transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
          touch-action: manipulation;
        }
        .hud-pressable:active {
          transform: scale(0.91);
        }
        .hud-compass-pressable {
          transform: translateX(-50%);
          transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
          touch-action: manipulation;
        }
        .hud-compass-pressable:active {
          transform: translateX(-50%) scale(0.94);
        }
        @keyframes hudGoldRipple {
          0% {
            transform: translate(-50%, -50%) scale(0.25);
            opacity: 0.95;
          }
          100% {
            transform: translate(-50%, -50%) scale(4.2);
            opacity: 0;
          }
        }
        @keyframes runeSparkFly {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          70% {
            opacity: 0.95;
          }
          100% {
            transform: translate(calc(-50% + var(--spark-tx)), calc(-50% + var(--spark-ty))) scale(0.1);
            opacity: 0;
          }
        }
        @media (max-height: 540px) {
          .hud-top-left-stack {
            top: 6px !important;
            left: 6px !important;
            gap: 3px !important;
            max-width: 44vw;
          }
          .hud-profile-card {
            transform: scale(0.84);
            transform-origin: top left;
            margin-bottom: -8px;
          }
          .hud-alliance-subbar {
            display: none !important;
          }
          .hud-minimap-box {
            width: 72px !important;
            height: 72px !important;
          }
          .hud-coords-bookmark-row {
            gap: 4px !important;
            flex-wrap: nowrap !important;
          }
          .hud-top-right-stack {
            top: 6px !important;
            right: 6px !important;
            max-width: 54vw;
            gap: 3px !important;
          }
          .hud-resource-bar {
            max-width: 100%;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding: 3px 7px !important;
            gap: 6px !important;
          }
          .hud-camera-toolbar {
            max-width: 100%;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch;
            gap: 3px !important;
          }
          .hud-bottom-left-search {
            bottom: 50px !important;
            left: 6px !important;
            height: 36px !important;
            min-width: 96px !important;
            padding: 3px 8px !important;
          }
          .hud-bottom-left-chat {
            bottom: 6px !important;
            left: 6px !important;
            height: 40px !important;
            padding: 4px 8px !important;
            max-width: 190px !important;
          }
          .hud-bottom-actions {
            bottom: 6px !important;
            right: 6px !important;
            gap: 4px !important;
          }
          .hud-bottom-actions > button {
            width: 46px !important;
            height: 54px !important;
          }
          .hud-bottom-actions > button:last-child {
            width: 52px !important;
            height: 58px !important;
          }
          .hud-bottom-compass {
            bottom: 58px !important;
            min-height: 40px !important;
            padding: 4px 10px 4px 6px !important;
            gap: 6px !important;
          }
          .hud-bottom-compass svg {
            width: 28px !important;
            height: 28px !important;
          }
          .bottom-1x1-troop-card {
            bottom: 54px !important;
            padding: 7px 10px !important;
            max-width: 72vw !important;
          }
          .hud-floating-drawer {
            bottom: 92px !important;
            max-height: 58dvh !important;
            overflow-y: auto;
            touch-action: pan-y;
          }
          .hud-mail-grid {
            max-height: 62dvh;
            overflow-y: auto;
            touch-action: pan-y;
          }
        }
        @media (max-width: 1024px) and (min-height: 501px) {
          .hud-bottom-compass {
            bottom: 72px !important;
          }
        }
        @media (max-width: 768px) {
          .hud-top-left-stack {
            top: 8px !important;
            left: 8px !important;
            gap: 4px !important;
            max-width: calc(52vw - 10px);
          }
          .hud-profile-card {
            transform: scale(0.86);
            transform-origin: top left;
            margin-bottom: -6px;
          }
          .hud-alliance-subbar {
            max-width: 195px;
            overflow: hidden;
          }
          .hud-minimap-box {
            width: 86px !important;
            height: 86px !important;
          }
          .hud-coords-bookmark-row {
            gap: 4px !important;
            flex-wrap: wrap;
          }
          .hud-top-right-stack {
            top: 8px !important;
            right: 8px !important;
            max-width: calc(48vw - 10px);
            gap: 4px !important;
          }
          .hud-resource-bar {
            max-width: 100%;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding: 4px 7px !important;
            gap: 6px !important;
          }
          .hud-camera-toolbar {
            max-width: 100%;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch;
            gap: 4px !important;
          }
          .hud-bottom-left-search {
            bottom: 58px !important;
            left: 8px !important;
            height: 40px !important;
            min-width: 96px !important;
            padding: 4px 8px !important;
          }
          .hud-bottom-left-chat {
            bottom: 8px !important;
            left: 8px !important;
            height: 46px !important;
            padding: 4px 8px !important;
            max-width: 96px !important;
          }
          .hud-bottom-actions {
            bottom: 8px !important;
            right: 6px !important;
            gap: 3px !important;
          }
          .hud-bottom-actions > button {
            width: 40px !important;
            height: 50px !important;
          }
          .hud-bottom-actions > button:last-child {
            width: 46px !important;
            height: 54px !important;
          }
          .hud-bottom-compass {
            bottom: 60px !important;
            min-height: 42px !important;
            padding: 4px 10px 4px 6px !important;
            gap: 7px !important;
            max-width: 196px !important;
          }
          .hud-bottom-compass svg {
            width: 30px !important;
            height: 30px !important;
          }
          .hud-compass-area-label {
            max-width: 118px !important;
          }
          .bottom-1x1-troop-card {
            left: 8px !important;
            right: 8px !important;
            width: auto !important;
            max-width: none !important;
            bottom: 108px !important;
          }
          .hud-floating-drawer {
            left: 8px !important;
            right: 8px !important;
            width: auto !important;
            transform: none !important;
            bottom: 104px !important;
            max-height: 46dvh !important;
            touch-action: pan-y;
          }
          .hud-mail-grid {
            grid-template-columns: 1fr !important;
            max-height: 55dvh;
            overflow-y: auto;
            touch-action: pan-y;
          }
        }
        @media (max-width: 520px) {
          .hud-chat-preview-text {
            display: none;
          }
          .hud-search-btn-text {
            display: none !important;
          }
          .hud-bottom-left-search {
            width: 44px !important;
            min-width: 44px !important;
            padding: 4px !important;
            justify-content: center !important;
          }
          .hud-bottom-left-chat {
            width: 44px !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </>
  );
};
