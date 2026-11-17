import * as THREE from 'three';
import { WORLD_BOUNDS, RESERVED_PLOTS, WORLD_RESOURCES } from './WorldCoordinates';
import {
  createWaterfallTexture,
  createTerrainSurfaceNormalMap,
  createTerrainDetailAlbedoTexture,
} from './proceduralTextures';

/**
 * 10 Reusable Modular Terrain Biome Archetypes for the Medieval Himalayan Strategy Realm
 */
export type TerrainBiomeType =
  | 'green_plains'
  | 'grass'
  | 'forest_floor'
  | 'hills'
  | 'rocky_mountains'
  | 'snowy_peaks'
  | 'cliffs'
  | 'dirt_paths'
  | 'wetlands'
  | 'riverbanks';

export type TerrainLodMode = 'auto' | 'lod0' | 'lod1' | 'lod2';

export interface BiomeTileSpec {
  id: TerrainBiomeType;
  name: string;
  shortName: string;
  colorHex: string;
  skirtColorHex: string;
  roughness: number;
  metalness: number;
  normalScale: number;
  movementCost: number;
  passable: boolean;
  description: string;
  sampleWorldPos: [number, number];
}

export interface HexTileData {
  key: string;
  q: number;
  r: number;
  wx: number;
  wz: number;
  elevation: number;
  biome: TerrainBiomeType;
  slopeDiff: number;
  passable: boolean;
  movementCost: number;
  neighborElevations: number[];
}

export const MODULAR_BIOME_SPECS: Record<TerrainBiomeType, BiomeTileSpec> = {
  green_plains: {
    id: 'green_plains',
    name: 'Green Plains',
    shortName: 'Plains',
    colorHex: '#3f7638',
    skirtColorHex: '#2f5929',
    roughness: 0.82,
    metalness: 0.05,
    normalScale: 0.75,
    movementCost: 1.0,
    passable: true,
    description: 'Smooth pastoral alpine valley turf ideal for rapid cavalry maneuvers and citadel foundations.',
    sampleWorldPos: [760, 620],
  },
  grass: {
    id: 'grass',
    name: 'Verdant Steppe Grass',
    shortName: 'Grass',
    colorHex: '#4f883d',
    skirtColorHex: '#3b662d',
    roughness: 0.78,
    metalness: 0.05,
    normalScale: 0.85,
    movementCost: 1.0,
    passable: true,
    description: 'Lush highland meadow grass with wildflower clusters and dense turf blades.',
    sampleWorldPos: [900, 580],
  },
  forest_floor: {
    id: 'forest_floor',
    name: 'Deodar Forest Floor',
    shortName: 'Forest',
    colorHex: '#2b4b29',
    skirtColorHex: '#1f361e',
    roughness: 0.88,
    metalness: 0.04,
    normalScale: 0.95,
    movementCost: 1.4,
    passable: true,
    description: 'Rich humic pine-needle loam, moss carpets, and ancient roots beneath timber groves.',
    sampleWorldPos: [980, 860],
  },
  hills: {
    id: 'hills',
    name: 'Highland Hills',
    shortName: 'Hills',
    colorHex: '#5e7a42',
    skirtColorHex: '#465931',
    roughness: 0.80,
    metalness: 0.08,
    normalScale: 0.90,
    movementCost: 1.5,
    passable: true,
    description: 'Rolling highland knolls with smooth elevation transitions and strategic vantage points.',
    sampleWorldPos: [620, 900],
  },
  rocky_mountains: {
    id: 'rocky_mountains',
    name: 'Craggy Rocky Mountains',
    shortName: 'Mountains',
    colorHex: '#5a6673',
    skirtColorHex: '#3e4750',
    roughness: 0.85,
    metalness: 0.18,
    normalScale: 1.25,
    movementCost: 2.2,
    passable: true,
    description: 'Weathered Himalayan slate and granite formations rich in iron, stone, and aurum veins.',
    sampleWorldPos: [1280, 1160],
  },
  snowy_peaks: {
    id: 'snowy_peaks',
    name: 'Glacial Snowy Peaks',
    shortName: 'Snow Peaks',
    colorHex: '#eef4fa',
    skirtColorHex: '#94a3b8',
    roughness: 0.45,
    metalness: 0.15,
    normalScale: 0.80,
    movementCost: 2.4,
    passable: true,
    description: 'High-altitude Himalayan snowfields, crystalline frost ridges, and glacial moraines.',
    sampleWorldPos: [540, 1300],
  },
  cliffs: {
    id: 'cliffs',
    name: 'Stratified Granite Cliffs',
    shortName: 'Cliffs',
    colorHex: '#3b4757',
    skirtColorHex: '#1e293b',
    roughness: 0.90,
    metalness: 0.14,
    normalScale: 1.35,
    movementCost: 9.9,
    passable: false,
    description: 'Steep granite cliff faces and rocky escarpments that form natural defensive barriers.',
    sampleWorldPos: [570, 730],
  },
  dirt_paths: {
    id: 'dirt_paths',
    name: 'Medieval Dirt & Cobble Paths',
    shortName: 'Dirt Paths',
    colorHex: '#8a7256',
    skirtColorHex: '#63513d',
    roughness: 0.84,
    metalness: 0.08,
    normalScale: 0.85,
    movementCost: 0.7,
    passable: true,
    description: 'Compacted caravan dirt roads and cobblestone highways connecting the realm.',
    sampleWorldPos: [800, 620],
  },
  wetlands: {
    id: 'wetlands',
    name: 'Shallow Marsh Wetlands',
    shortName: 'Wetlands',
    colorHex: '#355949',
    skirtColorHex: '#253d32',
    roughness: 0.25,
    metalness: 0.22,
    normalScale: 0.70,
    movementCost: 1.8,
    passable: true,
    description: 'Lowland marsh basins with natural alpine ponds, peat moss, and cattail reed beds.',
    sampleWorldPos: [430, 500],
  },
  riverbanks: {
    id: 'riverbanks',
    name: 'Natural Riverbanks & Streams',
    shortName: 'Riverbanks',
    colorHex: '#594c3f',
    skirtColorHex: '#3d342b',
    roughness: 0.22,
    metalness: 0.25,
    normalScale: 0.90,
    movementCost: 1.3,
    passable: true,
    description: 'Smooth winding mountain stream channels with wet mud embankments and river stones.',
    sampleWorldPos: [500, 610],
  },
};

export class TerrainGenerator {
  // Primary root object added to scene (contains seamless LOD chunks + natural rivers + collision proxy)
  public mesh!: THREE.Group;
  public collisionMesh!: THREE.Mesh;
  public vegetationGroup!: THREE.Group;
  public plotMarkersGroup!: THREE.Group;
  public waterfallsGroup = new THREE.Group();
  public mistPuffsGroup = new THREE.Group();
  public leylineStreamsGroup = new THREE.Group();

