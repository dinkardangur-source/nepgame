import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  WorldEntity,
  EntityAction,
  WORLD_MONSTERS,
  WORLD_RESOURCES,
  RESERVED_PLOTS,
  WorldCoordinates,
  TroopUnit,
  INITIAL_TROOP_ROSTER,
  CastleSpawnData,
} from '../game/WorldCoordinates';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

const CASTLE_EMBLEM_SRC = '/assets/aistudio/Gemini_Generated_Image_fzxzmyfzxzmyfzxz_6436d71f.jfif';

interface ButtonRippleBurst {
  id: number;
  xPct: number;
  yPct: number;
}

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
  resources: { wood: number; stone: number; iron: number; food: number; gold: number; gems: number };
  conqueredPlots?: Record<string, 'neutral' | 'enemy' | 'alliance'>;
  onGrantReward?: (
    type: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems',
    amount: number,
    label: string
  ) => void;
  onShowToast?: (msg: string) => void;
}

interface BookmarkPin {
  id: string;
  name: string;
  x: number;
  y: number;
  category: 'favorite' | 'alliance' | 'enemy' | 'shrine';
  createdAt: number;
}

const BOOKMARKS_STORAGE_KEY = 'himalayan_realm_bookmarks_v1';

const DEFAULT_BOOKMARKS: BookmarkPin[] = [
  { id: 'bm-shrine-a1', name: 'Shrine A1 Sanctum', x: 684, y: 684, category: 'shrine', createdAt: 1 },
  { id: 'bm-frost-boss', name: 'Frost Yeti Lair', x: 300, y: 1360, category: 'enemy', createdAt: 2 },
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

interface QuestItemData {
  id: string;
  tab: 'imperial' | 'daily';
  title: string;
  desc: string;
  progress: number;
  target: number;
  rewardType: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems';
  rewardAmount: number;
  secondaryGems: number;
  claimed: boolean;
  actionType?: 'enter_kingdom' | 'open_worldmap' | 'relocate' | 'filter_3d';
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
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMinimapDraggingRef = useRef<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Android / PWA Install & Offline Status
  const { isInstallable, isInstalled, isIOS, isAndroid, install: installPWA } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  // Tactile Spring Press, Golden Ripple & Rune Sparkle Animations
  const [pressedBtnKey, setPressedBtnKey] = useState<string | null>(null);
  const [springPopKey, setSpringPopKey] = useState<string | null>(null);
  const [rippleBursts, setRippleBursts] = useState<Record<string, ButtonRippleBurst>>({});

  const handleHudPointerDown = (key: string) => {
    setPressedBtnKey(key);
  };

  const handleHudPointerLeave = (key: string) => {
    setPressedBtnKey((prev) => (prev === key ? null : prev));
  };

  const triggerTouchVfx = (e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>, key: string) => {
    setPressedBtnKey(null);
    const rect = e.currentTarget.getBoundingClientRect();
    let xPct = 50;
    let yPct = 50;
    if ('clientX' in e && rect.width > 0 && rect.height > 0 && e.clientX > 0) {
      xPct = Math.max(10, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
      yPct = Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    }
    const burstId = Date.now() + Math.floor(Math.random() * 1000);
    setRippleBursts((prev) => ({ ...prev, [key]: { id: burstId, xPct, yPct } }));
    setSpringPopKey(key);
    window.setTimeout(() => {
      setSpringPopKey((prev) => (prev === key ? null : prev));
    }, 460);
    window.setTimeout(() => {
      setRippleBursts((prev) => {
        if (prev[key]?.id !== burstId) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }, 640);
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

  // 1x1 Troop Formation Selection State
  const [troopRoster, setTroopRoster] = useState<TroopUnit[]>(INITIAL_TROOP_ROSTER);
  const [activeUnitIndex, setActiveUnitIndex] = useState<number>(0);

  // Currently active unit in the 1x1 card
  const currentUnit = troopRoster[activeUnitIndex] || troopRoster[0];

  // Dock Toggles
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<'world' | 'alliance'>('world');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; tag: string; text: string; time: string }>>([
    { id: '1', sender: 'Lord Kazi', tag: 'Vanguard', text: 'Ironcrest Pass is secured. Watch for Rock Drake patrols.', time: '14:22' },
    { id: '2', sender: 'Lady Maya', tag: 'Alliance', text: 'Gathering granite for Citadel Level 21 foundation upgrade.', time: '14:25' },
    { id: '3', sender: 'Herald Gorkha', tag: 'System', text: 'Ancient Frost Yeti King spotted in Northern Glaciers [300, 1360]!', time: '14:28' },
  ]);

  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [radarCategory, setRadarCategory] = useState<
    'all' | 'enemies' | 'shrines' | 'monsters' | 'gold' | 'iron' | 'stone' | 'wood' | 'farm'
  >('all');

  // Alliance Hub Modal State
  const [isAllianceOpen, setIsAllianceOpen] = useState(false);
  const [allianceTab, setAllianceTab] = useState<'overview' | 'members' | 'war'>('overview');

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
  const [questTab, setQuestTab] = useState<'imperial' | 'daily'>('imperial');
  const [questsList, setQuestsList] = useState<QuestItemData[]>([
    {
      id: 'q-merge-courtyard',
      tab: 'imperial',
      title: 'Merge 3D Buildings Inside Kingdom',
      desc: 'Enter the 3D Walled Imperial Citadel and merge matching Barracks, Towers, Mills, or Shrines.',
      progress: 1,
      target: 1,
      rewardType: 'gold',
      rewardAmount: 6000,
      secondaryGems: 120,
      claimed: false,
      actionType: 'enter_kingdom',
    },
    {
      id: 'q-inspect-congress',
      tab: 'imperial',
      title: 'Reconnoiter The Congress & 36 Shrines',
      desc: 'Open the Parchment WorldMap to inspect The Congress at [800, 800] and Shrines A1–A4, B1–B12, and C1–C20.',
      progress: 1,
      target: 1,
      rewardType: 'stone',
      rewardAmount: 20000,
      secondaryGems: 100,
      claimed: false,
      actionType: 'open_worldmap',
    },
    {
      id: 'q-alliance-castles',
      tab: 'imperial',
      title: 'Coordinate with 10 Alliance Member Castles',
      desc: 'Verify randomized spawn coordinates for My Castle and all 10 Alliance Member Castles across the 1600×1600 continent.',
      progress: 10,
      target: 10,
      rewardType: 'wood',
      rewardAmount: 24000,
      secondaryGems: 90,
      claimed: false,
      actionType: 'relocate',
    },
    {
      id: 'q-daily-shrine',
      tab: 'daily',
      title: 'Activate 3D Strategic Shrine Filter',
      desc: 'Toggle the 3D World Filter to highlight only The Congress, Shrines A/B/C & Castles.',
      progress: 1,
      target: 1,
      rewardType: 'iron',
      rewardAmount: 15000,
      secondaryGems: 80,
      claimed: false,
      actionType: 'filter_3d',
    },
    {
      id: 'q-daily-patrol',
      tab: 'daily',
      title: 'Garrison Vanguard Battalion',
      desc: 'Maintain 10,000+ March Power ready at My Castle to defend adjacent Crystal Shrines.',
      progress: 1,
      target: 1,
      rewardType: 'gold',
      rewardAmount: 4500,
      secondaryGems: 65,
      claimed: false,
    },
  ]);

  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mailTab, setMailTab] = useState<'all' | 'system' | 'battle' | 'alliance'>('all');
  const [mailMessages, setMailMessages] = useState<MailMessageData[]>([
    {
      id: 'mail-1',
      category: 'system',
      title: '👑 The Congress Consecrated at [800, 800]',
      sender: 'Imperial High Council',
      time: 'Just now',
      body: 'The central Arcane Blue Crystal & Gold Congress Citadel at [800, 800] is online! 4 Inner Sanctum Shrines (A1–A4), 12 Mid-Ring Shrines (B1–B12), and 20 Frontier Shrines (C1–C20) form the Continent 1 lattice.',
      coords: [800, 800],
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
      sender: 'Commander Kazi [VGD]',
      time: '8m ago',
      body: 'My Lord, all 10 Alliance Member Castles have established fortifications around the continent alongside My Castle. Use the WorldMap at any time to jump to allied strongholds or relocate positions.',
      coords: [800, 760],
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
      body: 'Our scouts surveyed Inner Sanctum Shrine A1 at [684, 684] and linking Mid-Ring Shrine B1 at [452, 452]. Arcane mana conduits are at 100% capacity. Claim recovered war spoils below.',
      coords: [684, 684],
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
      coords: [800, 800],
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
  const [rallyTimer, setRallyTimer] = useState<number>(5);

  // Helper to open one dock panel cleanly while closing conflicting floating drawers
  const openExclusiveDockPanel = (
    panel: 'inventory' | 'quests' | 'alliance' | 'mail' | 'radar' | 'chat' | 'bookmarks'
  ) => {
    setIsInventoryOpen(panel === 'inventory' ? !isInventoryOpen : false);
    setIsQuestsOpen(panel === 'quests' ? !isQuestsOpen : false);
    setIsAllianceOpen(panel === 'alliance' ? !isAllianceOpen : false);
    setIsMailOpen(panel === 'mail' ? !isMailOpen : false);
    setIsRadarOpen(panel === 'radar' ? !isRadarOpen : false);
    setIsChatOpen(panel === 'chat' ? !isChatOpen : false);
    setIsBookmarksOpen(panel === 'bookmarks' ? !isBookmarksOpen : false);
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

  const totalInventoryCount = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + item.count, 0),
    [inventoryItems]
  );

  const unclaimedQuestsCount = useMemo(
    () => questsList.filter((q) => !q.claimed && q.progress >= q.target).length,
    [questsList]
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

  const handleClaimQuest = (questId: string) => {
    const q = questsList.find((item) => item.id === questId);
    if (!q || q.claimed || q.progress < q.target) return;
    setQuestsList((prev) =>
      prev.map((item) => (item.id === questId ? { ...item, claimed: true } : item))
    );
    onGrantReward?.(q.rewardType, q.rewardAmount, q.title);
    if (q.secondaryGems > 0) {
      onGrantReward?.('gems', q.secondaryGems, `${q.title} Bonus`);
    }
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

  // Sculpted 3D Isometric SVG Models for Inventory, Quests, Alliance, Mail, Radar, Chat
  const render3DModelIcon = (
    type: 'inventory' | 'quests' | 'alliance' | 'mail' | 'radar' | 'chat',
    size = 28
  ) => {
    switch (type) {
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
      case 'radar':
        return (
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <ellipse cx="18" cy="31" rx="12" ry="3" fill="rgba(0,0,0,0.55)" />
            <circle cx="18" cy="18" r="11.5" fill="#0f172a" stroke="#34d399" strokeWidth="1.6" />
            <circle cx="18" cy="18" r="8.5" stroke="#facc15" strokeWidth="0.9" strokeDasharray="2 2" />
            <polygon points="18,8 21.5,18 18,16 14.5,18" fill="#38bdf8" />
            <polygon points="18,28 21.5,18 18,20 14.5,18" fill="#f87171" />
            <circle cx="18" cy="18" r="2.2" fill="#fef08a" />
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
  const renderResourceSvg = (res: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems') => {
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

  // Unit carousel handlers
  const handlePrevUnit = () => {
    setActiveUnitIndex((prev) => (prev > 0 ? prev - 1 : troopRoster.length - 1));
  };

  const handleNextUnit = () => {
    setActiveUnitIndex((prev) => (prev < troopRoster.length - 1 ? prev + 1 : 0));
  };

  // Adjust unit count for the active 1x1 unit card
  const updateActiveUnitCount = (delta: number) => {
    setTroopRoster((prev) =>
      prev.map((u, idx) => {
        if (idx === activeUnitIndex) {
          const newCount = Math.max(0, Math.min(u.maxCount, u.selectedCount + delta));
          return { ...u, selectedCount: newCount };
        }
        return u;
      })
    );
  };

  const setActiveUnitRatio = (ratio: number) => {
    setTroopRoster((prev) =>
      prev.map((u, idx) => {
        if (idx === activeUnitIndex) {
          return { ...u, selectedCount: Math.round(u.maxCount * ratio) };
        }
        return u;
      })
    );
  };

  // Calculate Marching Power & Total Units from all configured battalions
  const { totalTroopCount, totalMarchPower } = useMemo(() => {
    let count = 0;
    let power = 0;
    for (const unit of troopRoster) {
      count += unit.selectedCount;
      power += unit.selectedCount * unit.powerPerUnit;
    }
    return { totalTroopCount: count, totalMarchPower: power };
  }, [troopRoster]);

  const myCastleCoords = useMemo<[number, number]>(() => {
    const mc = castles.find((c) => c.isMyCastle);
    return mc ? [mc.position[0], mc.position[2]] : [800, 780];
  }, [castles]);

  // Target distance & estimated march time from My Castle
  const targetDistanceInfo = useMemo(() => {
    if (!selectedEntity) return { dist: 0, seconds: 0 };
    const dist = Math.round(
      Math.hypot(
        selectedEntity.position[0] - myCastleCoords[0],
        selectedEntity.position[2] - myCastleCoords[1]
      )
    );
    const seconds = Math.max(2, Math.round(dist / 24));
    return { dist, seconds };
  }, [selectedEntity, myCastleCoords]);

  // ============================================================
  // 1. RENDER FIXED 2x2 SQUARE MINIMAP (112x112 Compact, 1600x1600 Continent)
  // ============================================================
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 112;

    // 1. Hand-Painted Alpine Loam Base
    ctx.fillStyle = '#1c2d23';
    ctx.fillRect(0, 0, size, size);

    // 2. Glacial Snow Sector (Z > 1040)
    const snowTop = WorldCoordinates.worldToMinimap(0, 1040, size, size);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, snowTop.my, size, size - snowTop.my);

    // 3. Paved Imperial Cobblestone Highways
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.6;

    const h1Start = WorldCoordinates.worldToMinimap(800, 220, size, size);
    const h1End = WorldCoordinates.worldToMinimap(800, 1380, size, size);
    ctx.beginPath();
    ctx.moveTo(h1Start.mx, h1Start.my);
    ctx.lineTo(h1End.mx, h1End.my);
    ctx.stroke();

    const h2Start = WorldCoordinates.worldToMinimap(220, 800, size, size);
    const h2End = WorldCoordinates.worldToMinimap(1380, 800, size, size);
    ctx.beginPath();
    ctx.moveTo(h2Start.mx, h2Start.my);
    ctx.lineTo(h2End.mx, h2End.my);
    ctx.stroke();

    // 3b. Wetland Marsh Basins & Winding Streams on Minimap
    ctx.fillStyle = 'rgba(20, 184, 166, 0.45)';
    for (const [wx, wz] of [[430, 500], [970, 430]]) {
      const mPos = WorldCoordinates.worldToMinimap(wx, wz, size, size);
      ctx.beginPath();
      ctx.arc(mPos.mx, mPos.my, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    const s1a = WorldCoordinates.worldToMinimap(560, 720, size, size);
    const s1b = WorldCoordinates.worldToMinimap(430, 500, size, size);
    ctx.beginPath();
    ctx.moveTo(s1a.mx, s1a.my);
    ctx.lineTo(s1b.mx, s1b.my);
    ctx.stroke();
    const s2a = WorldCoordinates.worldToMinimap(1160, 720, size, size);
    const s2b = WorldCoordinates.worldToMinimap(970, 430, size, size);
    ctx.beginPath();
    ctx.moveTo(s2a.mx, s2a.my);
    ctx.lineTo(s2b.mx, s2b.my);
    ctx.stroke();

    // 4. Fixed 2x2 Sector Quadrant Grid Lines (Dividing at center 800)
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
    ctx.fillStyle = 'rgba(241, 245, 249, 0.48)';
    ctx.font = "700 6.5px 'Barlow Condensed', sans-serif";
    ctx.fillText('GLACIERS', 4, size - 4);
    ctx.fillText('PASS', size / 2 + 4, size - 4);
    ctx.fillText('PINES', 4, 9);
    ctx.fillText('BASIN', size / 2 + 4, 9);

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

    // 9. Camera View Frustum Box (scaled to 1600x1600 continent)
    const camCenter = WorldCoordinates.worldToMinimap(cameraInfo.x, cameraInfo.z, size, size);
    const frustumW = Math.max(10, (70 / cameraInfo.zoom) * (size / 1600));
    const frustumH = Math.max(8, (54 / cameraInfo.zoom) * (size / 1600));

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
        sender: 'Emperor Dangol',
        tag: chatChannel === 'world' ? 'Monarch' : 'Alliance',
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

  // Filtered radar targets (includes Enemy Castles, Shrines/Congress, Monsters, Resources)
  const radarTargetItems = useMemo(() => {
    const enemyTargets = enemyCastles.map((ec) => ({
      id: ec.id,
      name: `${ec.allianceTag} ${ec.name}`,
      level: ec.level,
      category: 'enemy' as const,
      subtype: 'Enemy Citadel',
      position: ec.position,
      dist: Math.round(Math.hypot(ec.position[0] - myCastleCoords[0], ec.position[2] - myCastleCoords[1])),
    }));

    const shrineTargets = RESERVED_PLOTS.map((p) => ({
      id: p.id,
      name: conqueredPlots?.[p.id] === 'alliance' ? `${p.name} [ALLIANCE]` : p.name,
      level: p.type === 'congress' ? 30 : p.type === 'shrine_a' ? 25 : p.type === 'shrine_b' ? 18 : 12,
      category: 'shrine' as const,
      subtype: p.type === 'congress' ? 'Congress Citadel' : p.type.replace('_', ' ').toUpperCase(),
      position: p.position,
      dist: Math.round(Math.hypot(p.position[0] - myCastleCoords[0], p.position[2] - myCastleCoords[1])),
    }));

    const monsterAndResourceTargets = [...WORLD_MONSTERS, ...WORLD_RESOURCES].map((ent) => ({
      id: ent.id,
      name: ent.name,
      level: ent.level,
      category: ent.category,
      subtype: ent.subtype,
      position: ent.position,
      dist: Math.round(Math.hypot(ent.position[0] - myCastleCoords[0], ent.position[2] - myCastleCoords[1])),
    }));

    return [...enemyTargets, ...shrineTargets, ...monsterAndResourceTargets].sort((a, b) => a.dist - b.dist);
  }, [enemyCastles, conqueredPlots, myCastleCoords]);

  const filteredRadarEntities = radarTargetItems.filter((ent) => {
    if (radarCategory === 'all') return ent.category !== 'shrine';
    if (radarCategory === 'enemies') return ent.category === 'enemy';
    if (radarCategory === 'shrines') return ent.category === 'shrine';
    if (radarCategory === 'monsters') return ent.category === 'monster';
    return ent.subtype === radarCategory;
  });

  const latestChatMessage = chatMessages[chatMessages.length - 1];
  const zoomOutScore = Math.min(
    100,
    Math.max(0, Math.round(((3.2 - cameraInfo.zoom) / (3.2 - 0.048)) * 100))
  );

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
        {/* User Profile Card */}
        <div
          className="hud-profile-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            background: 'rgba(12, 17, 26, 0.94)',
            border: '1px solid rgba(218, 165, 32, 0.5)',
            borderRadius: '10px',
            padding: '5px 12px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.65)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7f1d1d, #b91c1c)',
              border: '2px solid #dfba6e',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            👑
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ font: "700 13px 'Barlow Condensed'", color: '#fef08a', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                LORD DANGOL
              </span>
              <span
                style={{
                  font: "700 8.5px 'Barlow Condensed'",
                  background: '#b45309',
                  color: '#fef3c7',
                  padding: '1px 5px',
                  borderRadius: '3px',
                }}
              >
                VIP 4
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap' }}>
              <span>Lv. 18 Emperor</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span style={{ color: '#38bdf8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {totalMarchPower.toLocaleString()} ⚡
              </span>
            </div>
          </div>
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
            1600×1600 · C1
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
                { id: 'preset-congress', name: 'The Congress', x: 800, y: 800, tag: 'CENTER', isPreset: true },
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
                        padding: '2px 5px',
                        cursor: 'pointer',
                      }}
                      title="Delete Bookmark"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
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
        {/* Row 1: Resource Amounts (Right Upward Corner) */}
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
            onPointerDown={() => handleHudPointerDown('settings')}
            onPointerLeave={() => handleHudPointerLeave('settings')}
            onClick={(e) => {
              triggerTouchVfx(e, 'settings');
              setIsSettingsOpen(true);
            }}
            className={springPopKey === 'settings' ? 'hud-spring-pop' : undefined}
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
              transform: pressedBtnKey === 'settings' ? 'scale(0.91)' : undefined,
              transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            title="Strategy Settings, Keybinds & Android APK"
          >
            ⚙️
          </button>

          {!isInstalled && (
            <button
              type="button"
              onPointerDown={() => handleHudPointerDown('install-app')}
              onPointerLeave={() => handleHudPointerLeave('install-app')}
              onClick={async (e) => {
                triggerTouchVfx(e, 'install-app');
                if (isInstallable) {
                  const accepted = await installPWA();
                  if (accepted) {
                    onShowToast?.('📱 Himalayan Realms installed to Home Screen!');
                  }
                } else {
                  setShowAndroidModal(true);
                }
              }}
              className={springPopKey === 'install-app' ? 'hud-spring-pop' : undefined}
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
                transform: pressedBtnKey === 'install-app' ? 'scale(0.91)' : undefined,
                transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              title={isInstallable ? 'Install App to Android Home Screen' : 'Android App & APK Export'}
            >
              <span>📲</span>
              <span>{isInstallable ? 'Install' : 'APK'}</span>
            </button>
          )}

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
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM-LEFT: LIVE CHAT PREVIEW BAR (CHAT BUTTON ON LEFT)  */}
      {/* ============================================================ */}
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
            {latestChatMessage?.text}
          </div>
        </div>
      </button>

      {/* ============================================================ */}
      {/* 4. BOTTOM-CENTER: RADAR BUTTON (MIDDLE DOWNWARD)             */}
      {/* ============================================================ */}
      <button
        className="hud-bottom-center-radar"
        type="button"
        onClick={() => openExclusiveDockPanel('radar')}
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: isRadarOpen ? 'translate(-50%, -2px)' : 'translateX(-50%)',
          zIndex: 55,
          height: '54px',
          minWidth: '88px',
          padding: '5px 14px',
          borderRadius: '11px',
          background: isRadarOpen
            ? 'linear-gradient(180deg, #059669 0%, #064e3b 100%)'
            : 'linear-gradient(180deg, #1e293b 0%, #0b1120 100%)',
          borderTop: isRadarOpen ? '2px solid #34d399' : '1.5px solid rgba(52, 211, 153, 0.7)',
          borderLeft: isRadarOpen ? '2px solid #34d399' : '1.5px solid rgba(52, 211, 153, 0.7)',
          borderRight: isRadarOpen ? '2px solid #34d399' : '1.5px solid rgba(52, 211, 153, 0.7)',
          borderBottom: '4px solid #022c22',
          boxShadow: isRadarOpen
            ? '0 4px 18px rgba(52, 211, 153, 0.45)'
            : '0 8px 22px rgba(0, 0, 0, 0.8)',
          color: '#f8fafc',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          pointerEvents: 'auto',
          transition: 'all 0.15s ease',
        }}
        title="Open Realm Target Search Radar"
      >
        <div style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))' }}>
          {render3DModelIcon('radar', 25)}
        </div>
        <span style={{ font: "800 9.5px 'Barlow Condensed'", color: isRadarOpen ? '#fef08a' : '#86efac', letterSpacing: '0.05em', lineHeight: 1 }}>
          RADAR
        </span>
      </button>

      {/* ============================================================ */}
      {/* 5. BOTTOM-RIGHT: INVENTORY, QUESTS, MAIL & CASTLE INSIDE     */}
      {/* ============================================================ */}
      <div
        className="hud-bottom-right-dock"
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 55,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(10, 16, 28, 0.94)',
          borderTop: '1.5px solid rgba(218, 165, 32, 0.55)',
          borderLeft: '1.5px solid rgba(218, 165, 32, 0.55)',
          borderRight: '1.5px solid rgba(218, 165, 32, 0.55)',
          borderBottom: '4px solid #451a03',
          borderRadius: '12px',
          padding: '6px 8px',
          boxShadow: '0 10px 26px rgba(0, 0, 0, 0.85)',
          pointerEvents: 'auto',
        }}
      >
        {[
          {
            key: 'inventory' as const,
            label: 'INVENTORY',
            isOpen: isInventoryOpen,
            badge: totalInventoryCount,
            badgeColor: '#d97706',
            bgActive: 'linear-gradient(180deg, #d97706 0%, #78350f 100%)',
            bgIdle: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderColor: '#facc15',
            bevelColor: '#451a03',
            title: 'Open 3D Royal Inventory',
          },
          {
            key: 'quests' as const,
            label: 'QUESTS',
            isOpen: isQuestsOpen,
            badge: unclaimedQuestsCount,
            badgeColor: '#16a34a',
            bgActive: 'linear-gradient(180deg, #0284c7 0%, #1e3a8a 100%)',
            bgIdle: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderColor: '#38bdf8',
            bevelColor: '#0c4a6e',
            title: 'Open 3D Imperial & Daily Quests',
          },
          {
            key: 'alliance' as const,
            label: 'ALLIANCE',
            isOpen: isAllianceOpen,
            badge: allianceTerritoryStats.capturedTotal > 0 ? allianceTerritoryStats.capturedTotal : enemyCastles.length,
            badgeColor: allianceTerritoryStats.capturedTotal > 0 ? '#10b981' : '#dc2626',
            bgActive: 'linear-gradient(180deg, #059669 0%, #064e3b 100%)',
            bgIdle: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderColor: '#34d399',
            bevelColor: '#064e3b',
            title: 'Open Alliance Hub, Territory Buffs & War Rallies',
          },
          {
            key: 'mail' as const,
            label: 'MAIL',
            isOpen: isMailOpen,
            badge: unreadOrUnclaimedMailCount,
            badgeColor: '#dc2626',
            bgActive: 'linear-gradient(180deg, #b45309 0%, #7c2d12 100%)',
            bgIdle: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderColor: '#fde047',
            bevelColor: '#431407',
            title: 'Open 3D Royal Mail & Battle Dispatches',
          },
        ].map((btn) => {
          const burst = rippleBursts[btn.key];
          const isPressed = pressedBtnKey === btn.key;
          const isPopping = springPopKey === btn.key;
          return (
            <button
              key={btn.key}
              type="button"
              onPointerDown={() => handleHudPointerDown(btn.key)}
              onPointerLeave={() => handleHudPointerLeave(btn.key)}
              onPointerCancel={() => handleHudPointerLeave(btn.key)}
              onClick={(e) => {
                triggerTouchVfx(e, btn.key);
                openExclusiveDockPanel(btn.key);
              }}
              className={isPopping ? 'hud-spring-pop' : undefined}
              style={{
                position: 'relative',
                overflow: 'visible',
                width: '52px',
                height: '54px',
                borderRadius: '9px',
                background: btn.isOpen ? btn.bgActive : btn.bgIdle,
                borderTop: btn.isOpen ? `2px solid ${btn.borderColor}` : '1.5px solid rgba(218, 165, 32, 0.45)',
                borderLeft: btn.isOpen ? `2px solid ${btn.borderColor}` : '1.5px solid rgba(218, 165, 32, 0.45)',
                borderRight: btn.isOpen ? `2px solid ${btn.borderColor}` : '1.5px solid rgba(218, 165, 32, 0.45)',
                borderBottom: `3.5px solid ${btn.bevelColor}`,
                boxShadow: btn.isOpen
                  ? '0 4px 12px rgba(250, 204, 21, 0.35)'
                  : '0 4px 8px rgba(0,0,0,0.6)',
                color: '#f8fafc',
                cursor: 'pointer',
                touchAction: 'manipulation',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: '3px 2px',
                transform: isPressed
                  ? 'scale(0.90) translateY(2px)'
                  : btn.isOpen
                    ? 'translateY(-2px)'
                    : 'none',
                transition: 'transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
              }}
              title={btn.title}
            >
              {/* Clipped Golden Ripple Wave inside Button Bounds */}
              {burst && (
                <span
                  key={burst.id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: `${burst.xPct}%`,
                      top: `${burst.yPct}%`,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      borderTop: '2px solid #fef08a',
                      borderLeft: '2px solid #fef08a',
                      borderRight: '2px solid #fef08a',
                      borderBottom: '2px solid #fef08a',
                      background: 'radial-gradient(circle, rgba(250, 204, 21, 0.45), rgba(56, 189, 248, 0.12), transparent 70%)',
                      animation: 'hudGoldRipple 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    }}
                  />
                </span>
              )}

              {btn.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-4px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    background: btn.badgeColor,
                    borderTop: '1.5px solid #fef08a',
                    borderLeft: '1.5px solid #fef08a',
                    borderRight: '1.5px solid #fef08a',
                    borderBottom: '1.5px solid #fef08a',
                    color: '#fff',
                    font: "800 9px 'Barlow Condensed', sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.75)',
                    zIndex: 3,
                  }}
                >
                  {btn.badge}
                </span>
              )}
              <div style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))', position: 'relative', zIndex: 2 }}>
                {render3DModelIcon(btn.key, 25)}
              </div>
              <span
                style={{
                  position: 'relative',
                  zIndex: 2,
                  font: "800 8.5px 'Barlow Condensed', sans-serif",
                  color: btn.isOpen ? '#fef08a' : '#e2e8f0',
                  letterSpacing: '0.03em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {btn.label}
              </span>
            </button>
          );
        })}

        {/* Castle Inside Kingdom / World Toggle Button with Full-Bleed Crest & Rune Sparkle Burst */}
        {(() => {
          const castleBurst = rippleBursts['castle'];
          const isCastlePressed = pressedBtnKey === 'castle';
          const isCastlePopping = springPopKey === 'castle';
          return (
            <button
              className={`hud-castle-corner-btn${isCastlePopping ? ' hud-spring-pop' : ''}`}
              type="button"
              onPointerDown={() => handleHudPointerDown('castle')}
              onPointerLeave={() => handleHudPointerLeave('castle')}
              onPointerCancel={() => handleHudPointerLeave('castle')}
              onClick={(e) => {
                triggerTouchVfx(e, 'castle');
                onToggleViewMode();
              }}
              style={{
                position: 'relative',
                overflow: 'visible',
                width: '66px',
                height: '58px',
                borderRadius: '11px',
                background:
                  viewMode === 'world'
                    ? '#1c1208'
                    : 'linear-gradient(180deg, #0284c7 0%, #0369a1 65%, #0c4a6e 100%)',
                borderTop: viewMode === 'world' ? '2px solid #fde047' : '2px solid #38bdf8',
                borderLeft: viewMode === 'world' ? '2px solid #fde047' : '2px solid #38bdf8',
                borderRight: viewMode === 'world' ? '2px solid #fde047' : '2px solid #38bdf8',
                borderBottom: viewMode === 'world' ? '4px solid #78350f' : '4px solid #082f49',
                boxShadow:
                  viewMode === 'world'
                    ? '0 4px 16px rgba(250, 204, 21, 0.45), 0 0 12px rgba(56, 189, 248, 0.3)'
                    : '0 4px 14px rgba(56, 189, 248, 0.45)',
                color: '#fff',
                cursor: 'pointer',
                touchAction: 'manipulation',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: viewMode === 'world' ? 'flex-end' : 'center',
                gap: '1px',
                padding: '3px 2px',
                transform: isCastlePressed ? 'scale(0.89) translateY(2px)' : undefined,
                transition: 'transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
              }}
              title={
                viewMode === 'world'
                  ? 'Enter Inside Kingdom (3D Citadel Courtyard)'
                  : 'Return to World Map'
              }
            >
              {/* Clipped Artwork, Scrim & Golden Ripple Layer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '9px',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                {viewMode === 'world' && (
                  <>
                    <img
                      src={CASTLE_EMBLEM_SRC}
                      alt="Castle Inside"
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 42%',
                        display: 'block',
                        transform: isCastlePressed ? 'scale(1.08)' : 'scale(1.03)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                    {/* Bottom Contrast Scrim for Sharp Label Readability */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(6,10,18,0.02) 0%, rgba(6,10,18,0.18) 46%, rgba(6,10,18,0.92) 100%)',
                      }}
                    />
                  </>
                )}

                {/* Expanding Golden & Cyan Ripple Wave on Tap/Click */}
                {castleBurst && (
                  <span
                    key={`rip-${castleBurst.id}`}
                    style={{
                      position: 'absolute',
                      left: `${castleBurst.xPct}%`,
                      top: `${castleBurst.yPct}%`,
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      borderTop: '2.5px solid #fef08a',
                      borderLeft: '2.5px solid #fef08a',
                      borderRight: '2.5px solid #fef08a',
                      borderBottom: '2.5px solid #fef08a',
                      background:
                        'radial-gradient(circle, rgba(254, 240, 138, 0.55) 0%, rgba(56, 189, 248, 0.35) 55%, transparent 75%)',
                      animation: 'hudGoldRipple 0.58s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    }}
                  />
                )}
              </div>

              {/* Radial Cyan & Gold Rune Sparkle Burst Outside Button Frame */}
              {castleBurst && (
                <div
                  key={`spk-${castleBurst.id}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 6,
                  }}
                >
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, idx) => {
                    const rad = (deg * Math.PI) / 180;
                    const dist = idx % 2 === 0 ? 34 : 26;
                    const tx = Math.round(Math.cos(rad) * dist);
                    const ty = Math.round(Math.sin(rad) * dist);
                    const isCyan = idx % 2 === 1;
                    return (
                      <span
                        key={deg}
                        style={
                          {
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: isCyan ? '6px' : '7px',
                            height: isCyan ? '6px' : '7px',
                            borderRadius: '50%',
                            background: isCyan ? '#38bdf8' : '#fef08a',
                            boxShadow: isCyan
                              ? '0 0 8px #38bdf8, 0 0 14px #0ea5e9'
                              : '0 0 8px #fde047, 0 0 14px #f59e0b',
                            '--spark-tx': `${tx}px`,
                            '--spark-ty': `${ty}px`,
                            animation: 'runeSparkFly 0.52s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                          } as React.CSSProperties
                        }
                      />
                    );
                  })}
                </div>
              )}

              {viewMode === 'kingdom' && (
                <span style={{ fontSize: '20px', lineHeight: 1, position: 'relative', zIndex: 2 }}>
                  🌍
                </span>
              )}
              <span
                style={{
                  position: 'relative',
                  zIndex: 2,
                  font: "900 10.5px 'Barlow Condensed', sans-serif",
                  color: '#fef08a',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.9)',
                }}
              >
                {viewMode === 'world' ? 'CASTLE' : 'WORLD'}
              </span>
              <span
                style={{
                  position: 'relative',
                  zIndex: 2,
                  font: "800 7.5px 'Barlow Condensed', sans-serif",
                  color: viewMode === 'world' ? '#7dd3fc' : '#bae6fd',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                  marginBottom: viewMode === 'world' ? '1px' : 0,
                }}
              >
                {viewMode === 'world' ? 'Inside' : 'Map'}
              </span>
            </button>
          );
        })()}
      </div>

      {/* ============================================================ */}
      {/* 5B. RIGHT-SIDE 1x1 BATTALION COMMANDER (ABOVE BOTTOM-RIGHT)  */}
      {/* ============================================================ */}
      {viewMode === 'world' && selectedEntity && (
        <div
          className="bottom-1x1-troop-card"
          style={{
            position: 'absolute',
            right: '14px',
            bottom: '84px',
            width: '295px',
            maxWidth: 'calc(100vw - 28px)',
            zIndex: 65,
            background: 'rgba(10, 16, 26, 0.98)',
            borderTop: '1.5px solid #dfba6e',
            borderLeft: '1.5px solid #dfba6e',
            borderRight: '1.5px solid #dfba6e',
            borderBottom: '4px solid #78350f',
            borderRadius: '12px',
            padding: '9px 12px',
            boxShadow: '0 6px 0 rgba(0, 0, 0, 0.6), 0 16px 36px rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
            pointerEvents: 'auto',
            animation: 'slideUpCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Top Target Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  minWidth: '26px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  borderTop: '1px solid #dfba6e',
                  borderLeft: '1px solid #dfba6e',
                  borderRight: '1px solid #dfba6e',
                  borderBottom: '2.5px solid #78350f',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '14px',
                }}
              >
                {selectedEntity.category === 'monster' ? '🐲' : selectedEntity.category === 'resource' ? '📦' : '🏰'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "700 12.5px 'Barlow Condensed'", color: '#fef08a', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedEntity.name} (Lv.{selectedEntity.level})
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                  {selectedEntity.subtype} · {targetDistanceInfo.dist}m ({targetDistanceInfo.seconds}s march)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {selectedEntity.health !== undefined && (
                <span style={{ fontSize: '9.5px', color: '#f87171', fontWeight: 600 }}>
                  HP: {selectedEntity.health}
                </span>
              )}
              {selectedEntity.yieldAmount !== undefined && (
                <span style={{ fontSize: '9.5px', color: '#86efac', fontWeight: 600 }}>
                  +{selectedEntity.yieldAmount}
                </span>
              )}
              <button
                onClick={onCloseSelection}
                style={{
                  background: 'linear-gradient(180deg, #334155, #1e293b)',
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  borderLeft: '1px solid rgba(255,255,255,0.2)',
                  borderRight: '1px solid rgba(255,255,255,0.2)',
                  borderBottom: '2px solid #0f172a',
                  boxShadow: '0 1.5px 0 #020617',
                  color: '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  lineHeight: 1,
                }}
                title="Close Target"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Center: 1x1 Troop Selection Card with 3D Icons & Quick Carousel */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              borderTop: '1.5px solid #38bdf8',
              borderLeft: '1.5px solid #38bdf8',
              borderRight: '1.5px solid #38bdf8',
              borderBottom: '3.5px solid #0369a1',
              boxShadow: '0 3px 0 #082f49',
              borderRadius: '8px',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Unit Carousel Left 3D Button */}
            <button
              onClick={handlePrevUnit}
              style={{
                width: '24px',
                height: '36px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #334155, #1e293b)',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                borderBottom: '3px solid #0f172a',
                boxShadow: '0 2px 0 #020617',
                color: '#e0f2fe',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                transition: 'all 0.1s ease',
              }}
              title="Previous Unit"
            >
              ◄
            </button>

            {/* 1x1 Unit Avatar 3D Frame & Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #1e3a8a, #0c1838)',
                  borderTop: '2px solid #38bdf8',
                  borderLeft: '2px solid #38bdf8',
                  borderRight: '2px solid #38bdf8',
                  borderBottom: '3.5px solid #0284c7',
                  boxShadow: '0 3px 0 #0369a1, 0 4px 12px rgba(56, 189, 248, 0.4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '20px',
                }}
              >
                {currentUnit.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ font: "700 12px 'Barlow Condensed'", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUnit.name}
                  </span>
                  <span
                    style={{
                      font: "700 7.5px 'Barlow Condensed'",
                      background: currentUnit.tier >= 4 ? '#b45309' : '#334155',
                      borderBottom: '1.5px solid rgba(0,0,0,0.4)',
                      color: currentUnit.tier >= 4 ? '#fef08a' : '#cbd5e1',
                      padding: '1px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    T{currentUnit.tier}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fef08a' }}>
                    {currentUnit.selectedCount}/{currentUnit.maxCount}
                  </span>
                  <span style={{ fontSize: '9px', color: '#38bdf8' }}>
                    ({(currentUnit.selectedCount * currentUnit.powerPerUnit).toLocaleString()} ⚡)
                  </span>
                  <span style={{ fontSize: '8.5px', color: '#64748b' }}>
                    {activeUnitIndex + 1}/12
                  </span>
                </div>
              </div>
            </div>

            {/* Unit Carousel Right 3D Button */}
            <button
              onClick={handleNextUnit}
              style={{
                width: '24px',
                height: '36px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, #334155, #1e293b)',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                borderBottom: '3px solid #0f172a',
                boxShadow: '0 2px 0 #020617',
                color: '#e0f2fe',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                transition: 'all 0.1s ease',
              }}
              title="Next Unit"
            >
              ►
            </button>
          </div>

          {/* 3D Steppers & Presets for active 1x1 unit */}
          <div style={{ display: 'flex', gap: '3.5px', alignItems: 'center' }}>
            <button
              onClick={() => updateActiveUnitCount(-100)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #334155, #1e293b)',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                borderBottom: '2.5px solid #0f172a',
                boxShadow: '0 2px 0 #020617',
                color: '#cbd5e1',
                font: "700 9.5px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              -100
            </button>
            <button
              onClick={() => updateActiveUnitCount(-50)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #334155, #1e293b)',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                borderBottom: '2.5px solid #0f172a',
                boxShadow: '0 2px 0 #020617',
                color: '#cbd5e1',
                font: "700 9.5px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              -50
            </button>
            <button
              onClick={() => updateActiveUnitCount(50)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #0284c7, #0369a1)',
                borderTop: '1px solid #38bdf8',
                borderLeft: '1px solid #38bdf8',
                borderRight: '1px solid #38bdf8',
                borderBottom: '2.5px solid #0c4a6e',
                boxShadow: '0 2px 0 #082f49',
                color: '#e0f2fe',
                font: "700 9.5px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              +50
            </button>
            <button
              onClick={() => updateActiveUnitCount(100)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #0284c7, #0369a1)',
                borderTop: '1px solid #38bdf8',
                borderLeft: '1px solid #38bdf8',
                borderRight: '1px solid #38bdf8',
                borderBottom: '2.5px solid #0c4a6e',
                boxShadow: '0 2px 0 #082f49',
                color: '#e0f2fe',
                font: "700 9.5px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              +100
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setActiveUnitRatio(0.25)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #1e293b, #0f172a)',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                borderBottom: '2px solid #020617',
                boxShadow: '0 1.5px 0 rgba(0,0,0,0.5)',
                color: '#94a3b8',
                font: "700 9px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              25%
            </button>
            <button
              onClick={() => setActiveUnitRatio(0.5)}
              style={{
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #1e293b, #0f172a)',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                borderBottom: '2px solid #020617',
                boxShadow: '0 1.5px 0 rgba(0,0,0,0.5)',
                color: '#94a3b8',
                font: "700 9px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              50%
            </button>
            <button
              onClick={() => setActiveUnitRatio(1.0)}
              style={{
                padding: '2px 7px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #ca8a04, #854d0e)',
                borderTop: '1px solid #facc15',
                borderLeft: '1px solid #facc15',
                borderRight: '1px solid #facc15',
                borderBottom: '2.5px solid #713f12',
                boxShadow: '0 2px 0 #422006',
                color: '#fef08a',
                font: "700 9.5px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              MAX
            </button>
          </div>

          {/* 3D Action Buttons Grid */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
            {selectedEntity.actions.includes('attack') && (
              <button
                onClick={() => {
                  onExecuteAction(selectedEntity, 'attack');
                  onCloseSelection();
                }}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
                  borderTop: '1px solid #f87171',
                  borderLeft: '1px solid #f87171',
                  borderRight: '1px solid #f87171',
                  borderBottom: '3.5px solid #7f1d1d',
                  boxShadow: '0 3px 0 #450a0a, 0 4px 10px rgba(220, 38, 38, 0.35)',
                  color: '#fff',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>⚔️</span>
                <span>ATTACK ({targetDistanceInfo.seconds}s)</span>
              </button>
            )}

            {selectedEntity.actions.includes('mine') && (
              <button
                onClick={() => {
                  onExecuteAction(selectedEntity, 'mine');
                  onCloseSelection();
                }}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #16a34a 0%, #166534 100%)',
                  borderTop: '1px solid #4ade80',
                  borderLeft: '1px solid #4ade80',
                  borderRight: '1px solid #4ade80',
                  borderBottom: '3.5px solid #14532d',
                  boxShadow: '0 3px 0 #052e16, 0 4px 10px rgba(22, 163, 74, 0.35)',
                  color: '#fff',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>⛏️</span>
                <span>MINE ({targetDistanceInfo.seconds}s)</span>
              </button>
            )}

            {selectedEntity.actions.includes('rally') && (
              <button
                onClick={() => {
                  setRallyModalTarget(selectedEntity);
                  onCloseSelection();
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #d97706 0%, #92400e 100%)',
                  borderTop: '1px solid #fbbf24',
                  borderLeft: '1px solid #fbbf24',
                  borderRight: '1px solid #fbbf24',
                  borderBottom: '3.5px solid #78350f',
                  boxShadow: '0 3px 0 #451a03, 0 4px 10px rgba(217, 119, 6, 0.35)',
                  color: '#fff',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>🚩</span>
                <span>RALLY</span>
              </button>
            )}

            {selectedEntity.actions.includes('scout') && (
              <button
                onClick={() => {
                  setScoutModalTarget(selectedEntity);
                  onCloseSelection();
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                  borderTop: '1px solid #38bdf8',
                  borderLeft: '1px solid #38bdf8',
                  borderRight: '1px solid #38bdf8',
                  borderBottom: '3.5px solid #0c4a6e',
                  boxShadow: '0 3px 0 #082f49, 0 4px 10px rgba(2, 132, 199, 0.35)',
                  color: '#fff',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>🦅</span>
                <span>SCOUT</span>
              </button>
            )}

            {selectedEntity.actions.includes('garrison') && (
              <button
                onClick={() => {
                  onExecuteAction(selectedEntity, 'garrison');
                  onCloseSelection();
                }}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #4f46e5 0%, #3730a3 100%)',
                  borderTop: '1px solid #818cf8',
                  borderLeft: '1px solid #818cf8',
                  borderRight: '1px solid #818cf8',
                  borderBottom: '3.5px solid #1e1b4b',
                  boxShadow: '0 3px 0 #1e1b4b, 0 4px 10px rgba(79, 70, 229, 0.35)',
                  color: '#fff',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>🛡️</span>
                <span>GARRISON</span>
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
                  padding: '7px 12px',
                  borderRadius: '7px',
                  background: 'linear-gradient(180deg, #ca8a04 0%, #854d0e 100%)',
                  borderTop: '1px solid #facc15',
                  borderLeft: '1px solid #facc15',
                  borderRight: '1px solid #facc15',
                  borderBottom: '3.5px solid #713f12',
                  boxShadow: '0 3px 0 #422006, 0 4px 10px rgba(202, 138, 4, 0.35)',
                  color: '#fef08a',
                  font: "700 12px 'Barlow Condensed'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.1s ease',
                }}
              >
                <span style={{ fontSize: '14px' }}>🔨</span>
                <span>UPGRADE</span>
              </button>
            )}
          </div>
        </div>
      )}

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
      {/* 7. RADAR TARGET SEARCH PANEL (ANCHORED ABOVE CENTER RADAR)   */}
      {/* ============================================================ */}
      {isRadarOpen && (
        <div
          className="hud-floating-drawer hud-radar-drawer"
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '340px',
            maxWidth: 'calc(100vw - 20px)',
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
            <div style={{ font: "700 13px 'Barlow Condensed'", color: '#fef08a' }}>
              🧭 REALM TARGET RADAR
            </div>
            <button onClick={() => setIsRadarOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {(['all', 'enemies', 'shrines', 'monsters', 'gold', 'iron', 'stone', 'wood', 'farm'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setRadarCategory(cat)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: radarCategory === cat ? '#b45309' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: radarCategory === cat ? '#fef08a' : '#cbd5e1',
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
            {filteredRadarEntities.map((ent) => (
              <div
                key={ent.id}
                onClick={() => {
                  onPanTo(ent.position[0], ent.position[2]);
                  setIsRadarOpen(false);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div>
                  <div
                    style={{
                      font: "700 12px 'Barlow Condensed'",
                      color:
                        ent.category === 'enemy'
                          ? '#fca5a5'
                          : ent.category === 'shrine'
                            ? '#fef08a'
                            : ent.category === 'monster'
                              ? '#f87171'
                              : '#86efac',
                    }}
                  >
                    {ent.name} (Lv.{ent.level})
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                    [X:{Math.round(ent.position[0])}, Y:{Math.round(ent.position[2])}] · {ent.subtype}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>{ent.dist}m</div>
                  <div style={{ fontSize: '9px', color: '#38bdf8' }}>Pan ↗</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. CHAT POPUP (ANCHORED ABOVE BOTTOM-LEFT CHAT BAR)          */}
      {/* ============================================================ */}
      {isChatOpen && (
        <div
          className="hud-floating-drawer hud-chat-drawer"
          style={{
            position: 'absolute',
            bottom: '70px',
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
                onClick={() => setChatChannel('alliance')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: chatChannel === 'alliance' ? '#b45309' : 'transparent',
                  border: 'none',
                  color: chatChannel === 'alliance' ? '#fef08a' : '#94a3b8',
                  font: "700 11px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                Alliance
              </button>
            </div>
            <button onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} style={{ fontSize: '11px', lineHeight: 1.4 }}>
                <span style={{ color: '#94a3b8', fontSize: '9px', marginRight: '4px' }}>[{msg.time}]</span>
                <span style={{ color: '#fef08a', fontWeight: 700, marginRight: '4px' }}>{msg.sender}:</span>
                <span style={{ color: '#e2e8f0' }}>{msg.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send dispatch to realm..."
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

            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fef08a', marginBottom: '4px' }}>
              {scoutModalTarget.name} (Lv.{scoutModalTarget.level})
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
              Sector Coordinates: [{Math.round(scoutModalTarget.position[0])}, {Math.round(scoutModalTarget.position[2])}]
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
      {rallyModalTarget && (
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
          onClick={() => setRallyModalTarget(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#0f172a',
              border: '1px solid #f59e0b',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ font: "700 17px 'Barlow Condensed'", color: '#fef08a' }}>
                🚩 DECLARE ALLIANCE RALLY
              </div>
              <button
                onClick={() => setRallyModalTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '14px' }}>
              Rallying imperial troops against <b>{rallyModalTarget.name}</b>. All alliance members will march in formation from Vanguard Fortress!
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setRallyTimer(mins)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    background: rallyTimer === mins ? '#b45309' : 'rgba(255,255,255,0.05)',
                    border: rallyTimer === mins ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                    color: rallyTimer === mins ? '#fef08a' : '#cbd5e1',
                    font: "700 12px 'Barlow Condensed'",
                    cursor: 'pointer',
                  }}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                onExecuteAction(rallyModalTarget, 'rally');
                setRallyModalTarget(null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #b45309, #78350f)',
                border: '1px solid #f59e0b',
                color: '#fff',
                font: "700 14px 'Barlow Condensed'",
                cursor: 'pointer',
              }}
            >
              🚩 Sound War Horn & Launch Rally
            </button>
          </div>
        </div>
      )}

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
                        onShowToast?.('📱 Himalayan Realms installed on Home Screen!');
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
                  📦 View APK Build & Install Guide
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
                {render3DModelIcon('inventory', 34)}
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
                            ? 'radar'
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
      {/* 13. 3D IMPERIAL & DAILY QUESTS MODAL                         */}
      {/* ============================================================ */}
      {isQuestsOpen && (
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
          onClick={() => setIsQuestsOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '660px',
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '2px solid #38bdf8',
              borderLeft: '2px solid #38bdf8',
              borderRight: '2px solid #38bdf8',
              borderBottom: '5px solid #0c4a6e',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(56,189,248,0.25)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {render3DModelIcon('quests', 34)}
                <div>
                  <h2 style={{ margin: 0, font: "800 20px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.04em' }}>
                    3D IMPERIAL DECREES & REALM QUESTS
                  </h2>
                  <div style={{ fontSize: '11.5px', color: '#7dd3fc' }}>
                    Complete 3D Citadel Merges & Crystal Tower Recon to claim Royal Treasury Rewards
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuestsOpen(false)}
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

            {/* Quest Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setQuestTab('imperial')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  background:
                    questTab === 'imperial'
                      ? 'linear-gradient(180deg, #0284c7, #1e3a8a)'
                      : 'rgba(30, 41, 59, 0.75)',
                  borderTop: questTab === 'imperial' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderLeft: questTab === 'imperial' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderRight: questTab === 'imperial' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderBottom: questTab === 'imperial' ? '3px solid #0c4a6e' : '3px solid #0f172a',
                  color: questTab === 'imperial' ? '#fef08a' : '#cbd5e1',
                  font: "800 12.5px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                👑 Main Imperial Quests
              </button>
              <button
                type="button"
                onClick={() => setQuestTab('daily')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  background:
                    questTab === 'daily'
                      ? 'linear-gradient(180deg, #0284c7, #1e3a8a)'
                      : 'rgba(30, 41, 59, 0.75)',
                  borderTop: questTab === 'daily' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderLeft: questTab === 'daily' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderRight: questTab === 'daily' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  borderBottom: questTab === 'daily' ? '3px solid #0c4a6e' : '3px solid #0f172a',
                  color: questTab === 'daily' ? '#fef08a' : '#cbd5e1',
                  font: "800 12.5px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                ⚔️ Daily Vanguard Tasks
              </button>
            </div>

            {/* Quest List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
              {questsList
                .filter((q) => q.tab === questTab)
                .map((q) => (
                  <div
                    key={q.id}
                    style={{
                      background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      borderTop: q.claimed
                        ? '1px solid rgba(148, 163, 184, 0.25)'
                        : '1.5px solid rgba(56, 189, 248, 0.5)',
                      borderLeft: q.claimed
                        ? '1px solid rgba(148, 163, 184, 0.25)'
                        : '1.5px solid rgba(56, 189, 248, 0.5)',
                      borderRight: q.claimed
                        ? '1px solid rgba(148, 163, 184, 0.25)'
                        : '1.5px solid rgba(56, 189, 248, 0.5)',
                      borderBottom: q.claimed ? '3px solid #1e293b' : '4px solid #0c4a6e',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: q.claimed ? 0.68 : 1,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ font: "800 15px 'Barlow Condensed'", color: '#fef08a' }}>
                          {q.title}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#7dd3fc',
                            fontWeight: 700,
                          }}
                        >
                          {q.progress}/{q.target}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '3px' }}>
                        {q.desc}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '7px', fontSize: '11.5px', fontWeight: 700 }}>
                        <span style={{ color: '#fde047' }}>
                          🪙 +{q.rewardAmount.toLocaleString()} {q.rewardType.toUpperCase()}
                        </span>
                        <span style={{ color: '#c084fc' }}>💎 +{q.secondaryGems} GEMS</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      {!q.claimed ? (
                        <button
                          type="button"
                          onClick={() => handleClaimQuest(q.id)}
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
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🎁 CLAIM REWARD
                        </button>
                      ) : (
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: '7px',
                            background: 'rgba(51, 65, 85, 0.5)',
                            color: '#94a3b8',
                            font: "700 11.5px 'Barlow Condensed'",
                          }}
                        >
                          ✓ CLAIMED
                        </span>
                      )}

                      {q.actionType && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuestsOpen(false);
                            if (q.actionType === 'enter_kingdom' && viewMode === 'world') {
                              onToggleViewMode();
                            } else if (q.actionType === 'open_worldmap') {
                              onOpenStrategicWorldMap();
                            } else if (q.actionType === 'relocate') {
                              onRelocateCastles();
                            } else if (q.actionType === 'filter_3d') {
                              onToggleStrategicFilter(!isStrategicFilterActive);
                            }
                          }}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: 'rgba(14, 116, 144, 0.35)',
                            border: '1px solid #38bdf8',
                            color: '#bae6fd',
                            font: "700 10.5px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          🎯 Go To Objective
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

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
                {render3DModelIcon('mail', 34)}
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
      {/* 15. ALLIANCE HUB, TERRITORY BUFFS & WAR RALLIES MODAL        */}
      {/* ============================================================ */}
      {isAllianceOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            zIndex: 105,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
            pointerEvents: 'auto',
          }}
          onClick={() => setIsAllianceOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '88dvh',
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '2px solid #34d399',
              borderLeft: '2px solid #34d399',
              borderRight: '2px solid #34d399',
              borderBottom: '5px solid #064e3b',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(52,211,153,0.25)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {render3DModelIcon('alliance', 34)}
                <div>
                  <h2 style={{ margin: 0, font: "800 20px 'Barlow Condensed', sans-serif", color: '#a7f3d0', letterSpacing: '0.04em' }}>
                    🛡️ [VGD] HIMALAYAN VANGUARD ALLIANCE
                  </h2>
                  <div style={{ fontSize: '11.5px', color: '#86efac' }}>
                    Territory Control: {allianceTerritoryStats.capturedTotal}/37 Shrines & Congress · Total Power: {allianceTerritoryStats.totalPower.toLocaleString()} ⚡
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllianceOpen(false)}
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

            {/* Alliance Hub Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'overview', label: '👑 Overview & Territory Buffs' },
                  { id: 'members', label: `🏰 Alliance Castles (${allianceMemberCastles.length})` },
                  { id: 'war', label: `⚔️ War Rallies & Targets (${enemyCastles.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAllianceTab(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background:
                      allianceTab === tab.id
                        ? 'linear-gradient(180deg, #059669, #064e3b)'
                        : 'rgba(30, 41, 59, 0.75)',
                    borderTop: allianceTab === tab.id ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                    borderLeft: allianceTab === tab.id ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                    borderRight: allianceTab === tab.id ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                    borderBottom: allianceTab === tab.id ? '3px solid #022c22' : '3px solid #0f172a',
                    color: allianceTab === tab.id ? '#fef08a' : '#cbd5e1',
                    font: "800 12px 'Barlow Condensed', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {allianceTab === 'overview' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <div style={{ background: 'rgba(6, 78, 59, 0.35)', border: '1px solid rgba(52, 211, 153, 0.45)', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#6ee7b7', textTransform: 'uppercase' }}>Congress Sovereign</div>
                      <div style={{ font: "800 18px 'Barlow Condensed'", color: allianceTerritoryStats.hasCongress ? '#fef08a' : '#94a3b8' }}>
                        {allianceTerritoryStats.hasCongress ? '👑 CLAIMED (+20% ALL)' : '⚔️ UNCLAIMED'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(250, 204, 21, 0.35)', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#fde047', textTransform: 'uppercase' }}>Attack Bonus</div>
                      <div style={{ font: "800 18px 'Barlow Condensed'", color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>
                        +{allianceTerritoryStats.attackBuff}% Attack
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{allianceTerritoryStats.aCount}/4 Shrine A Held</div>
                    </div>
                    <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#7dd3fc', textTransform: 'uppercase' }}>March Speed</div>
                      <div style={{ font: "800 18px 'Barlow Condensed'", color: '#bae6fd', fontVariantNumeric: 'tabular-nums' }}>
                        +{allianceTerritoryStats.marchBuff}% Speed
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{allianceTerritoryStats.bCount}/12 Shrine B Held</div>
                    </div>
                    <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(134, 239, 172, 0.35)', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#86efac', textTransform: 'uppercase' }}>Resource Yield</div>
                      <div style={{ font: "800 18px 'Barlow Condensed'", color: '#a7f3d0', fontVariantNumeric: 'tabular-nums' }}>
                        +{allianceTerritoryStats.yieldBuff}% Yield
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{allianceTerritoryStats.cCount}/20 Shrine C Held</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ font: "800 14px 'Barlow Condensed'", color: '#fef08a', marginBottom: '6px' }}>
                      🏰 CONQUEST DIRECTIVE — CONTINENT 1
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      Tap any <b>Shrine (C1–C20, B1–B12, A1–A4)</b>, <b>The Congress</b>, or crimson <b>Enemy Citadel</b> on the 3D map and click <b>ATTACK</b> or <b>RALLY</b> to launch siege arrows and flaming catapult volleys. Conquered Shrines turn emerald-gold and grant continent-wide Alliance buffs!
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllianceOpen(false);
                          onPanTo(800, 800);
                          onShowToast?.('👑 Focused camera on The Congress [800, 800] — Tap to Attack or Rally!');
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          background: 'linear-gradient(180deg, #ca8a04, #854d0e)',
                          borderTop: '1px solid #fef08a',
                          borderLeft: '1px solid #fef08a',
                          borderRight: '1px solid #fef08a',
                          borderBottom: '3px solid #422006',
                          color: '#fef08a',
                          font: "800 12px 'Barlow Condensed'",
                          cursor: 'pointer',
                        }}
                      >
                        👑 Jump to The Congress [800, 800]
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllianceTab('war')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          background: 'linear-gradient(180deg, #dc2626, #991b1b)',
                          borderTop: '1px solid #f87171',
                          borderLeft: '1px solid #f87171',
                          borderRight: '1px solid #f87171',
                          borderBottom: '3px solid #450a0a',
                          color: '#fff',
                          font: "800 12px 'Barlow Condensed'",
                          cursor: 'pointer',
                        }}
                      >
                        ⚔️ View {enemyCastles.length} Enemy Threats
                      </button>
                    </div>
                  </div>
                </>
              )}

              {allianceTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {allianceMemberCastles.map((mc) => (
                    <div
                      key={mc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        background: mc.isMyCastle ? 'rgba(6, 78, 59, 0.35)' : 'rgba(15, 23, 42, 0.85)',
                        border: mc.isMyCastle ? '1px solid #34d399' : '1px solid rgba(56, 189, 248, 0.28)',
                        borderRadius: '9px',
                      }}
                    >
                      <div>
                        <div style={{ font: "800 13.5px 'Barlow Condensed'", color: mc.isMyCastle ? '#fef08a' : '#bae6fd' }}>
                          {mc.isMyCastle ? '👑 ' : '🛡️ '}
                          {mc.allianceTag} {mc.owner} · {mc.name} (Lv.{mc.level})
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                          Coords: [X:{Math.round(mc.position[0])}, Y:{Math.round(mc.position[2])}] · Power: {mc.power.toLocaleString()} ⚡
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAllianceOpen(false);
                            onPanTo(mc.position[0], mc.position[2]);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'rgba(2, 132, 199, 0.35)',
                            border: '1px solid #38bdf8',
                            color: '#e0f2fe',
                            font: "700 11px 'Barlow Condensed'",
                            cursor: 'pointer',
                          }}
                        >
                          Jump 📍
                        </button>
                        {!mc.isMyCastle && (
                          <button
                            type="button"
                            onClick={() => {
                              onGrantReward?.('gold', 250, `Alliance Aid to ${mc.owner}`);
                              onShowToast?.(`🛡️ Sent Vanguard reinforcements to ${mc.owner}! (+250 Alliance Tribute Gold)`);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(5, 150, 105, 0.4)',
                              border: '1px solid #34d399',
                              color: '#a7f3d0',
                              font: "700 11px 'Barlow Condensed'",
                              cursor: 'pointer',
                            }}
                          >
                            Reinforce 🛡️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {allianceTab === 'war' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {enemyCastles.map((ec) => (
                    <div
                      key={ec.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'rgba(69, 10, 10, 0.4)',
                        border: '1px solid rgba(248, 113, 113, 0.5)',
                        borderRadius: '9px',
                      }}
                    >
                      <div>
                        <div style={{ font: "800 14px 'Barlow Condensed'", color: '#fca5a5' }}>
                          ☠️ {ec.allianceTag} {ec.owner} · {ec.name} (Lv.{ec.level})
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#fecaca', fontVariantNumeric: 'tabular-nums' }}>
                          [X:{Math.round(ec.position[0])}, Y:{Math.round(ec.position[2])}] · Power: {ec.power.toLocaleString()} ⚡
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllianceOpen(false);
                          onPanTo(ec.position[0], ec.position[2]);
                          onShowToast?.(`⚔️ Camera locked on enemy ${ec.name} — Tap citadel to Attack or Rally!`);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          background: 'linear-gradient(180deg, #dc2626, #991b1b)',
                          borderTop: '1px solid #f87171',
                          borderLeft: '1px solid #f87171',
                          borderRight: '1px solid #f87171',
                          borderBottom: '3px solid #450a0a',
                          color: '#fff',
                          font: "800 11.5px 'Barlow Condensed'",
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Jump to Attack ⚔️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 16. ANDROID APK BUILD & INSTALL MODAL + OFFLINE INDICATOR    */}
      {/* ============================================================ */}
      {showAndroidModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            zIndex: 112,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
            pointerEvents: 'auto',
          }}
          onClick={() => setShowAndroidModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '2px solid #34d399',
              borderLeft: '2px solid #34d399',
              borderRight: '2px solid #34d399',
              borderBottom: '5px solid #064e3b',
              borderRadius: '14px',
              padding: '18px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(52,211,153,0.25)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={CASTLE_EMBLEM_SRC}
                  alt="App Icon"
                  style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div>
                  <h2 style={{ margin: 0, font: "800 18px 'Barlow Condensed'", color: '#a7f3d0' }}>
                    📲 HIMALAYAN REALMS — ANDROID APP & APK
                  </h2>
                  <div style={{ fontSize: '11px', color: '#86efac' }}>
                    Fullscreen Android PWA + Capacitor Native Android Project
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {isInstallable ? (
              <button
                type="button"
                onClick={async () => {
                  const ok = await installPWA();
                  if (ok) {
                    setShowAndroidModal(false);
                    onShowToast?.('📱 Himalayan Realms added to Android Home Screen!');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '9px',
                  background: 'linear-gradient(180deg, #059669, #065f46)',
                  borderTop: '1.5px solid #34d399',
                  borderLeft: '1.5px solid #34d399',
                  borderRight: '1.5px solid #34d399',
                  borderBottom: '3.5px solid #022c22',
                  color: '#fef08a',
                  font: "800 14px 'Barlow Condensed'",
                  cursor: 'pointer',
                }}
              >
                📲 Install Fullscreen Android App Directly
              </button>
            ) : (
              <div style={{ background: 'rgba(6, 78, 59, 0.3)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#d1fae5', lineHeight: 1.5 }}>
                {isIOS ? (
                  <>
                    <b>Install on iPhone / iPad:</b> Tap <b>Share</b> in Safari and choose <b>Add to Home Screen</b>.
                  </>
                ) : isAndroid ? (
                  <>
                    <b>Install on Android Chrome:</b> Open Chrome menu (⋮) → <b>Add to Home screen</b> → <b>Install</b> for fullscreen app mode with your Castle Crest icon.
                  </>
                ) : (
                  <>
                    <b>Quick Mobile Install:</b> Open this URL in Android Chrome and tap <b>Install App</b> in the browser bar/menu for fullscreen standalone play.
                  </>
                )}
              </div>
            )}

            <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
              <div style={{ font: "800 13px 'Barlow Condensed'", color: '#7dd3fc', marginBottom: '4px' }}>
                📦 COMPILE NATIVE .APK (CAPACITOR ANDROID)
              </div>
              This workspace includes the generated <b>android/</b> Gradle project (with your Castle Crest launcher icons) and a GitHub Actions workflow (<code>build-android-apk.yml</code>). Run locally with Android Studio / JDK 21:
              <pre style={{ margin: '6px 0 0', padding: '7px 9px', background: '#020617', borderRadius: '6px', fontSize: '10.5px', color: '#fef08a', overflowX: 'auto' }}>
                npm run android:apk
              </pre>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px' }}>
                Output APK path: <code>android/app/build/outputs/apk/debug/app-debug.apk</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <div
          style={{
            position: 'fixed',
            bottom: '74px',
            left: '12px',
            zIndex: 80,
            background: 'rgba(180, 83, 9, 0.95)',
            border: '1px solid #fde047',
            borderRadius: '7px',
            padding: '4px 10px',
            color: '#fef08a',
            font: "700 11px 'Barlow Condensed'",
            boxShadow: '0 4px 12px rgba(0,0,0,0.65)',
            pointerEvents: 'none',
          }}
        >
          ● Offline Mode — Cached Realm Active
        </div>
      )}

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
        @media (max-width: 768px) {
          .hud-top-left-stack {
            top: 8px !important;
            left: 8px !important;
            gap: 4px !important;
            max-width: calc(52vw - 10px);
          }
          .hud-profile-card {
            padding: 4px 8px !important;
            gap: 6px !important;
            max-width: 100%;
          }
          .hud-profile-card > div:first-child {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            font-size: 13px !important;
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
          .hud-bottom-left-chat {
            bottom: 8px !important;
            left: 8px !important;
            height: 46px !important;
            padding: 4px 8px !important;
            max-width: 96px !important;
          }
          .hud-bottom-center-radar {
            bottom: 8px !important;
            height: 46px !important;
            min-width: 54px !important;
            padding: 4px 7px !important;
          }
          .hud-bottom-right-dock {
            bottom: 8px !important;
            right: 8px !important;
            padding: 4px 5px !important;
            gap: 3px !important;
          }
          .hud-bottom-right-dock > button {
            width: 35px !important;
            height: 46px !important;
          }
          .hud-castle-corner-btn {
            width: 44px !important;
            height: 48px !important;
          }
          .bottom-1x1-troop-card {
            left: 8px !important;
            right: 8px !important;
            width: auto !important;
            max-width: none !important;
            bottom: 68px !important;
          }
          .hud-floating-drawer {
            left: 8px !important;
            right: 8px !important;
            width: auto !important;
            transform: none !important;
            bottom: 68px !important;
            max-height: 48dvh !important;
          }
          .hud-mail-grid {
            grid-template-columns: 1fr !important;
            max-height: 55dvh;
            overflow-y: auto;
          }
        }
        @media (max-width: 520px) {
          .hud-chat-preview-text {
            display: none;
          }
          .hud-bottom-left-chat {
            width: 44px !important;
            justify-content: center !important;
          }
          .hud-bottom-center-radar {
            left: 25% !important;
            transform: translateX(-50%) !important;
          }
        }
      `}</style>
    </>
  );
};
