import * as THREE from 'three';
import {
  createStoneBrickTexture,
  createWoodPlankTexture,
  createRoofTileTexture,
  createDragonBannerTexture,
  createPrayerFlagTexture,
  createTerrainDetailAlbedoTexture,
  createTerrainSurfaceNormalMap,
} from './proceduralTextures';
import { applyDualScaleGrassShader } from './TerrainGenerator';
import {
  ContactShadowEntry,
  ShadowProjectionState,
  createContactShadowMaterial,
  createFlatContactShadow,
  syncContactShadowEntries,
} from './shadows';

export type MergeBuildingCategory = 'barracks' | 'tower' | 'mill' | 'shrine';

export interface KingdomMergePlot {
  plotId: string;
  slotIndex: number;
  position: [number, number, number];
  building: {
    id: string;
    category: MergeBuildingCategory;
    name: string;
    subtitle: string;
    icon: string;
    level: number;
    maxLevel: number;
    powerBonus: number;
    productionText: string;
    quickActionLabel: string;
    quickActionIcon: string;
    rewardType: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems' | 'troops';
    rewardAmount: number;
  } | null;
}

export interface InsideKingdomState {
  keepLevel: number;
  keepMaxLevel: number;
  keepPower: number;
  plots: KingdomMergePlot[];
  selectedPlotId: string | null; // 'keep' or plotId
}

export interface InsideKingdomSnapshot {
  keepLevel: number;
  keepPower: number;
  selectedPlotId: string | null;
  slots: Array<{ slotIndex: number; category: MergeBuildingCategory; level: number } | null>;
}

export const BUILDING_TEMPLATES: Record<
  MergeBuildingCategory,
  {
    baseName: string;
    subtitle: string;
    icon: string;
    basePower: number;
    baseCost: { wood: number; stone: number; iron: number; food: number };
    rewardType: 'wood' | 'stone' | 'iron' | 'food' | 'gold' | 'gems' | 'troops';
    baseRewardAmount: number;
    quickActionIcon: string;
    getProductionText: (level: number) => string;
    getQuickActionLabel: (level: number) => string;
    getTierName: (level: number) => string;
  }
> = {
  barracks: {
    baseName: 'Gurkha War Barracks',
    subtitle: 'MILITARY INFANTRY & CAVALRY DRILL HALL',
    icon: '⚔️',
    basePower: 2400,
    baseCost: { wood: 2200, stone: 1800, iron: 1400, food: 1600 },
    rewardType: 'troops',
    baseRewardAmount: 180,
    quickActionIcon: '🗡️',
    getProductionText: (lvl) => `Trains +${180 * lvl} Gurkha Shock Troops · +${(2400 * lvl).toLocaleString()} Power`,
    getQuickActionLabel: (lvl) => `Train +${180 * lvl} Gurkha Infantry`,
    getTierName: (lvl) =>
      lvl <= 1
        ? 'Gurkha Recruit Garrison'
        : lvl === 2
          ? 'Khukuri Vanguard Barracks'
          : lvl === 3
            ? 'Royal Highland War Hall'
            : lvl === 4
              ? 'Grand Himalayan Citadel Armory'
              : 'Supreme Dragon Guard War Academy',
  },
  tower: {
    baseName: 'Himalayan Bastion Tower',
    subtitle: 'FORTIFIED WATCHTOWER & SIEGE DEFENSE',
    icon: '🏹',
    basePower: 2800,
    baseCost: { wood: 1900, stone: 2500, iron: 1600, food: 1000 },
    rewardType: 'gold',
    baseRewardAmount: 450,
    quickActionIcon: '🛡️',
    getProductionText: (lvl) => `+${(2800 * lvl).toLocaleString()} Citadel Defense · +${450 * lvl} Garrison Gold`,
    getQuickActionLabel: (lvl) => `Collect Watchtower Tribute (+${450 * lvl} Gold)`,
    getTierName: (lvl) =>
      lvl <= 1
        ? 'Timber Watchpost'
        : lvl === 2
          ? 'Granite Arrow Bastion'
          : lvl === 3
            ? 'Gilded Crossbow Spire'
            : lvl === 4
              ? 'Dragonfire Artificer Tower'
              : 'Imperial Sky-Sentinel Fortress',
  },
  mill: {
    baseName: 'Sacred Pine & Ore Mill',
    subtitle: 'WATERWHEEL SAWMILL & BLAST FOUNDRY',
    icon: '🌲',
    basePower: 1950,
    baseCost: { wood: 1800, stone: 1800, iron: 1100, food: 1200 },
    rewardType: 'wood',
    baseRewardAmount: 1600,
    quickActionIcon: '⚙️',
    getProductionText: (lvl) => `Produces +${(1600 * lvl).toLocaleString()} Wood & Stone / Harvest`,
    getQuickActionLabel: (lvl) => `Harvest Mill Output (+${(1600 * lvl).toLocaleString()} Wood)`,
    getTierName: (lvl) =>
      lvl <= 1
        ? 'Glacial Stream Sawmill'
        : lvl === 2
          ? 'Twin-Wheel Timber & Masonry Mill'
          : lvl === 3
            ? 'High-Altitude Iron & Pine Works'
            : lvl === 4
              ? 'Royal Guild Waterwheel Foundry'
              : 'Grand Himalayan Industrial Forge',
  },
  shrine: {
    baseName: 'Golden Mandala Stupa',
    subtitle: 'SACRED MONASTIC SHRINE & LEYLINE ALTAR',
    icon: '🛕',
    basePower: 3100,
    baseCost: { wood: 2000, stone: 2400, iron: 1500, food: 1500 },
    rewardType: 'gems',
    baseRewardAmount: 20,
    quickActionIcon: '💎',
    getProductionText: (lvl) => `+${8 * lvl}% March Speed · +${20 * lvl} Sacred Gems`,
    getQuickActionLabel: (lvl) => `Channel Mandala Blessing (+${20 * lvl} Gems)`,
    getTierName: (lvl) =>
      lvl <= 1
        ? 'Whitewashed Prayer Chorten'
        : lvl === 2
          ? 'Lotus Terrace Stupa'
          : lvl === 3
            ? 'Golden Harmika Sanctuary'
            : lvl === 4
              ? 'Enlightened Dharma Pagoda'
              : 'Supreme Celestial Mandala Temple',
  },
};

export function createBuildingData(category: MergeBuildingCategory, level: number, uniqueSuffix?: string) {
  const tpl = BUILDING_TEMPLATES[category];
  const multiplier = Math.pow(2.15, level - 1);
  return {
    id: `bldg-${category}-lv${level}-${uniqueSuffix || Math.random().toString(36).slice(2, 7)}`,
    category,
    name: tpl.getTierName(level),
    subtitle: tpl.subtitle,
    icon: tpl.icon,
    level,
    maxLevel: 10,
    powerBonus: Math.round(tpl.basePower * multiplier),
    productionText: tpl.getProductionText(level),
    quickActionLabel: tpl.getQuickActionLabel(level),
    quickActionIcon: tpl.quickActionIcon,
    rewardType: tpl.rewardType,
    rewardAmount: Math.round(tpl.baseRewardAmount * Math.pow(1.85, level - 1)),
  };
}

/**
 * 16 Symmetrical 3D Courtyard Plots surrounding the Central Imperial Pagoda Keep at (1600, 10, 1596)
 */
const COURTYARD_PLOT_COORDS: Array<[number, number, number]> = [
  // Inner Ring (8 plots flanking the Keep)
  [1584, 10.0, 1584],
  [1572, 10.0, 1584],
  [1616, 10.0, 1584],
  [1628, 10.0, 1584],
  [1584, 10.0, 1598],
  [1572, 10.0, 1598],
  [1616, 10.0, 1598],
  [1628, 10.0, 1598],
  // Forecourt Southern Ring (8 plots along the Grand Processional Avenue)
  [1586, 10.0, 1612],
  [1572, 10.0, 1612],
  [1614, 10.0, 1612],
  [1628, 10.0, 1612],
  [1586, 10.0, 1625],
  [1572, 10.0, 1625],
  [1614, 10.0, 1625],
  [1628, 10.0, 1625],
];

const INITIAL_SLOT_SEEDS: Array<{ category: MergeBuildingCategory; level: number } | null> = [
  // Matching pairs ready for immediate 3D click-to-merge or auto-merge!
  { category: 'barracks', level: 1 },
  { category: 'barracks', level: 1 },
  { category: 'tower', level: 1 },
  { category: 'tower', level: 1 },
  { category: 'barracks', level: 2 },
  { category: 'mill', level: 2 },
  { category: 'shrine', level: 2 },
  { category: 'tower', level: 2 },
  { category: 'mill', level: 1 },
  { category: 'mill', level: 1 },
  { category: 'shrine', level: 1 },
  { category: 'shrine', level: 1 },
  { category: 'barracks', level: 3 },
  { category: 'shrine', level: 3 },
  null,
  null,
];

export class InsideKingdom3D {
  public rootGroup = new THREE.Group();
  public pickableObjects: THREE.Object3D[] = [];

  private stoneMat: THREE.MeshStandardMaterial;
  private darkStoneMat: THREE.MeshStandardMaterial;
  private woodMat: THREE.MeshStandardMaterial;
  private roofMat: THREE.MeshStandardMaterial;
  private crimsonRoofMat: THREE.MeshStandardMaterial;
  private goldMat: THREE.MeshStandardMaterial;
  private whiteStuccoMat: THREE.MeshStandardMaterial;
  private lanternMat: THREE.MeshStandardMaterial;
  private bannerMat: THREE.MeshStandardMaterial;
  private prayerFlagMat: THREE.MeshStandardMaterial;

