import * as THREE from 'three';

/**
 * WorldCoordinates.ts
 * Shared coordinate system for the Himalayan Realms strategy game.
 * Uses X and Z for horizontal ground placement, and Y for vertical terrain elevation.
 */

export const WORLD_BOUNDS = {
  MIN_X: 0,
  MAX_X: 3200,
  MIN_Z: 0,
  MAX_Z: 3200,
  CENTER_X: 1600,
  CENTER_Z: 1600,
  PLAYABLE_MARGIN: 20,
} as const;

// ============================================================================
// SHARED NILE RIVER & NORTHERN DELTA COURSE (South +Z=3260 -> North -Z=-60)
// ============================================================================
export const NILE_DELTA_FORK_Z = 740;
export const NILE_DELTA_FORK_X = 1655;

// [z, x] control points ascending in Z
const NILE_MAIN_POINTS: ReadonlyArray<readonly [number, number]> = [
  [740, 1655],
  [856, 1668],
  [1180, 1712],
  [1600, 1742],
  [1980, 1718],
  [2344, 1665],
  [2590, 1600],
  [2840, 1505],
  [3260, 1445],
];

const NILE_WEST_DELTA_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-60, 920],
  [180, 1015],
  [360, 1135],
  [610, 1600],
  [740, 1655],
];

const NILE_EAST_DELTA_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-60, 2280],
  [180, 2180],
  [360, 2065],
  [560, 1860],
  [740, 1655],
];

function sampleCatmullXAtZ(z: number, pts: ReadonlyArray<readonly [number, number]>): number {
  const n = pts.length;
  if (z <= pts[0][0]) return pts[0][1];
  if (z >= pts[n - 1][0]) return pts[n - 1][1];

  let seg = 0;
  for (let i = 0; i < n - 1; i++) {
    if (z >= pts[i][0] && z <= pts[i + 1][0]) {
      seg = i;
      break;
    }
  }

  const p0 = pts[Math.max(0, seg - 1)][1];
  const p1 = pts[seg][1];
  const p2 = pts[seg + 1][1];
  const p3 = pts[Math.min(n - 1, seg + 2)][1];

  const z1 = pts[seg][0];
  const z2 = pts[seg + 1][0];
  const t = (z - z1) / Math.max(1e-5, z2 - z1);
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export interface NileChannelPoint {
  centerX: number;
  halfWidth: number;
  branch: 'main' | 'delta_west' | 'delta_east';
}

export function getNileMainX(z: number): number {
  return sampleCatmullXAtZ(z, NILE_MAIN_POINTS);
}

export function getNileWestDeltaX(z: number): number {
  return sampleCatmullXAtZ(z, NILE_WEST_DELTA_POINTS);
}

export function getNileEastDeltaX(z: number): number {
  return sampleCatmullXAtZ(z, NILE_EAST_DELTA_POINTS);
}

export function getNileChannelsAtZ(z: number): NileChannelPoint[] {
  if (z >= NILE_DELTA_FORK_Z) {
    const southTaper = z > 2920 ? Math.max(0.76, 1 - (z - 2920) / 1100) : 1.0;
    return [{ centerX: getNileMainX(z), halfWidth: 16.5 * southTaper, branch: 'main' }];
  }
  const dt = Math.max(0, (NILE_DELTA_FORK_Z - z) / (NILE_DELTA_FORK_Z + 60));
  const branchHalf = 14.5 - dt * 3.0;
  return [
    { centerX: getNileWestDeltaX(z), halfWidth: branchHalf, branch: 'delta_west' },
    { centerX: getNileEastDeltaX(z), halfWidth: branchHalf, branch: 'delta_east' },
  ];
}

export function getDistanceToNile(
  x: number,
  z: number
): { distToCenter: number; distBeyondWater: number; branch: 'main' | 'delta_west' | 'delta_east' } {
  let bestCenterDist = Infinity;
  let bestWaterEdgeDist = Infinity;
  let bestBranch: 'main' | 'delta_west' | 'delta_east' = 'main';

  for (let dz = -20; dz <= 20; dz += 10) {
    const sz = z + dz;
    if (sz < -60 || sz > 3260) continue;
    const channels = getNileChannelsAtZ(sz);
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const d = Math.hypot(x - ch.centerX, dz);
      if (d < bestCenterDist) {
        bestCenterDist = d;
        bestWaterEdgeDist = Math.max(0, d - ch.halfWidth);
        bestBranch = ch.branch;
      }
    }
  }
  return { distToCenter: bestCenterDist, distBeyondWater: bestWaterEdgeDist, branch: bestBranch };
}

export interface NileBridgeSpec {
  x: number;
  z: number;
  orientation: 'ew_road' | 'ns_road';
}

export const NILE_HIGHWAY_BRIDGES: ReadonlyArray<NileBridgeSpec> = [
  { x: getNileMainX(2840), z: 2840, orientation: 'ew_road' },
  { x: 1600, z: 2590, orientation: 'ns_road' },
  { x: getNileMainX(2344), z: 2344, orientation: 'ew_road' },
  { x: getNileMainX(1600), z: 1600, orientation: 'ew_road' },
  { x: getNileMainX(856), z: 856, orientation: 'ew_road' },
  { x: 1600, z: 610, orientation: 'ns_road' },
  { x: getNileWestDeltaX(360), z: 360, orientation: 'ew_road' },
  { x: getNileEastDeltaX(360), z: 360, orientation: 'ew_road' },
];

export interface PlayerAllianceIdentity {
  tag: string; // Strictly 4 uppercase chars, e.g. "GORK"
  alias: string; // Strictly 4 words, e.g. "Royal Himalayan Mountain Guard"
}

export const DEFAULT_PLAYER_ALLIANCE: PlayerAllianceIdentity = {
  tag: 'GORK',
  alias: 'Royal Himalayan Mountain Guard',
};

export const RIVAL_ALLIANCE_DEFS: Record<'CRIM' | 'SHDW', PlayerAllianceIdentity> = {
  CRIM: { tag: 'CRIM', alias: 'Crimson Iron Peak Horde' },
  SHDW: { tag: 'SHDW', alias: 'Shadow Highland Crest Raiders' },
};

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
  maxYieldAmount?: number;
  resourceType?: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold';
  power?: number;
  attackDamage?: number;
  defense?: number;
  suggestedReward?: number;
  requiredTroopCapacity?: number;
  difficulty?: number;
  respawnAt?: number;
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
  allianceAlias?: string;
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
  allianceAlias?: string;
  isMyCastle: boolean;
  faction?: 'my' | 'alliance' | 'enemy';
  level: number;
  power: number;
  position: [number, number, number];
  radius: number;
  description: string;
}


/**
 * Nepalese Medieval Troop Roster Definition (Infantry, Archer, Cavalry - Lv 1 to Lv 5)
 */
export interface TroopUnit {
  id: string;
  classId: 'infantry' | 'archer' | 'cavalry';
  name: string;
  shortName: string;
  category: 'infantry' | 'archer' | 'cavalry';
  tier: 1 | 2 | 3 | 4 | 5;
  icon: string;
  selectedCount: number;
  maxCount: number;
  powerPerUnit: number;
  hp: number;
  attack: number;
  load: number;
  gatheringSpeed: number;
  speed: number;
  description: string;
}

