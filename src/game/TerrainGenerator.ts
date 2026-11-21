import * as THREE from 'three';
import {
  WORLD_BOUNDS,
  RESERVED_PLOTS,
  WORLD_RESOURCES,
  NILE_DELTA_FORK_Z,
  NILE_HIGHWAY_BRIDGES,
  getNileMainX,
  getNileWestDeltaX,
  getNileEastDeltaX,
  getDistanceToNile,
} from './WorldCoordinates';
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
    sampleWorldPos: [1560, 1420],
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
    sampleWorldPos: [1700, 1380],
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
    sampleWorldPos: [1780, 1660],
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
    sampleWorldPos: [1420, 1700],
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
    sampleWorldPos: [2520, 2360],
  },
  snowy_peaks: {
    id: 'snowy_peaks',
    name: 'Emerald Highland Peaks',
    shortName: 'Highland Peaks',
    colorHex: '#3b7338',
    skirtColorHex: '#2a5428',
    roughness: 0.80,
    metalness: 0.06,
    normalScale: 0.90,
    movementCost: 1.8,
    passable: true,
    description: 'High-altitude sunlit emerald ridges, mossed granite outcrops, and verdant mountain crests.',
    sampleWorldPos: [220, 2980],
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
    sampleWorldPos: [1370, 1530],
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
    sampleWorldPos: [1600, 1420],
  },
  wetlands: {
    id: 'wetlands',
    name: 'Nile Delta Floodplains',
    shortName: 'Delta Plains',
    colorHex: '#2f6f36',
    skirtColorHex: '#215227',
    roughness: 0.72,
    metalness: 0.08,
    normalScale: 0.75,
    movementCost: 1.3,
    passable: true,
    description: 'Lush alluvial floodplains nourished by the branching northern Nile Delta.',
    sampleWorldPos: [1620, 420],
  },
  riverbanks: {
    id: 'riverbanks',
    name: 'Nile Riverbanks & Channels',
    shortName: 'Nile Banks',
    colorHex: '#4f5242',
    skirtColorHex: '#383b2e',
    roughness: 0.25,
    metalness: 0.22,
    normalScale: 0.85,
    movementCost: 1.4,
    passable: true,
    description: 'Alluvial riverbeds and fertile green embankments framing the south-to-north Nile River.',
    sampleWorldPos: [1742, 1600],
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
   * Smooth monotonic Nile water surface elevation (flows downhill South +Z -> North -Z)
   */
  public getNileWaterSurfaceY(z: number): number {
    const tSouthToNorth = THREE.MathUtils.clamp((z + 60) / 3320, 0, 1); // 0 at North(-60), 1 at South(3260)
    // Gentle river gradient: 6.8m in northern delta -> 7.8m near Congress -> 12.6m at southern highland ridge
    return 6.8 + Math.pow(tSouthToNorth, 1.45) * 5.8;
  }

  /**
   * Continuous smooth elevation function for any (x, z) in the 3200x3200 realm.
   * Produces realistic readable elevation terraces with full-map lush green land
   * and a continuous south-to-north Nile River basin.
   */
  public getHeightAt(x: number, z: number): number {
    if (x <= 0 || x >= 3200 || z <= 0 || z >= 3200) {
      const cx = THREE.MathUtils.clamp(x, 0.5, 3199.5);
      const cz = THREE.MathUtils.clamp(z, 0.5, 3199.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(x - cx, z - cz);
      const t = THREE.MathUtils.clamp(outDist / 6800, 0, 1);
      const ridgeWave =
        Math.sin(x * 0.006 + z * 0.005) * 14.0 +
        Math.cos(x * 0.013 - z * 0.012) * 8.0 +
        Math.sin(outDist * 0.009) * 6.0;
      const rollingLift = Math.sin(t * Math.PI * 0.65) * 28.0 + t * 18.0;
      let outerY = Math.max(8, edgeH + rollingLift + ridgeWave * (0.35 + t * 0.65));

      // Keep Nile southern source & northern delta mouths smoothly recessed near border
      if (outDist < 160) {
        const nile = getDistanceToNile(x, z);
        if (nile.distBeyondWater < 30) {
          const blend = (1 - outDist / 160) * (1 - nile.distBeyondWater / 30);
          outerY = THREE.MathUtils.lerp(outerY, this.getNileWaterSurfaceY(z) - 1.0, blend * 0.9);
        }
      }
      return outerY;
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

    // 2. Central The Congress & Inner Courtyard Plateau (center [1600, 1600])
    const distCitadel = Math.hypot(x - 1600, z - 1600);
    const distVanguard = Math.hypot(x - 1600, z - 1480);
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

    // Roadway ramps: smooth grade along imperial roads
    const distRoad = this.getDistanceToRoads(x, z);
    if (distRoad < 10.0) {
      const rampFactor = Math.max(0, 1.0 - distRoad / 10.0);
      height = THREE.MathUtils.lerp(height, rawH, rampFactor * 0.85);
    }

    // Continuous South-to-North Nile River & Northern Delta Channel Carving
    const nile = getDistanceToNile(x, z);
    if (nile.distBeyondWater < 32.0) {
      const waterY = this.getNileWaterSurfaceY(z);
      if (nile.distBeyondWater <= 0.1) {
        // Submerged riverbed cleanly beneath water ribbon
        height = waterY - 1.75;
      } else {
        // Gentle sloped bank rising from shoreline (waterY + 0.55) to terrace elevation
        const bankT = nile.distBeyondWater / 32.0;
        const smoothBankT = bankT * bankT * (3 - 2 * bankT);
        const shoreTarget = waterY + 0.45 + smoothBankT * 2.2;
        height = THREE.MathUtils.lerp(shoreTarget, height, smoothBankT);
      }
    }

    return Math.max(3.5, height);
  }

  private getNaturalTerrainHeight(x: number, z: number): number {
    let rollingHills = 9.0;
    rollingHills += Math.sin(x * 0.0052) * 3.2;
    rollingHills += Math.cos(z * 0.0058) * 3.0;
    rollingHills += Math.sin((x + z) * 0.008) * 1.9;
    rollingHills += Math.sin(x * 0.015 - z * 0.014) * 1.1;

    // Gentle green highland undulation toward outer frontier corners (fully playable, zero snow cliffs)
    const radialFromCenter = Math.hypot(x - 1600, z - 1600);
    if (radialFromCenter > 1520) {
      const cornerFactor = THREE.MathUtils.clamp((radialFromCenter - 1520) / 760, 0, 1);
      rollingHills += cornerFactor * cornerFactor * 4.8;
    }

    return Math.max(4.0, rollingHills);
  }

  /**
   * Distance from paved imperial cobblestone roads and shrine-to-Congress lattice routes
   */
  public getDistanceToRoads(x: number, z: number): number {
    const dCentralNS = Math.abs(x - 1600);
    const inRangeNS = z >= 360 && z <= 2840;

    const dCentralEW = Math.abs(z - 1600);
    const inRangeEW = x >= 360 && x <= 2840;

    const dDiag1 = Math.abs((x - 1600) - (z - 1600)) / Math.SQRT2;
    const dDiag2 = Math.abs((x - 1600) + (z - 1600)) / Math.SQRT2;
    const inDiagRange = Math.hypot(x - 1600, z - 1600) <= 1280;

    let minDist = 999;
    if (inRangeNS) minDist = Math.min(minDist, dCentralNS);
    if (inRangeEW) minDist = Math.min(minDist, dCentralEW);
    if (inDiagRange) {
      minDist = Math.min(minDist, dDiag1, dDiag2);
    }

    // Mid-ring & Outer-ring shrine highway corridors
    for (const c of [856, 2344]) {
      if (x >= 360 && x <= 2840) minDist = Math.min(minDist, Math.abs(z - c));
      if (z >= 360 && z <= 2840) minDist = Math.min(minDist, Math.abs(x - c));
    }
    for (const c of [360, 2840]) {
      if (x >= 360 && x <= 2840) minDist = Math.min(minDist, Math.abs(z - c));
      if (z >= 360 && z <= 2840) minDist = Math.min(minDist, Math.abs(x - c));
    }

    return minDist;
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
    const nile = getDistanceToNile(wx, wz);

    if (nile.distBeyondWater < 4.0) {
      return 'riverbanks';
    }
    if (this.getDistanceToRoads(wx, wz) < 8.5 && elevation < 26.0) {
      return 'dirt_paths';
    }

    // Lush fertile Nile floodplains & northern delta triangle
    const inDeltaTriangle =
      wz <= NILE_DELTA_FORK_Z + 40 &&
      wz >= 60 &&
      wx >= getNileWestDeltaX(wz) - 36 &&
      wx <= getNileEastDeltaX(wz) + 36;
    if (nile.distBeyondWater < 28.0) {
      return 'wetlands';
    }
    if (nile.distBeyondWater < 52.0 || (inDeltaTriangle && elevation < 20.0)) {
      return 'grass';
    }

    if (maxSlopeDiff >= 5.0 && elevation < 33.0) {
      return 'cliffs';
    }

    // Full-map lush green terrain extending into all 4 corners with selective grassy rocky crests
    const ridgeNoise = Math.sin(wx * 0.011) * 1.4 + Math.cos(wz * 0.012) * 1.4;
    if (elevation + ridgeNoise >= 21.5) {
      return 'rocky_mountains';
    }
    for (const res of WORLD_RESOURCES) {
      if (res.subtype === 'wood' && Math.hypot(wx - res.position[0], wz - res.position[2]) < 56.0) {
        return 'forest_floor';
      }
    }
    const forestNoise = Math.sin(wx * 0.014) * Math.cos(wz * 0.014);
    if (forestNoise > 0.42 && Math.hypot(wx - 1600, wz - 1540) > 130) {
      return 'forest_floor';
    }
    if (elevation >= 12.2 || maxSlopeDiff >= 2.4) {
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

    // Lush emerald floodplain gradient along Nile Riverbanks
    const nile = getDistanceToNile(wx, wz);
    if (nile.distBeyondWater > 2.0 && nile.distBeyondWater < 48.0) {
      const bankFade = 1.0 - (nile.distBeyondWater - 2.0) / 46.0;
      const fertileCol = new THREE.Color('#2c7435');
      targetColor.lerp(fertileCol, bankFade * 0.52);
    }

    // Darken steep cliff slopes for realistic stratified rock contrast
    if (slopeDiff > 2.2) {
      const cliffShade = Math.min(0.38, (slopeDiff - 2.2) * 0.08);
      targetColor.lerp(new THREE.Color('#27323f'), cliffShade);
    }

    // Smooth road border blend
    const dRoad = this.getDistanceToRoads(wx, wz);
    if (dRoad < 9.5 && dRoad > 5.0 && elev < 24.0 && nile.distBeyondWater > 4.0) {
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
        if (wx < 5 || wx > 3195 || wz < 5 || wz > 3195) continue;

        const elev = this.getHeightAt(wx, wz);
        const hE = this.getHeightAt(Math.min(3199, wx + 8), wz);
        const hW = this.getHeightAt(Math.max(1, wx - 8), wz);
        const hN = this.getHeightAt(wx, Math.min(3199, wz + 8));
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
      }
    }

    // Step 2: Build 8x8 Regional Indexed THREE.LOD Chunks (Zero Seams, Fast Boot & High FPS across 3200x3200)
    const CHUNK_GRID = 8;
    const chunkSize = this.width / CHUNK_GRID; // 400m per chunk across 3200x3200
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
        const wz = THREE.MathUtils.clamp(startZ + iz * step, 0.5, 3199.5);
        for (let ix = 0; ix <= segments; ix++) {
          const wx = THREE.MathUtils.clamp(startX + ix * step, 0.5, 3199.5);
          const wy = this.getHeightAt(wx, wz);

          // Local gradient for slope shading & biome classification
          const hR = this.getHeightAt(Math.min(3199.5, wx + 4), wz);
          const hU = this.getHeightAt(wx, Math.min(3199.5, wz + 4));
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

        const geo0 = buildIndexedChunkGeometry(cx, cz, 26, 0);
        const geo1 = buildIndexedChunkGeometry(cx, cz, 13, 1);
        const geo2 = buildIndexedChunkGeometry(cx, cz, 7, 2);

        const mesh0 = new THREE.Mesh(geo0, this.terrainMaterial);
        mesh0.receiveShadow = true;
        const mesh1 = new THREE.Mesh(geo1, this.terrainMaterial);
        mesh1.receiveShadow = true;
        const mesh2 = new THREE.Mesh(geo2, this.terrainMaterial);
        mesh2.receiveShadow = true;

        lod.addLevel(mesh0, 0);
        lod.addLevel(mesh1, 460);
        lod.addLevel(mesh2, 900);

        this.lodChunks.push(lod);
        this.mesh.add(lod);
      }
    }

    // Step 3: Tactical Seam Grid Overlay is built lazily only if user enables Hex Grid (saves ~25k height queries at boot)

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

    // Step 6: Seamless Outer Lush Green Mountain & Valley Apron (-6800..10000) filling full screen corners at max zoom out
    this.createOuterMountainBorder();
  }

  /**
   * Builds 4 stitched outer lush green highland border skirts (-6800..10000)
   * matching exact inner chunk edge elevations along x=0.5/3199.5 and z=0.5/3199.5
   * so all screen edges and corners remain covered in continuous green land at full Zoom Out 100.
   */
  private createOuterMountainBorder() {
    const EXTENT = 6800;
    const tempColor = new THREE.Color();
    const plainsCol = new THREE.Color('#3f7638');
    const meadowCol = new THREE.Color('#4f883d');
    const forestCol = new THREE.Color('#2b522a');
    const hillCol = new THREE.Color('#5a7a42');

    const evalEdgeAndOuterPoint = (wx: number, wz: number) => {
      const cx = THREE.MathUtils.clamp(wx, 0.5, 3199.5);
      const cz = THREE.MathUtils.clamp(wz, 0.5, 3199.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(wx - cx, wz - cz);

      if (outDist <= 0.01) {
        const hR = this.getHeightAt(Math.min(3199.5, cx + 4), cz);
        const hU = this.getHeightAt(cx, Math.min(3199.5, cz + 4));
        const slope = Math.hypot(edgeH - hR, edgeH - hU);
        this.sampleBlendedTerrainColor(cx, cz, edgeH, slope, tempColor);
        return { wy: edgeH, color: tempColor.clone() };
      }

      const wy = this.getHeightAt(wx, wz);

      // Keep lush green Nile bank color along southern/northern river mouths and blend seamlessly into verdant hills
      const nile = getDistanceToNile(wx, wz);
      const col = new THREE.Color();
      if (outDist < 85 && nile.distBeyondWater < 28) {
        if (nile.distBeyondWater < 5) {
          col.set('#4f5242');
        } else {
          col.set('#2c7435').lerp(meadowCol, THREE.MathUtils.clamp(outDist / 85, 0, 1));
        }
      } else {
        const biomeWave = Math.sin(wx * 0.0045 + wz * 0.0038) * 0.5 + 0.5;
        const crestWave = Math.cos(wx * 0.009 - wz * 0.008) * 0.5 + 0.5;
        col.copy(plainsCol).lerp(meadowCol, biomeWave * 0.65);
        if (wy > 26) {
          col.lerp(hillCol, THREE.MathUtils.clamp((wy - 26) / 28, 0, 0.55));
        }
        if (crestWave > 0.58) {
          col.lerp(forestCol, (crestWave - 0.58) * 1.15);
        }
        col.offsetHSL(0, 0, Math.sin(wx * 0.014 + wz * 0.011) * 0.015);
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
      mesh.name = 'OuterGreenContinentSkirt';
      this.mesh.add(mesh);
    };

    // North & South full-width borders (cover all 4 green corners cleanly at Zoom Out 100)
    buildPerimeterStrip(-EXTENT, 3200 + EXTENT, 3199.5, 3200 + EXTENT, 64, 18);
    buildPerimeterStrip(-EXTENT, 3200 + EXTENT, -EXTENT, 0.5, 64, 18);
    // West & East side borders
    buildPerimeterStrip(-EXTENT, 0.5, 0.5, 3199.5, 18, 40);
    buildPerimeterStrip(3199.5, 3200 + EXTENT, 0.5, 3199.5, 18, 40);
  }

  private buildHexGridOverlay() {
    if (this.hexGridOverlay) return;
    const R = TerrainGenerator.HEX_RADIUS;
    const cornerCos: number[] = [];
    const cornerSin: number[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      cornerCos.push(Math.cos(ang));
      cornerSin.push(-Math.sin(ang));
    }
    const gridLinePositions: number[] = [];
    for (const tile of this.hexTilesMap.values()) {
      for (let i = 0; i < 6; i++) {
        const ni = (i + 1) % 6;
        const ox1 = tile.wx + cornerCos[i] * R;
        const oz1 = tile.wz + cornerSin[i] * R;
        const ox2 = tile.wx + cornerCos[ni] * R;
        const oz2 = tile.wz + cornerSin[ni] * R;
        const y1 = this.getHeightAt(THREE.MathUtils.clamp(ox1, 1, 3199), THREE.MathUtils.clamp(oz1, 1, 3199)) + 0.18;
        const y2 = this.getHeightAt(THREE.MathUtils.clamp(ox2, 1, 3199), THREE.MathUtils.clamp(oz2, 1, 3199)) + 0.18;
        gridLinePositions.push(ox1, y1, oz1, ox2, y2, oz2);
      }
    }
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
  }

  /**
   * Toggle Tactical Grid Seam Overlay visibility
   */
  public setShowHexGrid(show: boolean) {
    this.showHexGrid = show;
    if (show && !this.hexGridOverlay) {
      this.buildHexGridOverlay();
    }
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

    const MAX_TREES = 1650;
    const MAX_BOULDERS = 340;

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

    for (let i = 0; i < 2450; i++) {
      const rx = 25 + seededRandom() * 3150;
      const rz = 25 + seededRandom() * 3150;

      let isNearPlot = false;
      for (const plot of RESERVED_PLOTS) {
        if (Math.hypot(rx - plot.position[0], rz - plot.position[2]) < plot.radius + 14) {
          isNearPlot = true;
          break;
        }
      }
      if (isNearPlot) continue;
      if (this.getDistanceToRoads(rx, rz) < 10.0) continue;

      const nile = getDistanceToNile(rx, rz);
      // Skip placing trees directly inside the Nile water channel
      if (nile.distBeyondWater < 6.0) continue;

      const ry = this.getHeightAt(rx, rz);
      if (ry > 36.0 || ry < 4.0) continue;

      // Smooth riverbank boulders scattered along the Nile shoreline
      if (nile.distBeyondWater < 14.5) {
        if (boulderIdx < MAX_BOULDERS) {
          const s = 0.6 + seededRandom() * 0.95;
          dummy.position.set(rx, ry - 0.1, rz);
          dummy.rotation.set(seededRandom() * 0.4, seededRandom() * Math.PI * 2, seededRandom() * 0.4);
          dummy.scale.set(s * 1.25, s * 0.65, s);
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

        // Rich emerald cedar/pine greens across Nile banks, meadows, and outer frontier corners
        if (nile.distBeyondWater < 46.0) {
          color.set(seededRandom() > 0.45 ? '#205729' : '#2d6e35').offsetHSL(0, 0, (seededRandom() - 0.5) * 0.08);
        } else {
          color.set(seededRandom() > 0.5 ? '#1f4b27' : '#2d6236').offsetHSL(0, 0, (seededRandom() - 0.5) * 0.08);
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
   * Builds a smooth, continuous curved Nile River ribbon from zStart (South +Z) to zEnd (North -Z)
   */
  private buildNileChannelRibbon(
    getCenterX: (z: number) => number,
    zStart: number,
    zEnd: number,
    segs: number,
    getHalfWidth: (t: number, z: number) => number,
    yOffset: number,
    uvScale: number,
    mat: THREE.Material
  ): THREE.Mesh {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = THREE.MathUtils.lerp(zStart, zEnd, t);
      const cx = getCenterX(z);

      const zNext = THREE.MathUtils.lerp(zStart, zEnd, Math.min(1, t + 0.01));
      const cxNext = getCenterX(zNext);
      let dx = cxNext - cx;
      let dz = zNext - z;
      if (Math.hypot(dx, dz) < 1e-4) {
        const zPrev = THREE.MathUtils.lerp(zStart, zEnd, Math.max(0, t - 0.01));
        const cxPrev = getCenterX(zPrev);
        dx = cx - cxPrev;
        dz = z - zPrev;
      }
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const halfW = getHalfWidth(t, z);
      const lx = cx - nx * halfW;
      const lz = z - nz * halfW;
      const rx = cx + nx * halfW;
      const rz = z + nz * halfW;

      const yCenter = this.getNileWaterSurfaceY(z) + yOffset;

      positions.push(lx, yCenter, lz);
      positions.push(rx, yCenter, rz);

      uvs.push(0, t * uvScale);
      uvs.push(1, t * uvScale);

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

  private sharedBridgeResources: {
    deckMat: THREE.MeshStandardMaterial;
    trimStoneMat: THREE.MeshStandardMaterial;
    pierMat: THREE.MeshStandardMaterial;
    brassCapMat: THREE.MeshStandardMaterial;
    deckGeo: THREE.BoxGeometry;
    archGeo: THREE.BoxGeometry;
    parapetGeo: THREE.BoxGeometry;
    pierGeo: THREE.BoxGeometry;
    rampGeo: THREE.BoxGeometry;
    postGeo: THREE.BoxGeometry;
    capGeo: THREE.SphereGeometry;
  } | null = null;

  private getSharedBridgeResources() {
    if (this.sharedBridgeResources) return this.sharedBridgeResources;
    const span = 44;
    const roadW = 13.5;
    this.sharedBridgeResources = {
      deckMat: new THREE.MeshStandardMaterial({
        color: 0x7c7872,
        roughness: 0.86,
        metalness: 0.08,
      }),
      trimStoneMat: new THREE.MeshStandardMaterial({
        color: 0xc2bcb2,
        roughness: 0.78,
        metalness: 0.1,
      }),
      pierMat: new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.9,
        metalness: 0.08,
      }),
      brassCapMat: new THREE.MeshStandardMaterial({
        color: 0xdfba6e,
        roughness: 0.35,
        metalness: 0.82,
        emissive: 0x7c5818,
        emissiveIntensity: 0.35,
      }),
      deckGeo: new THREE.BoxGeometry(span, 1.3, roadW),
      archGeo: new THREE.BoxGeometry(span - 8, 1.8, roadW - 1.2),
      parapetGeo: new THREE.BoxGeometry(span, 1.4, 1.0),
      pierGeo: new THREE.BoxGeometry(4.2, 4.6, roadW + 1.4),
      rampGeo: new THREE.BoxGeometry(8.5, 1.1, roadW),
      postGeo: new THREE.BoxGeometry(1.7, 2.8, 1.7),
      capGeo: new THREE.SphereGeometry(0.65, 8, 8),
    };
    return this.sharedBridgeResources;
  }

  /**
   * Builds a composite Stone Arch Bridge spanning the Nile River along an imperial highway crossing
   */
  private createNileStoneBridge(x: number, z: number, orientation: 'ew_road' | 'ns_road'): THREE.Group {
    const group = new THREE.Group();
    const waterY = this.getNileWaterSurfaceY(z);
    group.position.set(x, waterY, z);
    if (orientation === 'ns_road') {
      group.rotation.y = Math.PI / 2;
    }

    const res = this.getSharedBridgeResources();
    const span = 44;
    const roadW = 13.5;

    // 1. Stone Road Deck spanning the river
    const deck = new THREE.Mesh(res.deckGeo, res.deckMat);
    deck.position.set(0, 2.3, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // 2. Arched underside masonry span
    const archSpan = new THREE.Mesh(res.archGeo, res.pierMat);
    archSpan.position.set(0, 1.35, 0);
    group.add(archSpan);

    // 3. Left & Right Stone Parapet Walls
    for (const side of [-1, 1]) {
      const parapet = new THREE.Mesh(res.parapetGeo, res.trimStoneMat);
      parapet.position.set(0, 3.55, side * (roadW * 0.5 - 0.5));
      parapet.castShadow = true;
      group.add(parapet);
    }

    // 4. Riverbed Support Piers & Abutments
    for (const px of [-14, 0, 14]) {
      const pier = new THREE.Mesh(res.pierGeo, res.pierMat);
      pier.position.set(px, -0.3, 0);
      pier.castShadow = true;
      group.add(pier);
    }

    // 5. Sloped Stone Approach Ramps on West & East banks
    for (const side of [-1, 1]) {
      const ramp = new THREE.Mesh(res.rampGeo, res.deckMat);
      ramp.position.set(side * (span * 0.5 + 3.2), 1.4, 0);
      ramp.rotation.z = side * -0.22;
      ramp.receiveShadow = true;
      group.add(ramp);
    }

    // 6. 4 Corner Gate Pillars + Gold Caps
    for (const sx of [-span * 0.5 + 1.0, span * 0.5 - 1.0]) {
      for (const sz of [-(roadW * 0.5 - 0.5), roadW * 0.5 - 0.5]) {
        const post = new THREE.Mesh(res.postGeo, res.trimStoneMat);
        post.position.set(sx, 4.1, sz);
        post.castShadow = true;
        group.add(post);

        const cap = new THREE.Mesh(res.capGeo, res.brassCapMat);
        cap.position.set(sx, 5.7, sz);
        group.add(cap);
      }
    }

    return group;
  }

  /**
   * Winding South-to-North Nile River, Northern Delta Fork, Stone Arch Bridges & High-Ridge Mist
   * (All standing terrain waterfalls/fountains & circular marsh ponds removed; Shrine moats kept intact)
   */
  private createWaterfallsAndNaturalRivers() {
    this.waterfallsGroup.name = 'TerraceWaterfallsGroup';
    this.mistPuffsGroup.name = 'CascadingGlacialMistGroup';
    this.leylineStreamsGroup.name = 'NileRiverAndDeltaGroup';

    // Flowing Nile River Water Material (Deep Nile Cerulean-Azure)
    const riverTex = createWaterfallTexture();
    riverTex.repeat.set(1, 3);
    const riverMat = new THREE.MeshStandardMaterial({
      map: riverTex,
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.36,
      roughness: 0.14,
      metalness: 0.48,
      transparent: true,
      opacity: 0.90,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.riverStreamMaterials.push(riverMat);

    // Subtle Shoreline Cyan Foam / Shimmer Trim Material
    const shoreMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.25,
      transparent: true,
      opacity: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });

    // 1. Main Nile Channel (South +3260 -> Delta Apex +736)
    const nileMain = this.buildNileChannelRibbon(
      getNileMainX,
      3260,
      NILE_DELTA_FORK_Z - 6,
      128,
      (_t, z) => {
        const taper = z > 2920 ? Math.max(0.76, 1 - (z - 2920) / 1100) : 1.0;
        return 17.0 * taper;
      },
      0.08,
      26,
      riverMat
    );
    const nileMainShore = this.buildNileChannelRibbon(
      getNileMainX,
      3260,
      NILE_DELTA_FORK_Z - 6,
      96,
      (_t, z) => {
        const taper = z > 2920 ? Math.max(0.76, 1 - (z - 2920) / 1100) : 1.0;
        return 19.6 * taper;
      },
      0.03,
      16,
      shoreMat
    );

    // 2. Northern Nile Delta Fork (West & East Branches: z=+748 -> z=-60)
    const deltaHalfW = (t: number) => 14.8 - t * 3.0;
    const deltaShoreW = (t: number) => 17.2 - t * 3.0;

    const westDelta = this.buildNileChannelRibbon(
      getNileWestDeltaX,
      NILE_DELTA_FORK_Z + 8,
      -60,
      64,
      deltaHalfW,
      0.08,
      12,
      riverMat
    );
    const westDeltaShore = this.buildNileChannelRibbon(
      getNileWestDeltaX,
      NILE_DELTA_FORK_Z + 8,
      -60,
      48,
      deltaShoreW,
      0.03,
      10,
      shoreMat
    );

    const eastDelta = this.buildNileChannelRibbon(
      getNileEastDeltaX,
      NILE_DELTA_FORK_Z + 8,
      -60,
      64,
      deltaHalfW,
      0.08,
      12,
      riverMat
    );
    const eastDeltaShore = this.buildNileChannelRibbon(
      getNileEastDeltaX,
      NILE_DELTA_FORK_Z + 8,
      -60,
      48,
      deltaShoreW,
      0.03,
      10,
      shoreMat
    );

    this.leylineStreamsGroup.add(
      nileMainShore,
      westDeltaShore,
      eastDeltaShore,
      nileMain,
      westDelta,
      eastDelta
    );

    // 3. Stone Arch Bridges where Imperial Highways cross the Nile River & Delta
    for (const bridge of NILE_HIGHWAY_BRIDGES) {
      this.leylineStreamsGroup.add(
        this.createNileStoneBridge(bridge.x, bridge.z, bridge.orientation)
      );
    }

    this.leylineMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.82,
    });

    // Corner snow mist removed cleanly for crisp full-map green visibility
  }

  /**
   * Living Animation Update for Terrain (LOD Chunks, Flowing Nile River, High-Ridge Mist)
   */
  public updateTerrainOverflow(delta: number, elapsed: number, camera?: THREE.Camera) {
    if (this.currentLodMode === 'auto' && camera) {
      for (const lod of this.lodChunks) {
        lod.update(camera);
      }
    }

    for (const rMat of this.riverStreamMaterials) {
      if (rMat.map) {
        rMat.map.offset.y = (rMat.map.offset.y - delta * 0.45) % 1.0;
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
