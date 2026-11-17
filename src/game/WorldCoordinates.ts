import * as THREE from 'three';

/**
 * WorldCoordinates.ts
 * Shared coordinate system for the Himalayan Realms strategy game.
 * Uses X and Z for horizontal ground placement, and Y for vertical terrain elevation.
 */

export const WORLD_BOUNDS = {
  MIN_X: 0,
  MAX_X: 1600,
  MIN_Z: 0,
  MAX_Z: 1600,
  CENTER_X: 800,
  CENTER_Z: 800,
  PLAYABLE_MARGIN: 60,
} as const;

export type EntityAction = 'attack' | 'rally' | 'scout' | 'mine' | 'garrison' | 'upgrade' | 'inspect';

export interface WorldEntity {
  id: string;
  name: string;
  category: 'building' | 'monster' | 'resource';
  type: string;
  subtype: string;
  level: number;
  position: [number, number, number]; // [x, y, z]
  radius: number;
  health?: number;
  maxHealth?: number;
  yieldAmount?: number;
  resourceType?: 'wood' | 'stone' | 'iron' | 'food' | 'gold';
  power?: number;
  tier?: number;
  description: string;
  actions: EntityAction[];
  isDefeated?: boolean;
  ownerFaction?: 'neutral' | 'enemy' | 'alliance';
  conqueredBy?: string;
  buffLabel?: string;
  faction?: 'my' | 'alliance' | 'enemy';
}

export interface ReservedPlot {
  id: string;
  name: string;
  code?: string;
  type: 'congress' | 'shrine_a' | 'shrine_b' | 'shrine_c' | 'my_castle' | 'alliance_castle';
  position: [number, number, number]; // [x, y, z]
  size: [number, number]; // [width, depth]
  radius: number;
  tier: number;
  starCount?: number;
  owner?: string;
  allianceTag?: string;
  status: 'reserved' | 'built';
  description: string;
}

export interface StrategicDistanceLink {
  fromId: string;
  toId: string;
  label: string;
  color: 'gold' | 'cyan';
}

export interface CastleSpawnData {
  id: string;
  name: string;
  owner: string;
  allianceTag: string;
  isMyCastle: boolean;
  faction?: 'my' | 'alliance' | 'enemy';
  level: number;
  power: number;
  position: [number, number, number];
  radius: number;
  description: string;
}


/**
 * 2x6 Troop Unit Formation Slot Definition
 */
export interface TroopUnit {
  id: string;
  name: string;
  shortName: string;
  category: 'infantry' | 'archer' | 'cavalry' | 'siege' | 'scout' | 'hero';
  tier: number;
  icon: string;
  selectedCount: number;
  maxCount: number;
  powerPerUnit: number;
  speed: number;
  description: string;
}

/**
 * Initial 2x6 (12 unit slots) Vanguard Tactical Formation Roster
 */
export const INITIAL_TROOP_ROSTER: TroopUnit[] = [
  // --- ROW 1: Frontline Assault & Ranged (6 units) ---
  {
    id: 'unit_infantry_1',
    name: 'Gurkha Footmen',
    shortName: 'Footmen',
    category: 'infantry',
    tier: 1,
    icon: '🗡️',
    selectedCount: 450,
    maxCount: 1500,
    powerPerUnit: 12,
    speed: 15,
    description: 'Disciplined hill warriors armed with forged shortswords and wooden shields.',
  },
  {
    id: 'unit_infantry_2',
    name: 'Khukuri Blademen',
    shortName: 'Khukuri',
    category: 'infantry',
    tier: 2,
    icon: '⚔️',
    selectedCount: 300,
    maxCount: 1000,
    powerPerUnit: 24,
    speed: 16,
    description: 'Fearless shock troopers wielding razor-honed curved Nepalese khukuris.',
  },
  {
    id: 'unit_archer_1',
    name: 'Royal Longbowmen',
    shortName: 'Longbow',
    category: 'archer',
    tier: 2,
    icon: '🏹',
    selectedCount: 250,
    maxCount: 800,
    powerPerUnit: 20,
    speed: 14,
    description: 'Pinpoint archers delivering bamboo-shaft volleys from fortified elevations.',
  },
  {
    id: 'unit_archer_2',
    name: 'Himalayan Crossbows',
    shortName: 'Crossbow',
    category: 'archer',
    tier: 3,
    icon: '🎯',
    selectedCount: 180,
    maxCount: 600,
    powerPerUnit: 35,
    speed: 13,
    description: 'Heavy steel crossbowmen firing armor-penetrating bolts into thick hide.',
  },
  {
    id: 'unit_cavalry_1',
    name: 'Highland Yak Lancers',
    shortName: 'Yak Lancer',
    category: 'cavalry',
    tier: 3,
    icon: '🐂',
    selectedCount: 140,
    maxCount: 500,
    powerPerUnit: 48,
    speed: 18,
    description: 'Hardy mountain beast cavalry trampling enemy ranks across steep ridges.',
  },
  {
    id: 'unit_cavalry_2',
    name: 'Iron War Elephant',
    shortName: 'War Elephant',
    category: 'cavalry',
    tier: 4,
    icon: '🐘',
    selectedCount: 40,
    maxCount: 120,
    powerPerUnit: 160,
    speed: 11,
    description: 'Massive armored war elephant carrying an archer howdah and iron tusk spikes.',
  },

  // --- ROW 2: Recon, Mystic, Siege & Royal Vanguard (6 units) ---
  {
    id: 'unit_scout_1',
    name: 'Mountain Falcon Scouts',
    shortName: 'Falconer',
    category: 'scout',
    tier: 1,
    icon: '🦅',
    selectedCount: 80,
    maxCount: 300,
    powerPerUnit: 8,
    speed: 26,
    description: 'Swift aerial recon scouts relaying target intel and hidden mineral veins.',
  },
  {
    id: 'unit_support_1',
    name: 'Tantric Monastery Monks',
    shortName: 'Monks',
    category: 'hero',
    tier: 3,
    icon: '📿',
    selectedCount: 100,
    maxCount: 400,
    powerPerUnit: 42,
    speed: 14,
    description: 'Enlightened martial monks channeling protective mantras and battlefield haste.',
  },
  {
    id: 'unit_siege_1',
    name: 'Iron Battering Ram',
    shortName: 'Ram',
    category: 'siege',
    tier: 2,
    icon: '🪵',
    selectedCount: 25,
    maxCount: 80,
    powerPerUnit: 75,
    speed: 9,
    description: 'Iron-capped timber siege ram built to breach monster dens and stone ramparts.',
  },
  {
    id: 'unit_siege_2',
    name: 'Bronze Catapult',
    shortName: 'Catapult',
    category: 'siege',
    tier: 3,
    icon: '☄️',
    selectedCount: 20,
    maxCount: 60,
    powerPerUnit: 110,
    speed: 8,
    description: 'Tension artillery hurling fiery boulder projectiles across extreme distances.',
  },
  {
    id: 'unit_siege_3',
    name: 'Dragon Fire Trebuchet',
    shortName: 'Trebuchet',
    category: 'siege',
    tier: 4,
    icon: '🔥',
    selectedCount: 12,
    maxCount: 40,
    powerPerUnit: 220,
    speed: 7,
    description: 'Counterweight siege war machine flinging alchemical brimstone casks.',
  },
  {
    id: 'unit_hero_1',
    name: 'Royal Guard Champion',
    shortName: 'Champion',
    category: 'hero',
    tier: 5,
    icon: '👑',
    selectedCount: 1,
    maxCount: 5,
    powerPerUnit: 1200,
    speed: 16,
    description: 'Peerless imperial warlord leading the vanguard with morale-boosting war cries.',
  },
];

