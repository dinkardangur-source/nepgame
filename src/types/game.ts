export interface Resources {
  wood: number;
  stone: number;
  iron: number;
  food: number;
  crystal?: number;
}

export interface UnitCounts {
  infantry: number;
  cavalry: number;
  archer: number;
}

export type ArmyState = 'IDLE' | 'MARCHING' | 'GATHERING' | 'ATTACKING' | 'RETURNING';

export interface InteractiveObject {
  id: string;
  name: string;
  type: 'citadel' | 'resource' | 'monster' | 'fort' | 'tower';
  subtype:
    | 'wood'
    | 'farm'
    | 'gold'
    | 'stonecrystal'
    | 'crystal'
    | 'stone'
    | 'iron'
    | 'bear'
    | 'rabbit'
    | 'wolf'
    | 'treemonster'
    | 'yeti'
    | 'dragon'
    | 'rebel'
    | 'citadel'
    | 'tower'
    | string;
  level: number;
  position: [number, number, number];
  power?: number;
  health?: number;
  maxHealth?: number;
  yieldAmount?: number;
  resourceType?: 'wood' | 'stone' | 'iron' | 'food' | 'crystal' | 'gold' | 'stonecrystal' | 'farm';
  defenseRating?: string;
  counterUnit?: string;
  description?: string;
  mesh?: any;
  isDefeated?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'world' | 'alliance';
  sender: string;
  tag?: string;
  avatar?: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  isPlayer?: boolean;
}

export interface Province {
  id: 'valley' | 'snow' | 'mountain' | 'forest' | 'riverlands' | 'ruins' | string;
  name: string;
  subtitle: string;
  description: string;
  center: [number, number, number];
  icon: string;
  safe: boolean;
  minLevel?: number;
}

export interface TrainingQueueItem {
  id: string;
  unit: 'infantry' | 'cavalry' | 'archer';
  count: number;
  timeRemaining: number;
  totalTime: number;
  name: string;
}

export interface KingdomBuilding {
  id: string;
  name: string;
  tag: string;
  icon: string;
  level: number;
  maxLevel: number;
  cost: Resources;
  reqCitadelLevel: number;
  passiveBonus: string;
  passiveAmount: string;
  description: string;
}

export interface Blueprint {
  id: string;
  name: string;
  icon: string;
  category: string;
  cost: Resources;
  benefit: string;
  description?: string;
  constructed: boolean;
}

export interface CombatFloater {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

export interface ToastMessage {
  id: string;
  text: string;
}