  private plots: KingdomMergePlot[] = [];
  private plotGroupsMap = new Map<string, THREE.Group>();
  private plotBuildingMeshesMap = new Map<string, THREE.Group>();
  private plotHighlightRingsMap = new Map<string, THREE.Mesh>();
  private plotLabelSpritesMap = new Map<string, THREE.Sprite>();
  private plotLabelKeysMap = new Map<string, string>();
  private radialShadowMat: THREE.MeshBasicMaterial;
  private octagonalShadowMat: THREE.MeshBasicMaterial;
  private contactShadowEntries: ContactShadowEntry[] = [];
  private plotShadowEntriesMap = new Map<string, ContactShadowEntry>();

  private animWaterwheels: THREE.Object3D[] = [];
  private animWardRings: THREE.Object3D[] = [];
  private animBlessingRings: THREE.Object3D[] = [];
  private animDragonBanners: Array<{ obj: THREE.Object3D; phase: number }> = [];
  private animPrayerFlags: THREE.Object3D[] = [];

  private keepGroup = new THREE.Group();
  private keepLevel = 20;
  private keepMaxLevel = 30;
  private keepPower = 24000;
  private selectedPlotId: string | null = 'plot-0';

  // Active 3D scale-pop animations when merging or constructing
  private activePopAnimations: Array<{
    group: THREE.Group;
    baseScale: number;
    elapsed: number;
    duration: number;
  }> = [];

  // Callbacks to WorldMap & React UI
  private onStateChange?: (state: InsideKingdomState) => void;
  private onMergeEffect?: (worldPos: THREE.Vector3, text: string, color: string) => void;