  // Regional LOD Chunks & Inspector Overlays
  public lodChunks: THREE.LOD[] = [];
  public hexGridOverlay!: THREE.LineSegments;
  public biomeHighlightGroup = new THREE.Group();
  public selectedHexRing!: THREE.LineLoop;

  public waterfallMaterials: THREE.MeshStandardMaterial[] = [];
  public riverStreamMaterials: THREE.MeshStandardMaterial[] = [];
  public mistParticles: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; speed: number; rotSpeed: number }> = [];
  public leylineMaterial!: THREE.MeshStandardMaterial;
  public terrainMaterial!: THREE.MeshStandardMaterial;

  // Spatial Tile Constants
  public static readonly HEX_RADIUS = 22.0;
  public static readonly CITADEL_ELEVATION = 10.0;
  public static readonly TERRACE_STEP = 3.0;

  private width = WORLD_BOUNDS.MAX_X - WORLD_BOUNDS.MIN_X; // 1600
  private depth = WORLD_BOUNDS.MAX_Z - WORLD_BOUNDS.MIN_Z; // 1600

  // Spatial Map of all Tactical Tiles by "q,r"
  public hexTilesMap = new Map<string, HexTileData>();
  public biomeCounts: Record<TerrainBiomeType, number> = {
    green_plains: 0,
    grass: 0,
    forest_floor: 0,
    hills: 0,
    rocky_mountains: 0,
    snowy_peaks: 0,
    cliffs: 0,
    dirt_paths: 0,
    wetlands: 0,
    riverbanks: 0,
  };

  public currentLodMode: TerrainLodMode = 'auto';
  public showHexGrid = false;
  public highlightedBiome: TerrainBiomeType | null = null;
  public totalTrianglesByLod = { lod0: 0, lod1: 0, lod2: 0 };

  constructor() {
    this.createSeamlessModularTerrain();
    this.createReservedPlotMarkers();
    this.createInstancedVegetation();
    this.createWaterfallsAndNaturalRivers();
  }

  /**
   * Continuous smooth elevation function for any (x, z) in the 1600x1600 realm.
   * Produces realistic readable elevation terraces with smooth beveled transitions
   * and natural river/marsh depressions.
   */
  public getHeightAt(x: number, z: number): number {
    if (x <= 0 || x >= 1600 || z <= 0 || z >= 1600) {
      const cx = THREE.MathUtils.clamp(x, 0.5, 1599.5);
      const cz = THREE.MathUtils.clamp(z, 0.5, 1599.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(x - cx, z - cz);
      const t = THREE.MathUtils.clamp(outDist / 540, 0, 1);
      const ridgeWave =
        Math.sin(x * 0.018 + z * 0.011) * 18.0 +
        Math.cos(x * 0.032 - z * 0.024) * 11.0 +
        Math.sin(outDist * 0.022) * 8.0;
      const peakLift = Math.sin(t * Math.PI * 0.88) * 58.0 + t * 24.0;
      return Math.max(22, edgeH + peakLift + ridgeWave * (0.35 + t * 0.65));
    }

    // 1. Reserved Flat Plots Override (The Congress & 36 Shrines) with smooth skirt blend
    for (const plot of RESERVED_PLOTS) {
      const dist = Math.hypot(x - plot.position[0], z - plot.position[2]);
      if (dist < plot.radius) {
        return plot.position[1];
      } else if (dist < plot.radius + 14.0) {
        const t = (dist - plot.radius) / 14.0;
        const smoothT = t * t * (3 - 2 * t);
        const rawH = this.getSmoothTerraceHeight(x, z);
        return THREE.MathUtils.lerp(plot.position[1], rawH, smoothT);
      }
    }

    // 2. Central The Congress & Inner Courtyard Plateau
    const distCitadel = Math.hypot(x - 800, z - 800);
    const distVanguard = Math.hypot(x - 800, z - 680);
    const minCenterDist = Math.min(distCitadel, distVanguard);

    if (minCenterDist < 56) {
      return TerrainGenerator.CITADEL_ELEVATION;
    } else if (minCenterDist < 88) {
      const t = (minCenterDist - 56) / 32.0;
      const smoothT = t * t * (3 - 2 * t);
      const natural = this.getSmoothTerraceHeight(x, z);
      return THREE.MathUtils.lerp(TerrainGenerator.CITADEL_ELEVATION, natural, smoothT);
    }

    return this.getSmoothTerraceHeight(x, z);
  }

  /**
   * Smoothly beveled terrace height so elevation layers are readable without jagged steps
   */
  private getSmoothTerraceHeight(x: number, z: number): number {
    const rawH = this.getNaturalTerrainHeight(x, z);
    const step = TerrainGenerator.TERRACE_STEP;

    // Smooth step quantization (readable strategy terraces with smooth 40% bevel ramps)
    const cell = Math.floor(rawH / step);
    const frac = (rawH - cell * step) / step;
    const smoothFrac = frac < 0.65 ? frac * 0.25 : 0.1625 + ((frac - 0.65) / 0.35) * 0.8375;
    let height = (cell + smoothFrac) * step;

    // Natural smooth river channel & marsh depression
    const distWetland = this.getDistanceToWetlands(x, z);
    const distStream = this.getDistanceToStreams(x, z);

    if (distWetland < 34.0) {
      const wFactor = Math.max(0, 1.0 - distWetland / 34.0);
      height = THREE.MathUtils.lerp(height, 5.8, wFactor * 0.85);
    }
    if (distStream < 11.0) {
      const sFactor = Math.max(0, 1.0 - distStream / 11.0);
      height -= sFactor * 1.4;
    }

    // Roadway ramps: smooth grade along imperial roads
    const distRoad = this.getDistanceToRoads(x, z);
    if (distRoad < 10.0) {
      const rampFactor = Math.max(0, 1.0 - distRoad / 10.0);
      return THREE.MathUtils.lerp(height, rawH, rampFactor * 0.85);
    }

    return Math.max(3.5, height);
  }

  private getNaturalTerrainHeight(x: number, z: number): number {
    const distFromBorder = Math.min(x, 1600 - x, z, 1600 - z);

    let perimeterHeight = 0;
    if (distFromBorder < 140) {
      const factor = (140 - distFromBorder) / 140;
      perimeterHeight = Math.pow(factor, 1.6) * 58.0;
      perimeterHeight += Math.sin(x * 0.025) * Math.cos(z * 0.025) * 7.5;
      perimeterHeight += Math.sin(x * 0.055 + z * 0.04) * 3.8;
    }

    let rollingHills = 8.2;
    rollingHills += Math.sin(x * 0.008) * 4.0;
    rollingHills += Math.cos(z * 0.009) * 3.6;
    rollingHills += Math.sin((x + z) * 0.012) * 2.4;
    rollingHills += Math.sin(x * 0.021 - z * 0.018) * 1.2;

    if (z > 1120) {
      const northFactor = (z - 1120) / 480;
      rollingHills += northFactor * 14.0 + Math.sin(x * 0.015) * 3.2;
    }

    if (x > 1140) {
      const eastFactor = (x - 1140) / 460;
      rollingHills += eastFactor * 11.5 + Math.cos(z * 0.015) * 2.8;
    }

    if (x < 720 && z < 720) {
      rollingHills += Math.cos(x * 0.01) * Math.sin(z * 0.01) * 2.0;
    }

    return Math.max(3.5, rollingHills + perimeterHeight);
  }

  /**
   * Distance from paved imperial cobblestone roads and shrine-to-Congress lattice routes
   */
  public getDistanceToRoads(x: number, z: number): number {
    const dCentralNS = Math.abs(x - 800);
    const inRangeNS = z >= 220 && z <= 1380;

    const dCentralEW = Math.abs(z - 800);
    const inRangeEW = x >= 220 && x <= 1380;

    const dDiag1 = Math.abs((x - 800) - (z - 800)) / Math.SQRT2;
    const dDiag2 = Math.abs((x - 800) + (z - 800)) / Math.SQRT2;
    const inDiagRange = Math.hypot(x - 800, z - 800) <= 580;

    let minDist = 999;
    if (inRangeNS) minDist = Math.min(minDist, dCentralNS);
    if (inRangeEW) minDist = Math.min(minDist, dCentralEW);
    if (inDiagRange) {
      minDist = Math.min(minDist, dDiag1, dDiag2);
    }

    // Ring corridors linking Shrines B and C
    for (const c of [452, 1148]) {
      if (x >= 220 && x <= 1380) minDist = Math.min(minDist, Math.abs(z - c));
      if (z >= 220 && z <= 1380) minDist = Math.min(minDist, Math.abs(x - c));
    }

    return minDist;
  }

  /**
   * Distance to shallow lowland marsh wetland basins
   */
  public getDistanceToWetlands(x: number, z: number): number {
    const dWestMarsh = Math.hypot(x - 430, z - 500);
    const dEastMarsh = Math.hypot(x - 970, z - 430);
    return Math.min(dWestMarsh, dEastMarsh);
  }

  /**
   * Exact curve X for Western & Eastern mountain streams
   */
  public getStreamCenterX(streamIndex: 0 | 1, z: number): number {
    if (streamIndex === 0) {
      const t = THREE.MathUtils.clamp((z - 500) / 220, 0, 1);
      return THREE.MathUtils.lerp(430, 560, t) + Math.sin(t * Math.PI * 2) * 22;
    } else {
      const t = THREE.MathUtils.clamp((z - 430) / 290, 0, 1);
      return THREE.MathUtils.lerp(970, 1160, t) - Math.sin(t * Math.PI * 2) * 26;
    }
  }

  /**
   * Distance to winding mountain streams with muddy banks
   */
  public getDistanceToStreams(x: number, z: number): number {
    let minD = 999;
    if (z >= 490 && z <= 725) {
      const streamX = this.getStreamCenterX(0, z);
      minD = Math.min(minD, Math.abs(x - streamX));
    }
    if (z >= 420 && z <= 725) {
      const streamX = this.getStreamCenterX(1, z);
      minD = Math.min(minD, Math.abs(x - streamX));
    }
    return minD;
  }

  /**
   * Convert Axial Hex (q, r) to World (wx, wz)
   */
  public hexToWorld(q: number, r: number): { wx: number; wz: number } {
    const R = TerrainGenerator.HEX_RADIUS;
    const hexW = Math.sqrt(3) * R;
    const rowH = 1.5 * R;
    const wx = (q + (r & 1) * 0.5) * hexW;
    const wz = r * rowH;
    return { wx, wz };
  }

  /**
   * Convert World (wx, wz) to nearest HexTileData
   */
  public getHexTileAt(wx: number, wz: number): HexTileData | null {
    const R = TerrainGenerator.HEX_RADIUS;
    const hexW = Math.sqrt(3) * R;
    const rowH = 1.5 * R;

    const rApprox = Math.round(wz / rowH);
    const qApprox = Math.round(wx / hexW - (rApprox & 1) * 0.5);

    let bestTile: HexTileData | null = null;
    let bestDist = Infinity;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dq = -1; dq <= 1; dq++) {
        const key = `${qApprox + dq},${rApprox + dr}`;
        const tile = this.hexTilesMap.get(key);
        if (tile) {
          const d = Math.hypot(wx - tile.wx, wz - tile.wz);
          if (d < bestDist) {
            bestDist = d;
            bestTile = tile;
          }
        }
      }
    }
    return bestTile;
  }

  /**
   * Classify a world coordinate into one of the 10 Modular Biome Archetypes
   */
  private classifyBiomeAt(wx: number, wz: number, elevation: number, maxSlopeDiff: number): TerrainBiomeType {
    if (this.getDistanceToRoads(wx, wz) < 8.5 && elevation < 24.0) {
      return 'dirt_paths';
    }
    if (this.getDistanceToWetlands(wx, wz) < 32.0 && elevation <= 10.5) {
      return 'wetlands';
    }
    if (this.getDistanceToStreams(wx, wz) < 9.5 && elevation <= 18.0) {
      return 'riverbanks';
    }
    if (maxSlopeDiff >= 4.8 && elevation < 33.0) {
      return 'cliffs';
    }
    if (elevation >= 26.0 || (wz > 1280 && elevation >= 17.5)) {
      return 'snowy_peaks';
    }
    if (elevation >= 17.2 || (wx > 1200 && wz > 1060)) {
      return 'rocky_mountains';
    }
    for (const res of WORLD_RESOURCES) {
      if (res.subtype === 'wood' && Math.hypot(wx - res.position[0], wz - res.position[2]) < 56.0) {
        return 'forest_floor';
      }
    }
    const forestNoise = Math.sin(wx * 0.016) * Math.cos(wz * 0.016);
    if (forestNoise > 0.42 && Math.hypot(wx - 800, wz - 740) > 120) {
      return 'forest_floor';
    }
    if (elevation >= 12.0 || maxSlopeDiff >= 2.4) {
      return 'hills';
    }
    const meadowWave = Math.sin(wx * 0.012 + wz * 0.01);
    if (meadowWave > 0.1) {
      return 'grass';
    }
    return 'green_plains';
  }

  /**
   * Compute smooth blended vertex color at (wx, wz) across all 10 biomes
   */
  private sampleBlendedTerrainColor(wx: number, wz: number, elev: number, slopeDiff: number, targetColor: THREE.Color) {
    const biome = this.classifyBiomeAt(wx, wz, elev, slopeDiff);
    const spec = MODULAR_BIOME_SPECS[biome];
    targetColor.set(spec.colorHex);

    // Subtle organic micro-variation
    const noise = (Math.sin(wx * 0.08 + wz * 0.06) + Math.cos(wx * 0.05 - wz * 0.09)) * 0.018;
    targetColor.offsetHSL(0, 0, noise);

    // Darken steep cliff slopes for realistic stratified rock contrast
    if (slopeDiff > 2.2) {
      const cliffShade = Math.min(0.38, (slopeDiff - 2.2) * 0.08);
      targetColor.lerp(new THREE.Color('#27323f'), cliffShade);
    }

    // Smooth road border blend
    const dRoad = this.getDistanceToRoads(wx, wz);
    if (dRoad < 9.5 && dRoad > 5.0 && elev < 24.0) {
      const t = (dRoad - 5.0) / 4.5;
      const grassCol = new THREE.Color('#477d3a');
      targetColor.lerp(grassCol, t * 0.65);
    }
  }

  /**
   * Builds the Seamless High-Performance Modular Terrain with:
   * - 8x8 Regional Indexed THREE.LOD Chunks (LOD0: 28x28, LOD1: 14x14, LOD2: 7x7)
   * - Shared edge vertices between chunks for 100% crack-free seamless transitions
   * - 10 Biome Tile Metadata & Optional Tactical Seam Grid Overlay
   */
  private createSeamlessModularTerrain() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'ModularTerrainKitRoot';

    const detailAlbedo = createTerrainDetailAlbedoTexture();
    const normalMap = createTerrainSurfaceNormalMap();

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detailAlbedo,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.78,
      metalness: 0.08,
      flatShading: false,
    });

    // Step 1: Populate Tactical Tile Registry for Inspector & Pathfinding
    const R = TerrainGenerator.HEX_RADIUS;
    const hexW = Math.sqrt(3) * R;
    const rowH = 1.5 * R;
    const cols = Math.ceil(this.width / hexW) + 1;
    const rows = Math.ceil(this.depth / rowH) + 1;

    const cornerCos: number[] = [];
    const cornerSin: number[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      cornerCos.push(Math.cos(ang));
      cornerSin.push(-Math.sin(ang));
    }

    const gridLinePositions: number[] = [];

    for (let r = 0; r <= rows; r++) {
      for (let q = 0; q <= cols; q++) {
        const { wx, wz } = this.hexToWorld(q, r);
        if (wx < 5 || wx > 1595 || wz < 5 || wz > 1595) continue;

        const elev = this.getHeightAt(wx, wz);
        const hE = this.getHeightAt(Math.min(1599, wx + 8), wz);
        const hW = this.getHeightAt(Math.max(1, wx - 8), wz);
        const hN = this.getHeightAt(wx, Math.min(1599, wz + 8));
        const hS = this.getHeightAt(wx, Math.max(1, wz - 8));
        const maxSlope = Math.max(
          Math.abs(elev - hE),
          Math.abs(elev - hW),
          Math.abs(elev - hN),
          Math.abs(elev - hS)
        );

        const biome = this.classifyBiomeAt(wx, wz, elev, maxSlope);
        const spec = MODULAR_BIOME_SPECS[biome];
        this.biomeCounts[biome]++;

        const key = `${q},${r}`;
        this.hexTilesMap.set(key, {
          key,
          q,
          r,
          wx,
          wz,
          elevation: elev,
          biome,
          slopeDiff: maxSlope,
          passable: spec.passable,
          movementCost: spec.movementCost,
          neighborElevations: [hE, hS, hS, hW, hN, hN],
        });

        // Build optional tactical grid wireframe lines (hidden by default)
        for (let i = 0; i < 6; i++) {
          const ni = (i + 1) % 6;
          const ox1 = wx + cornerCos[i] * R;
          const oz1 = wz + cornerSin[i] * R;
          const ox2 = wx + cornerCos[ni] * R;
          const oz2 = wz + cornerSin[ni] * R;
          const y1 = this.getHeightAt(THREE.MathUtils.clamp(ox1, 1, 1599), THREE.MathUtils.clamp(oz1, 1, 1599)) + 0.18;
          const y2 = this.getHeightAt(THREE.MathUtils.clamp(ox2, 1, 1599), THREE.MathUtils.clamp(oz2, 1, 1599)) + 0.18;
          gridLinePositions.push(ox1, y1, oz1, ox2, y2, oz2);
        }
      }
    }

    // Step 2: Build 8x8 Regional Indexed THREE.LOD Chunks (Zero Seams, High FPS)
    const CHUNK_GRID = 8;
    const chunkSize = this.width / CHUNK_GRID; // 200m per chunk across 1600x1600
    const tempColor = new THREE.Color();

    const buildIndexedChunkGeometry = (
      chunkX: number,
      chunkZ: number,
      segments: number,
      lodLevel: 0 | 1 | 2
    ): THREE.BufferGeometry => {
      const startX = chunkX * chunkSize;
      const startZ = chunkZ * chunkSize;
      const originX = startX + chunkSize * 0.5;
      const originZ = startZ + chunkSize * 0.5;

      const vertCountPerRow = segments + 1;
      const totalVerts = vertCountPerRow * vertCountPerRow;

      const positions = new Float32Array(totalVerts * 3);
      const uvs = new Float32Array(totalVerts * 2);
      const colors = new Float32Array(totalVerts * 3);
      const indices: number[] = [];

      const step = chunkSize / segments;
      const uvScale = 0.035;

      let vIdx = 0;
      for (let iz = 0; iz <= segments; iz++) {
        const wz = THREE.MathUtils.clamp(startZ + iz * step, 0.5, 1599.5);
        for (let ix = 0; ix <= segments; ix++) {
          const wx = THREE.MathUtils.clamp(startX + ix * step, 0.5, 1599.5);
          const wy = this.getHeightAt(wx, wz);

          // Local gradient for slope shading & biome classification
          const hR = this.getHeightAt(Math.min(1599.5, wx + 4), wz);
          const hU = this.getHeightAt(wx, Math.min(1599.5, wz + 4));
          const slope = Math.hypot(wy - hR, wy - hU);

          positions[vIdx * 3] = wx - originX;
          positions[vIdx * 3 + 1] = wy;
          positions[vIdx * 3 + 2] = wz - originZ;

          uvs[vIdx * 2] = wx * uvScale;
          uvs[vIdx * 2 + 1] = wz * uvScale;

          this.sampleBlendedTerrainColor(wx, wz, wy, slope, tempColor);
          colors[vIdx * 3] = tempColor.r;
          colors[vIdx * 3 + 1] = tempColor.g;
          colors[vIdx * 3 + 2] = tempColor.b;

          vIdx++;
        }
      }

      for (let iz = 0; iz < segments; iz++) {
        for (let ix = 0; ix < segments; ix++) {
          const a = iz * vertCountPerRow + ix;
          const b = iz * vertCountPerRow + (ix + 1);
          const c = (iz + 1) * vertCountPerRow + ix;
          const d = (iz + 1) * vertCountPerRow + (ix + 1);

          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      const triCount = segments * segments * 2;
      if (lodLevel === 0) this.totalTrianglesByLod.lod0 += triCount;
      else if (lodLevel === 1) this.totalTrianglesByLod.lod1 += triCount;
      else this.totalTrianglesByLod.lod2 += triCount;

      return geo;
    };

    for (let cz = 0; cz < CHUNK_GRID; cz++) {
      for (let cx = 0; cx < CHUNK_GRID; cx++) {
        const originX = (cx + 0.5) * chunkSize;
        const originZ = (cz + 0.5) * chunkSize;

        const lod = new THREE.LOD();
        lod.position.set(originX, 0, originZ);
        lod.name = `TerrainChunk_${cx}_${cz}`;

        const geo0 = buildIndexedChunkGeometry(cx, cz, 24, 0);
        const geo1 = buildIndexedChunkGeometry(cx, cz, 12, 1);
        const geo2 = buildIndexedChunkGeometry(cx, cz, 6, 2);

        const mesh0 = new THREE.Mesh(geo0, this.terrainMaterial);
        mesh0.receiveShadow = true;
        const mesh1 = new THREE.Mesh(geo1, this.terrainMaterial);
        mesh1.receiveShadow = true;
        const mesh2 = new THREE.Mesh(geo2, this.terrainMaterial);
        mesh2.receiveShadow = true;

        lod.addLevel(mesh0, 0);
        lod.addLevel(mesh1, 420);
        lod.addLevel(mesh2, 820);

        this.lodChunks.push(lod);
        this.mesh.add(lod);
      }
    }

    // Step 3: Build Optional Tactical Seam Overlay (Toggled in Terrain Kit Inspector)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridLinePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
    });
    this.hexGridOverlay = new THREE.LineSegments(lineGeo, lineMat);
    this.hexGridOverlay.visible = false;
    this.mesh.add(this.hexGridOverlay);

    // Step 4: Selected Tile Ring Indicator & Biome Highlight Group
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      ringPts.push(new THREE.Vector3(cornerCos[i] * R * 0.95, 0.35, cornerSin[i] * R * 0.95));
    }
    const selRingGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    this.selectedHexRing = new THREE.LineLoop(
      selRingGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    this.selectedHexRing.visible = false;
    this.mesh.add(this.selectedHexRing);
    this.mesh.add(this.biomeHighlightGroup);

    // Step 5: Lightweight Invisible Collision Proxy Mesh
    const colGeo = new THREE.PlaneGeometry(this.width, this.depth, 48, 48);
    colGeo.rotateX(-Math.PI / 2);
    colGeo.translate(this.width / 2, 0, this.depth / 2);
    const colPos = colGeo.attributes.position;
    for (let i = 0; i < colPos.count; i++) {
      colPos.setY(i, this.getHeightAt(colPos.getX(i), colPos.getZ(i)));
    }
    colGeo.computeVertexNormals();
    this.collisionMesh = new THREE.Mesh(
      colGeo,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.collisionMesh.name = 'MainlandCollisionProxy';
    this.mesh.add(this.collisionMesh);

    // Step 6: Seamless Outer Himalayan Mountain Apron (-540..2140) framing corners cleanly
    this.createOuterMountainBorder();
  }

  /**
   * Builds 4 stitched outer Himalayan mountain border skirts (-540..2140)
   * matching exact inner chunk edge elevations along x=0.5/1599.5 and z=0.5/1599.5
   * so corners never expose empty skybox void when zoomed/panned near edges.
   */
  private createOuterMountainBorder() {
    const EXTENT = 540;
    const tempColor = new THREE.Color();
    const snowCol = new THREE.Color('#eef4fa');
    const rockCol = new THREE.Color('#475569');
    const pineCol = new THREE.Color('#2d4a32');

    const evalEdgeAndOuterPoint = (wx: number, wz: number) => {
      const cx = THREE.MathUtils.clamp(wx, 0.5, 1599.5);
      const cz = THREE.MathUtils.clamp(wz, 0.5, 1599.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(wx - cx, wz - cz);

      if (outDist <= 0.01) {
        const hR = this.getHeightAt(Math.min(1599.5, cx + 4), cz);
        const hU = this.getHeightAt(cx, Math.min(1599.5, cz + 4));
        const slope = Math.hypot(edgeH - hR, edgeH - hU);
        this.sampleBlendedTerrainColor(cx, cz, edgeH, slope, tempColor);
        return { wy: edgeH, color: tempColor.clone() };
      }

      const t = THREE.MathUtils.clamp(outDist / EXTENT, 0, 1);
      const ridgeWave =
        Math.sin(wx * 0.018 + wz * 0.011) * 18.0 +
        Math.cos(wx * 0.032 - wz * 0.024) * 11.0 +
        Math.sin(outDist * 0.022) * 8.0;
      const peakLift = Math.sin(t * Math.PI * 0.88) * 58.0 + t * 24.0;
      const wy = Math.max(22, edgeH + peakLift + ridgeWave * (0.35 + t * 0.65));

      const col = new THREE.Color();
      if (wy > 86) {
        col.copy(snowCol).offsetHSL(0, 0, -0.02 + Math.sin(wx * 0.04) * 0.02);
      } else if (wy > 58) {
        const snowMix = THREE.MathUtils.clamp((wy - 58) / 28, 0, 1);
        col.copy(rockCol).lerp(snowCol, snowMix * 0.85);
      } else {
        const rockMix = THREE.MathUtils.clamp((wy - 35) / 23, 0, 1);
        col.copy(pineCol).lerp(rockCol, rockMix);
      }

      return { wy, color: col };
    };

    const buildPerimeterStrip = (
      xMin: number,
      xMax: number,
      zMin: number,
      zMax: number,
      segX: number,
      segZ: number
    ) => {
      const vertsPerRow = segX + 1;
      const totalVerts = (segX + 1) * (segZ + 1);
      const positions = new Float32Array(totalVerts * 3);
      const uvs = new Float32Array(totalVerts * 2);
      const colors = new Float32Array(totalVerts * 3);
      const indices: number[] = [];

      let vIdx = 0;
      for (let iz = 0; iz <= segZ; iz++) {
        const wz = THREE.MathUtils.lerp(zMin, zMax, iz / segZ);
        for (let ix = 0; ix <= segX; ix++) {
          const wx = THREE.MathUtils.lerp(xMin, xMax, ix / segX);
          const { wy, color } = evalEdgeAndOuterPoint(wx, wz);

          positions[vIdx * 3] = wx;
          positions[vIdx * 3 + 1] = wy;
          positions[vIdx * 3 + 2] = wz;

          uvs[vIdx * 2] = wx * 0.035;
          uvs[vIdx * 2 + 1] = wz * 0.035;

          colors[vIdx * 3] = color.r;
          colors[vIdx * 3 + 1] = color.g;
          colors[vIdx * 3 + 2] = color.b;
          vIdx++;
        }
      }

      for (let iz = 0; iz < segZ; iz++) {
        for (let ix = 0; ix < segX; ix++) {
          const a = iz * vertsPerRow + ix;
          const b = iz * vertsPerRow + (ix + 1);
          const c = (iz + 1) * vertsPerRow + ix;
          const d = (iz + 1) * vertsPerRow + (ix + 1);
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, this.terrainMaterial);
      mesh.receiveShadow = true;
      mesh.name = 'OuterMountainBorderSkirt';
      this.mesh.add(mesh);
    };

    // North & South full-width borders (cover all 4 corners cleanly)
    buildPerimeterStrip(-EXTENT, 1600 + EXTENT, 1599.5, 1600 + EXTENT, 36, 7);
    buildPerimeterStrip(-EXTENT, 1600 + EXTENT, -EXTENT, 0.5, 36, 7);
    // West & East side borders
    buildPerimeterStrip(-EXTENT, 0.5, 0.5, 1599.5, 7, 24);
    buildPerimeterStrip(1599.5, 1600 + EXTENT, 0.5, 1599.5, 7, 24);
  }

  /**
   * Toggle Tactical Grid Seam Overlay visibility
   */
  public setShowHexGrid(show: boolean) {
    this.showHexGrid = show;
    if (this.hexGridOverlay) {
      this.hexGridOverlay.visible = show;
    }
  }

  /**
   * Set LOD Override Mode ('auto' | 'lod0' | 'lod1' | 'lod2')
   */
  public setLodMode(mode: TerrainLodMode) {
    this.currentLodMode = mode;
    for (const lod of this.lodChunks) {
      lod.autoUpdate = mode === 'auto';
      if (mode !== 'auto') {
        const targetIdx = mode === 'lod0' ? 0 : mode === 'lod1' ? 1 : 2;
        lod.levels.forEach((lvl, idx) => {
          lvl.object.visible = idx === targetIdx;
        });
      }
    }
  }

  /**
   * Highlight all tiles belonging to a specific Biome Archetype on the 3D World Map
   */
  public setHighlightedBiome(biome: TerrainBiomeType | null) {
    this.highlightedBiome = biome;

    while (this.biomeHighlightGroup.children.length > 0) {
      const child = this.biomeHighlightGroup.children[0] as THREE.Mesh;
      this.biomeHighlightGroup.remove(child);
      child.geometry.dispose();
    }

    if (!biome) return;

    const spec = MODULAR_BIOME_SPECS[biome];
    const R = TerrainGenerator.HEX_RADIUS;
    const ringGeo = new THREE.RingGeometry(R * 0.65, R * 0.85, 24);
    ringGeo.rotateX(-Math.PI / 2);

    const ringMat = new THREE.MeshBasicMaterial({
      color: spec.colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
    });

    for (const tile of this.hexTilesMap.values()) {
      if (tile.biome === biome) {
        const marker = new THREE.Mesh(ringGeo, ringMat);
        marker.position.set(tile.wx, tile.elevation + 0.28, tile.wz);
        this.biomeHighlightGroup.add(marker);
      }
    }
  }

  /**
   * Focus the Cyan Inspector Ring on a specific tile
   */
  public focusHexTile(tile: HexTileData | null) {
    if (!tile) {
      this.selectedHexRing.visible = false;
      return;
    }
    this.selectedHexRing.position.set(tile.wx, tile.elevation, tile.wz);
    this.selectedHexRing.visible = true;
  }

  /**
   * Create reserved plot markers on the terrain
   */
  private createReservedPlotMarkers() {
    this.plotMarkersGroup = new THREE.Group();
    this.plotMarkersGroup.name = 'ReservedPlotMarkersGroup';

    const stonePlatformMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.82,
      metalness: 0.18,
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdfba6e,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x7c5818,
      emissiveIntensity: 0.4,
    });

    const shrinePlatformMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.7,
      metalness: 0.1,
    });

    for (const plot of RESERVED_PLOTS) {
      const plotGroup = new THREE.Group();
      plotGroup.position.set(plot.position[0], plot.position[1], plot.position[2]);
      plotGroup.userData = { isReservedPlot: true, plotData: plot };

      if (plot.type === 'congress') {
        const baseGeo = new THREE.BoxGeometry(plot.size[0], 0.65, plot.size[1]);
        const baseMesh = new THREE.Mesh(baseGeo, stonePlatformMat);
        baseMesh.receiveShadow = true;
        baseMesh.castShadow = true;
        plotGroup.add(baseMesh);

        const emblemGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.16, 16);
        const emblemMesh = new THREE.Mesh(emblemGeo, goldTrimMat);
        emblemMesh.position.y = 0.4;
        plotGroup.add(emblemMesh);

        const pillarGeo = new THREE.CylinderGeometry(0.9, 1.1, 4.8, 8);
        const halfW = plot.size[0] / 2 - 2.0;
        const halfD = plot.size[1] / 2 - 2.0;
        const corners = [
          [-halfW, -halfD],
          [halfW, -halfD],
          [halfW, halfD],
          [-halfW, halfD],
        ];

        for (const [cx, cz] of corners) {
          const pillar = new THREE.Mesh(pillarGeo, stonePlatformMat);
          pillar.position.set(cx, 2.4, cz);
          pillar.castShadow = true;
          plotGroup.add(pillar);

          const finial = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), goldTrimMat);
          finial.position.set(cx, 5.0, cz);
          plotGroup.add(finial);
        }
      } else if (plot.type === 'shrine_a') {
        const shrineGeo = new THREE.CylinderGeometry(plot.radius * 0.9, plot.radius * 0.95, 0.75, 16);
        const shrineMesh = new THREE.Mesh(shrineGeo, shrinePlatformMat);
        shrineMesh.position.y = 0.375;
        shrineMesh.receiveShadow = true;
        plotGroup.add(shrineMesh);

        const lotus = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.22, 16), goldTrimMat);
        lotus.position.y = 0.8;
        plotGroup.add(lotus);
      } else {
        const shrineBaseGeo = new THREE.CylinderGeometry(plot.radius * 0.85, plot.radius * 0.9, 0.55, 12);
        const shrineBase = new THREE.Mesh(shrineBaseGeo, stonePlatformMat);
        shrineBase.position.y = 0.275;
        shrineBase.receiveShadow = true;
        shrineBase.castShadow = true;
        plotGroup.add(shrineBase);
      }

      this.plotMarkersGroup.add(plotGroup);
    }
  }

  /**
   * High-Performance Hardware-Instanced Himalayan Pine Forests & Riverbank Flora
   * Replaces individual tree meshes with 4 InstancedMeshes across the 1600x1600 continent.
   */
  private createInstancedVegetation() {
    this.vegetationGroup = new THREE.Group();
    this.vegetationGroup.name = 'InstancedVegetationGroup';

    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.2, 6);
    trunkGeo.translate(0, 1.1, 0);

    const coneLowGeo = new THREE.ConeGeometry(2.4, 4.8, 7);
    coneLowGeo.translate(0, 3.5, 0);

    const coneHighGeo = new THREE.ConeGeometry(1.75, 3.8, 7);
    coneHighGeo.translate(0, 5.4, 0);

    const boulderGeo = new THREE.DodecahedronGeometry(0.75, 1);
    boulderGeo.translate(0, 0.35, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.92 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.12 });

    const MAX_TREES = 700;
    const MAX_BOULDERS = 220;

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX_TREES);
    const coneLowInst = new THREE.InstancedMesh(coneLowGeo, foliageMat, MAX_TREES);
    const coneHighInst = new THREE.InstancedMesh(coneHighGeo, foliageMat, MAX_TREES);
    const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, MAX_BOULDERS);

    trunkInst.castShadow = true;
    coneLowInst.castShadow = true;
    coneLowInst.receiveShadow = true;
    coneHighInst.castShadow = true;
    coneHighInst.receiveShadow = true;
    boulderInst.castShadow = true;
    boulderInst.receiveShadow = true;

    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let treeIdx = 0;
    let boulderIdx = 0;

    for (let i = 0; i < 1000; i++) {
      const rx = 75 + seededRandom() * 1450;
      const rz = 75 + seededRandom() * 1450;

      let isNearPlot = false;
      for (const plot of RESERVED_PLOTS) {
        if (Math.hypot(rx - plot.position[0], rz - plot.position[2]) < plot.radius + 14) {
          isNearPlot = true;
          break;
        }
      }
      if (isNearPlot) continue;
      if (this.getDistanceToRoads(rx, rz) < 10.0) continue;

      const ry = this.getHeightAt(rx, rz);
      if (ry > 32.0 || ry < 4.0) continue;

      // Riverbank & wetland smooth river stones
      if (this.getDistanceToWetlands(rx, rz) < 34.0 || this.getDistanceToStreams(rx, rz) < 11.0) {
        if (boulderIdx < MAX_BOULDERS) {
          const s = 0.55 + seededRandom() * 0.9;
          dummy.position.set(rx, ry - 0.1, rz);
          dummy.rotation.set(seededRandom() * 0.4, seededRandom() * Math.PI * 2, seededRandom() * 0.4);
          dummy.scale.set(s * 1.2, s * 0.65, s);
          dummy.updateMatrix();
          boulderInst.setMatrixAt(boulderIdx, dummy.matrix);

          color.set('#576574').offsetHSL(0, 0, (seededRandom() - 0.5) * 0.12);
          boulderInst.setColorAt(boulderIdx, color);
          boulderIdx++;
        }
        continue;
      }

      if (treeIdx < MAX_TREES) {
        const scale = 0.68 + seededRandom() * 0.68;
        dummy.position.set(rx, ry, rz);
        dummy.rotation.set(0, seededRandom() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        trunkInst.setMatrixAt(treeIdx, dummy.matrix);
        coneLowInst.setMatrixAt(treeIdx, dummy.matrix);
        coneHighInst.setMatrixAt(treeIdx, dummy.matrix);

        // Snow-dusted pine tint in northern high altitudes, rich pine green in valleys
        if (rz > 1180 || ry > 22.0) {
          color.set('#648276').lerp(new THREE.Color('#e2e8f0'), 0.45 + seededRandom() * 0.25);
        } else {
          color.set(seededRandom() > 0.5 ? '#1e3f24' : '#2a5434').offsetHSL(0, 0, (seededRandom() - 0.5) * 0.08);
        }
        coneLowInst.setColorAt(treeIdx, color);
        coneHighInst.setColorAt(treeIdx, color.clone().offsetHSL(0, 0, 0.04));

        treeIdx++;
      }
    }

    trunkInst.count = treeIdx;
    coneLowInst.count = treeIdx;
    coneHighInst.count = treeIdx;
    boulderInst.count = boulderIdx;

    trunkInst.instanceMatrix.needsUpdate = true;
    coneLowInst.instanceMatrix.needsUpdate = true;
    coneHighInst.instanceMatrix.needsUpdate = true;
    boulderInst.instanceMatrix.needsUpdate = true;

    if (coneLowInst.instanceColor) coneLowInst.instanceColor.needsUpdate = true;
    if (coneHighInst.instanceColor) coneHighInst.instanceColor.needsUpdate = true;
    if (boulderInst.instanceColor) boulderInst.instanceColor.needsUpdate = true;

    trunkInst.computeBoundingSphere();
    coneLowInst.computeBoundingSphere();
    coneHighInst.computeBoundingSphere();
    boulderInst.computeBoundingSphere();

    this.vegetationGroup.add(trunkInst, coneLowInst, coneHighInst, boulderInst);
  }

  /**
   * Builds a smooth, continuous curved river ribbon along a meandering stream path
   * (Replaces the old hexagon river cylinders with realistic flowing mountain streams)
   */
  private buildSmoothRiverRibbon(streamIndex: 0 | 1, zStart: number, zEnd: number, width: number, mat: THREE.Material): THREE.Mesh {
    const segs = 36;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = THREE.MathUtils.lerp(zStart, zEnd, t);
      const cx = this.getStreamCenterX(streamIndex, z);

      // Compute tangent for perpendicular bank width
      const zNext = THREE.MathUtils.lerp(zStart, zEnd, Math.min(1, t + 0.02));
      const cxNext = this.getStreamCenterX(streamIndex, zNext);
      const dx = cxNext - cx;
      const dz = zNext - z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const halfW = width * (0.5 + 0.15 * Math.sin(t * Math.PI));
      const lx = cx - nx * halfW;
      const lz = z - nz * halfW;
      const rx = cx + nx * halfW;
      const rz = z + nz * halfW;

      const yCenter = this.getHeightAt(cx, z) + 0.16;

      positions.push(lx, yCenter, lz);
      positions.push(rx, yCenter, rz);

      uvs.push(0, t * 6);
      uvs.push(1, t * 6);

      if (i < segs) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Procedural waterfalls, natural meandering mountain streams, and glacial mist
   */
  private createWaterfallsAndNaturalRivers() {
    this.waterfallsGroup.name = 'TerraceWaterfallsGroup';
    this.mistPuffsGroup.name = 'CascadingGlacialMistGroup';
    this.leylineStreamsGroup.name = 'GlowingLeylinesGroup';

    const wfTexture = createWaterfallTexture();
    const wfMaterial = new THREE.MeshStandardMaterial({
      map: wfTexture,
      color: 0xe0f2fe,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterfallMaterials.push(wfMaterial);

    // Flowing River Stream Material
    const riverTex = createWaterfallTexture();
    riverTex.repeat.set(1, 2);
    const riverMat = new THREE.MeshStandardMaterial({
      map: riverTex,
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0.84,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.riverStreamMaterials.push(riverMat);

    // Add the 2 Smooth Curved Mountain River Streams across the 1600x1600 continent
    const westRiver = this.buildSmoothRiverRibbon(0, 500, 720, 11.0, riverMat);
    const eastRiver = this.buildSmoothRiverRibbon(1, 430, 720, 12.0, riverMat);
    this.leylineStreamsGroup.add(westRiver, eastRiver);

    // Smooth Natural Alpine Marsh Lakes at the end of each stream
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x075985,
      emissiveIntensity: 0.3,
      roughness: 0.08,
      metalness: 0.55,
      transparent: true,
      opacity: 0.82,
    });
    for (const [lx, lz, rx, rz] of [
      [430, 500, 34, 26],
      [970, 430, 36, 28],
    ]) {
      const lakeGeo = new THREE.CircleGeometry(1, 32);
      lakeGeo.rotateX(-Math.PI / 2);
      lakeGeo.scale(rx, 1, rz);
      const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
      lakeMesh.position.set(lx, this.getHeightAt(lx, lz) + 0.14, lz);
      lakeMesh.receiveShadow = true;
      this.leylineStreamsGroup.add(lakeMesh);
    }

    const splashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });

    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    this.leylineMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.82,
    });

    const waterfallSites = [
      { x: 560, z: 720, width: 16, topY: 18.0, botY: 9.0, rotY: 0.2 },
      { x: 680, z: 1060, width: 18, topY: 24.0, botY: 13.0, rotY: -0.4 },
      { x: 1060, z: 1080, width: 16, topY: 25.0, botY: 14.0, rotY: 0.6 },
      { x: 460, z: 520, width: 14, topY: 14.0, botY: 6.0, rotY: -0.2 },
      { x: 1160, z: 720, width: 15, topY: 18.0, botY: 9.0, rotY: -0.5 },
      { x: 400, z: 1300, width: 15, topY: 28.0, botY: 17.0, rotY: 0.3 },
    ];

    for (const site of waterfallSites) {
      const dropH = site.topY - site.botY;
      const centerY = (site.topY + site.botY) / 2;

      const wfGroup = new THREE.Group();
      wfGroup.position.set(site.x, centerY, site.z);
      wfGroup.rotation.y = site.rotY;

      const curtainGeo = new THREE.PlaneGeometry(site.width, dropH, 8, 4);
      const curtainMesh = new THREE.Mesh(curtainGeo, wfMaterial);
      curtainMesh.rotation.x = -0.08;
      wfGroup.add(curtainMesh);

      const lipGeo = new THREE.BoxGeometry(site.width * 1.05, 0.4, 3.0);
      const lipMesh = new THREE.Mesh(lipGeo, poolMat);
      lipMesh.position.set(0, dropH / 2 + 0.1, -1.2);
      wfGroup.add(lipMesh);

      const poolGeo = new THREE.CylinderGeometry(site.width * 0.75, site.width * 0.85, 0.6, 20);
      const poolMesh = new THREE.Mesh(poolGeo, poolMat);
      poolMesh.position.set(0, -dropH / 2 + 0.2, 1.8);
      wfGroup.add(poolMesh);

      for (let s = 0; s < 3; s++) {
        const ringGeo = new THREE.RingGeometry(site.width * 0.25 * s, site.width * 0.25 * (s + 0.5), 20);
        const ringMesh = new THREE.Mesh(ringGeo, splashMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set((Math.random() - 0.5) * 3, -dropH / 2 + 0.35 + s * 0.05, 1.8 + (Math.random() - 0.5) * 2);
        wfGroup.add(ringMesh);
      }

      this.waterfallsGroup.add(wfGroup);
    }

    const mistGeo = new THREE.DodecahedronGeometry(3.2, 1);
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.36,
      roughness: 0.98,
      depthWrite: false,
    });

    const mistSpawns = [
      [440, 24.0, 1160], [580, 22.0, 1220], [720, 24.0, 1180], [880, 23.0, 1200],
      [1020, 25.0, 1140], [1200, 26.0, 1180], [340, 26.0, 1300], [1340, 24.0, 1280],
      [560, 10.5, 724], [680, 14.5, 1064], [1060, 15.5, 1084], [460, 7.5, 524],
      [1160, 10.5, 724], [400, 18.5, 1304],
    ];

    mistSpawns.forEach(([mx, my, mz], idx) => {
      const puff = new THREE.Mesh(mistGeo, mistMat);
      const scale = 0.8 + (idx % 5) * 0.28;
      puff.position.set(mx, my + 0.8, mz);
      puff.scale.set(scale * 1.4, scale * 0.7, scale * 1.2);
      this.mistPuffsGroup.add(puff);

      this.mistParticles.push({
        mesh: puff,
        baseY: my + 0.8,
        phase: idx * 0.45,
        speed: 0.8 + (idx % 3) * 0.3,
        rotSpeed: 0.15 + (idx % 4) * 0.08,
      });
    });
  }

  /**
   * Living Animation Update for Terrain (LOD Chunks, Waterfalls, Smooth Rivers, Mist)
   */
  public updateTerrainOverflow(delta: number, elapsed: number, camera?: THREE.Camera) {
    if (this.currentLodMode === 'auto' && camera) {
      for (const lod of this.lodChunks) {
        lod.update(camera);
      }
    }

    for (const mat of this.waterfallMaterials) {
      if (mat.map) {
        mat.map.offset.y = (mat.map.offset.y - delta * 1.6) % 1.0;
      }
    }

    for (const rMat of this.riverStreamMaterials) {
      if (rMat.map) {
        rMat.map.offset.y = (rMat.map.offset.y - delta * 0.55) % 1.0;
      }
    }

    if (this.leylineMaterial) {
      this.leylineMaterial.emissiveIntensity = 1.2 + Math.sin(elapsed * 2.2) * 0.45;
    }

    for (const p of this.mistParticles) {
      const osc = Math.sin(elapsed * p.speed + p.phase);
      p.mesh.position.y = p.baseY + osc * 0.55;
      p.mesh.rotation.y += delta * p.rotSpeed;
    }
  }
}