/**
 * Nepalese Medieval Troop Roster: Magar Warriors, Limbu Archers & Thakuri Cavalry (Lv 1-5)
 */
export const INITIAL_TROOP_ROSTER: TroopUnit[] = [
  {
    id: 'magar_lv1',
    classId: 'infantry',
    name: 'Magar Warriors Lv.1',
    shortName: 'Magar L1',
    category: 'infantry',
    tier: 1,
    icon: '🗡️',
    selectedCount: 500,
    maxCount: 950,
    powerPerUnit: 10,
    hp: 120,
    attack: 12,
    load: 20,
    gatheringSpeed: 1.0,
    speed: 1.0,
    description: 'Khukuri, shield & traditional armor. Strong frontline effective against Cavalry.',
  },
  {
    id: 'magar_lv3',
    classId: 'infantry',
    name: 'Magar Warriors Lv.3',
    shortName: 'Magar L3',
    category: 'infantry',
    tier: 3,
    icon: '🛡️',
    selectedCount: 1500,
    maxCount: 1850,
    powerPerUnit: 22,
    hp: 190,
    attack: 21,
    load: 30,
    gatheringSpeed: 1.5,
    speed: 1.2,
    description: 'Veteran Khukuri frontline battalion forged for B Shrines & Lv 3-5 monsters.',
  },
  {
    id: 'magar_lv4',
    classId: 'infantry',
    name: 'Magar Warriors Lv.4',
    shortName: 'Magar L4',
    category: 'infantry',
    tier: 4,
    icon: '⚔️',
    selectedCount: 2500,
    maxCount: 5800,
    powerPerUnit: 32,
    hp: 240,
    attack: 28,
    load: 36,
    gatheringSpeed: 1.8,
    speed: 1.3,
    description: 'Elite Royal Magar vanguard required for A Shrines & The Alliance Congress.',
  },
  {
    id: 'limbu_lv1',
    classId: 'archer',
    name: 'Limbu Archers Lv.1',
    shortName: 'Limbu L1',
    category: 'archer',
    tier: 1,
    icon: '🏹',
    selectedCount: 300,
    maxCount: 600,
    powerPerUnit: 12,
    hp: 80,
    attack: 18,
    load: 15,
    gatheringSpeed: 1.0,
    speed: 1.1,
    description: 'Traditional bow, arrows & quiver. High long-range damage against Infantry.',
  },
  {
    id: 'limbu_lv3',
    classId: 'archer',
    name: 'Limbu Archers Lv.3',
    shortName: 'Limbu L3',
    category: 'archer',
    tier: 3,
    icon: '🎯',
    selectedCount: 1000,
    maxCount: 1200,
    powerPerUnit: 27,
    hp: 125,
    attack: 32,
    load: 23,
    gatheringSpeed: 1.5,
    speed: 1.3,
    description: 'Hilltop sharpshooters breaking enemy shields across valleys & B Shrines.',
  },
  {
    id: 'limbu_lv4',
    classId: 'archer',
    name: 'Limbu Archers Lv.4',
    shortName: 'Limbu L4',
    category: 'archer',
    tier: 4,
    icon: '🔱',
    selectedCount: 1500,
    maxCount: 3400,
    powerPerUnit: 39,
    hp: 155,
    attack: 42,
    load: 28,
    gatheringSpeed: 1.8,
    speed: 1.4,
    description: 'Royal Kanchenjunga archers anchoring A Shrine & Congress volleys.',
  },
  {
    id: 'thakuri_lv1',
    classId: 'cavalry',
    name: 'Thakuri Cavalry Lv.1',
    shortName: 'Thakuri L1',
    category: 'cavalry',
    tier: 1,
    icon: '🐎',
    selectedCount: 200,
    maxCount: 420,
    powerPerUnit: 15,
    hp: 150,
    attack: 22,
    load: 30,
    gatheringSpeed: 0.8,
    speed: 1.8,
    description: 'Horse-mounted warriors with rapid marching speed & high load. Effective vs Archers.',
  },
  {
    id: 'thakuri_lv3',
    classId: 'cavalry',
    name: 'Thakuri Cavalry Lv.3',
    shortName: 'Thakuri L3',
    category: 'cavalry',
    tier: 3,
    icon: '🏇',
    selectedCount: 500,
    maxCount: 680,
    powerPerUnit: 34,
    hp: 240,
    attack: 40,
    load: 48,
    gatheringSpeed: 1.2,
    speed: 2.2,
    description: 'Armored mountain chargers raiding resource convoys & reinforcing B Shrines.',
  },
  {
    id: 'thakuri_lv4',
    classId: 'cavalry',
    name: 'Thakuri Cavalry Lv.4',
    shortName: 'Thakuri L4',
    category: 'cavalry',
    tier: 4,
    icon: '👑',
    selectedCount: 1000,
    maxCount: 2300,
    powerPerUnit: 49,
    hp: 300,
    attack: 53,
    load: 60,
    gatheringSpeed: 1.5,
    speed: 2.4,
    description: 'Royal Mustang shock riders charging into A Shrines & Congress flanks.',
  },
];

/**
 * Surveyed Continent 1 Shrine & Congress Network on 3200 x 3200 Continent:
 * - 1 Central "The Congress" at [1600, 10.0, 1600]
 * - 4 Shrine A sites (A1–A4) surrounding The Congress
 * - 12 Shrine B sites (B1–B12) forming the mid-tier defensive ring
 * - 20 Shrine C sites (C1–C20) forming the outer 6x6 perimeter lattice across snow corners
 */
const GRID_COORDS = [360, 856, 1352, 1848, 2344, 2840] as const;