  constructor(options?: {
    onStateChange?: (state: InsideKingdomState) => void;
    onMergeEffect?: (worldPos: THREE.Vector3, text: string, color: string) => void;
  }) {
    this.onStateChange = options?.onStateChange;
    this.onMergeEffect = options?.onMergeEffect;

    const stoneTex = createStoneBrickTexture();
    const woodTex = createWoodPlankTexture();
    const roofTex = createRoofTileTexture();
    const dragonBannerTex = createDragonBannerTexture();
    const prayerFlagTex = createPrayerFlagTexture();

    this.stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.82,
      metalness: 0.14,
    });
    this.darkStoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      color: 0x64748b,
      roughness: 0.86,
      metalness: 0.18,
    });
    this.woodMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.74,
      metalness: 0.06,
    });
    this.roofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      color: 0x334155,
      roughness: 0.58,
      metalness: 0.22,
    });
    this.crimsonRoofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      color: 0x991b1b,
      roughness: 0.52,
      metalness: 0.2,
    });
    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.28,
      metalness: 0.92,
      emissive: 0x854d0e,
      emissiveIntensity: 0.38,
    });
    this.whiteStuccoMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      metalness: 0.08,
    });
    this.lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.bannerMat = new THREE.MeshStandardMaterial({
      map: dragonBannerTex,
      side: THREE.DoubleSide,
      roughness: 0.55,
    });
    this.prayerFlagMat = new THREE.MeshStandardMaterial({
      map: prayerFlagTex,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    this.radialShadowMat = createContactShadowMaterial('radial', 0.7);
    this.octagonalShadowMat = createContactShadowMaterial('octagonal', 0.72);

    this.initWalledCourtyardEnvironment();
    this.initCentralImperialKeep();
    this.initMergePlots();
    this.refreshAnimatedPartsCache();
    this.refreshHighlightsAndLabels();
  }

  private refreshAnimatedPartsCache() {
    this.animWaterwheels = [];
    this.animWardRings = [];
    this.animBlessingRings = [];
    this.animDragonBanners = [];
    this.animPrayerFlags = [];
    this.rootGroup.traverse((obj) => {
      const ud = obj.userData;
      if (!ud) return;
      if (ud.isWaterwheel) {
        this.animWaterwheels.push(obj);
      } else if (ud.isWardRing) {
        this.animWardRings.push(obj);
      } else if (ud.isBlessingRing) {
        this.animBlessingRings.push(obj);
      } else if (ud.isDragonBanner) {
        this.animDragonBanners.push({ obj, phase: Number(ud.phase || 0) });
      } else if (ud.isPrayerFlag) {
        this.animPrayerFlags.push(obj);
      }
    });
  }

  public setCallbacks(callbacks: {
    onStateChange?: (state: InsideKingdomState) => void;
    onMergeEffect?: (worldPos: THREE.Vector3, text: string, color: string) => void;
  }) {
    this.onStateChange = callbacks.onStateChange;
    this.onMergeEffect = callbacks.onMergeEffect;
    this.emitState();
  }

  public getState(): InsideKingdomState {
    return {
      keepLevel: this.keepLevel,
      keepMaxLevel: this.keepMaxLevel,
      keepPower: this.keepPower,
      plots: this.plots.map((p) => ({
        ...p,
        building: p.building ? { ...p.building } : null,
      })),
      selectedPlotId: this.selectedPlotId,
    };
  }

  public getSnapshot(): InsideKingdomSnapshot {
    return {
      keepLevel: this.keepLevel,
      keepPower: this.keepPower,
      selectedPlotId: this.selectedPlotId,
      slots: this.plots.map((p) =>
        p.building
          ? {
              slotIndex: p.slotIndex,
              category: p.building.category,
              level: p.building.level,
            }
          : null
      ),
    };
  }

  public restoreState(snapshot: Partial<InsideKingdomSnapshot>): void {
    if (typeof snapshot.keepLevel === 'number' && snapshot.keepLevel >= 1) {
      this.keepLevel = Math.min(this.keepMaxLevel, Math.max(1, Math.round(snapshot.keepLevel)));
      this.keepPower =
        typeof snapshot.keepPower === 'number' && snapshot.keepPower > 0
          ? Math.round(snapshot.keepPower)
          : Math.round(24000 * Math.pow(1.18, Math.max(0, this.keepLevel - 20)));

      const oldSprite = this.plotLabelSpritesMap.get('keep');
      if (oldSprite) {
        this.keepGroup.remove(oldSprite);
        if (oldSprite.material.map) oldSprite.material.map.dispose();
        oldSprite.material.dispose();
      }
      const keepSprite = this.createBadgeSprite(
        `🏯 Lv.${this.keepLevel} Imperial Pagoda Keep`,
        'SUPREME CITADEL THRONE',
        '#facc15',
        false
      );
      keepSprite.position.set(0, 28.2, 0);
      keepSprite.scale.set(16, 4.0, 1);
      this.keepGroup.add(keepSprite);
      this.plotLabelSpritesMap.set('keep', keepSprite);
    }

    if (Array.isArray(snapshot.slots)) {
      for (let i = 0; i < this.plots.length; i++) {
        const plot = this.plots[i];
        const savedSlot = snapshot.slots[i];
        if (
          savedSlot &&
          (savedSlot.category === 'barracks' ||
            savedSlot.category === 'tower' ||
            savedSlot.category === 'mill' ||
            savedSlot.category === 'shrine')
        ) {
          const lvl = Math.min(10, Math.max(1, Math.round(savedSlot.level || 1)));
          plot.building = createBuildingData(savedSlot.category, lvl, `${plot.slotIndex}`);
        } else if (savedSlot === null) {
          plot.building = null;
        }
        this.rebuildPlot3DMesh(plot);
      }
    }

    if (snapshot.selectedPlotId !== undefined) {
      this.selectedPlotId = snapshot.selectedPlotId;
    }

    this.refreshAnimatedPartsCache();
    this.refreshHighlightsAndLabels();
    this.emitState();
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }

  private addMesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    castShadow = true
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow && mat !== this.lanternMat;
    m.receiveShadow = mat !== this.lanternMat;
    parent.add(m);
    return m;
  }

  /**
   * 1. Build the 3D Walled Himalayan Citadel Courtyard (Prominent 4-Sided Wall Border, Gatehouse, Corner Towers, and Surrounding Forest & Bushes except Main Gate)
   */
  private initWalledCourtyardEnvironment() {
    const center = new THREE.Vector3(1600, 10.0, 1600);

    // Seamless Contoured Himalayan Highland Grass Valley surrounding the Citadel (1800m x 1800m)
    // Eliminates flat rectangular meadow edges and matches World Map dual-scale PBR turf quality
    const grassValleyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: createTerrainDetailAlbedoTexture(),
      normalMap: createTerrainSurfaceNormalMap(),
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.89,
      metalness: 0.02,
      flatShading: false,
    });
    applyDualScaleGrassShader(grassValleyMat);

    const buildValleyAxis = (halfExtent: number, halfSteps: number): number[] => {
      const vals: number[] = [];
      for (let i = -halfSteps; i <= halfSteps; i++) {
        const s = i / halfSteps;
        const absS = Math.abs(s);
        // Dense spacing (~5-8m) near courtyard & forest belt, stretching smoothly to horizon
        const eased = Math.sign(s) * (absS * 0.14 + Math.pow(absS, 2.7) * 0.86);
        vals.push(eased * halfExtent);
      }
      return vals;
    };

    const valleyXs = buildValleyAxis(920, 32);
    const valleyZs = buildValleyAxis(920, 32);
    const vCols = valleyXs.length;
    const vRows = valleyZs.length;
    const vCount = vCols * vRows;

    const evalValleyHeight = (dx: number, dz: number): number => {
      // Distance outside the Citadel + forest belt box (kept calm & flat where trees/lanterns stand)
      const boxDx = Math.max(0, Math.abs(dx) - 78);
      const boxDz = Math.max(0, Math.abs(dz - 4) - 70);
      const outBox = Math.hypot(boxDx, boxDz);
      // Keep southern Main Gate approach corridor gently graded
      const inSouthGateRoad = dz > 50 && Math.abs(dx) < 16;
      const roadFlatten = inSouthGateRoad ? 1 - THREE.MathUtils.smoothstep(Math.abs(dx), 7, 16) : 0;

      if (outBox <= 0.01) {
        return center.y - 0.04;
      }

      const hillT = THREE.MathUtils.smoothstep(outBox, 0, 260);
      const farT = THREE.MathUtils.smoothstep(outBox, 120, 760);
      const wave =
        Math.sin((1600 + dx) * 0.016 + (1600 + dz) * 0.013) * 4.8 +
        Math.cos((1600 + dx) * 0.031 - (1600 + dz) * 0.027) * 2.4 +
        Math.sin(outBox * 0.019) * 2.6;
      const lift = farT * 34.0 + hillT * (7.5 + wave);
      return center.y - 0.04 + lift * (1 - roadFlatten * 0.85);
    };

    const vPositions = new Float32Array(vCount * 3);
    const vNormals = new Float32Array(vCount * 3);
    const vUvs = new Float32Array(vCount * 2);
    const vColors = new Float32Array(vCount * 3);
    const vIndices: number[] = [];

    const forestLoamCol = new THREE.Color('#2d5a2b');
    const meadowGrassCol = new THREE.Color('#47833a');
    const sunlitHillCol = new THREE.Color('#5a9240');
    const highlandRidgeCol = new THREE.Color('#3b6e37');
    const tempValleyCol = new THREE.Color();
    const uvScale = 0.044;

    let vIdx = 0;
    for (let iz = 0; iz < vRows; iz++) {
      const dz = valleyZs[iz];
      const wz = 1600 + dz;
      for (let ix = 0; ix < vCols; ix++) {
        const dx = valleyXs[ix];
        const wx = 1600 + dx;
        const wy = evalValleyHeight(dx, dz);

        vPositions[vIdx * 3] = wx;
        vPositions[vIdx * 3 + 1] = wy;
        vPositions[vIdx * 3 + 2] = wz;

        const eps = 3.5;
        const hL = evalValleyHeight(dx - eps, dz);
        const hR = evalValleyHeight(dx + eps, dz);
        const hD = evalValleyHeight(dx, dz - eps);
        const hU = evalValleyHeight(dx, dz + eps);
        const nx = hL - hR;
        const ny = 2.0 * eps;
        const nz = hD - hU;
        const invLen = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
        vNormals[vIdx * 3] = nx * invLen;
        vNormals[vIdx * 3 + 1] = ny * invLen;
        vNormals[vIdx * 3 + 2] = nz * invLen;

        vUvs[vIdx * 2] = wx * uvScale;
        vUvs[vIdx * 2 + 1] = wz * uvScale;

        const boxDx = Math.max(0, Math.abs(dx) - 54);
        const boxDz = Math.max(0, Math.abs(dz) - 48);
        const wallDist = Math.hypot(boxDx, boxDz);
        const forestBand = wallDist < 34 ? 1 - THREE.MathUtils.smoothstep(wallDist, 6, 34) : 0;
        const macroWave = Math.sin(wx * 0.011 + wz * 0.009) * 0.5 + 0.5;
        const elevGain = Math.max(0, wy - center.y);

        tempValleyCol.copy(meadowGrassCol).lerp(sunlitHillCol, macroWave * 0.45);
        tempValleyCol.lerp(forestLoamCol, forestBand * 0.62);
        if (elevGain > 6) {
          tempValleyCol.lerp(highlandRidgeCol, THREE.MathUtils.clamp((elevGain - 6) / 28, 0, 0.55));
        }

        vColors[vIdx * 3] = tempValleyCol.r;
        vColors[vIdx * 3 + 1] = tempValleyCol.g;
        vColors[vIdx * 3 + 2] = tempValleyCol.b;
        vIdx++;
      }
    }

    for (let iz = 0; iz < vRows - 1; iz++) {
      for (let ix = 0; ix < vCols - 1; ix++) {
        const a = iz * vCols + ix;
        const b = iz * vCols + (ix + 1);
        const c = (iz + 1) * vCols + ix;
        const d = (iz + 1) * vCols + (ix + 1);
        vIndices.push(a, c, b);
        vIndices.push(b, c, d);
      }
    }

    const valleyGeo = new THREE.BufferGeometry();
    valleyGeo.setIndex(vIndices);
    valleyGeo.setAttribute('position', new THREE.BufferAttribute(vPositions, 3));
    valleyGeo.setAttribute('normal', new THREE.BufferAttribute(vNormals, 3));
    valleyGeo.setAttribute('uv', new THREE.BufferAttribute(vUvs, 2));
    valleyGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));

    const valleyMesh = new THREE.Mesh(valleyGeo, grassValleyMat);
    valleyMesh.receiveShadow = true;
    valleyMesh.name = 'InsideKingdomGrassValley';
    this.rootGroup.add(valleyMesh);

    // Dressed Outer Granite Footing Plinth anchoring the Citadel walls & corners cleanly into grass
    const outerWallCurb = this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(108.8, 0.44, 96.8),
      this.stoneMat,
      1600,
      center.y - 0.14,
      1600,
      false
    );
    outerWallCurb.receiveShadow = true;

    // Grand Paved Royal Granite Courtyard Foundation Slab inside the Wall Border (104m x 92m: X=1548..1652, Z=1554..1646)
    const courtyardSlab = this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(104, 0.5, 92),
      this.darkStoneMat,
      1600,
      center.y - 0.15,
      1600,
      false
    );
    courtyardSlab.receiveShadow = true;

    // Inner Courtyard Golden Border Inlay with non-overlapping mitered corners & corner medallions
    const borderFrameMat = new THREE.MeshBasicMaterial({
      color: 0xdfba6e,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const addInlay = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = this.addMesh(this.rootGroup, new THREE.BoxGeometry(w, h, d), mat, x, y, z, false);
      m.renderOrder = 3;
      return m;
    };
    addInlay(95.2, 0.04, 0.8, 1600, center.y + 0.125, 1558, borderFrameMat);
    addInlay(0.8, 0.04, 83.2, 1552, center.y + 0.125, 1600, borderFrameMat);
    addInlay(0.8, 0.04, 83.2, 1648, center.y + 0.125, 1600, borderFrameMat);
    addInlay(37.2, 0.04, 0.8, 1571, center.y + 0.125, 1642, borderFrameMat);
    addInlay(37.2, 0.04, 0.8, 1629, center.y + 0.125, 1642, borderFrameMat);

    for (const [mx, mz] of [
      [1552, 1558],
      [1648, 1558],
      [1552, 1642],
      [1648, 1642],
    ]) {
      this.addMesh(
        this.rootGroup,
        new THREE.CylinderGeometry(1.15, 1.35, 0.12, 8),
        this.goldMat,
        mx,
        center.y + 0.14,
        mz,
        false
      );
    }

    // Central Golden Processional Avenue (North-South & East-West Crossways + Open Main Gate Road)
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(12.5, 0.36, 118),
      this.stoneMat,
      1600,
      center.y - 0.02,
      1624,
      false
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(92, 0.36, 8.5),
      this.stoneMat,
      1600,
      center.y - 0.02,
      1598,
      false
    );

    // Glowing Golden Leyline Inlays along the Imperial Avenue and out through the Main Gate
    const leylineMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    addInlay(0.5, 0.06, 114, 1594.5, center.y + 0.17, 1624, leylineMat);
    addInlay(0.5, 0.06, 114, 1605.5, center.y + 0.17, 1624, leylineMat);

    // =========================================================================
    // FORTIFIED PERIMETER WALL BORDER ENCLOSING ALL INSIDE BUILDINGS
    // North: Z=1554, South: Z=1646, West: X=1548, East: X=1652
    // =========================================================================
    const wallHeight = 7.6;
    const wallThick = 4.2;

    // 1. North Rampart Wall (Z = 1554, X = 1548..1652 -> 104m wide)
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(104, wallHeight, wallThick),
      this.stoneMat,
      1600,
      center.y + wallHeight / 2,
      1554
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(104.4, 0.38, wallThick + 0.4),
      this.goldMat,
      1600,
      center.y + wallHeight + 0.15,
      1554
    );

    // 2. West Rampart Wall (X = 1548, Z = 1554..1646 -> 92m deep)
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(wallThick, wallHeight, 92),
      this.stoneMat,
      1548,
      center.y + wallHeight / 2,
      1600
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(wallThick + 0.4, 0.38, 92.4),
      this.goldMat,
      1548,
      center.y + wallHeight + 0.15,
      1600
    );

    // 3. East Rampart Wall (X = 1652, Z = 1554..1646 -> 92m deep)
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(wallThick, wallHeight, 92),
      this.stoneMat,
      1652,
      center.y + wallHeight / 2,
      1600
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(wallThick + 0.4, 0.38, 92.4),
      this.goldMat,
      1652,
      center.y + wallHeight + 0.15,
      1600
    );

    // 4. South Rampart Wall Left & Right Flanks (Z = 1646, leaving a 20m Main Gate opening at X = 1590..1610)
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(42, wallHeight, wallThick),
      this.stoneMat,
      1569,
      center.y + wallHeight / 2,
      1646
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(42.4, 0.38, wallThick + 0.4),
      this.goldMat,
      1569,
      center.y + wallHeight + 0.15,
      1646
    );

    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(42, wallHeight, wallThick),
      this.stoneMat,
      1631,
      center.y + wallHeight / 2,
      1646
    );
    this.addMesh(
      this.rootGroup,
      new THREE.BoxGeometry(42.4, 0.38, wallThick + 0.4),
      this.goldMat,
      1631,
      center.y + wallHeight + 0.15,
      1646
    );

    // Crenellated Battlements & Glowing Wall Braziers around North, South, West, East Walls
    for (let x = 1554; x <= 1646; x += 6) {
      // North Wall Battlements (Outer & Inner)
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(3.0, 1.4, 1.1), this.stoneMat, x, center.y + wallHeight + 0.85, 1552.4);
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(3.0, 1.1, 0.9), this.stoneMat, x, center.y + wallHeight + 0.7, 1555.6);
      if (x % 18 === 0) {
        this.addMesh(this.rootGroup, new THREE.SphereGeometry(0.42, 8, 8), this.lanternMat, x, center.y + wallHeight + 1.9, 1554);
      }

      // South Wall Battlements (skipping Main Gate opening X = 1588..1612)
      if (x < 1587 || x > 1613) {
        this.addMesh(this.rootGroup, new THREE.BoxGeometry(3.0, 1.4, 1.1), this.stoneMat, x, center.y + wallHeight + 0.85, 1647.6);
        this.addMesh(this.rootGroup, new THREE.BoxGeometry(3.0, 1.1, 0.9), this.stoneMat, x, center.y + wallHeight + 0.7, 1644.4);
      }
    }

    for (let z = 1560; z <= 1640; z += 6) {
      // West Wall Battlements
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(1.1, 1.4, 3.0), this.stoneMat, 1546.4, center.y + wallHeight + 0.85, z);
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(0.9, 1.1, 3.0), this.stoneMat, 1549.6, center.y + wallHeight + 0.7, z);
      // East Wall Battlements
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(1.1, 1.4, 3.0), this.stoneMat, 1653.6, center.y + wallHeight + 0.85, z);
      this.addMesh(this.rootGroup, new THREE.BoxGeometry(0.9, 1.1, 3.0), this.stoneMat, 1650.4, center.y + wallHeight + 0.7, z);

      if (z % 18 === 0) {
        this.addMesh(this.rootGroup, new THREE.SphereGeometry(0.42, 8, 8), this.lanternMat, 1548, center.y + wallHeight + 1.9, z);
        this.addMesh(this.rootGroup, new THREE.SphereGeometry(0.42, 8, 8), this.lanternMat, 1652, center.y + wallHeight + 1.9, z);
      }
    }

    // Six Perimeter Himalayan Pagoda Bastion Towers (4 Corners + 2 Mid-Wall Side Towers)
    const bastionCoords: Array<[number, number]> = [
      [1548, 1554],
      [1652, 1554],
      [1548, 1646],
      [1652, 1646],
      [1548, 1600],
      [1652, 1600],
    ];
    for (const [cx, cz] of bastionCoords) {
      const cGroup = new THREE.Group();
      cGroup.position.set(cx, center.y, cz);
      const towerShadow = createFlatContactShadow({
        width: 15.6,
        depth: 15.6,
        y: 0.09,
        material: this.radialShadowMat,
        shiftAmount: 1.45,
        renderOrder: 2,
      });
      cGroup.add(towerShadow.mesh);
      this.contactShadowEntries.push(towerShadow.entry);

      this.addMesh(cGroup, new THREE.CylinderGeometry(5.7, 6.3, 0.75, 8), this.darkStoneMat, 0, 0.35, 0);
      this.addMesh(cGroup, new THREE.CylinderGeometry(4.5, 5.4, 11.5, 8), this.stoneMat, 0, 5.75, 0);
      this.addMesh(cGroup, new THREE.ConeGeometry(6.6, 3.8, 8), this.crimsonRoofMat, 0, 12.8, 0);
      this.addMesh(cGroup, new THREE.CylinderGeometry(3.0, 3.4, 3.0, 8), this.woodMat, 0, 15.0, 0);
      this.addMesh(cGroup, new THREE.ConeGeometry(4.9, 3.0, 8), this.roofMat, 0, 17.4, 0);
      this.addMesh(cGroup, new THREE.CylinderGeometry(0.2, 0.55, 2.8, 8), this.goldMat, 0, 19.6, 0);
      this.addMesh(cGroup, new THREE.SphereGeometry(0.5, 8, 8), this.lanternMat, 0, 21.2, 0);
      this.rootGroup.add(cGroup);
    }

    // Southern Imperial Main Gatehouse Archway (Z = 1646, X = 1600)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(1600, center.y, 1646);
    const gateShadow = createFlatContactShadow({
      width: 32,
      depth: 14,
      y: 0.14,
      material: this.octagonalShadowMat,
      shiftAmount: 1.35,
      renderOrder: 2,
    });
    gateGroup.add(gateShadow.mesh);
    this.contactShadowEntries.push(gateShadow.entry);

    this.addMesh(gateGroup, new THREE.BoxGeometry(6.0, 12.0, 6.2), this.stoneMat, -10.5, 6.0, 0);
    this.addMesh(gateGroup, new THREE.BoxGeometry(6.0, 12.0, 6.2), this.stoneMat, 10.5, 6.0, 0);
    // Overhead Pagoda Bridge Arch
    this.addMesh(gateGroup, new THREE.BoxGeometry(27, 3.4, 5.8), this.woodMat, 0, 12.2, 0);
    this.addMesh(gateGroup, new THREE.ConeGeometry(18, 4.2, 4), this.crimsonRoofMat, 0, 15.8, 0).rotation.y =
      Math.PI / 4;
    this.addMesh(gateGroup, new THREE.BoxGeometry(25, 0.5, 6.2), this.goldMat, 0, 13.8, 0);
    // Twin Dragon Banners flanking the Main Gate
    const bLeft = this.addMesh(gateGroup, new THREE.PlaneGeometry(2.0, 5.2), this.bannerMat, -9.8, 7.6, 3.3);
    bLeft.userData = { isDragonBanner: true, phase: 0.4 };
    const bRight = this.addMesh(gateGroup, new THREE.PlaneGeometry(2.0, 5.2), this.bannerMat, 9.8, 7.6, 3.3);
    bRight.userData = { isDragonBanner: true, phase: 1.9 };

    // Ceremonial Stone Lantern Pillars lining the open Main Gate Road (Z = 1654..1677)
    for (const gz of [1655, 1666, 1677]) {
      for (const gx of [-8.2, 8.2]) {
        this.addMesh(gateGroup, new THREE.CylinderGeometry(0.45, 0.65, 2.4, 6), this.stoneMat, gx, 1.2, gz - 1646);
        this.addMesh(gateGroup, new THREE.SphereGeometry(0.42, 8, 8), this.lanternMat, gx, 2.65, gz - 1646);
        this.addMesh(gateGroup, new THREE.ConeGeometry(0.95, 0.7, 6), this.goldMat, gx, 3.25, gz - 1646);
      }
    }
    this.rootGroup.add(gateGroup);

    // Build Lush 3D Forest & Bushes surrounding the Wall Border (Except Main Gate!)
    this.initSurroundingForestAndBushes(center.y);
  }

  /**
   * 1B. Procedural 3D Forest Trees & Lush Bushes surrounding the Citadel Wall Border (Except Main Gate)
   */
  private initSurroundingForestAndBushes(baseY: number) {
    const forestGroup = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b,
      roughness: 0.9,
      metalness: 0.05,
    });
    const pineDarkMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.78,
      metalness: 0.05,
    });
    const pineMidMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.75,
      metalness: 0.06,
    });
    const pineBrightMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.72,
      metalness: 0.06,
    });
    const bushDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e6b34,
      roughness: 0.8,
      metalness: 0.04,
    });
    const bushLightMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.76,
      metalness: 0.05,
    });
    const blossomMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.6,
      emissive: 0x881337,
      emissiveIntensity: 0.2,
    });

    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.72, 3.2, 7);
    const coneBotGeo = new THREE.ConeGeometry(3.2, 4.4, 7);
    const coneMidGeo = new THREE.ConeGeometry(2.5, 3.8, 7);
    const coneTopGeo = new THREE.ConeGeometry(1.7, 3.2, 7);

    const bushCenterGeo = new THREE.DodecahedronGeometry(1.35, 1);
    const bushSideGeo = new THREE.DodecahedronGeometry(0.95, 1);
    const flowerGeo = new THREE.SphereGeometry(0.26, 6, 6);

    const pineShadowGeo = new THREE.PlaneGeometry(6.8, 6.8);
    const spawnPineTree = (x: number, z: number, scale: number, seed: number) => {
      const tree = new THREE.Group();
      tree.position.set(x, baseY, z);
      tree.scale.setScalar(scale);
      tree.rotation.y = (seed * 1.7) % (Math.PI * 2);

      const leafMat = seed % 3 === 0 ? pineDarkMat : seed % 3 === 1 ? pineMidMat : pineBrightMat;
      const pShadow = new THREE.Mesh(pineShadowGeo, this.radialShadowMat);
      pShadow.rotation.x = -Math.PI / 2;
      pShadow.position.y = 0.04;
      pShadow.castShadow = false;
      pShadow.receiveShadow = false;
      pShadow.renderOrder = 2;
      tree.add(pShadow);

      this.addMesh(tree, trunkGeo, trunkMat, 0, 1.6, 0, true);
      this.addMesh(tree, coneBotGeo, leafMat, 0, 3.9, 0, true);
      this.addMesh(tree, coneMidGeo, leafMat, 0, 6.2, 0, true);
      this.addMesh(tree, coneTopGeo, leafMat, 0, 8.2, 0, true);
      forestGroup.add(tree);
    };

    const spawnBushCluster = (x: number, z: number, scale: number, seed: number) => {
      const bush = new THREE.Group();
      bush.position.set(x, baseY, z);
      bush.scale.set(scale * 1.15, scale * 0.82, scale * 1.15);
      bush.rotation.y = (seed * 2.3) % (Math.PI * 2);

      const bMat = seed % 2 === 0 ? bushDarkMat : bushLightMat;
      this.addMesh(bush, bushCenterGeo, bMat, 0, 0.9, 0, true);
      this.addMesh(bush, bushSideGeo, bushDarkMat, -0.95, 0.65, 0.35, true);
      this.addMesh(bush, bushSideGeo, bushLightMat, 0.9, 0.65, -0.3, true);
      this.addMesh(bush, bushSideGeo, bMat, 0.15, 0.6, 0.85, true);

      // Himalayan rhododendron blossoms on every 3rd bush
      if (seed % 3 === 0) {
        this.addMesh(bush, flowerGeo, blossomMat, -0.4, 1.55, 0.45, false);
        this.addMesh(bush, flowerGeo, blossomMat, 0.55, 1.35, -0.25, false);
      }
      forestGroup.add(bush);
    };

    // Helper: returns true if (x, z) falls inside the open Southern Main Gate corridor
    const isMainGateCorridor = (x: number, z: number): boolean => {
      return z > 1638 && x > 1582 && x < 1618;
    };

    // 1. INNER WALL BORDER BUSHES (Tucked neatly along the inside base of North, West, East, and South-Flank walls)
    let seed = 1;
    // Inner North Wall Bushes (Z = 1557.2)
    for (let x = 1555; x <= 1645; x += 5.5) {
      if (Math.abs(x - 1600) < 13) continue; // Keep area behind Imperial Keep tidy
      spawnBushCluster(x, 1557.2, 0.72 + (seed % 3) * 0.08, seed++);
    }
    // Inner West & East Wall Bushes (X = 1551.2 and X = 1648.8)
    for (let z = 1561; z <= 1639; z += 5.5) {
      if (Math.abs(z - 1598) < 5.5) continue; // Skip East-West avenue
      spawnBushCluster(1551.2, z, 0.72 + (seed % 3) * 0.08, seed++);
      spawnBushCluster(1648.8, z, 0.72 + (seed % 3) * 0.08, seed++);
    }
    // Inner South Wall Bushes (Z = 1642.8, skipping Main Gate X = 1582..1618)
    for (let x = 1555; x <= 1645; x += 5.5) {
      if (isMainGateCorridor(x, 1643)) continue;
      spawnBushCluster(x, 1642.8, 0.74, seed++);
    }

    // 2. OUTER WALL BORDER BUSHES (Hugging the outside foot of the North, West, East, and South-Flank walls)
    // Outer North Wall Hedge & Shrubs (Z = 1549.5 & Z = 1546.5)
    for (let x = 1542; x <= 1658; x += 4.5) {
      spawnBushCluster(x + ((seed % 3) - 1) * 0.6, 1549.4, 0.95 + (seed % 4) * 0.12, seed++);
      if (seed % 2 === 0) {
        spawnBushCluster(x, 1545.8, 0.85, seed++);
      }
    }
    // Outer West & East Wall Hedge & Shrubs (X = 1543.4 and X = 1656.6)
    for (let z = 1548; z <= 1652; z += 4.5) {
      spawnBushCluster(1543.4, z + ((seed % 3) - 1) * 0.6, 0.95 + (seed % 4) * 0.12, seed++);
      spawnBushCluster(1656.6, z + ((seed % 3) - 1) * 0.6, 0.95 + (seed % 4) * 0.12, seed++);
    }
    // Outer South Wall Hedge & Shrubs (Z = 1650.6, strictly skipping Main Gate X = 1582..1618!)
    for (let x = 1542; x <= 1658; x += 4.5) {
      if (isMainGateCorridor(x, 1651)) continue;
      spawnBushCluster(x + ((seed % 3) - 1) * 0.5, 1650.6, 0.98 + (seed % 3) * 0.12, seed++);
      if (seed % 2 === 0) {
        spawnBushCluster(x, 1654.2, 0.86, seed++);
      }
    }

    // 3. DENSE 3D SURROUNDING HIMALAYAN FOREST BELT (North, West, East, and South-Flanks — Except Main Gate!)
    // North Forest Belt (Z = 1528..1545, X = 1526..1674)
    for (let z = 1530; z <= 1545; z += 6.5) {
      for (let x = 1528; x <= 1672; x += 7.0) {
        const jitterX = ((seed * 37) % 5) - 2.5;
        const jitterZ = ((seed * 19) % 4) - 2.0;
        const scale = 0.92 + ((seed * 13) % 7) * 0.11;
        spawnPineTree(x + jitterX, z + jitterZ, scale, seed++);
      }
    }

    // West Forest Belt (X = 1524..1541, Z = 1548..1666)
    for (let x = 1525; x <= 1540; x += 6.5) {
      for (let z = 1548; z <= 1666; z += 7.0) {
        const jitterX = ((seed * 29) % 4) - 2.0;
        const jitterZ = ((seed * 41) % 5) - 2.5;
        const scale = 0.95 + ((seed * 17) % 6) * 0.11;
        spawnPineTree(x + jitterX, z + jitterZ, scale, seed++);
      }
    }

    // East Forest Belt (X = 1659..1675, Z = 1548..1666)
    for (let x = 1659; x <= 1674; x += 6.5) {
      for (let z = 1548; z <= 1666; z += 7.0) {
        const jitterX = ((seed * 31) % 4) - 2.0;
        const jitterZ = ((seed * 23) % 5) - 2.5;
        const scale = 0.95 + ((seed * 19) % 6) * 0.11;
        spawnPineTree(x + jitterX, z + jitterZ, scale, seed++);
      }
    }

    // South-West & South-East Forest Flanks (Z = 1653..1670, strictly excluding Main Gate X = 1582..1618!)
    for (let z = 1654; z <= 1669; z += 6.5) {
      for (let x = 1532; x <= 1668; x += 7.0) {
        const tx = x + (((seed * 17) % 4) - 2.0);
        const tz = z + (((seed * 29) % 4) - 2.0);
        if (isMainGateCorridor(tx, tz)) continue;
        const scale = 0.9 + ((seed * 11) % 6) * 0.11;
        spawnPineTree(tx, tz, scale, seed++);
      }
    }

    this.rootGroup.add(forestGroup);
  }

  /**
   * 2. Build the Central Emperor's Imperial Pagoda Keep at (1600, 10.0, 1569)
   */
  private initCentralImperialKeep() {
    this.keepGroup.position.set(1600, 10.0, 1569);
    this.keepGroup.userData = { insidePlotId: 'keep' };

    const keepShadow = createFlatContactShadow({
      width: 29,
      depth: 25,
      y: 0.14,
      material: this.octagonalShadowMat,
      shiftAmount: 1.9,
      renderOrder: 2,
    });
    this.keepGroup.add(keepShadow.mesh);
    this.contactShadowEntries.push(keepShadow.entry);

    // Stepped Imperial Marble & Granite Terrace Plinth
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(22, 2.2, 18), this.stoneMat, 0, 1.1, 0);
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(22.6, 0.35, 18.6), this.goldMat, 0, 2.25, 0);
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(17.5, 4.5, 14.5), this.whiteStuccoMat, 0, 4.45, 0);

    // Tier 1 Crimson-Gold Eaves
    const roof1 = this.addMesh(this.keepGroup, new THREE.ConeGeometry(14.5, 3.6, 4), this.crimsonRoofMat, 0, 8.2, 0);
    roof1.rotation.y = Math.PI / 4;
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(18.5, 0.35, 18.5), this.goldMat, 0, 6.6, 0);

    // Tier 2 Royal Timber Hall
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(12.5, 3.8, 10.5), this.woodMat, 0, 11.2, 0);
    const roof2 = this.addMesh(this.keepGroup, new THREE.ConeGeometry(10.8, 3.2, 4), this.crimsonRoofMat, 0, 14.4, 0);
    roof2.rotation.y = Math.PI / 4;

    // Tier 3 Golden Dragon Throne Pavilion
    this.addMesh(this.keepGroup, new THREE.BoxGeometry(8.2, 3.2, 7.2), this.woodMat, 0, 17.0, 0);
    const roof3 = this.addMesh(this.keepGroup, new THREE.ConeGeometry(7.6, 3.0, 4), this.goldMat, 0, 19.8, 0);
    roof3.rotation.y = Math.PI / 4;

    // Supreme Golden Pinnacle Spire
    this.addMesh(this.keepGroup, new THREE.CylinderGeometry(0.22, 0.75, 4.5, 12), this.goldMat, 0, 23.2, 0);
    this.addMesh(this.keepGroup, new THREE.SphereGeometry(0.7, 12, 12), this.lanternMat, 0, 25.6, 0);

    // Orbiting Golden Imperial Mandala Ring
    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.16, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75 })
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 14.5;
    auraRing.userData = { isWardRing: true };
    this.keepGroup.add(auraRing);

    // Invisible Hit Collider for clicking the Keep
    const hitCollider = new THREE.Mesh(
      new THREE.BoxGeometry(22, 24, 18),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitCollider.position.y = 12;
    hitCollider.userData = { insidePlotId: 'keep' };
    this.keepGroup.add(hitCollider);
    this.pickableObjects.push(hitCollider);

    // Keep Floating Label Sprite
    const keepSprite = this.createBadgeSprite(
      `🏯 Lv.${this.keepLevel} Imperial Pagoda Keep`,
      'SUPREME CITADEL THRONE',
      '#facc15',
      false
    );
    keepSprite.position.set(0, 28.2, 0);
    keepSprite.scale.set(16, 4.0, 1);
    this.keepGroup.add(keepSprite);
    this.plotLabelSpritesMap.set('keep', keepSprite);

    this.rootGroup.add(this.keepGroup);
  }

  /**
   * 3. Initialize the 16 Interactive 3D Merge Building Plots
   */
  private initMergePlots() {
    COURTYARD_PLOT_COORDS.forEach((coords, index) => {
      const plotId = `plot-${index}`;
      const seed = INITIAL_SLOT_SEEDS[index];
      const plotData: KingdomMergePlot = {
        plotId,
        slotIndex: index,
        position: coords,
        building: seed ? createBuildingData(seed.category, seed.level, `${index}`) : null,
      };
      this.plots.push(plotData);

      const plotGroup = new THREE.Group();
      plotGroup.position.set(coords[0], coords[1], coords[2]);
      plotGroup.userData = { insidePlotId: plotId };

      // Grounded soft contact shadow anchored under the plot plinth (scaled dynamically by building tier)
      const plotShadow = createFlatContactShadow({
        width: 11.4,
        depth: 11.4,
        y: 0.13,
        material: this.radialShadowMat,
        shiftAmount: 0.9,
        renderOrder: 2,
      });
      plotGroup.add(plotShadow.mesh);
      this.contactShadowEntries.push(plotShadow.entry);
      this.plotShadowEntriesMap.set(plotId, plotShadow.entry);

      // Octagonal Carved Himalayan Granite Plinth Base
      const plinth = this.addMesh(
        plotGroup,
        new THREE.CylinderGeometry(4.4, 4.9, 0.75, 8),
        this.stoneMat,
        0,
        0.375,
        0,
        true
      );
      plinth.rotation.y = Math.PI / 8;

      // Golden Bevel Trim on Plinth
      const trim = this.addMesh(
        plotGroup,
        new THREE.CylinderGeometry(4.15, 4.25, 0.14, 8),
        this.goldMat,
        0,
        0.78,
        0,
        false
      );
      trim.rotation.y = Math.PI / 8;

      // Interactive Selection / Merge-Candidate Indicator Ring
      const ringGeo = new THREE.RingGeometry(4.5, 5.25, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const highlightRing = new THREE.Mesh(ringGeo, ringMat);
      highlightRing.rotation.x = -Math.PI / 2;
      highlightRing.position.y = 0.16;
      highlightRing.renderOrder = 4;
      highlightRing.visible = false;
      plotGroup.add(highlightRing);
      this.plotHighlightRingsMap.set(plotId, highlightRing);

      // Raycast Pickable Cylinder for this 3D Merge Plot
      const collider = new THREE.Mesh(
        new THREE.CylinderGeometry(4.7, 4.7, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      collider.position.y = 6.0;
      collider.userData = { insidePlotId: plotId };
      plotGroup.add(collider);
      this.pickableObjects.push(collider);

      this.plotGroupsMap.set(plotId, plotGroup);
      this.rootGroup.add(plotGroup);

      // Build initial 3D structure mesh if plot is occupied
      this.rebuildPlot3DMesh(plotData);
    });
  }

  /**
   * 4. Procedural 3D Multi-Tier Building Generator (Evolves visually with Merge Level!)
   */
  private rebuildPlot3DMesh(plot: KingdomMergePlot) {
    const plotGroup = this.plotGroupsMap.get(plot.plotId);
    if (!plotGroup) return;

    // Remove previous building mesh & label if present
    const oldMesh = this.plotBuildingMeshesMap.get(plot.plotId);
    if (oldMesh) {
      plotGroup.remove(oldMesh);
      this.plotBuildingMeshesMap.delete(plot.plotId);
    }
    const oldSprite = this.plotLabelSpritesMap.get(plot.plotId);
    if (oldSprite) {
      plotGroup.remove(oldSprite);
      if (oldSprite.material.map) oldSprite.material.map.dispose();
      oldSprite.material.dispose();
      this.plotLabelSpritesMap.delete(plot.plotId);
    }
    this.plotLabelKeysMap.delete(plot.plotId);

    const plotShadowEntry = this.plotShadowEntriesMap.get(plot.plotId);

    if (!plot.building) {
      if (plotShadowEntry) {
        plotShadowEntry.baseScaleX = 0.92;
        plotShadowEntry.baseScaleZ = 0.92;
        plotShadowEntry.shiftAmount = 0.45;
      }
      // Empty plot marker: subtle holographic construction anvil plinth
      const emptyGroup = new THREE.Group();
      emptyGroup.position.y = 0.8;
      emptyGroup.userData.baseScale = 1;
      const holoMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      this.addMesh(emptyGroup, new THREE.CylinderGeometry(1.8, 2.2, 0.5, 6), holoMat, 0, 0.25, 0, false);
      plotGroup.add(emptyGroup);
      this.plotBuildingMeshesMap.set(plot.plotId, emptyGroup);

      const emptySprite = this.createBadgeSprite(
        `➕ Empty Plot #${plot.slotIndex + 1}`,
        'CLICK TO SUMMON BUILDING',
        '#38bdf8',
        false
      );
      emptySprite.position.set(0, 4.2, 0);
      emptySprite.scale.set(10.5, 2.6, 1);
      plotGroup.add(emptySprite);
      this.plotLabelSpritesMap.set(plot.plotId, emptySprite);
      this.plotLabelKeysMap.set(plot.plotId, 'empty|0');
      this.refreshAnimatedPartsCache();
      return;
    }

    const { category, level } = plot.building;
    const bGroup = new THREE.Group();
    bGroup.position.y = 0.8;

    // Scale increases subtly with each merged tier + extra stories/ornaments
    const tierScale = 1.0 + Math.min(level - 1, 6) * 0.085;
    bGroup.userData.baseScale = tierScale;
    bGroup.scale.setScalar(tierScale);
    if (plotShadowEntry) {
      plotShadowEntry.baseScaleX = 1.04 * tierScale;
      plotShadowEntry.baseScaleZ = 1.04 * tierScale;
      plotShadowEntry.shiftAmount = (category === 'tower' ? 1.35 : 1.05) * tierScale;
    }

    if (category === 'barracks') {
      // GURKHA WAR BARRACKS: Fortified timber & granite drill hall with multi-tier pagoda roofs
      const stories = Math.min(4, 1 + Math.floor((level - 1) / 1));
      let curY = 0;
      for (let s = 0; s < stories; s++) {
        const w = 5.2 - s * 0.75;
        const d = 4.4 - s * 0.6;
        const h = s === 0 ? 2.6 : 2.0;
        this.addMesh(
          bGroup,
          new THREE.BoxGeometry(w, h, d),
          s === 0 ? this.stoneMat : this.woodMat,
          0,
          curY + h / 2,
          0
        );
        curY += h;

        const roofR = w * 0.78;
        const roof = this.addMesh(
          bGroup,
          new THREE.ConeGeometry(roofR, 1.6, 4),
          level >= 3 || s === stories - 1 ? this.crimsonRoofMat : this.roofMat,
          0,
          curY + 0.7,
          0
        );
        roof.rotation.y = Math.PI / 4;

        if (level >= 2) {
          this.addMesh(bGroup, new THREE.BoxGeometry(w + 0.4, 0.16, d + 0.4), this.goldMat, 0, curY + 0.05, 0);
        }
        curY += 1.05;
      }

      // Golden Roof Finial Spire
      this.addMesh(bGroup, new THREE.CylinderGeometry(0.1, 0.3, 1.5, 8), this.goldMat, 0, curY + 0.9, 0);

      // Twin War Banners & Weapon Rack in Forecourt
      const b1 = this.addMesh(bGroup, new THREE.PlaneGeometry(0.85, 2.2), this.bannerMat, -2.2, 1.6, 2.4);
      b1.userData = { isDragonBanner: true, phase: plot.slotIndex };
      const b2 = this.addMesh(bGroup, new THREE.PlaneGeometry(0.85, 2.2), this.bannerMat, 2.2, 1.6, 2.4);
      b2.userData = { isDragonBanner: true, phase: plot.slotIndex + 1.5 };
    } else if (category === 'tower') {
      // HIMALAYAN BASTION WATCHTOWER: Tall tapered granite defense tower with golden spire & prayer lanterns
      const towerHeight = 4.8 + Math.min(level, 6) * 1.35;
      this.addMesh(
        bGroup,
        new THREE.CylinderGeometry(1.9, 2.65, towerHeight, 8),
        this.stoneMat,
        0,
        towerHeight / 2,
        0
      );

      // Timber Machicolation War Gallery at top
      const topY = towerHeight;
      this.addMesh(bGroup, new THREE.CylinderGeometry(2.45, 2.2, 1.3, 8), this.woodMat, 0, topY + 0.65, 0);
      this.addMesh(
        bGroup,
        new THREE.ConeGeometry(3.2, 2.4, 8),
        level >= 2 ? this.crimsonRoofMat : this.roofMat,
        0,
        topY + 2.4,
        0
      );
      this.addMesh(bGroup, new THREE.CylinderGeometry(0.12, 0.38, 2.2, 8), this.goldMat, 0, topY + 4.2, 0);
      this.addMesh(bGroup, new THREE.SphereGeometry(0.32, 8, 8), this.lanternMat, 0, topY + 5.3, 0);

      // Glowing Corner Lanterns
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2 + Math.PI / 4;
        this.addMesh(
          bGroup,
          new THREE.SphereGeometry(0.22, 6, 6),
          this.lanternMat,
          Math.cos(ang) * 2.5,
          topY + 1.1,
          Math.sin(ang) * 2.5
        );
      }

      // Level 2+ Orbiting Golden Defense Ward Ring
      if (level >= 2) {
        const ward = new THREE.Mesh(
          new THREE.TorusGeometry(2.9, 0.09, 6, 32),
          new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.7 })
        );
        ward.rotation.x = Math.PI / 2;
        ward.position.y = topY + 0.8;
        ward.userData = { isWardRing: true };
        bGroup.add(ward);
      }
    } else if (category === 'mill') {
      // SACRED PINE & ORE MILL: Workshop with rotating waterwheel, blast furnace stack, and stockpiles
      const hallW = 4.6;
      const hallH = 2.6 + Math.min(level - 1, 4) * 0.55;
      this.addMesh(bGroup, new THREE.BoxGeometry(hallW, hallH, 3.8), this.woodMat, -0.3, hallH / 2, 0);
      const roof = this.addMesh(bGroup, new THREE.ConeGeometry(3.8, 1.9, 4), this.roofMat, -0.3, hallH + 0.9, 0);
      roof.rotation.y = Math.PI / 4;

      // Rotating Waterwheel on Right Flank
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(2.25, 1.8, 0);
      wheelGroup.userData = { isWaterwheel: true };
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.16, 8, 16), this.woodMat);
      rim.rotation.y = Math.PI / 2;
      wheelGroup.add(rim);
      for (let sp = 0; sp < 4; sp++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 0.22), this.goldMat);
        spoke.rotation.x = (sp * Math.PI) / 4;
        wheelGroup.add(spoke);
      }
      bGroup.add(wheelGroup);

      // Stone Blast Smelter Chimney Stack (grows with level)
      const stackH = 3.6 + level * 0.65;
      this.addMesh(bGroup, new THREE.CylinderGeometry(0.55, 0.85, stackH, 8), this.stoneMat, -1.8, stackH / 2, -1.1);
      this.addMesh(bGroup, new THREE.SphereGeometry(0.38, 8, 8), this.lanternMat, -1.8, stackH + 0.2, -1.1);

      // Gold & Timber Stockpiles in front
      for (let i = 0; i < Math.min(level, 4); i++) {
        this.addMesh(
          bGroup,
          new THREE.BoxGeometry(0.85, 0.45, 0.55),
          i % 2 === 0 ? this.goldMat : this.woodMat,
          -1.4 + i * 0.95,
          0.25,
          2.2
        );
      }
    } else if (category === 'shrine') {
      // GOLDEN MANDALA STUPA: Stepped whitewashed Buddhist stupa with lotus dome & 13-ring golden spire
      const steps = Math.min(4, 2 + Math.floor(level / 2));
      let curY = 0;
      for (let s = 0; s < steps; s++) {
        const w = 5.4 - s * 0.9;
        this.addMesh(bGroup, new THREE.BoxGeometry(w, 0.75, w), this.whiteStuccoMat, 0, curY + 0.375, 0);
        this.addMesh(bGroup, new THREE.BoxGeometry(w + 0.15, 0.12, w + 0.15), this.goldMat, 0, curY + 0.76, 0);
        curY += 0.78;
      }

      // Hemispherical Whitewashed Dome (Anda)
      const domeRadius = 2.15;
      this.addMesh(
        bGroup,
        new THREE.SphereGeometry(domeRadius, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
        this.whiteStuccoMat,
        0,
        curY + 0.2,
        0
      );
      curY += domeRadius * 0.85;

      // Golden Harmika Cube & Conical 13-Ring Spire
      this.addMesh(bGroup, new THREE.BoxGeometry(1.35, 0.95, 1.35), this.goldMat, 0, curY + 0.45, 0);
      const spireH = 2.8 + Math.min(level, 5) * 0.55;
      this.addMesh(
        bGroup,
        new THREE.CylinderGeometry(0.12, 0.72, spireH, 12),
        this.goldMat,
        0,
        curY + 0.95 + spireH / 2,
        0
      );
      const topTip = curY + 1.0 + spireH;
      this.addMesh(bGroup, new THREE.SphereGeometry(0.36, 10, 10), this.lanternMat, 0, topTip, 0);

      // Prayer Flag Lines radiating from Spire Tip
      for (let f = 0; f < 4; f++) {
        const ang = (f * Math.PI) / 2 + Math.PI / 4;
        const flag = this.addMesh(
          bGroup,
          new THREE.PlaneGeometry(2.4, 0.45),
          this.prayerFlagMat,
          Math.cos(ang) * 1.4,
          topTip - 1.2,
          Math.sin(ang) * 1.4,
          false
        );
        flag.rotation.y = -ang;
        flag.userData = { isPrayerFlag: true };
      }

      // Sacred Blessing Torus Ring
      const blessRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.08, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.75 })
      );
      blessRing.rotation.x = Math.PI / 2;
      blessRing.position.y = curY + 0.5;
      blessRing.userData = { isBlessingRing: true };
      bGroup.add(blessRing);
    }

    plotGroup.add(bGroup);
    this.plotBuildingMeshesMap.set(plot.plotId, bGroup);
    this.refreshAnimatedPartsCache();
  }

  /**
   * Create a crisp 3D CanvasTexture Sprite Billboard for building level & merge hints
   */
  private createBadgeSprite(
    title: string,
    subtitle: string,
    borderColor: string,
    isMergeCandidate: boolean
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 128);

      // Rounded dark slate badge pill
      ctx.fillStyle = isMergeCandidate ? 'rgba(6, 78, 59, 0.94)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = isMergeCandidate ? '#4ade80' : borderColor;
      ctx.lineWidth = isMergeCandidate ? 6 : 4;

      const r = 22;
      ctx.beginPath();
      ctx.moveTo(16 + r, 14);
      ctx.lineTo(496 - r, 14);
      ctx.quadraticCurveTo(496, 14, 496, 14 + r);
      ctx.lineTo(496, 114 - r);
      ctx.quadraticCurveTo(496, 114, 496 - r, 114);
      ctx.lineTo(16 + r, 114);
      ctx.quadraticCurveTo(16, 114, 16, 114 - r);
      ctx.lineTo(16, 14 + r);
      ctx.quadraticCurveTo(16, 14, 16 + r, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Main Title (Level & Name)
      ctx.font = 'bold 34px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isMergeCandidate ? '#bbf7d0' : '#fef08a';
      ctx.fillText(title, 256, 60);

      // Subtitle / Merge Callout
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.fillStyle = isMergeCandidate ? '#4ade80' : '#cbd5e1';
      ctx.fillText(subtitle, 256, 95);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 20;
    return sprite;
  }

  /**
   * Update 3D selection rings and floating merge badges across all 16 plots
   */
  private refreshHighlightsAndLabels() {
    const selectedPlot = this.plots.find((p) => p.plotId === this.selectedPlotId) || null;
    const selectedBldg = selectedPlot?.building || null;

    for (const plot of this.plots) {
      const ring = this.plotHighlightRingsMap.get(plot.plotId);
      const plotGroup = this.plotGroupsMap.get(plot.plotId);
      if (!ring || !plotGroup) continue;

      const isSelected = plot.plotId === this.selectedPlotId;
      const isMatchingTwin =
        !isSelected &&
        selectedBldg !== null &&
        plot.building !== null &&
        plot.building.category === selectedBldg.category &&
        plot.building.level === selectedBldg.level &&
        plot.building.level < plot.building.maxLevel;

      if (isSelected) {
        ring.visible = true;
        (ring.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.95;
      } else if (isMatchingTwin) {
        ring.visible = true;
        (ring.material as THREE.MeshBasicMaterial).color.setHex(0x4ade80);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.92;
      } else {
        ring.visible = false;
      }

      const labelKey = plot.building
        ? `${plot.building.category}|${plot.building.level}|${plot.building.powerBonus}|${isMatchingTwin ? 1 : 0}`
        : `empty|${selectedBldg ? 1 : 0}`;
      if (this.plotLabelKeysMap.get(plot.plotId) === labelKey && this.plotLabelSpritesMap.has(plot.plotId)) {
        continue;
      }
      this.plotLabelKeysMap.set(plot.plotId, labelKey);

      // Rebuild label sprite only when level, power, or merge-candidate state actually changes
      const oldSprite = this.plotLabelSpritesMap.get(plot.plotId);
      if (oldSprite) {
        plotGroup.remove(oldSprite);
        if (oldSprite.material.map) oldSprite.material.map.dispose();
        oldSprite.material.dispose();
      }

      if (plot.building) {
        const b = plot.building;
        const borderColor =
          b.category === 'barracks'
            ? '#f87171'
            : b.category === 'tower'
              ? '#facc15'
              : b.category === 'shrine'
                ? '#c084fc'
                : '#38bdf8';

        const titleText = `${b.icon} Lv.${b.level} ${BUILDING_TEMPLATES[b.category].baseName}`;
        const subText = isMatchingTwin
          ? `✨ CLICK TO MERGE → LV.${b.level + 1}!`
          : `⚡ ${b.powerBonus.toLocaleString()} PWR`;

        const sprite = this.createBadgeSprite(titleText, subText, borderColor, isMatchingTwin);
        const topY = 8.2 + Math.min(b.level, 6) * 1.1;
        sprite.position.set(0, topY, 0);
        sprite.scale.set(12.2, 3.05, 1);
        plotGroup.add(sprite);
        this.plotLabelSpritesMap.set(plot.plotId, sprite);
      } else {
        const emptySprite = this.createBadgeSprite(
          `➕ Empty Plot #${plot.slotIndex + 1}`,
          selectedBldg ? 'CLICK TO MOVE OR SUMMON' : 'CLICK TO SUMMON BUILDING',
          '#38bdf8',
          false
        );
        emptySprite.position.set(0, 4.2, 0);
        emptySprite.scale.set(10.5, 2.6, 1);
        plotGroup.add(emptySprite);
        this.plotLabelSpritesMap.set(plot.plotId, emptySprite);
      }
    }
  }

  /**
   * Trigger a 3D elastic scale-pop animation on a plot's building mesh
   */
  private triggerPopAnimation(plotId: string) {
    const bGroup = this.plotBuildingMeshesMap.get(plotId);
    if (!bGroup) return;
    const baseScale = typeof bGroup.userData?.baseScale === 'number' ? bGroup.userData.baseScale : 1;
    const existing = this.activePopAnimations.find((a) => a.group === bGroup);
    if (existing) {
      existing.baseScale = baseScale;
      existing.elapsed = 0;
      return;
    }
    this.activePopAnimations.push({
      group: bGroup,
      baseScale,
      elapsed: 0,
      duration: 0.42,
    });
  }

  /**
   * Handle clicking on a 3D plot or the Keep in the 3D scene
   */
  public handlePlotClick(clickedId: string): {
    action: 'selected' | 'merged' | 'moved';
    mergedBuildingName?: string;
    newLevel?: number;
  } {
    if (clickedId === 'keep') {
      this.selectedPlotId = 'keep';
      this.refreshHighlightsAndLabels();
      this.emitState();
      return { action: 'selected' };
    }

    const targetPlot = this.plots.find((p) => p.plotId === clickedId);
    if (!targetPlot) return { action: 'selected' };

    const sourcePlot =
      this.selectedPlotId && this.selectedPlotId !== 'keep'
        ? this.plots.find((p) => p.plotId === this.selectedPlotId) || null
        : null;

    // Check if sourcePlot and targetPlot are distinct and have matching (category, level)
    if (
      sourcePlot &&
      sourcePlot.plotId !== targetPlot.plotId &&
      sourcePlot.building &&
      targetPlot.building &&
      sourcePlot.building.category === targetPlot.building.category &&
      sourcePlot.building.level === targetPlot.building.level &&
      targetPlot.building.level < targetPlot.building.maxLevel
    ) {
      const nextLevel = targetPlot.building.level + 1;
      const category = targetPlot.building.category;

      // Clear source plot and evolve target plot to nextLevel!
      sourcePlot.building = null;
      targetPlot.building = createBuildingData(category, nextLevel, `${targetPlot.slotIndex}`);
      this.selectedPlotId = targetPlot.plotId;

      this.rebuildPlot3DMesh(sourcePlot);
      this.rebuildPlot3DMesh(targetPlot);
      this.triggerPopAnimation(targetPlot.plotId);
      this.refreshHighlightsAndLabels();
      this.emitState();

      const worldPos = new THREE.Vector3(
        targetPlot.position[0],
        targetPlot.position[1] + 4.5,
        targetPlot.position[2]
      );
      this.onMergeEffect?.(
        worldPos,
        `✨ MERGED! Lv.${nextLevel} ${targetPlot.building.name}!`,
        '#4ade80'
      );

      return {
        action: 'merged',
        mergedBuildingName: targetPlot.building.name,
        newLevel: nextLevel,
      };
    }

    // Otherwise select the clicked plot
    this.selectedPlotId = targetPlot.plotId;
    this.refreshHighlightsAndLabels();
    this.emitState();
    return { action: 'selected' };
  }

  /**
   * Merge the currently selected plot with its first matching twin on the courtyard
   */
  public mergeSelectedWithMatchingTwin(): boolean {
    if (!this.selectedPlotId || this.selectedPlotId === 'keep') return false;
    const sourcePlot = this.plots.find((p) => p.plotId === this.selectedPlotId);
    if (!sourcePlot || !sourcePlot.building) return false;

    const twinPlot = this.plots.find(
      (p) =>
        p.plotId !== sourcePlot.plotId &&
        p.building &&
        p.building.category === sourcePlot.building!.category &&
        p.building.level === sourcePlot.building!.level &&
        p.building.level < p.building.maxLevel
    );

    if (!twinPlot) return false;
    this.handlePlotClick(twinPlot.plotId);
    return true;
  }

  /**
   * One-Click Auto-Merge All matching 3D building pairs across the courtyard
   */
  public autoMergeAll(): number {
    let mergesCount = 0;
    let foundPair = true;

    while (foundPair) {
      foundPair = false;
      for (let i = 0; i < this.plots.length; i++) {
        const plotA = this.plots[i];
        if (!plotA.building || plotA.building.level >= plotA.building.maxLevel) continue;

        for (let j = i + 1; j < this.plots.length; j++) {
          const plotB = this.plots[j];
          if (
            plotB.building &&
            plotB.building.category === plotA.building.category &&
            plotB.building.level === plotA.building.level
          ) {
            const nextLevel = plotA.building.level + 1;
            const cat = plotA.building.category;

            plotB.building = null;
            plotA.building = createBuildingData(cat, nextLevel, `${plotA.slotIndex}`);

            this.rebuildPlot3DMesh(plotB);
            this.rebuildPlot3DMesh(plotA);
            this.triggerPopAnimation(plotA.plotId);

            const worldPos = new THREE.Vector3(
              plotA.position[0],
              plotA.position[1] + 4.5,
              plotA.position[2]
            );
            this.onMergeEffect?.(
              worldPos,
              `✨ AUTO-MERGE → Lv.${nextLevel} ${plotA.building.name}!`,
              '#facc15'
            );

            this.selectedPlotId = plotA.plotId;
            mergesCount++;
            foundPair = true;
            break;
          }
        }
        if (foundPair) break;
      }
    }

    if (mergesCount > 0) {
      this.refreshHighlightsAndLabels();
      this.emitState();
    }
    return mergesCount;
  }

  /**
   * Construct / Summon a new Lv.1 3D building onto an empty courtyard plot
   */
  public constructBuilding(category: MergeBuildingCategory, preferredPlotId?: string): KingdomMergePlot | null {
    let targetPlot: KingdomMergePlot | undefined;
    if (preferredPlotId && preferredPlotId !== 'keep') {
      const candidate = this.plots.find((p) => p.plotId === preferredPlotId);
      if (candidate && !candidate.building) {
        targetPlot = candidate;
      }
    }
    if (!targetPlot) {
      targetPlot = this.plots.find((p) => !p.building);
    }
    if (!targetPlot) return null;

    targetPlot.building = createBuildingData(category, 1, `${targetPlot.slotIndex}`);
    this.selectedPlotId = targetPlot.plotId;
    this.rebuildPlot3DMesh(targetPlot);
    this.triggerPopAnimation(targetPlot.plotId);
    this.refreshHighlightsAndLabels();
    this.emitState();

    const worldPos = new THREE.Vector3(
      targetPlot.position[0],
      targetPlot.position[1] + 4.0,
      targetPlot.position[2]
    );
    this.onMergeEffect?.(
      worldPos,
      `🔨 BUILT Lv.1 ${BUILDING_TEMPLATES[category].baseName}!`,
      '#38bdf8'
    );

    return targetPlot;
  }

  /**
   * Upgrade the Central Imperial Pagoda Keep
   */
  public upgradeImperialKeep(): boolean {
    if (this.keepLevel >= this.keepMaxLevel) return false;
    this.keepLevel += 1;
    this.keepPower = Math.round(this.keepPower * 1.18);

    const oldSprite = this.plotLabelSpritesMap.get('keep');
    if (oldSprite) {
      this.keepGroup.remove(oldSprite);
      if (oldSprite.material.map) oldSprite.material.map.dispose();
      oldSprite.material.dispose();
    }
    const keepSprite = this.createBadgeSprite(
      `🏯 Lv.${this.keepLevel} Imperial Pagoda Keep`,
      'SUPREME CITADEL THRONE',
      '#facc15',
      false
    );
    keepSprite.position.set(0, 28.2, 0);
    keepSprite.scale.set(16, 4.0, 1);
    this.keepGroup.add(keepSprite);
    this.plotLabelSpritesMap.set('keep', keepSprite);

    this.onMergeEffect?.(
      new THREE.Vector3(1600, 22, 1569),
      `🏯 IMPERIAL KEEP UPGRADED TO LV.${this.keepLevel}!`,
      '#fef08a'
    );

    this.emitState();
    return true;
  }

  /**
   * Frame animation update for 3D courtyard buildings (waterwheels, rings, banners, shadows, pop-in scale)
   */
  public update(delta: number, elapsed: number, shadowState?: ShadowProjectionState) {
    if (shadowState) {
      this.radialShadowMat.opacity = shadowState.contactOpacity;
      this.octagonalShadowMat.opacity = Math.min(0.84, shadowState.contactOpacity * 1.06);
      syncContactShadowEntries(this.contactShadowEntries, shadowState);
    }
    // Animate pulsing rings on selected & merge-candidate plots
    this.plotHighlightRingsMap.forEach((ring) => {
      if (ring.visible) {
        const pulse = 1.0 + Math.sin(elapsed * 5.5) * 0.06;
        ring.scale.set(pulse, pulse, 1);
      }
    });

    // Animate cached 3D building parts without scene graph traversal
    for (let i = 0; i < this.animWaterwheels.length; i++) {
      this.animWaterwheels[i].rotation.x += delta * 2.2;
    }
    for (let i = 0; i < this.animWardRings.length; i++) {
      this.animWardRings[i].rotation.z += delta * 0.65;
    }
    for (let i = 0; i < this.animBlessingRings.length; i++) {
      this.animBlessingRings[i].rotation.z -= delta * 0.55;
    }
    for (let i = 0; i < this.animDragonBanners.length; i++) {
      const b = this.animDragonBanners[i];
      b.obj.rotation.y = Math.sin(elapsed * 3.4 + b.phase) * 0.18;
    }
    for (let i = 0; i < this.animPrayerFlags.length; i++) {
      this.animPrayerFlags[i].rotation.z = Math.sin(elapsed * 4.0) * 0.1;
    }

    // Process elastic scale-pop animations preserving tier baseScale
    for (let i = this.activePopAnimations.length - 1; i >= 0; i--) {
      const anim = this.activePopAnimations[i];
      anim.elapsed += delta;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const bounce = 1 + Math.sin(t * Math.PI) * 0.32;
      anim.group.scale.setScalar(anim.baseScale * bounce);
      if (t >= 1) {
        anim.group.scale.setScalar(anim.baseScale);
        this.activePopAnimations.splice(i, 1);
      }
    }
  }
}