/**
 * Surveyed Continent 1 Shrine & Congress Network on 1600 x 1600 Continent:
 * - 1 Central "The Congress" at [800, 10.0, 800]
 * - 4 Shrine A sites (A1–A4) surrounding The Congress
 * - 12 Shrine B sites (B1–B12) forming the mid-tier defensive ring
 * - 20 Shrine C sites (C1–C20) forming the outer 6x6 perimeter lattice
 */
const GRID_COORDS = [220, 452, 684, 916, 1148, 1380] as const;

export const RESERVED_PLOTS: ReservedPlot[] = [
  // =========================================================================
  // 1. CENTRAL THE CONGRESS (Center [800, 10.0, 800])
  // =========================================================================
  {
    id: 'plot-congress-center',
    name: 'The Congress',
    code: 'C',
    type: 'congress',
    position: [800, 10.0, 800],
    size: [48, 48],
    radius: 26,
    tier: 3,
    starCount: 3,
    status: 'built',
    description:
      'The Congress — Supreme Continental Citadel at the heart of Continent 1, fed by the 4 Inner A-Shrines (A1–A4) and crowned with arcane crystal & gold spires.',
  },

  // =========================================================================
  // 2. FOUR INNER SANCTUM SHRINES (Shrine A1–A4)
  // =========================================================================
  {
    id: 'plot-shrine-a1',
    name: 'Shrine A1',
    code: 'A1',
    type: 'shrine_a',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[2]],
    size: [24, 24],
    radius: 13,
    tier: 3,
    starCount: 3,
    status: 'built',
    description: 'High-tier Inner Sanctum Shrine A1 overlooking the northwest approach to The Congress (+25% Siege Attack).',
  },
  {
    id: 'plot-shrine-a2',
    name: 'Shrine A2',
    code: 'A2',
    type: 'shrine_a',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[2]],
    size: [24, 24],
    radius: 13,
    tier: 3,
    starCount: 3,
    status: 'built',
    description: 'High-tier Inner Sanctum Shrine A2 overlooking the northeast approach to The Congress (+25% Cavalry Charge).',
  },
  {
    id: 'plot-shrine-a3',
    name: 'Shrine A3',
    code: 'A3',
    type: 'shrine_a',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[3]],
    size: [24, 24],
    radius: 13,
    tier: 3,
    starCount: 3,
    status: 'built',
    description: 'High-tier Inner Sanctum Shrine A3 overlooking the southwest approach to The Congress (+25% Crystal Defense).',
  },
  {
    id: 'plot-shrine-a4',
    name: 'Shrine A4',
    code: 'A4',
    type: 'shrine_a',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[3]],
    size: [24, 24],
    radius: 13,
    tier: 3,
    starCount: 3,
    status: 'built',
    description: 'High-tier Inner Sanctum Shrine A4 overlooking the southeast approach to The Congress (+25% Royal Recovery).',
  },

  // =========================================================================
  // 3. TWELVE MID-RING SHRINES (Shrine B1–B12)
  // =========================================================================
  {
    id: 'plot-shrine-b1',
    name: 'Shrine B1',
    code: 'B1',
    type: 'shrine_b',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[1]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B1 linking outer C-Shrines C1/C2/C3/C7 toward Shrine A1.',
  },
  {
    id: 'plot-shrine-b2',
    name: 'Shrine B2',
    code: 'B2',
    type: 'shrine_b',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[1]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B2 commanding the northern upper corridor toward Shrines A1 & A2.',
  },
  {
    id: 'plot-shrine-b3',
    name: 'Shrine B3',
    code: 'B3',
    type: 'shrine_b',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[1]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B3 guarding the northeast upper approach toward Shrines A1 & A2.',
  },
  {
    id: 'plot-shrine-b4',
    name: 'Shrine B4',
    code: 'B4',
    type: 'shrine_b',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[1]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B4 linking outer C-Shrines C4/C5/C6/C8 toward Shrine A2.',
  },
  {
    id: 'plot-shrine-b5',
    name: 'Shrine B5',
    code: 'B5',
    type: 'shrine_b',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[2]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B5 anchoring the western upper leyline into Shrines A1 & A3.',
  },
  {
    id: 'plot-shrine-b6',
    name: 'Shrine B6',
    code: 'B6',
    type: 'shrine_b',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[2]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B6 anchoring the eastern upper leyline into Shrines A2 & A4.',
  },
  {
    id: 'plot-shrine-b7',
    name: 'Shrine B7',
    code: 'B7',
    type: 'shrine_b',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[3]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B7 anchoring the western lower leyline into Shrines A1 & A3.',
  },
  {
    id: 'plot-shrine-b8',
    name: 'Shrine B8',
    code: 'B8',
    type: 'shrine_b',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[3]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B8 anchoring the eastern lower leyline into Shrines A2 & A4.',
  },
  {
    id: 'plot-shrine-b9',
    name: 'Shrine B9',
    code: 'B9',
    type: 'shrine_b',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[4]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B9 linking outer C-Shrines C13/C15/C16/C17 toward Shrine A3.',
  },
  {
    id: 'plot-shrine-b10',
    name: 'Shrine B10',
    code: 'B10',
    type: 'shrine_b',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[4]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B10 commanding the southern lower corridor toward Shrines A3 & A4.',
  },
  {
    id: 'plot-shrine-b11',
    name: 'Shrine B11',
    code: 'B11',
    type: 'shrine_b',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[4]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B11 guarding the southeast lower approach toward Shrines A3 & A4.',
  },
  {
    id: 'plot-shrine-b12',
    name: 'Shrine B12',
    code: 'B12',
    type: 'shrine_b',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[4]],
    size: [18, 18],
    radius: 10,
    tier: 2,
    starCount: 2,
    status: 'built',
    description: 'Mid-tier Shrine B12 linking outer C-Shrines C14/C18/C19/C20 toward Shrine A4.',
  },

  // =========================================================================
  // 4. TWENTY OUTER PERIMETER SHRINES (Shrine C1–C20)
  // =========================================================================
  // Top Row (Row 0, Z = 220): C1..C6
  {
    id: 'plot-shrine-c1',
    name: 'Shrine C1',
    code: 'C1',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C1 on the northwest border of Continent 1.',
  },
  {
    id: 'plot-shrine-c2',
    name: 'Shrine C2',
    code: 'C2',
    type: 'shrine_c',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C2 on the upper northern road.',
  },
  {
    id: 'plot-shrine-c3',
    name: 'Shrine C3',
    code: 'C3',
    type: 'shrine_c',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C3 along the northern highlands.',
  },
  {
    id: 'plot-shrine-c4',
    name: 'Shrine C4',
    code: 'C4',
    type: 'shrine_c',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C4 along the north-central border.',
  },
  {
    id: 'plot-shrine-c5',
    name: 'Shrine C5',
    code: 'C5',
    type: 'shrine_c',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C5 commanding the upper northeast trade pass.',
  },
  {
    id: 'plot-shrine-c6',
    name: 'Shrine C6',
    code: 'C6',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[0]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C6 on the northeast corner of Continent 1.',
  },

  // Left & Right Perimeter Columns (Rows 1..4): C7/C8, C9/C10, C11/C12, C13/C14
  {
    id: 'plot-shrine-c7',
    name: 'Shrine C7',
    code: 'C7',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[1]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C7 guarding the upper western ridge.',
  },
  {
    id: 'plot-shrine-c8',
    name: 'Shrine C8',
    code: 'C8',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[1]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C8 guarding the upper eastern ridge.',
  },
  {
    id: 'plot-shrine-c9',
    name: 'Shrine C9',
    code: 'C9',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[2]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C9 on the western valley pass.',
  },
  {
    id: 'plot-shrine-c10',
    name: 'Shrine C10',
    code: 'C10',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[2]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C10 on the eastern valley pass.',
  },
  {
    id: 'plot-shrine-c11',
    name: 'Shrine C11',
    code: 'C11',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[3]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C11 watching the lower western border.',
  },
  {
    id: 'plot-shrine-c12',
    name: 'Shrine C12',
    code: 'C12',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[3]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C12 watching the lower eastern border.',
  },
  {
    id: 'plot-shrine-c13',
    name: 'Shrine C13',
    code: 'C13',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[4]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C13 anchoring the southwest highland gate.',
  },
  {
    id: 'plot-shrine-c14',
    name: 'Shrine C14',
    code: 'C14',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[4]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C14 anchoring the southeast highland gate.',
  },

  // Bottom Row (Row 5, Z = 1380): C15..C20
  {
    id: 'plot-shrine-c15',
    name: 'Shrine C15',
    code: 'C15',
    type: 'shrine_c',
    position: [GRID_COORDS[0], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C15 on the southwest glacial corner of Continent 1.',
  },
  {
    id: 'plot-shrine-c16',
    name: 'Shrine C16',
    code: 'C16',
    type: 'shrine_c',
    position: [GRID_COORDS[1], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C16 guarding the southern mountain approach.',
  },
  {
    id: 'plot-shrine-c17',
    name: 'Shrine C17',
    code: 'C17',
    type: 'shrine_c',
    position: [GRID_COORDS[2], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C17 along the south-west summit ridge.',
  },
  {
    id: 'plot-shrine-c18',
    name: 'Shrine C18',
    code: 'C18',
    type: 'shrine_c',
    position: [GRID_COORDS[3], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C18 along the south-east summit ridge.',
  },
  {
    id: 'plot-shrine-c19',
    name: 'Shrine C19',
    code: 'C19',
    type: 'shrine_c',
    position: [GRID_COORDS[4], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C19 guarding the southeastern rocky pass.',
  },
  {
    id: 'plot-shrine-c20',
    name: 'Shrine C20',
    code: 'C20',
    type: 'shrine_c',
    position: [GRID_COORDS[5], 10.0, GRID_COORDS[5]],
    size: [14, 14],
    radius: 8,
    tier: 1,
    starCount: 1,
    status: 'built',
    description: 'Frontier Shrine C20 on the southeast peak corner of Continent 1.',
  },
];

/**
 * Strategic Progression Road Links matching the WorldMap Lattice:
 * Outer Ring (C1–C20) -> Mid Ring (B1–B12) -> Inner Sanctum (A1–A4) -> The Congress
 */
export const STRATEGIC_DISTANCE_LINKS: StrategicDistanceLink[] = [
  // Top Row C -> Row 1 B
  { fromId: 'plot-shrine-c1', toId: 'plot-shrine-b1', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c2', toId: 'plot-shrine-b1', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c2', toId: 'plot-shrine-b2', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c2', toId: 'plot-shrine-b3', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c3', toId: 'plot-shrine-b1', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c3', toId: 'plot-shrine-b2', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c3', toId: 'plot-shrine-b3', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c4', toId: 'plot-shrine-b2', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c4', toId: 'plot-shrine-b3', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c4', toId: 'plot-shrine-b4', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c5', toId: 'plot-shrine-b2', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c5', toId: 'plot-shrine-b3', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c5', toId: 'plot-shrine-b4', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c6', toId: 'plot-shrine-b4', label: 'Route', color: 'cyan' },

  // Left & Right Column C -> B
  { fromId: 'plot-shrine-c7', toId: 'plot-shrine-b1', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c7', toId: 'plot-shrine-b5', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c9', toId: 'plot-shrine-b5', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c11', toId: 'plot-shrine-b7', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c13', toId: 'plot-shrine-b7', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c13', toId: 'plot-shrine-b9', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c8', toId: 'plot-shrine-b4', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c8', toId: 'plot-shrine-b6', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c10', toId: 'plot-shrine-b6', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c12', toId: 'plot-shrine-b8', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c14', toId: 'plot-shrine-b8', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c14', toId: 'plot-shrine-b12', label: 'Route', color: 'cyan' },

  // Bottom Row C -> Row 4 B
  { fromId: 'plot-shrine-c15', toId: 'plot-shrine-b9', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c16', toId: 'plot-shrine-b9', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c16', toId: 'plot-shrine-b10', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c16', toId: 'plot-shrine-b11', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c17', toId: 'plot-shrine-b9', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c17', toId: 'plot-shrine-b10', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c17', toId: 'plot-shrine-b11', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c18', toId: 'plot-shrine-b10', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c18', toId: 'plot-shrine-b11', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c18', toId: 'plot-shrine-b12', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c19', toId: 'plot-shrine-b10', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c19', toId: 'plot-shrine-b11', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c19', toId: 'plot-shrine-b12', label: 'Route', color: 'cyan' },
  { fromId: 'plot-shrine-c20', toId: 'plot-shrine-b12', label: 'Route', color: 'cyan' },

  // Mid Ring B1–B12 -> Inner Sanctum A1–A4
  { fromId: 'plot-shrine-b1', toId: 'plot-shrine-a1', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b2', toId: 'plot-shrine-a1', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b2', toId: 'plot-shrine-a2', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b3', toId: 'plot-shrine-a1', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b3', toId: 'plot-shrine-a2', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b4', toId: 'plot-shrine-a2', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b5', toId: 'plot-shrine-a1', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b5', toId: 'plot-shrine-a3', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b6', toId: 'plot-shrine-a2', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b6', toId: 'plot-shrine-a4', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b7', toId: 'plot-shrine-a1', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b7', toId: 'plot-shrine-a3', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b8', toId: 'plot-shrine-a2', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b8', toId: 'plot-shrine-a4', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b9', toId: 'plot-shrine-a3', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b10', toId: 'plot-shrine-a3', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b10', toId: 'plot-shrine-a4', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b11', toId: 'plot-shrine-a3', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b11', toId: 'plot-shrine-a4', label: 'Ascend', color: 'cyan' },
  { fromId: 'plot-shrine-b12', toId: 'plot-shrine-a4', label: 'Ascend', color: 'cyan' },

  // Inner Sanctum Square Links + Convergence to The Congress
  { fromId: 'plot-shrine-a1', toId: 'plot-shrine-a2', label: 'Sanctum', color: 'gold' },
  { fromId: 'plot-shrine-a1', toId: 'plot-shrine-a3', label: 'Sanctum', color: 'gold' },
  { fromId: 'plot-shrine-a2', toId: 'plot-shrine-a4', label: 'Sanctum', color: 'gold' },
  { fromId: 'plot-shrine-a3', toId: 'plot-shrine-a4', label: 'Sanctum', color: 'gold' },
  { fromId: 'plot-shrine-a1', toId: 'plot-congress-center', label: 'Imperial', color: 'gold' },
  { fromId: 'plot-shrine-a2', toId: 'plot-congress-center', label: 'Imperial', color: 'gold' },
  { fromId: 'plot-shrine-a3', toId: 'plot-congress-center', label: 'Imperial', color: 'gold' },
  { fromId: 'plot-shrine-a4', toId: 'plot-congress-center', label: 'Imperial', color: 'gold' },
];

const ALLIANCE_COMMANDERS = [
  { name: 'Lady Maya Fortress', owner: 'Lady Maya', level: 19, power: 184000 },
  { name: 'Lord Kazi Keep', owner: 'Lord Kazi', level: 18, power: 162000 },
  { name: 'General Thapa Bastion', owner: 'Gen. Thapa', level: 20, power: 210000 },
  { name: 'Duchess Tara Hold', owner: 'Duchess Tara', level: 17, power: 145000 },
  { name: 'Warlord Gurung Citadel', owner: 'Warlord Gurung', level: 19, power: 178000 },
  { name: 'Captain Sherpa Spire', owner: 'Capt. Sherpa', level: 16, power: 132000 },
  { name: 'Vanguard Bista Keep', owner: 'Commander Bista', level: 18, power: 159000 },
  { name: 'Archmage Rai Sanctuary', owner: 'Archmage Rai', level: 19, power: 191000 },
  { name: 'Sentinel Magar Stronghold', owner: 'Sentinel Magar', level: 17, power: 149000 },
  { name: 'Duke Lama Watch', owner: 'Duke Lama', level: 18, power: 166000 },
];

const ENEMY_COMMANDERS = [
  { name: 'Crimson Khan Citadel', owner: 'Khan Varak', tag: '[CRIM]', level: 18, power: 172000 },
  { name: 'Bloodiron Bastion', owner: 'Warlord Kael', tag: '[CRIM]', level: 16, power: 144000 },
  { name: 'Obsidian Dread Keep', owner: 'Baroness Vex', tag: '[SHDW]', level: 19, power: 194000 },
  { name: 'Ashfang Marauder Hold', owner: 'Raze Ironjaw', tag: '[SHDW]', level: 15, power: 126000 },
  { name: 'Stormpeak Raider Fort', owner: 'Dread Captain Zorn', tag: '[CRIM]', level: 17, power: 158000 },
  { name: 'Shattered Crown Spire', owner: 'Emperor Malakor', tag: '[CRIM]', level: 21, power: 224000 },
];

/**
 * Generates randomized, non-overlapping World Map coordinates across the 1600 x 1600 continent for:
 * - User's "My Castle" (1 castle)
 * - 10 Alliance Member Castles
 * - 6 Rival Enemy Castles
 * Ensures castles never overlap The Congress, any Shrine A/B/C, or each other.
 */
export function generateRandomCastles(getHeightAt?: (x: number, z: number) => number): CastleSpawnData[] {
  const placed: CastleSpawnData[] = [];

  const isPositionValid = (x: number, z: number, minCastleDist = 72): boolean => {
    // Keep away from central The Congress
    if (Math.hypot(x - 800, z - 800) < 88) return false;

    // Keep away from all 36 Shrines & The Congress
    for (const plot of RESERVED_PLOTS) {
      if (Math.hypot(x - plot.position[0], z - plot.position[2]) < plot.radius + 38) {
        return false;
      }
    }

    // Keep away from already placed Castles
    for (const c of placed) {
      if (Math.hypot(x - c.position[0], z - c.position[2]) < minCastleDist) {
        return false;
      }
    }
    return true;
  };

  const pickRandomCoord = (minDistFromCenter: number, maxDistFromCenter: number): [number, number, number] => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDistFromCenter + Math.random() * (maxDistFromCenter - minDistFromCenter);
      const rx = Math.round(800 + Math.cos(angle) * dist);
      const rz = Math.round(800 + Math.sin(angle) * dist);

      if (rx < 120 || rx > 1480 || rz < 120 || rz > 1480) continue;
      if (isPositionValid(rx, rz)) {
        const ry = getHeightAt ? getHeightAt(rx, rz) : 10.0;
        return [rx, ry, rz];
      }
    }
    const fallbackAngle = placed.length * 0.62;
    const fx = Math.round(800 + Math.cos(fallbackAngle) * 340);
    const fz = Math.round(800 + Math.sin(fallbackAngle) * 340);
    const fy = getHeightAt ? getHeightAt(fx, fz) : 10.0;
    return [fx, fy, fz];
  };

  // 1. Spawn User's "My Castle" at a random strategic location (180m - 460m from center)
  const myPos = pickRandomCoord(180, 460);
  placed.push({
    id: 'my-castle',
    name: 'My Castle (Lord Dangol)',
    owner: 'Lord Dangol (You)',
    allianceTag: '[CRYSTAL]',
    isMyCastle: true,
    faction: 'my',
    level: 20,
    power: 245000,
    position: myPos,
    radius: 15.0,
    description:
      'Your Royal Command Castle! All vanguard battalions, mining parties, and alliance rallies deploy from your castle gates. Click to enter your 3D Walled Inside Kingdom!',
  });

  // 2. Spawn 10 Alliance Member Castles across the 1600x1600 continent (210m - 620m from center)
  ALLIANCE_COMMANDERS.forEach((cmd, idx) => {
    const pos = pickRandomCoord(210, 620);
    placed.push({
      id: `alliance-castle-${idx + 1}`,
      name: cmd.name,
      owner: cmd.owner,
      allianceTag: '[CRYSTAL]',
      isMyCastle: false,
      faction: 'alliance',
      level: cmd.level,
      power: cmd.power,
      position: pos,
      radius: 12.5,
      description: `Allied Crystal Vanguard Castle commanded by ${cmd.owner} ([CRYSTAL] Alliance · ${cmd.power.toLocaleString()} Power). Reinforces adjacent Shrines and The Congress.`,
    });
  });

  // 3. Spawn 6 Rival Enemy Castles across contested quadrants (250m - 680m from center)
  ENEMY_COMMANDERS.forEach((cmd, idx) => {
    const pos = pickRandomCoord(250, 680);
    placed.push({
      id: `enemy-castle-${idx + 1}`,
      name: cmd.name,
      owner: cmd.owner,
      allianceTag: cmd.tag,
      isMyCastle: false,
      faction: 'enemy',
      level: cmd.level,
      power: cmd.power,
      position: pos,
      radius: 13.0,
      description: `Hostile ${cmd.tag} War Citadel commanded by ${cmd.owner} (${cmd.power.toLocaleString()} Power). Assault or launch an Alliance Rally to plunder Treasury Gold & Gems!`,
    });
  });

  return placed;
}


/**
 * 16+ Monsters across all 4 Quadrants (Lv 3 to 20)
 */
export const WORLD_MONSTERS: WorldEntity[] = [
  // Quadrant I: Northwest Glaciers
  {
    id: 'm_frost_yeti',
    name: 'Ancient Frost Yeti King',
    category: 'monster',
    type: 'monster',
    subtype: 'boss',
    level: 18,
    position: [300, 22.0, 1360],
    radius: 6.5,
    health: 1200,
    maxHealth: 1200,
    power: 24000,
    description: 'Legendary apex predator of the high Himalayan glaciers. Wields icy glacial boulders.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_glacial_wyrm',
    name: 'Glacial Ice Wyrm',
    category: 'monster',
    type: 'monster',
    subtype: 'drake',
    level: 16,
    position: [540, 20.0, 1300],
    radius: 5.8,
    health: 950,
    maxHealth: 950,
    power: 19500,
    description: 'Frozen serpent that burrows through packed glacial shelves and breathes freezing blizzards.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_snow_leopard',
    name: 'Himalayan Snow Leopard',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 5,
    position: [480, 16.0, 1180],
    radius: 3.8,
    health: 240,
    maxHealth: 240,
    power: 3100,
    description: 'Elusive mountain feline stalking prey along high-altitude glacial moraines.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_stone_colossus',
    name: 'Corrupted Stone Colossus',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 14,
    position: [760, 24.0, 1420],
    radius: 6.0,
    health: 820,
    maxHealth: 820,
    power: 16500,
    description: 'Ancient animated monastic guardian reawakened by dark elemental rift energy.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Quadrant II: Northeast Ironcrest
  {
    id: 'm_rock_drake',
    name: 'Iron Ridge Rock Drake',
    category: 'monster',
    type: 'monster',
    subtype: 'drake',
    level: 12,
    position: [1340, 18.5, 1240],
    radius: 5.5,
    health: 680,
    maxHealth: 680,
    power: 12400,
    description: 'Armored wyrm burrowing through heavy iron veins. Scales deflect ordinary arrows.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_crimson_wyvern',
    name: 'Crimson Sky Wyvern',
    category: 'monster',
    type: 'monster',
    subtype: 'boss',
    level: 20,
    position: [1440, 26.0, 1440],
    radius: 6.5,
    health: 1500,
    maxHealth: 1500,
    power: 31000,
    description: 'Supreme dragon monarch roosting on the eastern volcanic peak. Requires alliance rally.',
    actions: ['rally', 'attack', 'scout'],
  },
  {
    id: 'm_iron_golem',
    name: 'Iron Ore Sentinel',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 11,
    position: [1100, 16.0, 1340],
    radius: 4.8,
    health: 620,
    maxHealth: 620,
    power: 10500,
    description: 'Heavy forge automaton assembled from crushed magnetic slag.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_mountain_banshee',
    name: 'Gorge Banshee Spectre',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 7,
    position: [980, 13.0, 1110],
    radius: 4.0,
    health: 340,
    maxHealth: 340,
    power: 4900,
    description: 'Ghostly apparition wailing across high mountain passes to confuse vanguard scouts.',
    actions: ['attack', 'scout'],
  },

  // Quadrant III: Southwest Whispering Pines & Valleys
  {
    id: 'm_river_serpent',
    name: 'Karnali Basin Drake',
    category: 'monster',
    type: 'monster',
    subtype: 'aquatic',
    level: 10,
    position: [420, 8.8, 640],
    radius: 5.0,
    health: 520,
    maxHealth: 520,
    power: 8600,
    description: 'Serpentine green drake slithering through the lush emerald valley basins.',
    actions: ['attack', 'scout', 'rally'],
  },
  {
    id: 'm_bandit_warlord',
    name: 'Mountain Bandit Outpost',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 6,
    position: [580, 8.5, 460],
    radius: 4.5,
    health: 310,
    maxHealth: 310,
    power: 4200,
    description: 'Rogue marauders preying on trade caravans passing through western gorges.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_wild_boar_king',
    name: 'Razorback Boar Patriarch',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 4,
    position: [280, 9.0, 380],
    radius: 3.6,
    health: 220,
    maxHealth: 220,
    power: 2600,
    description: 'Giant aggressive tusked boar leading herds across lowland scrub forests.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_cave_troll',
    name: 'Himalayan Moss Troll',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 13,
    position: [340, 14.0, 240],
    radius: 5.4,
    health: 740,
    maxHealth: 740,
    power: 14200,
    description: 'Lumbering moss-encrusted troll brandishing an uprooted pine trunk.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Quadrant IV: Southeast Golden Basin & Deep Forests
  {
    id: 'm_treant_ancient',
    name: 'Forest Treant Ancient',
    category: 'monster',
    type: 'monster',
    subtype: 'treant',
    level: 9,
    position: [1240, 12.0, 520],
    radius: 5.0,
    health: 460,
    maxHealth: 460,
    power: 7200,
    description: 'Sentient pine titan defending old-growth sacred mandala timber.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_wolf_alpha',
    name: 'Shadow Dire Wolf Alpha',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 8,
    position: [1080, 11.0, 360],
    radius: 4.2,
    health: 380,
    maxHealth: 380,
    power: 5800,
    description: 'Lethal predator leading deepwood packs. Swift and vicious in forest ambush.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_horned_chimera',
    name: 'Himalayan Horned Chimera',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 15,
    position: [1380, 15.0, 290],
    radius: 5.6,
    health: 860,
    maxHealth: 860,
    power: 17800,
    description: 'Terrifying fusion of snow leopard, horned ram, and dragon serpent.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_goblin_camp',
    name: 'Highland Goblin War Camp',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 3,
    position: [920, 9.5, 290],
    radius: 3.5,
    health: 160,
    maxHealth: 160,
    power: 1800,
    description: 'Scavenger tribe hoarding stolen agricultural grain and iron tools.',
    actions: ['attack', 'scout'],
  },
];

/**
 * 32+ Resource Deposits across 4 Quadrants & 5 Resource Tiers (1600 x 1600 Continent)
 */
export const WORLD_RESOURCES: WorldEntity[] = [
  // --- WOOD & TIMBER GROVES (8 nodes) ---
  {
    id: 'res_wood_1',
    name: 'Valley Deodar Grove',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 1,
    position: [850, 10.0, 840],
    radius: 3.5,
    yieldAmount: 400,
    resourceType: 'wood',
    description: 'Fragrant Himalayan cedar wood essential for town framing and palisades.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_2',
    name: 'Lush Pine Forest',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 2,
    position: [980, 11.0, 860],
    radius: 4.0,
    yieldAmount: 800,
    resourceType: 'wood',
    description: 'Dense mountain pine yielding sturdy timber for watchtowers and barracks.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_3',
    name: 'Sacred Rhododendron Wood',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 3,
    position: [1200, 13.0, 980],
    radius: 4.5,
    yieldAmount: 1400,
    resourceType: 'wood',
    description: 'Tough highland hardwood carved for temple beams and siege machinery.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_4',
    name: 'Old-Growth Golden Fir',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 4,
    position: [1340, 15.0, 1040],
    radius: 5.0,
    yieldAmount: 2200,
    resourceType: 'wood',
    description: 'Ancient golden-grained timber prized for royal palaces and great gates.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_5',
    name: 'Deepwood Mandala Ancient',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 5,
    position: [1430, 16.0, 1280],
    radius: 5.5,
    yieldAmount: 3600,
    resourceType: 'wood',
    description: 'Rare enchanted spiritual timber blessed by high mountain monks.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_6',
    name: 'Northwood Cedar Stand',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 2,
    position: [580, 14.0, 1020],
    radius: 4.0,
    yieldAmount: 850,
    resourceType: 'wood',
    description: 'Wind-resistant cedar standing along northern ridges.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_7',
    name: 'Whispering Bamboo Basin',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 3,
    position: [480, 10.0, 560],
    radius: 4.2,
    yieldAmount: 1300,
    resourceType: 'wood',
    description: 'Flexible bamboo stalks ideal for royal longbows and scaffolding.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_8',
    name: 'Southern Oak Ridge',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 1,
    position: [920, 9.5, 490],
    radius: 3.6,
    yieldAmount: 450,
    resourceType: 'wood',
    description: 'Common hill oak logs suitable for firewood and rampart stakes.',
    actions: ['mine', 'scout'],
  },

  // --- FARMS & CROPS (8 nodes) ---
  {
    id: 'res_farm_1',
    name: 'Valley Barley Plots',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 1,
    position: [760, 10.0, 870],
    radius: 3.5,
    yieldAmount: 400,
    resourceType: 'food',
    description: 'High-altitude barley and buckwheat sustaining the royal garrison.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_2',
    name: 'Terraced Rice Paddis',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 2,
    position: [660, 10.0, 960],
    radius: 4.0,
    yieldAmount: 800,
    resourceType: 'food',
    description: 'Cascading hillside paddies nourished by fresh glacial meltwater.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_3',
    name: 'Highland Millet Terraces',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 3,
    position: [520, 12.0, 980],
    radius: 4.5,
    yieldAmount: 1400,
    resourceType: 'food',
    description: 'Nutritious golden millet feeding heavy cavalry and siege workforces.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_4',
    name: 'Royal Apple Orchards',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 4,
    position: [380, 14.0, 880],
    radius: 4.8,
    yieldAmount: 2200,
    resourceType: 'food',
    description: 'Crisp Mustang mountain apples supplying the imperial palace.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_5',
    name: 'Fertile River Delta Farms',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 5,
    position: [260, 11.0, 620],
    radius: 5.2,
    yieldAmount: 3600,
    resourceType: 'food',
    description: 'Blessed fertile river basin nourishing multiple alliance battalions.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_6',
    name: 'Southern Mustard Meadows',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 2,
    position: [840, 9.5, 340],
    radius: 4.0,
    yieldAmount: 780,
    resourceType: 'food',
    description: 'Golden blooming mustard fields yielding cooking oil and provisions.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_7',
    name: 'Eastern Corn Terraces',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 3,
    position: [1100, 10.5, 580],
    radius: 4.4,
    yieldAmount: 1350,
    resourceType: 'food',
    description: 'High-yield mountain maize fueling long-distance troop marches.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_8',
    name: 'Southwest Herbal Sanctuary',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 1,
    position: [640, 9.8, 380],
    radius: 3.6,
    yieldAmount: 420,
    resourceType: 'food',
    description: 'Medicinal herbs harvested for battlefield healing potions.',
    actions: ['mine', 'scout'],
  },

  // --- STONE & CRYSTAL QUARRIES (8 nodes) ---
  {
    id: 'res_stone_1',
    name: 'Slate Outcrop',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 1,
    position: [870, 10.0, 770],
    radius: 3.6,
    yieldAmount: 380,
    resourceType: 'stone',
    description: 'Exposed mountain slate ideal for simple roof shingles and wall pavers.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_2',
    name: 'Granite Quarry',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 2,
    position: [1020, 12.0, 760],
    radius: 4.0,
    yieldAmount: 780,
    resourceType: 'stone',
    description: 'Dense granite rock blocks extracted for keep ramparts and watchtowers.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_3',
    name: 'Marble Crag',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 3,
    position: [1240, 16.0, 880],
    radius: 4.5,
    yieldAmount: 1350,
    resourceType: 'stone',
    description: 'Veined crystalline marble used for temple sanctuaries and royal monuments.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_4',
    name: 'Obsidian Monolith',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 4,
    position: [1430, 19.0, 960],
    radius: 4.8,
    yieldAmount: 2200,
    resourceType: 'stone',
    description: 'Glass-smooth volcanic obsidian forming razor-sharp fortress spikes.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_5',
    name: 'Starfall Crystal Spire',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 5,
    position: [720, 20.0, 1340],
    radius: 5.2,
    yieldAmount: 3500,
    resourceType: 'stone',
    description: 'Pulsing arcane crystal formation holding concentrated elemental earth power.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_6',
    name: 'High Glacier Quartz Crag',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 4,
    position: [400, 21.0, 1240],
    radius: 4.6,
    yieldAmount: 2100,
    resourceType: 'stone',
    description: 'Frost-cracked quartz veins embedded in glacial bedrock.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_7',
    name: 'South Basalt Quarry',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 2,
    position: [740, 10.0, 490],
    radius: 4.0,
    yieldAmount: 820,
    resourceType: 'stone',
    description: 'Heavy volcanic basalt blocks used for fortress rampart foundations.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_8',
    name: 'Southeast Limestone Gorge',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 3,
    position: [1280, 13.0, 650],
    radius: 4.4,
    yieldAmount: 1380,
    resourceType: 'stone',
    description: 'Porous limestone mortar stone for masonry bonding.',
    actions: ['mine', 'scout'],
  },

  // --- IRON, COPPER & GOLD MINES (10 nodes) ---
  {
    id: 'res_gold_1',
    name: 'Vanguard Aurum Vein',
    category: 'resource',
    type: 'resource',
    subtype: 'gold',
    level: 1,
    position: [840, 10.0, 720],
    radius: 3.8,
    yieldAmount: 650,
    resourceType: 'gold',
    description: 'Lustrous aurum deposit located near the central valley. Plentiful royal bullion.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_gold_2',
    name: 'Crestline Gold Outcrop',
    category: 'resource',
    type: 'resource',
    subtype: 'gold',
    level: 2,
    position: [760, 10.0, 620],
    radius: 4.0,
    yieldAmount: 1100,
    resourceType: 'gold',
    description: 'Rich golden ore outcropping along the southern road to replenish imperial coinage.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_1',
    name: 'Shallow Iron Vein',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 1,
    position: [730, 10.0, 750],
    radius: 3.6,
    yieldAmount: 350,
    resourceType: 'iron',
    description: 'Surface deposits of iron ore suitable for forging basic spears and nails.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_2',
    name: 'Deep Copper Lode',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 2,
    position: [980, 11.5, 720],
    radius: 4.0,
    yieldAmount: 720,
    resourceType: 'iron',
    description: 'Rich reddish copper vein powering metallurgy and brass armaments.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_3',
    name: 'Royal Iron Mine',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 3,
    position: [1280, 17.0, 1160],
    radius: 4.5,
    yieldAmount: 1250,
    resourceType: 'iron',
    description: 'Established underground shaft yielding high-grade war iron for khukuris.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_4',
    name: 'Highland Gold Crevasse',
    category: 'resource',
    type: 'resource',
    subtype: 'gold',
    level: 4,
    position: [1340, 18.0, 1340],
    radius: 4.8,
    yieldAmount: 2400,
    resourceType: 'gold',
    description: 'Glittering aurum veins extracted from high crevices for the imperial treasury.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_5',
    name: 'Mithril Core Chamber',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 5,
    position: [1480, 20.0, 1200],
    radius: 5.2,
    yieldAmount: 3300,
    resourceType: 'iron',
    description: 'Legendary luminescent silver-blue ore lighter than silk and stronger than steel.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_6',
    name: 'Glacial Iron Seam',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 3,
    position: [360, 19.0, 1120],
    radius: 4.2,
    yieldAmount: 1200,
    resourceType: 'iron',
    description: 'Sub-zero magnetite seams buried under mountain frost.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_7',
    name: 'Southern Gold Placer',
    category: 'resource',
    type: 'resource',
    subtype: 'gold',
    level: 3,
    position: [1020, 10.0, 410],
    radius: 4.2,
    yieldAmount: 1600,
    resourceType: 'gold',
    description: 'Rich alluvial gold dust deposits washed down from eastern ranges.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_8',
    name: 'West Gorge Pyrite Mine',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 2,
    position: [490, 9.5, 410],
    radius: 3.8,
    yieldAmount: 680,
    resourceType: 'iron',
    description: 'Sulfurous iron ore mined for military smithing and arrows.',
    actions: ['mine', 'scout'],
  },
];

/**
 * Coordinate utility helper class
 */
export class WorldCoordinates {
  /**
   * Clamp world coordinate inside playable map boundary.
   */
  static clampToMap(x: number, z: number, margin: number = WORLD_BOUNDS.PLAYABLE_MARGIN): { x: number; z: number } {
    return {
      x: Math.max(WORLD_BOUNDS.MIN_X + margin, Math.min(WORLD_BOUNDS.MAX_X - margin, x)),
      z: Math.max(WORLD_BOUNDS.MIN_Z + margin, Math.min(WORLD_BOUNDS.MAX_Z - margin, z)),
    };
  }

  /**
   * Convert world coordinates [0..1600] to canvas minimap 2D position [0..width, 0..height].
   */
  static worldToMinimap(
    wx: number,
    wz: number,
    mapWidth: number,
    mapHeight: number
  ): { mx: number; my: number } {
    const mx = ((wx - WORLD_BOUNDS.MIN_X) / (WORLD_BOUNDS.MAX_X - WORLD_BOUNDS.MIN_X)) * mapWidth;
    const my = ((wz - WORLD_BOUNDS.MIN_Z) / (WORLD_BOUNDS.MAX_Z - WORLD_BOUNDS.MIN_Z)) * mapHeight;
    return { mx, my };
  }

  /**
   * Convert canvas minimap 2D position [0..width, 0..height] back to world coordinates.
   */
  static minimapToWorld(
    mx: number,
    my: number,
    mapWidth: number,
    mapHeight: number
  ): { wx: number; wz: number } {
    const wx = WORLD_BOUNDS.MIN_X + (mx / mapWidth) * (WORLD_BOUNDS.MAX_X - WORLD_BOUNDS.MIN_X);
    const wz = WORLD_BOUNDS.MIN_Z + (my / mapHeight) * (WORLD_BOUNDS.MAX_Z - WORLD_BOUNDS.MIN_Z);
    return { wx, wz };
  }
}