export const RESERVED_PLOTS: ReservedPlot[] = [
  // =========================================================================
  // 1. CENTRAL THE CONGRESS (Center [1600, 10.0, 1600])
  // =========================================================================
  {
    id: 'plot-congress-center',
    name: 'The Congress',
    code: 'C',
    type: 'congress',
    position: [1600, 10.0, 1600],
    size: [48, 48],
    radius: 26,
    tier: 3,
    starCount: 3,
    status: 'built',
    description:
      'The Congress — Supreme Continental Citadel at the heart of Continent 1 [1600, 1600], requiring 2 C Shrines, 1 B Shrine & 1 A Shrine held before unlocking garrison command.',
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

export function isCastleCoordValid(
  x: number,
  z: number,
  existingPositions: Array<[number, number, number]>,
  minCastleDist = 92
): boolean {
  if (x < 160 || x > 3040 || z < 160 || z > 3040) return false;
  const cx = WORLD_BOUNDS.CENTER_X;
  const cz = WORLD_BOUNDS.CENTER_Z;

  // Keep away from central The Congress
  if (Math.hypot(x - cx, z - cz) < 108) return false;

  // Keep castles on dry banks clear of the Nile River & Northern Delta
  if (getDistanceToNile(x, z).distBeyondWater < 36) return false;

  // Keep away from all 36 Shrines & The Congress
  for (const plot of RESERVED_PLOTS) {
    if (Math.hypot(x - plot.position[0], z - plot.position[2]) < plot.radius + 46) {
      return false;
    }
  }

  // Keep away from existing Castles
  for (const pos of existingPositions) {
    if (Math.hypot(x - pos[0], z - pos[2]) < minCastleDist) {
      return false;
    }
  }
  return true;
}

export function pickValidCastleCoordinate(
  existingPositions: Array<[number, number, number]>,
  options?: {
    minDistFromCenter?: number;
    maxDistFromCenter?: number;
    minCastleDist?: number;
    oldPos?: [number, number, number];
    minJumpFromOld?: number;
    getHeightAt?: (x: number, z: number) => number;
  }
): [number, number, number] {
  const cx = WORLD_BOUNDS.CENTER_X;
  const cz = WORLD_BOUNDS.CENTER_Z;
  const minDistFromCenter = options?.minDistFromCenter ?? 340;
  const maxDistFromCenter = options?.maxDistFromCenter ?? 1420;
  const minCastleDist = options?.minCastleDist ?? 92;
  const oldPos = options?.oldPos;
  const minJumpFromOld = options?.minJumpFromOld ?? 320;
  const getHeightAt = options?.getHeightAt;

  for (let attempt = 0; attempt < 360; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDistFromCenter + Math.random() * (maxDistFromCenter - minDistFromCenter);
    const rx = Math.round(cx + Math.cos(angle) * dist);
    const rz = Math.round(cz + Math.sin(angle) * dist);

    if (oldPos && Math.hypot(rx - oldPos[0], rz - oldPos[2]) < minJumpFromOld) continue;
    if (isCastleCoordValid(rx, rz, existingPositions, minCastleDist)) {
      const ry = getHeightAt ? getHeightAt(rx, rz) : 10.0;
      return [rx, ry, rz];
    }
  }

  // Deterministic ring scan fallback across quadrants if random samples collided
  for (let step = 0; step < 36; step++) {
    const angle = (step / 36) * Math.PI * 2 + existingPositions.length * 0.41;
    const dist = 560 + (step % 4) * 210;
    const fx = Math.max(180, Math.min(3020, Math.round(cx + Math.cos(angle) * dist)));
    const fz = Math.max(180, Math.min(3020, Math.round(cz + Math.sin(angle) * dist)));
    if (oldPos && Math.hypot(fx - oldPos[0], fz - oldPos[2]) < minJumpFromOld * 0.5) continue;
    if (isCastleCoordValid(fx, fz, existingPositions, 72)) {
      const fy = getHeightAt ? getHeightAt(fx, fz) : 10.0;
      return [fx, fy, fz];
    }
  }

  const fallbackAngle = (existingPositions.length + 1) * 0.78;
  const fx = Math.round(cx + Math.cos(fallbackAngle) * 640);
  const fz = Math.round(cz + Math.sin(fallbackAngle) * 640);
  const fy = getHeightAt ? getHeightAt(fx, fz) : 10.0;
  return [fx, fy, fz];
}

/**
 * Generates randomized, non-overlapping World Map coordinates across the 3200 x 3200 continent for:
 * - User's "My Castle" (1 castle)
 * - 10 Alliance Member Castles
 * - 6 Rival Enemy Castles
 * Ensures castles never overlap The Congress, any Shrine A/B/C, Nile River, or each other.
 */
export function generateRandomCastles(
  getHeightAt?: (x: number, z: number) => number,
  playerAlliance: PlayerAllianceIdentity = DEFAULT_PLAYER_ALLIANCE
): CastleSpawnData[] {
  const placed: CastleSpawnData[] = [];
  const bracketTag = `[${playerAlliance.tag}]`;

  const pickRandomCoord = (minDistFromCenter: number, maxDistFromCenter: number): [number, number, number] =>
    pickValidCastleCoordinate(
      placed.map((c) => c.position),
      {
        minDistFromCenter,
        maxDistFromCenter,
        minCastleDist: 92,
        getHeightAt,
      }
    );

  // 1. Spawn User's "My Castle" at a random strategic location (280m - 920m from center)
  const myPos = pickRandomCoord(280, 920);
  placed.push({
    id: 'my-castle',
    name: 'My Castle (Lord Dangol)',
    owner: 'Lord Dangol (You)',
    allianceTag: bracketTag,
    allianceAlias: playerAlliance.alias,
    isMyCastle: true,
    faction: 'my',
    level: 20,
    power: 245000,
    position: myPos,
    radius: 15.0,
    description:
      `Your Royal Command Castle (${bracketTag} ${playerAlliance.alias})! All vanguard battalions, mining parties, and alliance rallies deploy from your castle gates. Click to enter your 3D Walled Inside Kingdom!`,
  });

  // 2. Spawn 10 Alliance Member Castles across the 3200x3200 continent (320m - 1280m from center)
  ALLIANCE_COMMANDERS.forEach((cmd, idx) => {
    const pos = pickRandomCoord(320, 1280);
    placed.push({
      id: `alliance-castle-${idx + 1}`,
      name: cmd.name,
      owner: cmd.owner,
      allianceTag: bracketTag,
      allianceAlias: playerAlliance.alias,
      isMyCastle: false,
      faction: 'alliance',
      level: cmd.level,
      power: cmd.power,
      position: pos,
      radius: 12.5,
      description: `Allied Vanguard Castle commanded by ${cmd.owner} (${bracketTag} ${playerAlliance.alias} · ${cmd.power.toLocaleString()} Power). Reinforces adjacent Shrines and The Congress.`,
    });
  });

  // 3. Spawn 6 Rival Enemy Castles across contested quadrants & snow corners (420m - 1420m from center)
  ENEMY_COMMANDERS.forEach((cmd, idx) => {
    const pos = pickRandomCoord(420, 1420);
    const rawTag = cmd.tag.replace(/[[\]]/g, '') as 'CRIM' | 'SHDW';
    const rivalAlias = RIVAL_ALLIANCE_DEFS[rawTag]?.alias || 'Crimson Iron Peak Horde';
    placed.push({
      id: `enemy-castle-${idx + 1}`,
      name: cmd.name,
      owner: cmd.owner,
      allianceTag: cmd.tag,
      allianceAlias: rivalAlias,
      isMyCastle: false,
      faction: 'enemy',
      level: cmd.level,
      power: cmd.power,
      position: pos,
      radius: 13.0,
      description: `Hostile ${cmd.tag} ${rivalAlias} War Citadel commanded by ${cmd.owner} (${cmd.power.toLocaleString()} Power). Assault or launch an Alliance Rally to plunder Treasury Gold & Gems!`,
    });
  });

  return placed;
}


/**
 * Curated + Deterministically Auto-Populated Monsters (Lv 1..10) across the 3200x3200 Continent
 */
const BASE_WORLD_MONSTERS: WorldEntity[] = [
  // Level 1 (2,000 HP | 100 ATK | 50 DEF | 500 Reward)
  {
    id: 'm_goblin_camp',
    name: 'Forest Marauder Pack',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 1,
    position: [1795, 9.5, 1180],
    radius: 3.5,
    health: 2000,
    maxHealth: 2000,
    attackDamage: 100,
    defense: 50,
    suggestedReward: 500,
    power: 1500,
    description: 'Lv.1 Forest Raiders stalking outer timber clearings. Ideal for Lv.1 Magar & Limbu squads.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_valley_jackal',
    name: 'Hilltop Timber Prowler',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 1,
    position: [1280, 9.5, 1320],
    radius: 3.5,
    health: 2000,
    maxHealth: 2000,
    attackDamage: 100,
    defense: 50,
    suggestedReward: 500,
    power: 1500,
    description: 'Lv.1 Highland predator lurking around valley farmland trails.',
    actions: ['attack', 'scout'],
  },

  // Level 2 (4,000 HP | 180 ATK | 100 DEF | 1,000 Reward)
  {
    id: 'm_wild_boar_king',
    name: 'Razorback Forest Boar',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 2,
    position: [980, 9.0, 1080],
    radius: 3.8,
    health: 4000,
    maxHealth: 4000,
    attackDamage: 180,
    defense: 100,
    suggestedReward: 1000,
    power: 2800,
    description: 'Lv.2 Tusked beast roaming dense bamboo & cedar woodlands.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_ruin_sentry',
    name: 'Abandoned Outpost Sentry',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 2,
    position: [2040, 10.5, 1380],
    radius: 3.9,
    health: 4000,
    maxHealth: 4000,
    attackDamage: 180,
    defense: 100,
    suggestedReward: 1000,
    power: 2800,
    description: 'Lv.2 Guard stationed in shattered frontier watchtower ruins.',
    actions: ['attack', 'scout'],
  },

  // Level 3 (7,000 HP | 280 ATK | 180 DEF | 1,800 Reward)
  {
    id: 'm_snow_leopard',
    name: 'Himalayan Highland Stalker',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 3,
    position: [820, 16.0, 2320],
    radius: 4.1,
    health: 7000,
    maxHealth: 7000,
    attackDamage: 280,
    defense: 180,
    suggestedReward: 1800,
    power: 4900,
    description: 'Lv.3 Agile mountain predator haunting misty emerald-ridge ledges.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_bandit_warlord',
    name: 'Gorge Cave Brigand',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 3,
    position: [1220, 8.8, 1040],
    radius: 4.2,
    health: 7000,
    maxHealth: 7000,
    attackDamage: 280,
    defense: 180,
    suggestedReward: 1800,
    power: 4900,
    description: 'Lv.3 Cave raider hoarding iron ingots and highland silver.',
    actions: ['attack', 'scout'],
  },

  // Level 4 (12,000 HP | 420 ATK | 280 DEF | 2,800 Reward)
  {
    id: 'm_mountain_banshee',
    name: 'Abandoned Castle Wraith',
    category: 'monster',
    type: 'monster',
    subtype: 'humanoid',
    level: 4,
    position: [1980, 13.0, 2040],
    radius: 4.4,
    health: 12000,
    maxHealth: 12000,
    attackDamage: 420,
    defense: 280,
    suggestedReward: 2800,
    power: 8200,
    description: 'Lv.4 Spectral guardian defending an abandoned Malla hilltop keep.',
    actions: ['attack', 'scout'],
  },
  {
    id: 'm_wolf_alpha',
    name: 'Shadow Dire Wolf Alpha',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 4,
    position: [2090, 11.0, 960],
    radius: 4.4,
    health: 12000,
    maxHealth: 12000,
    attackDamage: 420,
    defense: 280,
    suggestedReward: 2800,
    power: 8200,
    description: 'Lv.4 Deep-forest alpha ambushing resource caravans.',
    actions: ['attack', 'scout'],
  },

  // Level 5 (20,000 HP | 650 ATK | 450 DEF | 4,500 Reward)
  {
    id: 'm_treant_ancient',
    name: 'Sacred Forest Treant',
    category: 'monster',
    type: 'monster',
    subtype: 'treant',
    level: 5,
    position: [2420, 12.0, 1220],
    radius: 4.8,
    health: 20000,
    maxHealth: 20000,
    attackDamage: 650,
    defense: 450,
    suggestedReward: 4500,
    power: 13500,
    description: 'Lv.5 Ancient timber guardian defending rich Lv.5-6 hardwood groves.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_river_serpent',
    name: 'Karnali Cave Serpent',
    category: 'monster',
    type: 'monster',
    subtype: 'aquatic',
    level: 5,
    position: [920, 8.8, 1290],
    radius: 4.8,
    health: 20000,
    maxHealth: 20000,
    attackDamage: 650,
    defense: 450,
    suggestedReward: 4500,
    power: 13500,
    description: 'Lv.5 Cavern water drake guarding river delta resource flats.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Level 6 (32,000 HP | 900 ATK | 650 DEF | 7,000 Reward)
  {
    id: 'm_iron_golem',
    name: 'Iron Ridge Cave Golem',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 6,
    position: [2160, 16.0, 2460],
    radius: 5.0,
    health: 32000,
    maxHealth: 32000,
    attackDamage: 900,
    defense: 650,
    suggestedReward: 7000,
    power: 21000,
    description: 'Lv.6 Armored ore sentinel defending high-grade mountain iron seams.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_quarry_fiend',
    name: 'Granite Crag Fiend',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 6,
    position: [2510, 15.0, 1510],
    radius: 5.0,
    health: 32000,
    maxHealth: 32000,
    attackDamage: 900,
    defense: 650,
    suggestedReward: 7000,
    power: 21000,
    description: 'Lv.6 Stone titan patrolling abandoned mountain quarry tunnels.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Level 7 (50,000 HP | 1,300 ATK | 900 DEF | 10,000 Reward)
  {
    id: 'm_rock_drake',
    name: 'Ironcrest Mountain Drake',
    category: 'monster',
    type: 'monster',
    subtype: 'drake',
    level: 7,
    position: [2640, 18.5, 2580],
    radius: 5.4,
    health: 50000,
    maxHealth: 50000,
    attackDamage: 1300,
    defense: 900,
    suggestedReward: 10000,
    power: 32000,
    description: 'Lv.7 Winged mountain drake nesting above southeast highland crystal veins.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_cave_troll',
    name: 'Himalayan Cavern Troll',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 7,
    position: [240, 16.0, 240],
    radius: 5.4,
    health: 50000,
    maxHealth: 50000,
    attackDamage: 1300,
    defense: 900,
    suggestedReward: 10000,
    power: 32000,
    description: 'Lv.7 Monstrous northwest frontier cavern brute wielding stone pillars.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Level 8 (75,000 HP | 1,800 ATK | 1,300 DEF | 15,000 Reward)
  {
    id: 'm_stone_colossus',
    name: 'Abandoned Citadel Colossus',
    category: 'monster',
    type: 'monster',
    subtype: 'golem',
    level: 8,
    position: [1580, 22.0, 2940],
    radius: 5.8,
    health: 75000,
    maxHealth: 75000,
    attackDamage: 1800,
    defense: 1300,
    suggestedReward: 15000,
    power: 48000,
    description: 'Lv.8 Ancient stone guardian sealed inside an abandoned southern highland fortress.',
    actions: ['attack', 'rally', 'scout'],
  },
  {
    id: 'm_horned_chimera',
    name: 'Highland Horned Chimera',
    category: 'monster',
    type: 'monster',
    subtype: 'beast',
    level: 8,
    position: [2960, 17.0, 250],
    radius: 5.7,
    health: 75000,
    maxHealth: 75000,
    attackDamage: 1800,
    defense: 1300,
    suggestedReward: 15000,
    power: 48000,
    description: 'Lv.8 Tri-horned mountain beast stalking northeast emerald frontier ridges.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Level 9 (110,000 HP | 2,500 ATK | 1,800 DEF | 22,000 Reward)
  {
    id: 'm_glacial_wyrm',
    name: 'Emerald Peak Storm Wyrm',
    category: 'monster',
    type: 'monster',
    subtype: 'drake',
    level: 9,
    position: [1120, 20.0, 2760],
    radius: 6.1,
    health: 110000,
    maxHealth: 110000,
    attackDamage: 2500,
    defense: 1800,
    suggestedReward: 22000,
    power: 72000,
    description: 'Lv.9 Highland wyrm guarding southern frontier Crystal spires.',
    actions: ['attack', 'rally', 'scout'],
  },

  // Level 10 (160,000 HP | 3,500 ATK | 2,500 DEF | 35,000 Reward)
  {
    id: 'm_frost_yeti',
    name: 'Ancient Highland Yeti Sovereign',
    category: 'monster',
    type: 'monster',
    subtype: 'boss',
    level: 10,
    position: [240, 20.0, 2960],
    radius: 6.6,
    health: 160000,
    maxHealth: 160000,
    attackDamage: 3500,
    defense: 2500,
    suggestedReward: 35000,
    power: 110000,
    description: 'Lv.10 Apex highland sovereign in the southwest corner. Yields rare crystal spoils.',
    actions: ['rally', 'attack', 'scout'],
  },
  {
    id: 'm_crimson_wyvern',
    name: 'Crimson Himalayan Wyvern',
    category: 'monster',
    type: 'monster',
    subtype: 'boss',
    level: 10,
    position: [2960, 21.0, 2960],
    radius: 6.6,
    health: 160000,
    maxHealth: 160000,
    attackDamage: 3500,
    defense: 2500,
    suggestedReward: 35000,
    power: 110000,
    description: 'Lv.10 Supreme dragon monarch roosting over southeast highland Crystal & Iron peaks.',
    actions: ['rally', 'attack', 'scout'],
  },
];

/**
 * Curated Resource Nodes across Levels 1 to 10 (Food, Wood, Stone, Iron & Crystal)
 * Capacities exact per Level 1-10 Resource Balance Table across the full 3200x3200 green continent.
 */
const BASE_WORLD_RESOURCES: WorldEntity[] = [
  // --- WOOD & TIMBER GROVES (Levels 1..10, Capacity 5,000..150,000) ---
  {
    id: 'res_wood_1',
    name: 'Valley Deodar Grove',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 1,
    position: [1670, 10.0, 1665],
    radius: 3.6,
    yieldAmount: 5000,
    maxYieldAmount: 5000,
    requiredTroopCapacity: 100,
    difficulty: 1.0,
    resourceType: 'wood',
    description: 'Lv.1 Cedar timber grove (5,000 Wood). Accessible to starter Magar & Limbu forces.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_2',
    name: 'Lush Pine Forest',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 2,
    position: [1880, 11.0, 1680],
    radius: 4.0,
    yieldAmount: 8000,
    maxYieldAmount: 8000,
    requiredTroopCapacity: 250,
    difficulty: 1.05,
    resourceType: 'wood',
    description: 'Lv.2 Mountain pine logging camp (8,000 Wood).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_3',
    name: 'Sacred Rhododendron Wood',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 4,
    position: [2040, 13.0, 1940],
    radius: 4.4,
    yieldAmount: 18000,
    maxYieldAmount: 18000,
    requiredTroopCapacity: 900,
    difficulty: 1.15,
    resourceType: 'wood',
    description: 'Lv.4 Highland hardwood stand (18,000 Wood).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_4',
    name: 'Old-Growth Golden Fir',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 6,
    position: [2420, 15.0, 2010],
    radius: 4.8,
    yieldAmount: 35000,
    maxYieldAmount: 35000,
    requiredTroopCapacity: 2400,
    difficulty: 1.3,
    resourceType: 'wood',
    description: 'Lv.6 Ancient golden-grained timber reserve (35,000 Wood).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_5',
    name: 'Deepwood Mandala Ancient',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 8,
    position: [2620, 16.0, 2480],
    radius: 5.3,
    yieldAmount: 70000,
    maxYieldAmount: 70000,
    requiredTroopCapacity: 5500,
    difficulty: 1.5,
    resourceType: 'wood',
    description: 'Lv.8 Monastic sacred timber heartland (70,000 Wood).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_6',
    name: 'Northwood Cedar Stand',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 3,
    position: [1220, 14.0, 1940],
    radius: 4.1,
    yieldAmount: 12000,
    maxYieldAmount: 12000,
    requiredTroopCapacity: 500,
    difficulty: 1.1,
    resourceType: 'wood',
    description: 'Lv.3 Wind-resistant ridge cedar (12,000 Wood).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_wood_7',
    name: 'Imperial Himalayan Sal Basin',
    category: 'resource',
    type: 'resource',
    subtype: 'wood',
    level: 10,
    position: [2960, 15.0, 620],
    radius: 5.6,
    yieldAmount: 150000,
    maxYieldAmount: 150000,
    requiredTroopCapacity: 12000,
    difficulty: 1.85,
    resourceType: 'wood',
    description: 'Lv.10 Grand royal Sal timber sanctuary (150,000 Wood). Requires Lv.4-5 Thakuri haulers.',
    actions: ['mine', 'scout'],
  },

  // --- FOOD & TERRACED FARMS (Levels 1..10, Capacity 5,000..150,000) ---
  {
    id: 'res_farm_1',
    name: 'Valley Barley Plots',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 1,
    position: [1525, 10.0, 1690],
    radius: 3.6,
    yieldAmount: 5000,
    maxYieldAmount: 5000,
    requiredTroopCapacity: 100,
    difficulty: 1.0,
    resourceType: 'food',
    description: 'Lv.1 Valley barley terraces (5,000 Food). +15% Food harvest bonus.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_2',
    name: 'Terraced Rice Paddies',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 2,
    position: [1310, 10.0, 1890],
    radius: 4.0,
    yieldAmount: 8000,
    maxYieldAmount: 8000,
    requiredTroopCapacity: 250,
    difficulty: 1.05,
    resourceType: 'food',
    description: 'Lv.2 Cascading meltwater rice paddies (8,000 Food).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_3',
    name: 'Highland Millet Terraces',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 3,
    position: [1120, 12.0, 1920],
    radius: 4.3,
    yieldAmount: 12000,
    maxYieldAmount: 12000,
    requiredTroopCapacity: 500,
    difficulty: 1.1,
    resourceType: 'food',
    description: 'Lv.3 Golden millet grain terraces (12,000 Food).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_4',
    name: 'Mustang Apple Orchards',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 5,
    position: [720, 14.0, 1680],
    radius: 4.8,
    yieldAmount: 25000,
    maxYieldAmount: 25000,
    requiredTroopCapacity: 1500,
    difficulty: 1.22,
    resourceType: 'food',
    description: 'Lv.5 Royal highland orchard estates (25,000 Food).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_5',
    name: 'Fertile River Delta Farms',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 7,
    position: [560, 11.0, 1160],
    radius: 5.2,
    yieldAmount: 50000,
    maxYieldAmount: 50000,
    requiredTroopCapacity: 3600,
    difficulty: 1.4,
    resourceType: 'food',
    description: 'Lv.7 Alluvial river delta granaries (50,000 Food).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_6',
    name: 'Southern Mustard Meadows',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 9,
    position: [1620, 9.5, 580],
    radius: 5.4,
    yieldAmount: 100000,
    maxYieldAmount: 100000,
    requiredTroopCapacity: 8000,
    difficulty: 1.65,
    resourceType: 'food',
    description: 'Lv.9 Grand mustard & grain plains (100,000 Food).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_farm_7',
    name: 'Kathmandu Valley Royal Granary',
    category: 'resource',
    type: 'resource',
    subtype: 'farm',
    level: 10,
    position: [2040, 10.5, 1180],
    radius: 5.6,
    yieldAmount: 150000,
    maxYieldAmount: 150000,
    requiredTroopCapacity: 12000,
    difficulty: 1.85,
    resourceType: 'food',
    description: 'Lv.10 Supreme terraced harvest basin (150,000 Food).',
    actions: ['mine', 'scout'],
  },

  // --- STONE QUARRIES (Levels 1..10, Capacity 3,000..100,000) ---
  {
    id: 'res_stone_1',
    name: 'Slate Outcrop',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 1,
    position: [1690, 10.0, 1545],
    radius: 3.6,
    yieldAmount: 3000,
    maxYieldAmount: 3000,
    requiredTroopCapacity: 100,
    difficulty: 1.0,
    resourceType: 'stone',
    description: 'Lv.1 Mountain slate shelf (3,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_2',
    name: 'Granite Quarry',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 2,
    position: [1940, 12.0, 1535],
    radius: 4.0,
    yieldAmount: 5000,
    maxYieldAmount: 5000,
    requiredTroopCapacity: 250,
    difficulty: 1.05,
    resourceType: 'stone',
    description: 'Lv.2 Cut granite quarry blocks (5,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_3',
    name: 'Marble Crag',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 4,
    position: [2420, 16.0, 1640],
    radius: 4.5,
    yieldAmount: 12000,
    maxYieldAmount: 12000,
    requiredTroopCapacity: 900,
    difficulty: 1.15,
    resourceType: 'stone',
    description: 'Lv.4 Temple-grade marble quarry (12,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_4',
    name: 'Obsidian Monolith',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 6,
    position: [2880, 19.0, 1980],
    radius: 4.9,
    yieldAmount: 23000,
    maxYieldAmount: 23000,
    requiredTroopCapacity: 2400,
    difficulty: 1.3,
    resourceType: 'stone',
    description: 'Lv.6 Volcanic basalt monoliths (23,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_5',
    name: 'Highland Quartz Crag',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 8,
    position: [580, 21.0, 2620],
    radius: 5.2,
    yieldAmount: 45000,
    maxYieldAmount: 45000,
    requiredTroopCapacity: 5500,
    difficulty: 1.5,
    resourceType: 'stone',
    description: 'Lv.8 Deep highland bedrock quarry (45,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_6',
    name: 'South Basalt Quarry',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 3,
    position: [1520, 10.0, 1120],
    radius: 4.1,
    yieldAmount: 8000,
    maxYieldAmount: 8000,
    requiredTroopCapacity: 500,
    difficulty: 1.1,
    resourceType: 'stone',
    description: 'Lv.3 Fortress masonry basalt pit (8,000 Stone).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_stone_7',
    name: 'Annapurna Imperial Quarry',
    category: 'resource',
    type: 'resource',
    subtype: 'stone',
    level: 10,
    position: [2540, 14.0, 1240],
    radius: 5.6,
    yieldAmount: 100000,
    maxYieldAmount: 100000,
    requiredTroopCapacity: 12000,
    difficulty: 1.85,
    resourceType: 'stone',
    description: 'Lv.10 Colossal citadel quarry (100,000 Stone).',
    actions: ['mine', 'scout'],
  },

  // --- IRON MINES (Levels 1..10, Capacity 1,000..50,000) ---
  {
    id: 'res_iron_1',
    name: 'Shallow Iron Vein',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 1,
    position: [1505, 10.0, 1515],
    radius: 3.6,
    yieldAmount: 1000,
    maxYieldAmount: 1000,
    requiredTroopCapacity: 100,
    difficulty: 1.0,
    resourceType: 'iron',
    description: 'Lv.1 Surface bog-iron deposit (1,000 Iron).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_2',
    name: 'Deep Copper-Iron Lode',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 3,
    position: [1890, 11.5, 1510],
    radius: 4.1,
    yieldAmount: 3500,
    maxYieldAmount: 3500,
    requiredTroopCapacity: 500,
    difficulty: 1.1,
    resourceType: 'iron',
    description: 'Lv.3 Smelting iron-copper vein (3,500 Iron).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_3',
    name: 'Royal Khukuri Iron Mine',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 5,
    position: [2440, 17.0, 2060],
    radius: 4.7,
    yieldAmount: 7500,
    maxYieldAmount: 7500,
    requiredTroopCapacity: 1500,
    difficulty: 1.22,
    resourceType: 'iron',
    description: 'Lv.5 Weapon-grade steel-iron mine (7,500 Iron).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_4',
    name: 'Highland Magnetite Seam',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 7,
    position: [620, 19.0, 2080],
    radius: 5.0,
    yieldAmount: 15000,
    maxYieldAmount: 15000,
    requiredTroopCapacity: 3600,
    difficulty: 1.4,
    resourceType: 'iron',
    description: 'Lv.7 High-density magnetite ore pit (15,000 Iron).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_5',
    name: 'Mithril-Iron Core Chamber',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 9,
    position: [2940, 20.0, 2540],
    radius: 5.4,
    yieldAmount: 30000,
    maxYieldAmount: 30000,
    requiredTroopCapacity: 8000,
    difficulty: 1.65,
    resourceType: 'iron',
    description: 'Lv.9 Deep frontier forge core chamber (30,000 Iron).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_iron_6',
    name: 'Sagarmatha Meteoric Iron Vault',
    category: 'resource',
    type: 'resource',
    subtype: 'iron',
    level: 10,
    position: [260, 18.0, 560],
    radius: 5.6,
    yieldAmount: 50000,
    maxYieldAmount: 50000,
    requiredTroopCapacity: 12000,
    difficulty: 1.85,
    resourceType: 'iron',
    description: 'Lv.10 Legendary meteoric iron vein in northwest green frontier (50,000 Iron).',
    actions: ['mine', 'scout'],
  },

  // --- CRYSTAL DEPOSITS (Levels 1..10, Capacity 200..10,000) ---
  {
    id: 'res_crystal_1',
    name: 'Valley Quartz Crystal Node',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 1,
    position: [1660, 10.0, 1485],
    radius: 3.8,
    yieldAmount: 200,
    maxYieldAmount: 200,
    requiredTroopCapacity: 100,
    difficulty: 1.0,
    resourceType: 'crystal',
    description: 'Lv.1 Arcane blue crystal cluster (200 Crystal) near the central valley.',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_crystal_2',
    name: 'Crestline Crystal Outcrop',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 2,
    position: [1550, 10.0, 1280],
    radius: 4.0,
    yieldAmount: 400,
    maxYieldAmount: 400,
    requiredTroopCapacity: 250,
    difficulty: 1.05,
    resourceType: 'crystal',
    description: 'Lv.2 Glowing sapphire crystal seam (400 Crystal).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_crystal_3',
    name: 'Southern Crystal Leyline',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 4,
    position: [1980, 10.0, 690],
    radius: 4.4,
    yieldAmount: 1000,
    maxYieldAmount: 1000,
    requiredTroopCapacity: 900,
    difficulty: 1.15,
    resourceType: 'crystal',
    description: 'Lv.4 Resonant leyline crystal spire (1,000 Crystal).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_crystal_4',
    name: 'Starfall Crystal Spire',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 6,
    position: [1505, 20.0, 2560],
    radius: 4.9,
    yieldAmount: 2000,
    maxYieldAmount: 2000,
    requiredTroopCapacity: 2400,
    difficulty: 1.3,
    resourceType: 'crystal',
    description: 'Lv.6 Concentric starfall crystal pillar (2,000 Crystal).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_crystal_5',
    name: 'Highland Emerald Crystal Crevasse',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 8,
    position: [2940, 19.0, 240],
    radius: 5.2,
    yieldAmount: 4500,
    maxYieldAmount: 4500,
    requiredTroopCapacity: 5500,
    difficulty: 1.5,
    resourceType: 'crystal',
    description: 'Lv.8 High-altitude northeast frontier crystal cavern (4,500 Crystal).',
    actions: ['mine', 'scout'],
  },
  {
    id: 'res_crystal_6',
    name: 'Sovereign Himalaya Crystal Sanctuary',
    category: 'resource',
    type: 'resource',
    subtype: 'crystal',
    level: 10,
    position: [220, 21.0, 2940],
    radius: 5.7,
    yieldAmount: 10000,
    maxYieldAmount: 10000,
    requiredTroopCapacity: 12000,
    difficulty: 1.85,
    resourceType: 'crystal',
    description: 'Lv.10 Supreme crystal nexus in southwest emerald corner (10,000 Crystal).',
    actions: ['mine', 'scout'],
  },
];

// ============================================================================
// DETERMINISTIC REGIONAL AUTO-SPAWNER FOR 3200x3200 GREEN CONTINENT
// ============================================================================
const AUTO_MONSTER_STATS_BY_LEVEL: ReadonlyArray<{
  hp: number;
  atk: number;
  def: number;
  reward: number;
  power: number;
}> = [
  { hp: 2000, atk: 100, def: 50, reward: 500, power: 1500 },
  { hp: 4000, atk: 180, def: 100, reward: 1000, power: 2800 },
  { hp: 7000, atk: 280, def: 180, reward: 1800, power: 4900 },
  { hp: 12000, atk: 420, def: 280, reward: 2800, power: 8200 },
  { hp: 20000, atk: 650, def: 450, reward: 4500, power: 13500 },
  { hp: 32000, atk: 900, def: 650, reward: 7000, power: 21000 },
  { hp: 50000, atk: 1300, def: 900, reward: 10000, power: 32000 },
  { hp: 75000, atk: 1800, def: 1300, reward: 15000, power: 48000 },
  { hp: 110000, atk: 2500, def: 1800, reward: 22000, power: 72000 },
  { hp: 160000, atk: 3500, def: 2500, reward: 35000, power: 110000 },
];

const AUTO_FOOD_WOOD_CAP = [5000, 8000, 12000, 18000, 25000, 35000, 50000, 70000, 100000, 150000] as const;
const AUTO_STONE_CAP = [3000, 5000, 8000, 12000, 17000, 23000, 32000, 45000, 65000, 100000] as const;
const AUTO_IRON_CAP = [1000, 2000, 3500, 5000, 7500, 10000, 15000, 22000, 30000, 50000] as const;
const AUTO_CRYSTAL_CAP = [200, 400, 700, 1000, 1500, 2000, 3000, 4500, 6500, 10000] as const;
const AUTO_REQ_CAP = [100, 250, 500, 900, 1500, 2400, 3600, 5500, 8000, 12000] as const;
const AUTO_DIFF = [1.0, 1.05, 1.1, 1.15, 1.22, 1.3, 1.4, 1.5, 1.65, 1.85] as const;

function createAutoRng(initialSeed: number): () => number {
  let state = initialSeed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function isAutoCoordClear(x: number, z: number, occupied: Array<{ x: number; z: number }>, minNodeGap = 78): boolean {
  if (x < 70 || x > WORLD_BOUNDS.MAX_X - 70 || z < 70 || z > WORLD_BOUNDS.MAX_Z - 70) return false;
  // Keep clear of central Inside Kingdom & Congress citadel
  if (Math.hypot(x - WORLD_BOUNDS.CENTER_X, z - WORLD_BOUNDS.CENTER_Z) < 175) return false;
  // Keep clear of central highway crossways
  if (Math.abs(x - WORLD_BOUNDS.CENTER_X) < 28 || Math.abs(z - WORLD_BOUNDS.CENTER_Z) < 28) return false;
  // Keep clear of the Nile River & Northern Delta channels
  if (getDistanceToNile(x, z).distBeyondWater < 32) return false;
  for (const plot of RESERVED_PLOTS) {
    if (Math.hypot(x - plot.position[0], z - plot.position[2]) < plot.radius + 50) return false;
  }
  for (const o of occupied) {
    if (Math.hypot(x - o.x, z - o.z) < minNodeGap) return false;
  }
  return true;
}

function pickRegionalLevel(distFromCenter: number, rng: () => number): number {
  if (distFromCenter < 720) {
    const band = [1, 2, 2, 3, 3, 4];
    return band[Math.floor(rng() * band.length)];
  }
  if (distFromCenter < 1260) {
    const band = [4, 5, 5, 6, 6, 7];
    return band[Math.floor(rng() * band.length)];
  }
  const frontierBand = [7, 8, 8, 9, 9, 10];
  return frontierBand[Math.floor(rng() * frontierBand.length)];
}

export function generateAutoWorldMonsters(existing: WorldEntity[], count = 44): WorldEntity[] {
  const rng = createAutoRng(20260809);
  const occupied = existing.map((e) => ({ x: e.position[0], z: e.position[2] }));
  const generated: WorldEntity[] = [];

  const innerTemplates: Array<{ name: string; subtype: 'humanoid' | 'beast' | 'treant' | 'aquatic' }> = [
    { name: 'Valley Bandit Scout', subtype: 'humanoid' },
    { name: 'Rhododendron Wolf Pack', subtype: 'beast' },
    { name: 'Grove Bramble Treant', subtype: 'treant' },
    { name: 'Riverbank Lurker', subtype: 'aquatic' },
  ];
  const midTemplates: Array<{ name: string; subtype: 'beast' | 'treant' | 'golem' | 'humanoid' }> = [
    { name: 'Highland Cave Raider', subtype: 'humanoid' },
    { name: 'Crag Timber Guardian', subtype: 'treant' },
    { name: 'Granite Ridge Sentinel', subtype: 'golem' },
    { name: 'Mist Stalker Sabretooth', subtype: 'beast' },
  ];
  const highlandTemplates: Array<{ name: string; subtype: 'golem' | 'drake' | 'beast' }> = [
    { name: 'Emerald-Peak Stone Golem', subtype: 'golem' },
    { name: 'Highland Crest Storm Drake', subtype: 'drake' },
    { name: 'Ridgewood Dire Chimera', subtype: 'beast' },
    { name: 'Ancient Crag Titan', subtype: 'golem' },
  ];

  // Anchor points spread across all 4 quadrants + all 4 outer green corners
  const cornerAnchors: Array<[number, number]> = [
    [140, 140], [3060, 140], [140, 3060], [3060, 3060],
    [480, 190], [2720, 190], [480, 3010], [2720, 3010],
    [190, 520], [3010, 520], [190, 2680], [3010, 2680],
  ];

  let attempts = 0;
  while (generated.length < count && attempts < 1400) {
    attempts++;
    let rx: number;
    let rz: number;
    if (generated.length < cornerAnchors.length && attempts < cornerAnchors.length * 16) {
      const [ax, az] = cornerAnchors[generated.length];
      rx = Math.round(ax + (rng() - 0.5) * 260);
      rz = Math.round(az + (rng() - 0.5) * 260);
    } else {
      rx = Math.round(85 + rng() * (WORLD_BOUNDS.MAX_X - 170));
      rz = Math.round(85 + rng() * (WORLD_BOUNDS.MAX_Z - 170));
    }
    if (!isAutoCoordClear(rx, rz, occupied, 84)) continue;

    const dist = Math.hypot(rx - WORLD_BOUNDS.CENTER_X, rz - WORLD_BOUNDS.CENTER_Z);
    const level = pickRegionalLevel(dist, rng);
    const stats = AUTO_MONSTER_STATS_BY_LEVEL[level - 1];
    const pool = level <= 4 ? innerTemplates : level <= 7 ? midTemplates : highlandTemplates;
    const tpl = pool[generated.length % pool.length];
    const estY = 9.5 + (dist / 1600) * 8.5;

    occupied.push({ x: rx, z: rz });
    generated.push({
      id: `m_auto_${generated.length + 1}`,
      name: tpl.name,
      category: 'monster',
      type: 'monster',
      subtype: tpl.subtype,
      level,
      position: [rx, Number(estY.toFixed(1)), rz],
      radius: Number((3.5 + level * 0.28).toFixed(1)),
      health: stats.hp,
      maxHealth: stats.hp,
      attackDamage: stats.atk,
      defense: stats.def,
      suggestedReward: stats.reward,
      power: stats.power,
      description: `Lv.${level} Himalayan wild ${tpl.name} (${stats.hp.toLocaleString()} HP · ${stats.reward.toLocaleString()} Loot).`,
      actions: level >= 5 ? ['attack', 'rally', 'scout'] : ['attack', 'scout'],
    });
  }

  return generated;
}

export function generateAutoWorldResources(existing: WorldEntity[], occupiedExternal: WorldEntity[], count = 56): WorldEntity[] {
  const rng = createAutoRng(99173211);
  const occupied = [...existing, ...occupiedExternal].map((e) => ({ x: e.position[0], z: e.position[2] }));
  const generated: WorldEntity[] = [];

  const kindRotation: Array<{
    subtype: 'wood' | 'farm' | 'stone' | 'iron' | 'crystal';
    resourceType: 'wood' | 'food' | 'stone' | 'iron' | 'crystal';
    names: [string, string, string];
  }> = [
    { subtype: 'wood', resourceType: 'wood', names: ['Valley Pine Stand', 'Highland Fir Forest', 'Frontier Sacred Cedar'] },
    { subtype: 'farm', resourceType: 'food', names: ['Terraced Barley Field', 'Meltwater Millet Terrace', 'Highland Buckwheat Plot'] },
    { subtype: 'stone', resourceType: 'stone', names: ['Shale Quarry Bench', 'Alpine Granite Crag', 'Highland Basalt Outcrop'] },
    { subtype: 'iron', resourceType: 'iron', names: ['Valley Iron Seam', 'Mountain Magnetite Vein', 'Deep Frontier Iron Lode'] },
    { subtype: 'crystal', resourceType: 'crystal', names: ['Leyline Quartz Node', 'Sapphire Ridge Spire', 'Sovereign Emerald Crystal Vein'] },
  ];

  // Seed outer green corners and frontier belts richly
  const cornerAnchors: Array<[number, number]> = [
    [130, 130], [3070, 130], [130, 3070], [3070, 3070],
    [540, 160], [2660, 160], [540, 3040], [2660, 3040],
    [160, 660], [3040, 660], [160, 2540], [3040, 2540],
    [980, 190], [2220, 190], [980, 3010], [2220, 3010],
  ];

  let attempts = 0;
  while (generated.length < count && attempts < 1800) {
    attempts++;
    let rx: number;
    let rz: number;
    if (generated.length < cornerAnchors.length && attempts < cornerAnchors.length * 16) {
      const [ax, az] = cornerAnchors[generated.length];
      rx = Math.round(ax + (rng() - 0.5) * 240);
      rz = Math.round(az + (rng() - 0.5) * 240);
    } else {
      rx = Math.round(85 + rng() * (WORLD_BOUNDS.MAX_X - 170));
      rz = Math.round(85 + rng() * (WORLD_BOUNDS.MAX_Z - 170));
    }
    if (!isAutoCoordClear(rx, rz, occupied, 76)) continue;

    const dist = Math.hypot(rx - WORLD_BOUNDS.CENTER_X, rz - WORLD_BOUNDS.CENTER_Z);
    const level = pickRegionalLevel(dist, rng);
    const idx = level - 1;
    const spec = kindRotation[generated.length % kindRotation.length];
    const cap =
      spec.resourceType === 'food' || spec.resourceType === 'wood'
        ? AUTO_FOOD_WOOD_CAP[idx]
        : spec.resourceType === 'stone'
          ? AUTO_STONE_CAP[idx]
          : spec.resourceType === 'iron'
            ? AUTO_IRON_CAP[idx]
            : AUTO_CRYSTAL_CAP[idx];
    const nameIdx = level <= 4 ? 0 : level <= 7 ? 1 : 2;
    const estY = 9.8 + (dist / 1600) * 10.8;

    occupied.push({ x: rx, z: rz });
    generated.push({
      id: `res_auto_${spec.subtype}_${generated.length + 1}`,
      name: spec.names[nameIdx],
      category: 'resource',
      type: 'resource',
      subtype: spec.subtype,
      level,
      position: [rx, Number(estY.toFixed(1)), rz],
      radius: Number((3.6 + level * 0.2).toFixed(1)),
      yieldAmount: cap,
      maxYieldAmount: cap,
      requiredTroopCapacity: AUTO_REQ_CAP[idx],
      difficulty: AUTO_DIFF[idx],
      resourceType: spec.resourceType,
      description: `Lv.${level} ${spec.names[nameIdx]} (${cap.toLocaleString()} ${spec.resourceType.toUpperCase()}). Auto-surveyed continental deposit.`,
      actions: ['mine', 'scout'],
    });
  }

  return generated;
}

const AUTO_MONSTERS = generateAutoWorldMonsters(BASE_WORLD_MONSTERS, 44);
export const WORLD_MONSTERS: WorldEntity[] = [...BASE_WORLD_MONSTERS, ...AUTO_MONSTERS];

const AUTO_RESOURCES = generateAutoWorldResources(BASE_WORLD_RESOURCES, WORLD_MONSTERS, 56);
export const WORLD_RESOURCES: WorldEntity[] = [...BASE_WORLD_RESOURCES, ...AUTO_RESOURCES];

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
   * Convert world coordinates [0..3200] to canvas minimap 2D position [0..width, 0..height].
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
