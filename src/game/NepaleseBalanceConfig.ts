// ============================================================================
// NepaleseBalanceConfig.ts
// Complete Medieval Nepalese Kingdom Strategy Game Balance, Progression,
// Calculation Formulas, Multi-Class Garrison Defense, & JSON Config Store
// ============================================================================

import { HERO_PORTRAIT_URLS } from './HeroPortraits';

export type TroopClassId = 'infantry' | 'archer' | 'cavalry';
export type TroopLevel = 1 | 2 | 3 | 4 | 5;
export type ResourceKind = 'food' | 'wood' | 'stone' | 'iron' | 'crystal';
export type StructureTierKey = 'shrine_c' | 'shrine_b' | 'shrine_a' | 'congress';
export type HeroSpecialty = 'infantry' | 'archer' | 'cavalry' | 'gather' | 'siege';

export interface NepaleseHeroConfig {
  id: string;
  name: string;
  title: string;
  specialty: HeroSpecialty;
  crestColor: string;
  portraitUrl: string;
  classBonusClass: TroopClassId;
  classAttackPct: number;
  attackPct: number;
  hpPct: number;
  marchPct: number;
  gatherPct: number;
  loadPct: number;
  siegeDamagePct: number;
  lore: string;
}

export const NEPALESE_HEROES: NepaleseHeroConfig[] = [
  {
    id: 'hero_bhimsen_thapa',
    name: 'Bhimsen Thapa',
    title: 'Grand Mukhtiyar Vanguard',
    specialty: 'infantry',
    crestColor: '#34d399',
    portraitUrl: HERO_PORTRAIT_URLS.hero_bhimsen_thapa,
    classBonusClass: 'infantry',
    classAttackPct: 0.18,
    attackPct: 0.08,
    hpPct: 0.12,
    marchPct: 0.05,
    gatherPct: 0.04,
    loadPct: 0.06,
    siegeDamagePct: 0.1,
    lore: 'Supreme Gorkhali statesman-general stiffening Magar shield walls with iron discipline.',
  },
  {
    id: 'hero_bhakti_thapa',
    name: 'Bhakti Thapa',
    title: 'Iron Bastion Marksman',
    specialty: 'archer',
    crestColor: '#38bdf8',
    portraitUrl: HERO_PORTRAIT_URLS.hero_bhakti_thapa,
    classBonusClass: 'archer',
    classAttackPct: 0.22,
    attackPct: 0.1,
    hpPct: 0.06,
    marchPct: 0.06,
    gatherPct: 0.05,
    loadPct: 0.04,
    siegeDamagePct: 0.14,
    lore: 'Fearless ridge commander empowering Limbu longbowmen with lethal armor-piercing volleys.',
  },
  {
    id: 'hero_balbhadra_kunwar',
    name: 'Balbhadra Kunwar',
    title: 'Nalapani Mustang Rider',
    specialty: 'cavalry',
    crestColor: '#f59e0b',
    portraitUrl: HERO_PORTRAIT_URLS.hero_balbhadra_kunwar,
    classBonusClass: 'cavalry',
    classAttackPct: 0.2,
    attackPct: 0.08,
    hpPct: 0.08,
    marchPct: 0.18,
    gatherPct: 0.06,
    loadPct: 0.12,
    siegeDamagePct: 0.12,
    lore: 'Hero of Nalapani leading lightning Thakuri Mustang charges and rapid flanking marches.',
  },
  {
    id: 'hero_yogamaya_devi',
    name: 'Yogamaya Devi',
    title: 'Arun Valley Steward',
    specialty: 'gather',
    crestColor: '#a7f3d0',
    portraitUrl: HERO_PORTRAIT_URLS.hero_yogamaya_devi,
    classBonusClass: 'infantry',
    classAttackPct: 0.06,
    attackPct: 0.04,
    hpPct: 0.08,
    marchPct: 0.1,
    gatherPct: 0.26,
    loadPct: 0.24,
    siegeDamagePct: 0.05,
    lore: 'Revered highland organizer maximizing caravan load capacity and resource harvest speed.',
  },
  {
    id: 'hero_damodar_pande',
    name: 'Damodar Pande',
    title: 'Himalayan Siege Marshal',
    specialty: 'siege',
    crestColor: '#f87171',
    portraitUrl: HERO_PORTRAIT_URLS.hero_damodar_pande,
    classBonusClass: 'archer',
    classAttackPct: 0.12,
    attackPct: 0.15,
    hpPct: 0.1,
    marchPct: 0.08,
    gatherPct: 0.04,
    loadPct: 0.08,
    siegeDamagePct: 0.3,
    lore: 'Master of mountain fortress assaults specializing in incendiary wall-breach artillery.',
  },
];

export function getHeroById(heroId?: string | null): NepaleseHeroConfig | null {
  if (!heroId) return null;
  return NEPALESE_HEROES.find((h) => h.id === heroId) || null;
}

export function getEnemyCastleMaxHp(power: number, level: number): number {
  return Math.max(24000, Math.round(power * 0.32 + level * 450));
}

export interface PlayerResources {
  wood: number;
  stone: number;
  iron: number;
  food: number;
  crystal: number;
  gold: number;
  gems: number;
}

export interface ResourceLevelConfig {
  level: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
  crystal: number;
  difficulty: number;
  requiredTroopCapacity: number;
  respawnSeconds: number;
}

export interface MonsterLevelConfig {
  level: number;
  hp: number;
  attack: number;
  defense: number;
  suggestedReward: number;
  respawnSeconds: number;
  xpReward: number;
}

export interface TroopStatRow {
  level: TroopLevel;
  power: number;
  hp: number;
  attack: number;
  load: number;
  gatheringSpeed: number; // resource units per minute per troop
  marchingSpeed: number; // map tiles per minute
  trainCost: { food: number; wood: number; iron: number; crystal: number };
  trainSecondsPerUnit: number;
}

export interface TroopClassConfig {
  id: TroopClassId;
  name: string;
  cultureTitle: string;
  counters: TroopClassId;
  weakTo: TroopClassId;
  roleSummary: string;
  levels: Record<TroopLevel, TroopStatRow>;
}

export interface ShrineRequirementConfig {
  key: StructureTierKey;
  label: string;
  requiredTroopLevel: TroopLevel;
  requiredInfantry: number;
  requiredArcher: number;
  requiredCavalry: number;
  totalCapacity: number;
  barrierStrength: number;
  buffSummary: string;
}

export interface CongressPrerequisiteConfig {
  shrine_c: number;
  shrine_b: number;
  shrine_a: number;
}

export interface GameBalanceConfig {
  version: number;
  worldUnitsPerTile: number; // 16 world units = 1 tile (200x200 grid on 3200x3200 map)
  simulationTimeScale: number; // Multiplier for real-time marches/gathering/training
  counterDamageBonus: number; // e.g. 0.25 = +25% bonus vs countered class
  hospitalWoundedRatio: number; // e.g. 0.72 = 72% wounded, 28% fallen
  hospitalHealSecondsPerTroop: number;
  maxSimultaneousMarches: number;
  maxShrinesPerAlliance: number;
  congressPrerequisites: CongressPrerequisiteConfig;
  resourceGatheringBonuses: Record<ResourceKind, number>; // e.g. 0.15 = +15%
  resourcesByLevel: ResourceLevelConfig[]; // Lv 1..10
  monstersByLevel: MonsterLevelConfig[]; // Lv 1..10
  troops: Record<TroopClassId, TroopClassConfig>;
  structures: Record<StructureTierKey, ShrineRequirementConfig>;
}

export const BALANCE_STORAGE_KEY = 'nepalese_kingdom_balance_config_v1';
export const KINGDOM_SIM_STORAGE_KEY = 'nepalese_kingdom_sim_state_v3';
export const ALLIANCE_IDENTITY_STORAGE_KEY = 'nepalese_kingdom_alliance_identity_v1';

export interface PlayerAllianceIdentity {
  tag: string; // Strictly 4 uppercase alphanumeric chars
  alias: string; // Strictly 4 space-separated words
}

export const DEFAULT_PLAYER_ALLIANCE: PlayerAllianceIdentity = {
  tag: 'GORK',
  alias: 'Royal Himalayan Mountain Guard',
};

export function normalizeAllianceTag(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  if (cleaned.length === 4) return cleaned;
  return (cleaned + 'GORK').slice(0, 4);
}

export function validateAllianceAlias(raw: string): { valid: boolean; normalized: string; error?: string } {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 4) {
    return {
      valid: false,
      normalized: words.join(' '),
      error: `Alliance alias must be exactly 4 words (currently ${words.length}).`,
    };
  }
  return { valid: true, normalized: words.join(' ') };
}

export function loadAllianceIdentity(): PlayerAllianceIdentity {
  try {
    const raw = localStorage.getItem(ALLIANCE_IDENTITY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_ALLIANCE };
    const parsed = JSON.parse(raw) as Partial<PlayerAllianceIdentity>;
    const tag = parsed.tag ? normalizeAllianceTag(parsed.tag) : DEFAULT_PLAYER_ALLIANCE.tag;
    const aliasCheck = validateAllianceAlias(parsed.alias || '');
    return {
      tag,
      alias: aliasCheck.valid ? aliasCheck.normalized : DEFAULT_PLAYER_ALLIANCE.alias,
    };
  } catch {
    return { ...DEFAULT_PLAYER_ALLIANCE };
  }
}

export function saveAllianceIdentity(identity: PlayerAllianceIdentity): void {
  try {
    localStorage.setItem(ALLIANCE_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Ignore storage quota errors
  }
}

export const DEFAULT_GAME_BALANCE_CONFIG: GameBalanceConfig = {
  version: 1,
  worldUnitsPerTile: 16,
  simulationTimeScale: 12,
  counterDamageBonus: 0.25,
  hospitalWoundedRatio: 0.72,
  hospitalHealSecondsPerTroop: 0.35,
  maxSimultaneousMarches: 3,
  maxShrinesPerAlliance: 5,
  congressPrerequisites: {
    shrine_c: 2,
    shrine_b: 1,
    shrine_a: 1,
  },
  resourceGatheringBonuses: {
    food: 0.15,
    wood: 0.10,
    stone: 0.05,
    iron: 0.0,
    crystal: 0.0,
  },
  resourcesByLevel: [
    { level: 1, food: 5000, wood: 5000, stone: 3000, iron: 1000, crystal: 200, difficulty: 1.0, requiredTroopCapacity: 100, respawnSeconds: 45 },
    { level: 2, food: 8000, wood: 8000, stone: 5000, iron: 2000, crystal: 400, difficulty: 1.05, requiredTroopCapacity: 250, respawnSeconds: 60 },
    { level: 3, food: 12000, wood: 12000, stone: 8000, iron: 3500, crystal: 700, difficulty: 1.1, requiredTroopCapacity: 500, respawnSeconds: 75 },
    { level: 4, food: 18000, wood: 18000, stone: 12000, iron: 5000, crystal: 1000, difficulty: 1.15, requiredTroopCapacity: 900, respawnSeconds: 90 },
    { level: 5, food: 25000, wood: 25000, stone: 17000, iron: 7500, crystal: 1500, difficulty: 1.22, requiredTroopCapacity: 1500, respawnSeconds: 110 },
    { level: 6, food: 35000, wood: 35000, stone: 23000, iron: 10000, crystal: 2000, difficulty: 1.3, requiredTroopCapacity: 2400, respawnSeconds: 135 },
    { level: 7, food: 50000, wood: 50000, stone: 32000, iron: 15000, crystal: 3000, difficulty: 1.4, requiredTroopCapacity: 3600, respawnSeconds: 165 },
    { level: 8, food: 70000, wood: 70000, stone: 45000, iron: 22000, crystal: 4500, difficulty: 1.5, requiredTroopCapacity: 5500, respawnSeconds: 200 },
    { level: 9, food: 100000, wood: 100000, stone: 65000, iron: 30000, crystal: 6500, difficulty: 1.65, requiredTroopCapacity: 8000, respawnSeconds: 240 },
    { level: 10, food: 150000, wood: 150000, stone: 100000, iron: 50000, crystal: 10000, difficulty: 1.85, requiredTroopCapacity: 12000, respawnSeconds: 300 },
  ],
  monstersByLevel: [
    { level: 1, hp: 2000, attack: 100, defense: 50, suggestedReward: 500, respawnSeconds: 45, xpReward: 120 },
    { level: 2, hp: 4000, attack: 180, defense: 100, suggestedReward: 1000, respawnSeconds: 60, xpReward: 240 },
    { level: 3, hp: 7000, attack: 280, defense: 180, suggestedReward: 1800, respawnSeconds: 75, xpReward: 420 },
    { level: 4, hp: 12000, attack: 420, defense: 280, suggestedReward: 2800, respawnSeconds: 90, xpReward: 680 },
    { level: 5, hp: 20000, attack: 650, defense: 450, suggestedReward: 4500, respawnSeconds: 110, xpReward: 1050 },
    { level: 6, hp: 32000, attack: 900, defense: 650, suggestedReward: 7000, respawnSeconds: 135, xpReward: 1600 },
    { level: 7, hp: 50000, attack: 1300, defense: 900, suggestedReward: 10000, respawnSeconds: 160, xpReward: 2400 },
    { level: 8, hp: 75000, attack: 1800, defense: 1300, suggestedReward: 15000, respawnSeconds: 190, xpReward: 3600 },
    { level: 9, hp: 110000, attack: 2500, defense: 1800, suggestedReward: 22000, respawnSeconds: 240, xpReward: 5200 },
    { level: 10, hp: 160000, attack: 3500, defense: 2500, suggestedReward: 35000, respawnSeconds: 300, xpReward: 8000 },
  ],
  troops: {
    infantry: {
      id: 'infantry',
      name: 'Magar Warriors',
      cultureTitle: 'Khukuri Shield Vanguard',
      counters: 'cavalry',
      weakTo: 'archer',
      roleSummary: 'Strong defensive frontline armed with Khukuri, shield, and traditional Nepalese armor. Effective against Cavalry.',
      levels: {
        1: { level: 1, power: 10, hp: 120, attack: 12, load: 20, gatheringSpeed: 1.0, marchingSpeed: 1.0, trainCost: { food: 40, wood: 25, iron: 10, crystal: 0 }, trainSecondsPerUnit: 0.4 },
        2: { level: 2, power: 15, hp: 150, attack: 16, load: 25, gatheringSpeed: 1.2, marchingSpeed: 1.1, trainCost: { food: 65, wood: 40, iron: 20, crystal: 0 }, trainSecondsPerUnit: 0.6 },
        3: { level: 3, power: 22, hp: 190, attack: 21, load: 30, gatheringSpeed: 1.5, marchingSpeed: 1.2, trainCost: { food: 105, wood: 65, iron: 38, crystal: 2 }, trainSecondsPerUnit: 0.9 },
        4: { level: 4, power: 32, hp: 240, attack: 28, load: 36, gatheringSpeed: 1.8, marchingSpeed: 1.3, trainCost: { food: 170, wood: 110, iron: 65, crystal: 6 }, trainSecondsPerUnit: 1.3 },
        5: { level: 5, power: 45, hp: 300, attack: 36, load: 43, gatheringSpeed: 2.2, marchingSpeed: 1.4, trainCost: { food: 280, wood: 180, iron: 110, crystal: 14 }, trainSecondsPerUnit: 1.8 },
      },
    },
    archer: {
      id: 'archer',
      name: 'Limbu Archers',
      cultureTitle: 'Himalayan Bamboo Bowmen',
      counters: 'infantry',
      weakTo: 'cavalry',
      roleSummary: 'Long-range hill bowmen with traditional bow, arrows, and quiver. High attack, effective against Infantry.',
      levels: {
        1: { level: 1, power: 12, hp: 80, attack: 18, load: 15, gatheringSpeed: 1.0, marchingSpeed: 1.1, trainCost: { food: 35, wood: 45, iron: 12, crystal: 0 }, trainSecondsPerUnit: 0.45 },
        2: { level: 2, power: 18, hp: 100, attack: 24, load: 19, gatheringSpeed: 1.2, marchingSpeed: 1.2, trainCost: { food: 55, wood: 75, iron: 22, crystal: 0 }, trainSecondsPerUnit: 0.65 },
        3: { level: 3, power: 27, hp: 125, attack: 32, load: 23, gatheringSpeed: 1.5, marchingSpeed: 1.3, trainCost: { food: 90, wood: 120, iron: 42, crystal: 3 }, trainSecondsPerUnit: 0.95 },
        4: { level: 4, power: 39, hp: 155, attack: 42, load: 28, gatheringSpeed: 1.8, marchingSpeed: 1.4, trainCost: { food: 145, wood: 195, iron: 75, crystal: 8 }, trainSecondsPerUnit: 1.4 },
        5: { level: 5, power: 55, hp: 195, attack: 55, load: 34, gatheringSpeed: 2.2, marchingSpeed: 1.5, trainCost: { food: 240, wood: 310, iron: 125, crystal: 18 }, trainSecondsPerUnit: 1.95 },
      },
    },
    cavalry: {
      id: 'cavalry',
      name: 'Thakuri Cavalry',
      cultureTitle: 'Royal Mustang Lancers',
      counters: 'archer',
      weakTo: 'infantry',
      roleSummary: 'Fast horse-mounted warriors with heavy armor, high marching speed, and superior load capacity. Effective against Archers.',
      levels: {
        1: { level: 1, power: 15, hp: 150, attack: 22, load: 30, gatheringSpeed: 0.8, marchingSpeed: 1.8, trainCost: { food: 65, wood: 35, iron: 25, crystal: 0 }, trainSecondsPerUnit: 0.55 },
        2: { level: 2, power: 23, hp: 190, attack: 30, load: 38, gatheringSpeed: 1.0, marchingSpeed: 2.0, trainCost: { food: 105, wood: 55, iron: 42, crystal: 2 }, trainSecondsPerUnit: 0.8 },
        3: { level: 3, power: 34, hp: 240, attack: 40, load: 48, gatheringSpeed: 1.2, marchingSpeed: 2.2, trainCost: { food: 170, wood: 90, iron: 70, crystal: 5 }, trainSecondsPerUnit: 1.15 },
        4: { level: 4, power: 49, hp: 300, attack: 53, load: 60, gatheringSpeed: 1.5, marchingSpeed: 2.4, trainCost: { food: 270, wood: 145, iron: 115, crystal: 12 }, trainSecondsPerUnit: 1.65 },
        5: { level: 5, power: 70, hp: 380, attack: 70, load: 75, gatheringSpeed: 1.8, marchingSpeed: 2.7, trainCost: { food: 430, wood: 230, iron: 185, crystal: 24 }, trainSecondsPerUnit: 2.3 },
      },
    },
  },
  structures: {
    shrine_c: {
      key: 'shrine_c',
      label: 'C Shrine (Level 1)',
      requiredTroopLevel: 1,
      requiredInfantry: 500,
      requiredArcher: 300,
      requiredCavalry: 200,
      totalCapacity: 1000,
      barrierStrength: 15000,
      buffSummary: '+8% Gathering Speed & Frontier Ward',
    },
    shrine_b: {
      key: 'shrine_b',
      label: 'B Shrine (Level 3)',
      requiredTroopLevel: 3,
      requiredInfantry: 1500,
      requiredArcher: 1000,
      requiredCavalry: 500,
      totalCapacity: 3000,
      barrierStrength: 65000,
      buffSummary: '+15% Troop Defense & Highland Supply',
    },
    shrine_a: {
      key: 'shrine_a',
      label: 'A Shrine (Level 4)',
      requiredTroopLevel: 4,
      requiredInfantry: 2500,
      requiredArcher: 1500,
      requiredCavalry: 1000,
      totalCapacity: 5000,
      barrierStrength: 150000,
      buffSummary: '+25% Siege Attack & Sanctum Aura',
    },
    congress: {
      key: 'congress',
      label: 'Alliance Congress (Level 4)',
      requiredTroopLevel: 4,
      requiredInfantry: 5000,
      requiredArcher: 3000,
      requiredCavalry: 2000,
      totalCapacity: 10000,
      barrierStrength: 350000,
      buffSummary: 'Alliance-Wide Defense Coordination & Royal Sovereignty',
    },
  },
};

export function cloneDefaultBalanceConfig(): GameBalanceConfig {
  return JSON.parse(JSON.stringify(DEFAULT_GAME_BALANCE_CONFIG)) as GameBalanceConfig;
}

export function loadBalanceConfig(): GameBalanceConfig {
  try {
    const raw = localStorage.getItem(BALANCE_STORAGE_KEY);
    if (!raw) return cloneDefaultBalanceConfig();
    const parsed = JSON.parse(raw) as Partial<GameBalanceConfig>;
    const base = cloneDefaultBalanceConfig();
    return {
      ...base,
      ...parsed,
      maxShrinesPerAlliance:
        typeof parsed.maxShrinesPerAlliance === 'number' && parsed.maxShrinesPerAlliance >= 4
          ? parsed.maxShrinesPerAlliance
          : base.maxShrinesPerAlliance,
      congressPrerequisites: {
        ...base.congressPrerequisites,
        ...(parsed.congressPrerequisites || {}),
      },
      resourceGatheringBonuses: {
        ...base.resourceGatheringBonuses,
        ...(parsed.resourceGatheringBonuses || {}),
      },
      resourcesByLevel: Array.isArray(parsed.resourcesByLevel) && parsed.resourcesByLevel.length === 10
        ? parsed.resourcesByLevel
        : base.resourcesByLevel,
      monstersByLevel: Array.isArray(parsed.monstersByLevel) && parsed.monstersByLevel.length === 10
        ? parsed.monstersByLevel
        : base.monstersByLevel,
      troops: parsed.troops ? { ...base.troops, ...parsed.troops } : base.troops,
      structures: parsed.structures ? { ...base.structures, ...parsed.structures } : base.structures,
    };
  } catch {
    return cloneDefaultBalanceConfig();
  }
}

export function saveBalanceConfig(config: GameBalanceConfig): void {
  try {
    localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetBalanceConfig(): GameBalanceConfig {
  const def = cloneDefaultBalanceConfig();
  saveBalanceConfig(def);
  return def;
}

// ============================================================================
// Barracks Roster, Research, Equipment, Garrisons & Marches Models
// ============================================================================

export type TroopInventory = Record<TroopClassId, Record<TroopLevel, number>>;

export interface TroopStack {
  classId: TroopClassId;
  level: TroopLevel;
  count: number;
}

export interface ResearchState {
  martialArts: number; // +4% attack per level (max 10)
  mountainLogistics: number; // +5% march speed & +4% load per level (max 10)
  alpineAgronomy: number; // +6% gathering speed per level (max 10)
  fortressMedicine: number; // +5% HP & +5% hospital recovery speed (max 10)
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'mount' | 'relic';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  attackPct: number;
  hpPct: number;
  marchPct: number;
  gatherPct: number;
  loadPct: number;
  description: string;
}

export interface CalculatedBonuses {
  attackMult: number;
  hpMult: number;
  powerMult: number;
  loadMult: number;
  gatherMult: number;
  marchMult: number;
  healSpeedMult: number;
  siegeDamageMult: number;
  classAttackMults: Record<TroopClassId, number>;
}

export interface ArmyMetrics {
  totalCount: number;
  totalPower: number;
  totalHp: number;
  totalAttack: number;
  totalLoad: number;
  baseGatheringSpeedPerMin: number;
  marchSpeedTilesPerMin: number;
  byClass: Record<TroopClassId, { count: number; power: number; hp: number; attack: number; load: number }>;
  highestTroopLevel: TroopLevel;
  recommendedMonsterRange: [number, number];
}

export interface TrainingQueueItem {
  id: string;
  classId: TroopClassId;
  level: TroopLevel;
  count: number;
  startedAt: number;
  completesAt: number;
}

export interface HospitalQueueItem {
  id: string;
  classId: TroopClassId;
  level: TroopLevel;
  count: number;
  startedAt: number;
  completesAt: number;
}

export interface ShrineGarrisonState {
  structureId: string;
  structureKey: StructureTierKey;
  name: string;
  ownerFaction: 'neutral' | 'enemy' | 'alliance';
  barrierActive: boolean;
  barrierHp: number;
  maxBarrierHp: number;
  playerStacks: TroopStack[];
  allianceReinforcements: TroopStack[];
  lastBattleSummary?: string;
}

export interface BattleReport {
  id: string;
  timestamp: number;
  kind: 'monster' | 'shrine' | 'congress' | 'castle';
  targetId: string;
  targetName: string;
  targetLevel: number;
  heroId?: string;
  heroName?: string;
  victory: boolean;
  rounds: number;
  targetRemainingHp: number;
  targetMaxHp: number;
  deployedCount: number;
  woundedByClass: Record<TroopClassId, number>;
  lostByClass: Record<TroopClassId, number>;
  survivingByClass: Record<TroopClassId, number>;
  rewards: Partial<PlayerResources> & { xp?: number; equipmentDrop?: EquipmentItem | null };
  notes: string[];
}

export interface ActiveMarch {
  id: string;
  kind: 'gather' | 'attack_monster' | 'attack_castle' | 'reinforce_structure';
  targetId: string;
  targetName: string;
  targetLevel: number;
  targetPosition: [number, number, number];
  targetSubtype?: string;
  isRally?: boolean;
  rallyCaptains?: string[];
  rallyBonusPower?: number;
  alliedOrigins?: Array<{ name: string; position: [number, number, number] }>;
  resourceType?: ResourceKind;
  heroId?: string;
  heroName?: string;
  stacks: TroopStack[];
  status: 'marching' | 'gathering' | 'returning';
  distanceTiles: number;
  marchSpeedTilesPerMin: number;
  formulaMarchMinutes: number;
  gatherSpeedPerMin: number;
  maxCarryLoad: number;
  carriedAmount: number;
  phaseStartedAt: number;
  phaseDurationMs: number;
  lastTickAt: number;
}

export const INITIAL_EQUIPMENT_CATALOG: EquipmentItem[] = [
  {
    id: 'eq_khukuri_steel',
    name: 'Gorkha Sirupate Khukuri',
    slot: 'weapon',
    rarity: 'rare',
    attackPct: 0.08,
    hpPct: 0.02,
    marchPct: 0,
    gatherPct: 0,
    loadPct: 0,
    description: 'Hand-forged curved Nepalese blade boosting vanguard attack power.',
  },
  {
    id: 'eq_limbu_bow',
    name: 'Kanchenjunga Yew Warbow',
    slot: 'weapon',
    rarity: 'epic',
    attackPct: 0.14,
    hpPct: 0,
    marchPct: 0.04,
    gatherPct: 0,
    loadPct: 0,
    description: 'Sacred eastern highland longbow prized by Limbu marksmen.',
  },
  {
    id: 'eq_lamellar_coat',
    name: 'Malla Brass Lamellar Cuirass',
    slot: 'armor',
    rarity: 'rare',
    attackPct: 0,
    hpPct: 0.10,
    marchPct: 0,
    gatherPct: 0,
    loadPct: 0.04,
    description: 'Layered mountain bronze plates absorbing heavy monster strikes.',
  },
  {
    id: 'eq_mustang_saddle',
    name: 'Thakuri Mustang War Saddle',
    slot: 'mount',
    rarity: 'epic',
    attackPct: 0.04,
    hpPct: 0.04,
    marchPct: 0.14,
    gatherPct: 0.05,
    loadPct: 0.15,
    description: 'Reinforced pack-and-charge tack increasing march speed and cargo load.',
  },
  {
    id: 'eq_crystal_talisman',
    name: 'Sagarmatha Crystal Talisman',
    slot: 'relic',
    rarity: 'legendary',
    attackPct: 0.08,
    hpPct: 0.08,
    marchPct: 0.08,
    gatherPct: 0.18,
    loadPct: 0.12,
    description: 'Resonant Himalayan blue crystal maximizing resource extraction and stamina.',
  },
];

export function createInitialTroopInventory(): TroopInventory {
  return {
    infantry: { 1: 950, 2: 320, 3: 1850, 4: 5800, 5: 250 },
    archer: { 1: 600, 2: 240, 3: 1200, 4: 3400, 5: 180 },
    cavalry: { 1: 420, 2: 160, 3: 680, 4: 2300, 5: 120 },
  };
}

export function createEmptyTroopInventory(): TroopInventory {
  return {
    infantry: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    archer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    cavalry: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

// ============================================================================
// Magar Infantry Lv.1–5 Khukuri, Wooden Shield & Armor Progression Engine
// ============================================================================

export type InfantryGearSlot = 'weapon' | 'shield' | 'armor';

export interface InfantryTierGearRank {
  weapon: number; // 0..3 Khukuri Forge Rank
  shield: number; // 0..3 Wooden Shield Reinforcement Rank
  armor: number;  // 0..3 Armor Plating Rank
}

export type InfantryGearState = Record<TroopLevel, InfantryTierGearRank>;

export const MAX_INFANTRY_GEAR_RANK = 3;

export interface MagarTierSpec {
  level: TroopLevel;
  tierName: string;
  weaponName: string;
  shieldName: string;
  armorName: string;
  rarityColor: string;
  loreNote: string;
}

export const MAGAR_PROGRESSION_SPECS: Record<TroopLevel, MagarTierSpec> = {
  1: {
    level: 1,
    tierName: 'Militia',
    weaponName: 'Khukuri (Plain)',
    shieldName: 'Wooden Shield (Basic)',
    armorName: 'Armor: Cloth',
    rarityColor: '#94a3b8',
    loreNote: 'Frontier mountain levy armed with plain forged Khukuri, oak buckler, and woven dhaka cloth.',
  },
  2: {
    level: 2,
    tierName: 'Warrior',
    weaponName: 'Khukuri (Improved)',
    shieldName: 'Wooden Shield (Reinforced)',
    armorName: 'Armor: Leather',
    rarityColor: '#34d399',
    loreNote: 'Seasoned highland infantry with brass-riveted shield straps and cured yak-leather cuirass.',
  },
  3: {
    level: 3,
    tierName: 'Veteran',
    weaponName: 'Khukuri (Forged)',
    shieldName: 'Wooden Shield (Decorated)',
    armorName: 'Armor: Scale',
    rarityColor: '#38bdf8',
    loreNote: 'Battle-tested vanguard wearing overlapping iron scales with gilded brass Khukuri fuller.',
  },
  4: {
    level: 4,
    tierName: 'Elite',
    weaponName: 'Khukuri (Tempered)',
    shieldName: 'Wooden Shield (Elite)',
    armorName: 'Armor: Lamellar',
    rarityColor: '#c084fc',
    loreNote: 'Plumed royal guard clad in gilded lamellar plates and eight-pointed star buckler.',
  },
  5: {
    level: 5,
    tierName: 'Champion',
    weaponName: 'Khukuri (Masterwork)',
    shieldName: 'Wooden Shield (Legendary)',
    armorName: 'Armor: Royal',
    rarityColor: '#facc15',
    loreNote: 'Supreme Himalayan paladin with sunburst golden buckler, fur-lined royal plate, and masterwork blade.',
  },
};

export function createInitialInfantryGear(): InfantryGearState {
  return {
    1: { weapon: 0, shield: 0, armor: 0 },
    2: { weapon: 0, shield: 0, armor: 0 },
    3: { weapon: 0, shield: 0, armor: 0 },
    4: { weapon: 0, shield: 0, armor: 0 },
    5: { weapon: 0, shield: 0, armor: 0 },
  };
}

export function normalizeInfantryGear(raw?: Partial<Record<TroopLevel, Partial<InfantryTierGearRank>>> | null): InfantryGearState {
  const base = createInitialInfantryGear();
  if (!raw) return base;
  for (const lv of [1, 2, 3, 4, 5] as TroopLevel[]) {
    const row = raw[lv];
    if (row) {
      base[lv] = {
        weapon: Math.max(0, Math.min(MAX_INFANTRY_GEAR_RANK, Math.round(row.weapon || 0))),
        shield: Math.max(0, Math.min(MAX_INFANTRY_GEAR_RANK, Math.round(row.shield || 0))),
        armor: Math.max(0, Math.min(MAX_INFANTRY_GEAR_RANK, Math.round(row.armor || 0))),
      };
    }
  }
  return base;
}

export function getInfantryGearUpgradeCost(
  level: TroopLevel,
  slot: InfantryGearSlot,
  currentRank: number
): { wood: number; iron: number; gold: number; crystal: number } | null {
  if (currentRank >= MAX_INFANTRY_GEAR_RANK) return null;
  const nextRank = currentRank + 1;
  const tierFactor = level * nextRank;
  const woodMult = slot === 'shield' ? 1.35 : slot === 'armor' ? 0.9 : 0.75;
  const ironMult = slot === 'weapon' ? 1.35 : slot === 'armor' ? 1.15 : 0.7;
  return {
    wood: Math.round(650 * tierFactor * woodMult),
    iron: Math.round(520 * tierFactor * ironMult),
    gold: Math.round(450 * tierFactor),
    crystal: level >= 3 ? (level - 2) * 35 * nextRank : 0,
  };
}

export function getInfantryTierMultipliers(
  level: TroopLevel,
  infantryGear?: InfantryGearState | null
): { atkMult: number; hpMult: number; shieldMitigationPct: number; powerMult: number } {
  const ranks = infantryGear?.[level];
  if (!ranks) {
    return { atkMult: 1, hpMult: 1, shieldMitigationPct: 0, powerMult: 1 };
  }
  const atkMult = 1 + ranks.weapon * 0.06; // +6% per Khukuri rank (up to +18%)
  const shieldMitigationPct = ranks.shield * 0.05; // +5% incoming damage reduction & defense resilience per Shield rank
  const hpMult = 1 + ranks.armor * 0.06 + ranks.shield * 0.03; // +6% HP per Armor + 3% resilience per Shield
  const powerMult = 1 + (ranks.weapon * 0.06 + ranks.shield * 0.05 + ranks.armor * 0.06) * 0.55;
  return { atkMult, hpMult, shieldMitigationPct, powerMult };
}

export function getCalculatedBonuses(
  research: ResearchState,
  equippedIds: string[],
  catalog: EquipmentItem[],
  hero?: NepaleseHeroConfig | null
): CalculatedBonuses {
  let attackBonus = research.martialArts * 0.04;
  let hpBonus = research.fortressMedicine * 0.05;
  let loadBonus = research.mountainLogistics * 0.04;
  let gatherBonus = research.alpineAgronomy * 0.06;
  let marchBonus = research.mountainLogistics * 0.05;
  const healBonus = research.fortressMedicine * 0.05;
  let siegeBonus = 0;

  const classAttackMults: Record<TroopClassId, number> = {
    infantry: 1,
    archer: 1,
    cavalry: 1,
  };

  for (const eq of catalog) {
    if (!equippedIds.includes(eq.id)) continue;
    attackBonus += eq.attackPct;
    hpBonus += eq.hpPct;
    loadBonus += eq.loadPct;
    gatherBonus += eq.gatherPct;
    marchBonus += eq.marchPct;
  }

  if (hero) {
    attackBonus += hero.attackPct;
    hpBonus += hero.hpPct;
    loadBonus += hero.loadPct;
    gatherBonus += hero.gatherPct;
    marchBonus += hero.marchPct;
    siegeBonus += hero.siegeDamagePct;
    classAttackMults[hero.classBonusClass] += hero.classAttackPct;
  }

  return {
    attackMult: 1 + attackBonus,
    hpMult: 1 + hpBonus,
    powerMult: 1 + (attackBonus + hpBonus) * 0.5,
    loadMult: 1 + loadBonus,
    gatherMult: 1 + gatherBonus,
    marchMult: 1 + marchBonus,
    healSpeedMult: 1 + healBonus,
    siegeDamageMult: 1 + siegeBonus,
    classAttackMults,
  };
}

export function getRecommendedMonsterBand(level: TroopLevel): [number, number] {
  switch (level) {
    case 1:
      return [1, 2];
    case 2:
      return [2, 3];
    case 3:
      return [3, 5];
    case 4:
      return [5, 7];
    case 5:
      return [7, 10];
  }
}

/**
 * Computes exact Power, HP, Attack, Load, Gathering Speed, and Marching Speed
 * for any combination of Nepalese troops (optionally led by a Hero Commander).
 */
export function calculateArmyMetrics(
  stacks: TroopStack[],
  config: GameBalanceConfig,
  bonuses?: CalculatedBonuses,
  hero?: NepaleseHeroConfig | null,
  infantryGear?: InfantryGearState | null
): ArmyMetrics {
  const b: CalculatedBonuses = bonuses || {
    attackMult: 1,
    hpMult: 1,
    powerMult: 1,
    loadMult: 1,
    gatherMult: 1,
    marchMult: 1,
    healSpeedMult: 1,
    siegeDamageMult: 1,
    classAttackMults: { infantry: 1, archer: 1, cavalry: 1 },
  };

  let totalCount = 0;
  let totalPower = 0;
  let totalHp = 0;
  let totalAttack = 0;
  let totalLoad = 0;
  let baseGatheringSpeedPerMin = 0;
  let slowestMarchSpeed = Infinity;
  let highestTroopLevel: TroopLevel = 1;

  const byClass: ArmyMetrics['byClass'] = {
    infantry: { count: 0, power: 0, hp: 0, attack: 0, load: 0 },
    archer: { count: 0, power: 0, hp: 0, attack: 0, load: 0 },
    cavalry: { count: 0, power: 0, hp: 0, attack: 0, load: 0 },
  };

  for (const s of stacks) {
    if (s.count <= 0) continue;
    const row = config.troops[s.classId]?.levels[s.level];
    if (!row) continue;

    if (s.level > highestTroopLevel) highestTroopLevel = s.level;

    const gearMults =
      s.classId === 'infantry'
        ? getInfantryTierMultipliers(s.level, infantryGear)
        : { atkMult: 1, hpMult: 1, shieldMitigationPct: 0, powerMult: 1 };

    const heroClassMult =
      b.classAttackMults?.[s.classId] ??
      (hero && hero.classBonusClass === s.classId ? 1 + hero.classAttackPct : 1);
    const stackPower = row.power * s.count * b.powerMult * (1 + (heroClassMult - 1) * 0.45) * gearMults.powerMult;
    const stackHp = row.hp * s.count * b.hpMult * gearMults.hpMult;
    const stackAtk = row.attack * s.count * b.attackMult * heroClassMult * gearMults.atkMult;
    const stackLoad = row.load * s.count * b.loadMult;
    const stackGather = row.gatheringSpeed * s.count * b.gatherMult;

    totalCount += s.count;
    totalPower += stackPower;
    totalHp += stackHp;
    totalAttack += stackAtk;
    totalLoad += stackLoad;
    baseGatheringSpeedPerMin += stackGather;

    if (row.marchingSpeed < slowestMarchSpeed) {
      slowestMarchSpeed = row.marchingSpeed;
    }

    byClass[s.classId].count += s.count;
    byClass[s.classId].power += stackPower;
    byClass[s.classId].hp += stackHp;
    byClass[s.classId].attack += stackAtk;
    byClass[s.classId].load += stackLoad;
  }

  const marchSpeedTilesPerMin =
    slowestMarchSpeed === Infinity ? 1.0 * b.marchMult : slowestMarchSpeed * b.marchMult;

  return {
    totalCount,
    totalPower: Math.round(totalPower),
    totalHp: Math.round(totalHp),
    totalAttack: Math.round(totalAttack),
    totalLoad: Math.round(totalLoad),
    baseGatheringSpeedPerMin: Number(baseGatheringSpeedPerMin.toFixed(2)),
    marchSpeedTilesPerMin: Number(marchSpeedTilesPerMin.toFixed(2)),
    byClass,
    highestTroopLevel,
    recommendedMonsterRange: getRecommendedMonsterBand(highestTroopLevel),
  };
}

export function calculateMarchTiming(
  fromPos: [number, number, number],
  toPos: [number, number, number],
  marchSpeedTilesPerMin: number,
  config: GameBalanceConfig
): { distanceTiles: number; formulaMinutes: number; realSeconds: number } {
  const worldDist = Math.hypot(toPos[0] - fromPos[0], toPos[2] - fromPos[2]);
  const distanceTiles = Math.max(1, Number((worldDist / config.worldUnitsPerTile).toFixed(1)));
  const safeSpeed = Math.max(0.1, marchSpeedTilesPerMin);
  const formulaMinutes = Number((distanceTiles / safeSpeed).toFixed(2));
  const realSeconds = Math.max(2, Number(((formulaMinutes * 60) / Math.max(1, config.simulationTimeScale)).toFixed(1)));
  return { distanceTiles, formulaMinutes, realSeconds };
}

export function calculateResourceGatherTiming(
  targetAmount: number,
  resourceType: ResourceKind,
  baseGatherSpeedPerMin: number,
  config: GameBalanceConfig
): { effectiveGatherSpeedPerMin: number; formulaMinutes: number; realSeconds: number } {
  const resBonus = config.resourceGatheringBonuses[resourceType] ?? 0;
  const effectiveGatherSpeedPerMin = Math.max(
    0.1,
    Number((baseGatherSpeedPerMin * (1 + resBonus)).toFixed(2))
  );
  const formulaMinutes = Number((targetAmount / effectiveGatherSpeedPerMin).toFixed(2));
  const realSeconds = Math.max(3, Number(((formulaMinutes * 60) / Math.max(1, config.simulationTimeScale)).toFixed(1)));
  return { effectiveGatherSpeedPerMin, formulaMinutes, realSeconds };
}

/**
 * Resolves a battle between a Nepalese mixed army and a Lv 1-10 Monster.
 * Applies Monster HP, Monster Defense mitigation, Monster Attack Damage,
 * troop casualties (split into Wounded for Hospital vs Lost), and loot drops.
 */
export function resolveMonsterCombat(
  stacks: TroopStack[],
  monsterLevel: number,
  monsterCurrentHp: number,
  config: GameBalanceConfig,
  bonuses: CalculatedBonuses,
  rallyOpts?: { isRally?: boolean; alliedColumnCount?: number; monsterSubtype?: string },
  infantryGear?: InfantryGearState | null
): {
  victory: boolean;
  rounds: number;
  monsterRemainingHp: number;
  woundedStacks: TroopStack[];
  lostStacks: TroopStack[];
  survivingStacks: TroopStack[];
  woundedByClass: Record<TroopClassId, number>;
  lostByClass: Record<TroopClassId, number>;
  survivingByClass: Record<TroopClassId, number>;
  rewards: Partial<PlayerResources> & { xp: number; equipmentDrop: EquipmentItem | null };
  notes: string[];
} {
  const mCfg = config.monstersByLevel[Math.max(0, Math.min(9, monsterLevel - 1))];
  let mHp = Math.max(1, monsterCurrentHp);
  const alliedCols = rallyOpts?.isRally ? Math.max(1, rallyOpts.alliedColumnCount ?? 3) : 0;
  const rallyAtkMult = alliedCols > 0 ? 1 + alliedCols * 0.28 : 1;
  const rallyAggroShare = alliedCols > 0 ? 1 / (1 + alliedCols * 0.18) : 1;

  // Clone mutable per-stack HP pool
  const active = stacks
    .filter((s) => s.count > 0)
    .map((s) => {
      const row = config.troops[s.classId].levels[s.level];
      const gearMults =
        s.classId === 'infantry'
          ? getInfantryTierMultipliers(s.level, infantryGear)
          : { atkMult: 1, hpMult: 1, shieldMitigationPct: 0, powerMult: 1 };
      const unitHp = row.hp * bonuses.hpMult * gearMults.hpMult;
      const clsMult = bonuses.classAttackMults?.[s.classId] ?? 1;
      const unitAtk = row.attack * bonuses.attackMult * clsMult * rallyAtkMult * gearMults.atkMult;
      return {
        classId: s.classId,
        level: s.level,
        initialCount: s.count,
        aliveCount: s.count,
        unitHp,
        totalHp: s.count * unitHp,
        unitAtk,
        shieldMitigationPct: gearMults.shieldMitigationPct,
      };
    });

  let rounds = 0;
  const notes: string[] = [];
  if (alliedCols > 0) {
    notes.push(`Alliance Rally active: ${alliedCols} allied march column(s) boosted strike power by +${Math.round((rallyAtkMult - 1) * 100)}%.`);
  }

  while (mHp > 0 && active.some((a) => a.aliveCount > 0) && rounds < 40) {
    rounds++;

    // 1. Player troops + Allied Rally columns attack Monster (mitigated by Monster Defense)
    const rawArmyAtk = active.reduce((sum, a) => sum + a.aliveCount * a.unitAtk, 0);
    const defenseMitigation = 100 / (100 + mCfg.defense * 0.28);
    const dmgToMonster = Math.max(1, Math.round(rawArmyAtk * defenseMitigation));
    mHp = Math.max(0, mHp - dmgToMonster);

    if (mHp <= 0) break;

    // 2. Monster counter-attacks frontline first (Infantry -> Cavalry -> Archer)
    const totalAlive = active.reduce((s, a) => s + a.aliveCount, 0);
    if (totalAlive <= 0) break;

    const counterDmg = mCfg.attack * (0.9 + Math.min(0.35, monsterLevel * 0.03)) * rallyAggroShare;
    const priorityOrder: TroopClassId[] = ['infantry', 'cavalry', 'archer'];
    let remainingIncoming = counterDmg;

    for (const cls of priorityOrder) {
      if (remainingIncoming <= 0) break;
      const clsStacks = active.filter((a) => a.classId === cls && a.aliveCount > 0);
      const clsShare = cls === 'infantry' ? 0.65 : cls === 'cavalry' ? 0.25 : 0.10;
      const dmgAllocated = Math.min(
        remainingIncoming,
        Math.max(remainingIncoming * clsShare, remainingIncoming * 0.5)
      );
      if (clsStacks.length === 0) continue;

      const dmgEachStack = dmgAllocated / clsStacks.length;
      for (const st of clsStacks) {
        const reduced = dmgEachStack * Math.max(0.75, 1 - st.shieldMitigationPct);
        const applied = Math.min(st.totalHp, reduced);
        st.totalHp = Math.max(0, st.totalHp - applied);
        st.aliveCount = Math.ceil(st.totalHp / Math.max(1, st.unitHp));
        remainingIncoming -= dmgEachStack;
      }
    }
  }

  const victory = mHp <= 0;
  const woundedStacks: TroopStack[] = [];
  const lostStacks: TroopStack[] = [];
  const survivingStacks: TroopStack[] = [];
  const woundedByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
  const lostByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
  const survivingByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };

  for (const st of active) {
    const casualties = Math.max(0, st.initialCount - st.aliveCount);
    const wounded = Math.round(casualties * config.hospitalWoundedRatio);
    const lost = Math.max(0, casualties - wounded);

    if (wounded > 0) woundedStacks.push({ classId: st.classId, level: st.level, count: wounded });
    if (lost > 0) lostStacks.push({ classId: st.classId, level: st.level, count: lost });
    if (st.aliveCount > 0) survivingStacks.push({ classId: st.classId, level: st.level, count: st.aliveCount });

    woundedByClass[st.classId] += wounded;
    lostByClass[st.classId] += lost;
    survivingByClass[st.classId] += st.aliveCount;
  }

  let rewards: Partial<PlayerResources> & { xp: number; equipmentDrop: EquipmentItem | null } = {
    xp: 0,
    equipmentDrop: null,
  };

  if (victory) {
    const isGoldenGoblin = rallyOpts?.monsterSubtype === 'goblin';
    const base = mCfg.suggestedReward;
    const crystalAmt = Math.max(15, Math.round(base * (isGoldenGoblin ? 0.065 : 0.04)));
    let equipmentDrop: EquipmentItem | null = null;
    if (monsterLevel >= 3) {
      const dropIdx = Math.min(INITIAL_EQUIPMENT_CATALOG.length - 1, Math.floor((monsterLevel - 3) / 2));
      equipmentDrop = INITIAL_EQUIPMENT_CATALOG[dropIdx];
    }
    rewards = {
      food: Math.round(base * 0.45),
      wood: Math.round(base * 0.40),
      stone: Math.round(base * 0.30),
      iron: Math.round(base * 0.18),
      crystal: crystalAmt,
      gold: Math.round(base * (isGoldenGoblin ? 0.55 : 0.25)),
      xp: mCfg.xpReward,
      equipmentDrop,
    };
    notes.push(
      `${isGoldenGoblin ? 'Golden Goblin treasure bonus yielded extra Gold & Crystals! ' : ''}Monster defeated in ${rounds} tactical round(s) · Defense ${mCfg.defense} absorbed incoming blows.`
    );
  } else {
    notes.push(
      `Defeat after ${rounds} rounds · Monster survived with ${mHp.toLocaleString()} / ${mCfg.hp.toLocaleString()} HP.`
    );
  }

  return {
    victory,
    rounds,
    monsterRemainingHp: mHp,
    woundedStacks,
    lostStacks,
    survivingStacks,
    woundedByClass,
    lostByClass,
    survivingByClass,
    rewards,
    notes,
  };
}

/**
 * Multi-class Garrison Defense Simulation for Shrines C/B/A & Alliance Congress.
 * Guarantees that all 3 troop classes engage together with Rock-Paper-Scissors
 * advantages and if any 1 class reaches 0 troops, the remaining 2 continue fighting.
 */
export function resolveGarrisonDefenseBattle(
  garrisonStacks: TroopStack[],
  attackerStacks: TroopStack[],
  config: GameBalanceConfig,
  bonuses: CalculatedBonuses,
  infantryGear?: InfantryGearState | null
): {
  defenderWon: boolean;
  rounds: number;
  defenderWounded: TroopStack[];
  defenderLost: TroopStack[];
  defenderSurviving: TroopStack[];
  eliminatedClasses: TroopClassId[];
  attackerRemainingCount: number;
  notes: string[];
} {
  type FighterBucket = {
    classId: TroopClassId;
    level: TroopLevel;
    initial: number;
    alive: number;
    hpPool: number;
    unitHp: number;
    unitAtk: number;
  };

  const buildBuckets = (src: TroopStack[], mults: CalculatedBonuses, useGear: boolean): FighterBucket[] =>
    src
      .filter((s) => s.count > 0)
      .map((s) => {
        const row = config.troops[s.classId].levels[s.level];
        const gearMults =
          useGear && s.classId === 'infantry'
            ? getInfantryTierMultipliers(s.level, infantryGear)
            : { atkMult: 1, hpMult: 1, shieldMitigationPct: 0, powerMult: 1 };
        const unitHp = row.hp * mults.hpMult * gearMults.hpMult;
        return {
          classId: s.classId,
          level: s.level,
          initial: s.count,
          alive: s.count,
          hpPool: s.count * unitHp,
          unitHp,
          unitAtk: row.attack * mults.attackMult * gearMults.atkMult,
        };
      });

  const defBuckets = buildBuckets(garrisonStacks, bonuses, true);
  const atkBuckets = buildBuckets(attackerStacks, {
    attackMult: 1,
    hpMult: 1,
    powerMult: 1,
    loadMult: 1,
    gatherMult: 1,
    marchMult: 1,
    healSpeedMult: 1,
    siegeDamageMult: 1,
    classAttackMults: { infantry: 1, archer: 1, cavalry: 1 },
  }, false);

  let rounds = 0;
  const notes: string[] = [];
  const eliminatedSet = new Set<TroopClassId>();

  const computeClassDamage = (attackers: FighterBucket[], defenders: FighterBucket[]): Record<TroopClassId, number> => {
    const out: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
    const aliveDefClasses = (['infantry', 'archer', 'cavalry'] as TroopClassId[]).filter((c) =>
      defenders.some((d) => d.classId === c && d.alive > 0)
    );
    if (aliveDefClasses.length === 0) return out;

    for (const a of attackers) {
      if (a.alive <= 0) continue;
      const totalAtk = a.alive * a.unitAtk;
      const countersCls = config.troops[a.classId].counters;
      const share = totalAtk / aliveDefClasses.length;
      for (const targetCls of aliveDefClasses) {
        const mult = targetCls === countersCls ? 1 + config.counterDamageBonus : 1.0;
        out[targetCls] += share * mult;
      }
    }
    return out;
  };

  const applyDamageByClass = (buckets: FighterBucket[], dmgByClass: Record<TroopClassId, number>) => {
    for (const cls of ['infantry', 'archer', 'cavalry'] as TroopClassId[]) {
      const dmg = dmgByClass[cls];
      if (dmg <= 0) continue;
      const targets = buckets.filter((b) => b.classId === cls && b.alive > 0);
      if (targets.length === 0) continue;
      const perStack = dmg / targets.length;
      for (const t of targets) {
        t.hpPool = Math.max(0, t.hpPool - perStack);
        t.alive = Math.ceil(t.hpPool / Math.max(1, t.unitHp));
      }
    }
  };

  while (
    defBuckets.some((b) => b.alive > 0) &&
    atkBuckets.some((b) => b.alive > 0) &&
    rounds < 35
  ) {
    rounds++;
    const dmgToAtk = computeClassDamage(defBuckets, atkBuckets);
    const dmgToDef = computeClassDamage(atkBuckets, defBuckets);

    applyDamageByClass(atkBuckets, dmgToAtk);
    applyDamageByClass(defBuckets, dmgToDef);

    for (const cls of ['infantry', 'archer', 'cavalry'] as TroopClassId[]) {
      const hadCls = defBuckets.some((b) => b.classId === cls && b.initial > 0);
      const aliveInCls = defBuckets.some((b) => b.classId === cls && b.alive > 0);
      if (hadCls && !aliveInCls && !eliminatedSet.has(cls)) {
        eliminatedSet.add(cls);
        const otherAlive = (['infantry', 'archer', 'cavalry'] as TroopClassId[]).filter(
          (o) => o !== cls && defBuckets.some((b) => b.classId === o && b.alive > 0)
        );
        if (otherAlive.length > 0) {
          notes.push(
            `Round ${rounds}: Garrison ${config.troops[cls].name} eliminated — ${otherAlive
              .map((o) => config.troops[o].name)
              .join(' & ')} continued defending!`
          );
        }
      }
    }
  }

  const defAlive = defBuckets.reduce((s, b) => s + b.alive, 0);
  const atkAlive = atkBuckets.reduce((s, b) => s + b.alive, 0);
  const defenderWon = defAlive > 0 && atkAlive <= 0;

  const defenderWounded: TroopStack[] = [];
  const defenderLost: TroopStack[] = [];
  const defenderSurviving: TroopStack[] = [];

  for (const b of defBuckets) {
    const cas = Math.max(0, b.initial - b.alive);
    const w = Math.round(cas * config.hospitalWoundedRatio);
    const l = Math.max(0, cas - w);
    if (w > 0) defenderWounded.push({ classId: b.classId, level: b.level, count: w });
    if (l > 0) defenderLost.push({ classId: b.classId, level: b.level, count: l });
    if (b.alive > 0) defenderSurviving.push({ classId: b.classId, level: b.level, count: b.alive });
  }

  if (notes.length === 0) {
    notes.push(
      defenderWon
        ? `Garrison repelled the siege in ${rounds} round(s) with all active divisions holding.`
        : `Garrison overwhelmed after ${rounds} round(s).`
    );
  }

  return {
    defenderWon,
    rounds,
    defenderWounded,
    defenderLost,
    defenderSurviving,
    eliminatedClasses: Array.from(eliminatedSet),
    attackerRemainingCount: atkAlive,
    notes,
  };
}

/**
 * Resolves a Hero-led siege strike against an Enemy Citadel.
 * Smaller/mid-sized armies damage & ignite the Enemy Castle over multi-wave sieges
 * (allowing continuous burning VFX), while massive high-tier armies can breach to 0 HP
 * in one assault and trigger random continent teleportation.
 */
export function resolveCastleSiegeCombat(
  stacks: TroopStack[],
  castleLevel: number,
  castleCurrentHp: number,
  castleMaxHp: number,
  castlePower: number,
  config: GameBalanceConfig,
  bonuses: CalculatedBonuses,
  hero?: NepaleseHeroConfig | null,
  infantryGear?: InfantryGearState | null
): {
  breached: boolean;
  rounds: number;
  damageDealt: number;
  castleRemainingHp: number;
  woundedStacks: TroopStack[];
  lostStacks: TroopStack[];
  survivingStacks: TroopStack[];
  woundedByClass: Record<TroopClassId, number>;
  lostByClass: Record<TroopClassId, number>;
  survivingByClass: Record<TroopClassId, number>;
  rewards: Partial<PlayerResources> & { xp: number; equipmentDrop: EquipmentItem | null };
  notes: string[];
} {
  const startHp = Math.max(1, castleCurrentHp);
  let wallHp = startHp;
  const wallDefense = 650 + castleLevel * 55;
  const wallRetaliationAtk = 1400 + castleLevel * 180 + Math.round(castlePower * 0.012);
  const siegeMult = bonuses.siegeDamageMult ?? (hero ? 1 + hero.siegeDamagePct : 1);

  const active = stacks
    .filter((s) => s.count > 0)
    .map((s) => {
      const row = config.troops[s.classId].levels[s.level];
      const gearMults =
        s.classId === 'infantry'
          ? getInfantryTierMultipliers(s.level, infantryGear)
          : { atkMult: 1, hpMult: 1, shieldMitigationPct: 0, powerMult: 1 };
      const unitHp = row.hp * bonuses.hpMult * gearMults.hpMult;
      const clsMult = bonuses.classAttackMults?.[s.classId] ?? 1;
      const unitAtk = row.attack * bonuses.attackMult * clsMult * gearMults.atkMult;
      return {
        classId: s.classId,
        level: s.level,
        initialCount: s.count,
        aliveCount: s.count,
        unitHp,
        totalHp: s.count * unitHp,
        unitAtk,
        shieldMitigationPct: gearMults.shieldMitigationPct,
      };
    });

  let rounds = 0;
  const maxSiegeRounds = 6;
  const notes: string[] = [];

  while (wallHp > 0 && active.some((a) => a.aliveCount > 0) && rounds < maxSiegeRounds) {
    rounds++;
    const rawAtk = active.reduce((sum, a) => sum + a.aliveCount * a.unitAtk, 0);
    const mitigation = 100 / (100 + wallDefense * 0.42);
    const roundDmg = Math.max(250, Math.round(rawAtk * mitigation * siegeMult * 0.55));
    wallHp = Math.max(0, wallHp - roundDmg);

    if (wallHp <= 0) break;

    let incoming = wallRetaliationAtk * (0.72 + Math.min(0.4, rounds * 0.05));
    for (const cls of ['infantry', 'cavalry', 'archer'] as TroopClassId[]) {
      if (incoming <= 0) break;
      const clsStacks = active.filter((a) => a.classId === cls && a.aliveCount > 0);
      if (clsStacks.length === 0) continue;
      const share = cls === 'infantry' ? 0.6 : cls === 'cavalry' ? 0.25 : 0.15;
      const bucketDmg = Math.min(incoming, incoming * Math.max(share, 0.45));
      const eachDmg = bucketDmg / clsStacks.length;
      for (const st of clsStacks) {
        const reduced = eachDmg * Math.max(0.75, 1 - st.shieldMitigationPct);
        const applied = Math.min(st.totalHp, reduced);
        st.totalHp = Math.max(0, st.totalHp - applied);
        st.aliveCount = Math.ceil(st.totalHp / Math.max(1, st.unitHp));
        incoming -= eachDmg;
      }
    }
  }

  const breached = wallHp <= 0;
  const damageDealt = Math.max(0, startHp - wallHp);

  const woundedStacks: TroopStack[] = [];
  const lostStacks: TroopStack[] = [];
  const survivingStacks: TroopStack[] = [];
  const woundedByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
  const lostByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };
  const survivingByClass: Record<TroopClassId, number> = { infantry: 0, archer: 0, cavalry: 0 };

  for (const st of active) {
    const casualties = Math.max(0, st.initialCount - st.aliveCount);
    const wounded = Math.round(casualties * config.hospitalWoundedRatio);
    const lost = Math.max(0, casualties - wounded);
    if (wounded > 0) woundedStacks.push({ classId: st.classId, level: st.level, count: wounded });
    if (lost > 0) lostStacks.push({ classId: st.classId, level: st.level, count: lost });
    if (st.aliveCount > 0) survivingStacks.push({ classId: st.classId, level: st.level, count: st.aliveCount });
    woundedByClass[st.classId] += wounded;
    lostByClass[st.classId] += lost;
    survivingByClass[st.classId] += st.aliveCount;
  }

  const heroPrefix = hero ? `${hero.name} led ` : '';
  const rewards: Partial<PlayerResources> & { xp: number; equipmentDrop: EquipmentItem | null } = breached
    ? {
        gold: 2800 + castleLevel * 180,
        gems: 65 + Math.max(0, castleLevel - 14) * 10,
        food: 4200 + castleLevel * 240,
        wood: 3800 + castleLevel * 220,
        stone: 2600 + castleLevel * 160,
        iron: 1600 + castleLevel * 110,
        crystal: 90 + Math.max(0, castleLevel - 14) * 15,
        xp: 1400 + castleLevel * 90,
        equipmentDrop: castleLevel >= 18 ? INITIAL_EQUIPMENT_CATALOG[4] : null,
      }
    : {
        gold: Math.round(damageDealt * 0.04),
        xp: Math.max(180, Math.round(damageDealt * 0.02)),
        equipmentDrop: null,
      };

  if (breached) {
    notes.push(
      `${heroPrefix}a crushing ${rounds}-round siege, shattering the citadel walls for ${damageDealt.toLocaleString()} siege damage and forcing an emergency random relocation!`
    );
  } else {
    notes.push(
      `${heroPrefix}${rounds} siege volley(s) dealing ${damageDealt.toLocaleString()} wall damage — Enemy Citadel is now burning (${wallHp.toLocaleString()} / ${castleMaxHp.toLocaleString()} HP remaining).`
    );
  }

  return {
    breached,
    rounds,
    damageDealt,
    castleRemainingHp: wallHp,
    woundedStacks,
    lostStacks,
    survivingStacks,
    woundedByClass,
    lostByClass,
    survivingByClass,
    rewards,
    notes,
  };
}

// ============================================================================
// Alliance 5-Shrine Cap & Congress Prerequisite (2C + 1B + 1A) Evaluator
// ============================================================================

export interface AllianceShrineRuleStatus {
  heldByTier: {
    shrine_c: number;
    shrine_b: number;
    shrine_a: number;
    congress: number;
  };
  heldIds: Set<string>;
  totalShrinesHeld: number;
  maxShrinesPerAlliance: number;
  atShrineCap: boolean;
  congressUnlocked: boolean;
  missingForCongress: {
    shrine_c: number;
    shrine_b: number;
    shrine_a: number;
  };
  congressRequirementText: string;
}

export function inferStructureKeyFromId(idOrKey: string): StructureTierKey {
  const lower = idOrKey.toLowerCase();
  if (lower.includes('congress')) return 'congress';
  if (lower.includes('shrine-a') || lower.includes('shrine_a')) return 'shrine_a';
  if (lower.includes('shrine-b') || lower.includes('shrine_b')) return 'shrine_b';
  return 'shrine_c';
}

export function evaluateAllianceShrineRules(
  shrineGarrisons: Record<string, ShrineGarrisonState>,
  conqueredPlots: string[],
  config: GameBalanceConfig
): AllianceShrineRuleStatus {
  const heldIds = new Set<string>();
  const heldByTier = {
    shrine_c: 0,
    shrine_b: 0,
    shrine_a: 0,
    congress: 0,
  };

  const tracked = new Map<string, StructureTierKey>();

  for (const [id, g] of Object.entries(shrineGarrisons)) {
    const hasTroops = g.playerStacks.some((s) => s.count > 0) || g.allianceReinforcements.some((s) => s.count > 0);
    if (g.ownerFaction === 'alliance' || (hasTroops && g.structureKey !== 'congress')) {
      tracked.set(id, g.structureKey || inferStructureKeyFromId(id));
    }
  }

  for (const cid of conqueredPlots) {
    if (!tracked.has(cid)) {
      tracked.set(cid, inferStructureKeyFromId(cid));
    }
  }

  for (const [id, key] of tracked.entries()) {
    heldIds.add(id);
    heldByTier[key]++;
  }

  const totalShrinesHeld = heldByTier.shrine_c + heldByTier.shrine_b + heldByTier.shrine_a;
  const maxShrinesPerAlliance = config.maxShrinesPerAlliance || 5;
  const atShrineCap = totalShrinesHeld >= maxShrinesPerAlliance;

  const reqC = config.congressPrerequisites?.shrine_c ?? 2;
  const reqB = config.congressPrerequisites?.shrine_b ?? 1;
  const reqA = config.congressPrerequisites?.shrine_a ?? 1;

  const missingC = Math.max(0, reqC - heldByTier.shrine_c);
  const missingB = Math.max(0, reqB - heldByTier.shrine_b);
  const missingA = Math.max(0, reqA - heldByTier.shrine_a);
  const congressUnlocked = missingC === 0 && missingB === 0 && missingA === 0;

  const missingParts: string[] = [];
  if (missingC > 0) missingParts.push(`${missingC} C Shrine${missingC > 1 ? 's' : ''}`);
  if (missingB > 0) missingParts.push(`${missingB} B Shrine${missingB > 1 ? 's' : ''}`);
  if (missingA > 0) missingParts.push(`${missingA} A Shrine${missingA > 1 ? 's' : ''}`);

  const congressRequirementText = congressUnlocked
    ? `Unlocked (${heldByTier.shrine_c}/${reqC} C · ${heldByTier.shrine_b}/${reqB} B · ${heldByTier.shrine_a}/${reqA} A)`
    : `Need ${missingParts.join(', ')} (Hold ${reqC}C, ${reqB}B, ${reqA}A Shrines)`;

  return {
    heldByTier,
    heldIds,
    totalShrinesHeld,
    maxShrinesPerAlliance,
    atShrineCap,
    congressUnlocked,
    missingForCongress: {
      shrine_c: missingC,
      shrine_b: missingB,
      shrine_a: missingA,
    },
    congressRequirementText,
  };
}
