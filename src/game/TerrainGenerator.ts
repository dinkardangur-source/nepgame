import * as THREE from 'three';
import {
  WORLD_BOUNDS,
  RESERVED_PLOTS,
  WORLD_MONSTERS,
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
    colorHex: '#438139',
    skirtColorHex: '#2f5929',
    roughness: 0.86,
    metalness: 0.03,
    normalScale: 0.85,
    movementCost: 1.0,
    passable: true,
    description: 'Smooth pastoral alpine valley turf ideal for rapid cavalry maneuvers and citadel foundations.',
    sampleWorldPos: [1560, 1420],
  },
  grass: {
    id: 'grass',
    name: 'Verdant Steppe Grass',
    shortName: 'Grass',
    colorHex: '#55963e',
    skirtColorHex: '#3b662d',
    roughness: 0.84,
    metalness: 0.03,
    normalScale: 0.95,
    movementCost: 1.0,
    passable: true,
    description: 'Lush highland meadow grass with wildflower clusters and dense turf blades.',
    sampleWorldPos: [1700, 1380],
  },
  forest_floor: {
    id: 'forest_floor',
    name: 'Deodar Forest Floor',
    shortName: 'Forest',
    colorHex: '#294d27',
    skirtColorHex: '#1f361e',
    roughness: 0.9,
    metalness: 0.03,
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
    colorHex: '#5f8741',
    skirtColorHex: '#465931',
    roughness: 0.85,
    metalness: 0.05,
    normalScale: 0.95,
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

/**
 * Extends MeshStandardMaterial with world-space dual-scale rotated texture mixing,
 * non-repeating organic meadow micro-variation, and slope-aware shading while preserving
 * full Three.js PBR sunlight, shadows, fog, and normal mapping.
 */
export function applyDualScaleGrassShader(material: THREE.MeshStandardMaterial): void {
  material.customProgramCacheKey = () => 'kg-dual-scale-grass-v1';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerrainWorldPos;
varying float vTerrainSlopeY;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 kgTerrainWp = modelMatrix * vec4(transformed, 1.0);
vTerrainWorldPos = kgTerrainWp.xyz;
vTerrainSlopeY = normalize(mat3(modelMatrix) * objectNormal).y;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerrainWorldPos;
varying float vTerrainSlopeY;

float kgTerrainHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float kgTerrainNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = kgTerrainHash(i);
  float b = kgTerrainHash(i + vec2(1.0, 0.0));
  float c = kgTerrainHash(i + vec2(0.0, 1.0));
  float d = kgTerrainHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec2 wp = vTerrainWorldPos.xz;
  vec2 uvNear = vMapUv;
  vec2 uvMacro = vec2(
    wp.x * 0.0086 - wp.y * 0.0052,
    wp.x * 0.0052 + wp.y * 0.0086
  );
  vec2 uvFine = vec2(
    wp.x * 0.105 + wp.y * 0.062,
    -wp.x * 0.062 + wp.y * 0.105
  );

  float nMacro = kgTerrainNoise(wp * 0.024);
  float nMid = kgTerrainNoise(wp * 0.095 + vec2(11.3, 4.7));
  float nMicro = kgTerrainNoise(wp * 0.42 + vec2(3.1, 17.9));

  vec4 colNear = texture2D(map, uvNear);
  vec4 colMacro = texture2D(map, uvMacro);
  vec4 colFine = texture2D(map, uvFine);
  vec4 sampledDiffuseColor = mix(mix(colNear, colFine, 0.36), colMacro, 0.32 + nMacro * 0.22);

  float meadowVar = (nMacro - 0.5) * 0.13 + (nMid - 0.5) * 0.09 + (nMicro - 0.5) * 0.06;
  sampledDiffuseColor.rgb *= vec3(1.0 + meadowVar * 0.72, 1.0 + meadowVar * 1.05, 1.0 + meadowVar * 0.55);

  float slopeMask = smoothstep(0.92, 0.62, clamp(vTerrainSlopeY, 0.0, 1.0));
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(0.84, 0.85, 0.88), slopeMask * 0.50);

  diffuseColor *= sampledDiffuseColor;
#endif`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_OBJECTSPACE
  normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  #ifdef FLIP_SIDED
    normal = - normal;
  #endif
  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif
  normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
  vec2 wpN = vTerrainWorldPos.xz;
  vec2 uvNormMacro = vec2(
    wpN.x * 0.011 - wpN.y * 0.0065,
    wpN.x * 0.0065 + wpN.y * 0.011
  );
  vec3 mapN1 = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  vec3 mapN2 = texture2D( normalMap, uvNormMacro ).xyz * 2.0 - 1.0;
  vec3 mapN = normalize( mix( mapN1, mapN2, 0.38 ) );
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`
      );
  };
  material.needsUpdate = true;
}

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
  private grassWindUniform = { value: 0 };

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
  private lodBiasScale = 1.0;
  private lastLodBiasApplied = 1.0;
  private lastLodCamX = Number.NaN;
  private lastLodCamZ = Number.NaN;
  private lodFrameCounter = 0;

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
    if (x < 0.5 || x > 3199.5 || z < 0.5 || z > 3199.5) {
      const cx = THREE.MathUtils.clamp(x, 0.5, 3199.5);
      const cz = THREE.MathUtils.clamp(z, 0.5, 3199.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(x - cx, z - cz);
      if (outDist <= 0.0001) return edgeH;

      const t = THREE.MathUtils.clamp(outDist / 6800, 0, 1);
      // C1-smooth fade from exact playable perimeter height (0 offset at edge -> rolling green hills outward)
      const edgeFade = THREE.MathUtils.smoothstep(outDist, 0, 320);
      const ridgeWave =
        Math.sin(x * 0.0048 + z * 0.0041) * 14.0 +
        Math.cos(x * 0.0113 - z * 0.0107) * 7.5 +
        Math.sin(outDist * 0.0075) * 5.0;
      const rollingLift = Math.sin(t * Math.PI * 0.65) * 26.0 + t * 18.0;
      let outerY = edgeH + (rollingLift + ridgeWave) * edgeFade;

      // Keep Nile southern source & northern delta mouths smoothly recessed near border
      if (outDist < 220) {
        const nile = getDistanceToNile(x, z);
        if (nile.distBeyondWater < 34) {
          const riverBlend =
            (1 - THREE.MathUtils.smoothstep(outDist, 0, 220)) *
            (1 - THREE.MathUtils.smoothstep(nile.distBeyondWater, 0, 34));
          outerY = THREE.MathUtils.lerp(outerY, this.getNileWaterSurfaceY(z) - 1.2, riverBlend * 0.92);
        }
      }
      return Math.max(3.5, outerY);
    }

    // 1. Reserved Flat Plots Override (The Congress & 36 Shrines) with fast AABB precheck + smooth skirt blend
    for (let i = 0; i < RESERVED_PLOTS.length; i++) {
      const plot = RESERVED_PLOTS[i];
      const dx = x - plot.position[0];
      const dz = z - plot.position[2];
      const maxR = plot.radius + 14.0;
      if (dx > maxR || dx < -maxR || dz > maxR || dz < -maxR) continue;
      const dist = Math.hypot(dx, dz);
      if (dist < plot.radius) {
        return plot.position[1];
      } else if (dist < maxR) {
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

  private readonly _fertileCol = new THREE.Color('#2c7435');
  private readonly _cliffShadeCol = new THREE.Color('#232e3b');
  private readonly _roadGrassCol = new THREE.Color('#477d3a');
  private readonly _macroEmeraldCol = new THREE.Color('#346c31');
  private readonly _sunlitCrestCol = new THREE.Color('#639448');

  /**
   * Computes a globally continuous analytical surface normal from the heightfield
   * so chunk boundaries and outer border skirts share identical lighting with zero seams.
   */
  private computeAnalyticalNormal(wx: number, wz: number, outNormals: Float32Array, offset: number) {
    const eps = 3.0;
    const hL = this.getHeightAt(wx - eps, wz);
    const hR = this.getHeightAt(wx + eps, wz);
    const hD = this.getHeightAt(wx, wz - eps);
    const hU = this.getHeightAt(wx, wz + eps);
    const nx = hL - hR;
    const ny = 2.0 * eps;
    const nz = hD - hU;
    const invLen = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
    outNormals[offset] = nx * invLen;
    outNormals[offset + 1] = ny * invLen;
    outNormals[offset + 2] = nz * invLen;
  }

  /**
   * Compute smooth blended vertex color at (wx, wz) across all 10 biomes
   */
  private sampleBlendedTerrainColor(wx: number, wz: number, elev: number, slopeDiff: number, targetColor: THREE.Color) {
    const biome = this.classifyBiomeAt(wx, wz, elev, slopeDiff);
    const spec = MODULAR_BIOME_SPECS[biome];
    targetColor.set(spec.colorHex);

    // Multi-scale non-repeating macro meadow breakup (prevents visible grid tiling when zoomed out)
    const macroWave =
      Math.sin(wx * 0.0041 + wz * 0.0033) * 0.5 +
      Math.cos(wx * 0.0097 - wz * 0.0083) * 0.5;
    if (biome === 'green_plains' || biome === 'grass' || biome === 'hills') {
      const emeraldMix = THREE.MathUtils.clamp((macroWave + 0.4) * 0.24, 0, 0.36);
      targetColor.lerp(this._macroEmeraldCol, emeraldMix);

      // Warm sunlit highland crests for natural terrain elevation legibility
      if (elev > 11.5) {
        const crestMix = THREE.MathUtils.clamp((elev - 11.5) / 14.0, 0, 0.34);
        targetColor.lerp(this._sunlitCrestCol, crestMix);
      }
    }

    // Subtle organic micro-variation using incommensurate frequencies
    const microNoise =
      (Math.sin(wx * 0.067 + wz * 0.053) + Math.cos(wx * 0.043 - wz * 0.079)) * 0.016;
    targetColor.offsetHSL(0, 0, microNoise);

    // Lush emerald floodplain gradient along Nile Riverbanks
    const nile = getDistanceToNile(wx, wz);
    if (nile.distBeyondWater > 2.0 && nile.distBeyondWater < 48.0) {
      const bankFade = 1.0 - (nile.distBeyondWater - 2.0) / 46.0;
      targetColor.lerp(this._fertileCol, bankFade * 0.55);
    }

    // Subtle crevice & steep cliff shading for crisp 3D relief
    if (slopeDiff > 1.8) {
      const cliffShade = Math.min(0.42, (slopeDiff - 1.8) * 0.085);
      targetColor.lerp(this._cliffShadeCol, cliffShade);
    }

    // Smooth road border blend
    const dRoad = this.getDistanceToRoads(wx, wz);
    if (dRoad < 9.5 && dRoad > 5.0 && elev < 24.0 && nile.distBeyondWater > 4.0) {
      const t = (dRoad - 5.0) / 4.5;
      targetColor.lerp(this._roadGrassCol, t * 0.65);
    }
  }

  /**
   * Builds the Seamless High-Performance Modular Terrain with:
   * - 8x8 Regional Indexed THREE.LOD Chunks (LOD0: 24x24, LOD1: 12x12, LOD2: 6x6 exact divisors)
   * - Perimeter downward skirts + analytical global normals for zero border/corner T-junction cracks
   * - Dual-scale world-space PBR grass shader eliminating tiling seams
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
      normalScale: new THREE.Vector2(1.18, 1.18),
      roughness: 0.89,
      metalness: 0.02,
      flatShading: false,
    });
    applyDualScaleGrassShader(this.terrainMaterial);

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
      const topVertCount = vertCountPerRow * vertCountPerRow;
      // Add perimeter downward skirt vertices along all 4 chunk edges to seal LOD T-junctions & corners
      const perimeterCount = vertCountPerRow * 4;
      const totalVerts = topVertCount + perimeterCount;

      const positions = new Float32Array(totalVerts * 3);
      const normals = new Float32Array(totalVerts * 3);
      const uvs = new Float32Array(totalVerts * 2);
      const colors = new Float32Array(totalVerts * 3);
      const indices: number[] = [];

      const step = chunkSize / segments;
      const uvScale = 0.044;
      const eps = 3.5;

      let vIdx = 0;
      for (let iz = 0; iz <= segments; iz++) {
        const wz = THREE.MathUtils.clamp(startZ + iz * step, 0.5, 3199.5);
        for (let ix = 0; ix <= segments; ix++) {
          const wx = THREE.MathUtils.clamp(startX + ix * step, 0.5, 3199.5);
          const wy = this.getHeightAt(wx, wz);

          // Single-pass centered gradient evaluation used for both slope biome tinting and analytical normal
          const hL = this.getHeightAt(wx - eps, wz);
          const hR = this.getHeightAt(wx + eps, wz);
          const hD = this.getHeightAt(wx, wz - eps);
          const hU = this.getHeightAt(wx, wz + eps);
          const slope = Math.hypot((hR - hL) * 0.5, (hU - hD) * 0.5);

          positions[vIdx * 3] = wx - originX;
          positions[vIdx * 3 + 1] = wy;
          positions[vIdx * 3 + 2] = wz - originZ;

          const nx = hL - hR;
          const ny = 2.0 * eps;
          const nz = hD - hU;
          const invLen = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
          normals[vIdx * 3] = nx * invLen;
          normals[vIdx * 3 + 1] = ny * invLen;
          normals[vIdx * 3 + 2] = nz * invLen;

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

      // Build downward 4.5m perimeter skirts on all 4 sides of the chunk
      const skirtDrop = 4.5;
      const pushSkirtVert = (topIdx: number): number => {
        const sIdx = vIdx++;
        positions[sIdx * 3] = positions[topIdx * 3];
        positions[sIdx * 3 + 1] = positions[topIdx * 3 + 1] - skirtDrop;
        positions[sIdx * 3 + 2] = positions[topIdx * 3 + 2];

        normals[sIdx * 3] = normals[topIdx * 3];
        normals[sIdx * 3 + 1] = normals[topIdx * 3 + 1];
        normals[sIdx * 3 + 2] = normals[topIdx * 3 + 2];

        uvs[sIdx * 2] = uvs[topIdx * 2];
        uvs[sIdx * 2 + 1] = uvs[topIdx * 2 + 1];

        colors[sIdx * 3] = colors[topIdx * 3];
        colors[sIdx * 3 + 1] = colors[topIdx * 3 + 1];
        colors[sIdx * 3 + 2] = colors[topIdx * 3 + 2];
        return sIdx;
      };

      // North edge (iz = 0, outward -Z)
      const northSkirt: number[] = [];
      for (let ix = 0; ix <= segments; ix++) northSkirt.push(pushSkirtVert(ix));
      for (let ix = 0; ix < segments; ix++) {
        const e0 = ix;
        const e1 = ix + 1;
        indices.push(e0, e1, northSkirt[ix], e1, northSkirt[ix + 1], northSkirt[ix]);
      }

      // South edge (iz = segments, outward +Z)
      const southSkirt: number[] = [];
      for (let ix = 0; ix <= segments; ix++) southSkirt.push(pushSkirtVert(segments * vertCountPerRow + ix));
      for (let ix = 0; ix < segments; ix++) {
        const e0 = segments * vertCountPerRow + ix;
        const e1 = e0 + 1;
        indices.push(e0, southSkirt[ix], e1, e1, southSkirt[ix], southSkirt[ix + 1]);
      }

      // West edge (ix = 0, outward -X)
      const westSkirt: number[] = [];
      for (let iz = 0; iz <= segments; iz++) westSkirt.push(pushSkirtVert(iz * vertCountPerRow));
      for (let iz = 0; iz < segments; iz++) {
        const e0 = iz * vertCountPerRow;
        const e1 = (iz + 1) * vertCountPerRow;
        indices.push(e0, westSkirt[iz], e1, e1, westSkirt[iz], westSkirt[iz + 1]);
      }

      // East edge (ix = segments, outward +X)
      const eastSkirt: number[] = [];
      for (let iz = 0; iz <= segments; iz++) eastSkirt.push(pushSkirtVert(iz * vertCountPerRow + segments));
      for (let iz = 0; iz < segments; iz++) {
        const e0 = iz * vertCountPerRow + segments;
        const e1 = (iz + 1) * vertCountPerRow + segments;
        indices.push(e0, e1, eastSkirt[iz], e1, eastSkirt[iz + 1], eastSkirt[iz]);
      }

      const geo = new THREE.BufferGeometry();
      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const triCount = segments * segments * 2 + segments * 8;
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
   * matching exact inner chunk edge vertices 1-to-1 along x=0.5/3199.5 and z=0.5/3199.5
   * with analytical normals and C1 color blending so zero seams or T-junction cracks ever appear.
   */
  private createOuterMountainBorder() {
    const EXTENT = 6800;
    const uvScale = 0.044;
    const tempColor = new THREE.Color();
    const edgeColor = new THREE.Color();
    const plainsCol = new THREE.Color('#3f7638');
    const meadowCol = new THREE.Color('#4f883d');
    const forestCol = new THREE.Color('#2b522a');
    const hillCol = new THREE.Color('#5a7a42');

    // Exact 1-to-1 vertex grid matching the 8x24 LOD0 chunk perimeter (193 samples across 0.5..3199.5)
    const innerEdgeCoords: number[] = [];
    const totalInnerSegs = 8 * 24;
    for (let i = 0; i <= totalInnerSegs; i++) {
      innerEdgeCoords.push(THREE.MathUtils.clamp((i * 3200) / totalInnerSegs, 0.5, 3199.5));
    }

    // Quadratic ease-out radial distribution: dense (~24m) near playable edge, sparse out to horizon
    const buildWingCoords = (innerEdge: number, farEdge: number, steps: number): number[] => {
      const coords: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const eased = farEdge < innerEdge ? 1 - Math.pow(1 - t, 2.2) : Math.pow(t, 2.2);
        const val = farEdge < innerEdge
          ? THREE.MathUtils.lerp(farEdge, innerEdge, eased)
          : THREE.MathUtils.lerp(innerEdge, farEdge, eased);
        coords.push(val);
      }
      return coords;
    };

    const westWingX = buildWingCoords(0.5, -EXTENT, 22);
    const eastWingX = buildWingCoords(3199.5, 3200 + EXTENT, 22);
    const northWingZ = buildWingCoords(0.5, -EXTENT, 22);
    const southWingZ = buildWingCoords(3199.5, 3200 + EXTENT, 22);

    // Combine [-EXTENT..0.5] + [0.5..3199.5] + [3199.5..3200+EXTENT] without duplicating shared edge verts
    const fullWidthX = [
      ...westWingX.slice(0, -1),
      ...innerEdgeCoords,
      ...eastWingX.slice(1),
    ];

    const evalEdgeAndOuterPoint = (wx: number, wz: number, outColor: THREE.Color): number => {
      const cx = THREE.MathUtils.clamp(wx, 0.5, 3199.5);
      const cz = THREE.MathUtils.clamp(wz, 0.5, 3199.5);
      const edgeH = this.getHeightAt(cx, cz);
      const outDist = Math.hypot(wx - cx, wz - cz);

      // Centered slope calculation matches chunk vertices at every border and corner
      const hL = this.getHeightAt(cx - 4, cz);
      const hR = this.getHeightAt(cx + 4, cz);
      const hD = this.getHeightAt(cx, cz - 4);
      const hU = this.getHeightAt(cx, cz + 4);
      const edgeSlope = Math.hypot((hR - hL) * 0.5, (hU - hD) * 0.5);
      this.sampleBlendedTerrainColor(cx, cz, edgeH, edgeSlope, edgeColor);

      if (outDist <= 0.01) {
        outColor.copy(edgeColor);
        return edgeH;
      }

      const wy = this.getHeightAt(wx, wz);

      // Compute outer lush green hill palette, then smoothly blend from exact edgeColor over 0..380m
      const nile = getDistanceToNile(wx, wz);
      if (outDist < 120 && nile.distBeyondWater < 28) {
        if (nile.distBeyondWater < 5) {
          outColor.set('#4f5242');
        } else {
          outColor.copy(this._fertileCol).lerp(meadowCol, THREE.MathUtils.clamp(outDist / 120, 0, 1));
        }
      } else {
        const biomeWave = Math.sin(wx * 0.0045 + wz * 0.0038) * 0.5 + 0.5;
        const crestWave = Math.cos(wx * 0.009 - wz * 0.008) * 0.5 + 0.5;
        outColor.copy(plainsCol).lerp(meadowCol, biomeWave * 0.65);
        if (wy > 24) {
          outColor.lerp(hillCol, THREE.MathUtils.clamp((wy - 24) / 28, 0, 0.55));
        }
        if (crestWave > 0.56) {
          outColor.lerp(forestCol, (crestWave - 0.56) * 1.15);
        }
        outColor.offsetHSL(0, 0, Math.sin(wx * 0.014 + wz * 0.011) * 0.015);
      }

      const borderColorFade = THREE.MathUtils.smoothstep(outDist, 0, 380);
      tempColor.copy(edgeColor).lerp(outColor, borderColorFade);
      outColor.copy(tempColor);

      return wy;
    };

    const buildSkirtFromAxes = (xs: number[], zs: number[]) => {
      const cols = xs.length;
      const rows = zs.length;
      const totalVerts = cols * rows;
      const positions = new Float32Array(totalVerts * 3);
      const normals = new Float32Array(totalVerts * 3);
      const uvs = new Float32Array(totalVerts * 2);
      const colors = new Float32Array(totalVerts * 3);
      const indices: number[] = [];
      const vertexCol = new THREE.Color();

      let vIdx = 0;
      for (let iz = 0; iz < rows; iz++) {
        const wz = zs[iz];
        for (let ix = 0; ix < cols; ix++) {
          const wx = xs[ix];
          const wy = evalEdgeAndOuterPoint(wx, wz, vertexCol);

          positions[vIdx * 3] = wx;
          positions[vIdx * 3 + 1] = wy;
          positions[vIdx * 3 + 2] = wz;

          this.computeAnalyticalNormal(wx, wz, normals, vIdx * 3);

          uvs[vIdx * 2] = wx * uvScale;
          uvs[vIdx * 2 + 1] = wz * uvScale;

          colors[vIdx * 3] = vertexCol.r;
          colors[vIdx * 3 + 1] = vertexCol.g;
          colors[vIdx * 3 + 2] = vertexCol.b;
          vIdx++;
        }
      }

      for (let iz = 0; iz < rows - 1; iz++) {
        for (let ix = 0; ix < cols - 1; ix++) {
          const a = iz * cols + ix;
          const b = iz * cols + (ix + 1);
          const c = (iz + 1) * cols + ix;
          const d = (iz + 1) * cols + (ix + 1);
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mesh = new THREE.Mesh(geo, this.terrainMaterial);
      mesh.receiveShadow = true;
      mesh.name = 'OuterGreenContinentSkirt';
      this.mesh.add(mesh);
    };

    // South & North full-width skirts (exact 209-vertex match along 0.5..3199.5 + wide corner wings)
    buildSkirtFromAxes(fullWidthX, southWingZ);
    buildSkirtFromAxes(fullWidthX, northWingZ);
    // West & East skirts (exact 209-vertex match along z=0.5..3199.5)
    buildSkirtFromAxes(westWingX, innerEdgeCoords);
    buildSkirtFromAxes(eastWingX, innerEdgeCoords);
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
      if (!isNearPlot) {
        for (const mon of WORLD_MONSTERS) {
          if (Math.hypot(rx - mon.position[0], rz - mon.position[2]) < 16) {
            isNearPlot = true;
            break;
          }
        }
      }
      if (!isNearPlot) {
        for (const res of WORLD_RESOURCES) {
          if (Math.hypot(rx - res.position[0], rz - res.position[2]) < 14) {
            isNearPlot = true;
            break;
          }
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

    // Hardware-Instanced 3D Meadow Grass Tuft Clumps (1 draw call, GPU breeze sway)
    const grassGeo = this.createGrassTuftGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.grassWindUniform;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float bladeTip = clamp(position.y / 1.25, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vec2 worldAnchor = instanceMatrix[3].xz;
        #else
          vec2 worldAnchor = position.xz;
        #endif
        float gust = sin(uTime * 1.9 + worldAnchor.x * 0.035 + worldAnchor.y * 0.028);
        float microFlutter = cos(uTime * 3.1 + worldAnchor.x * 0.09);
        transformed.x += (gust * 0.16 + microFlutter * 0.05) * bladeTip * bladeTip;
        transformed.z += (gust * 0.11 - microFlutter * 0.04) * bladeTip * bladeTip;`
      );
    };

    const MAX_GRASS_TUFTS = 5600;
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, MAX_GRASS_TUFTS);
    grassInst.castShadow = false;
    grassInst.receiveShadow = true;

    let grassIdx = 0;
    let grassSeed = 9103;
    const grassRand = () => {
      grassSeed = (grassSeed * 9301 + 49297) % 233280;
      return grassSeed / 233280;
    };

    const grassPalette = ['#4b923c', '#5ca444', '#397b34', '#6bb048', '#41853b'];
    const baseGrassCol = new THREE.Color();

    for (let i = 0; i < 8200 && grassIdx < MAX_GRASS_TUFTS; i++) {
      const gx = 30 + grassRand() * 3140;
      const gz = 30 + grassRand() * 3140;

      // Keep central citadel courtyard clear
      if (Math.hypot(gx - 1600, gz - 1600) < 92) continue;

      let nearReserved = false;
      for (const plot of RESERVED_PLOTS) {
        if (Math.hypot(gx - plot.position[0], gz - plot.position[2]) < plot.radius + 11.0) {
          nearReserved = true;
          break;
        }
      }
      if (nearReserved) continue;
      if (this.getDistanceToRoads(gx, gz) < 10.5) continue;

      const nile = getDistanceToNile(gx, gz);
      if (nile.distBeyondWater < 4.8) continue;

      const gy = this.getHeightAt(gx, gz);
      const hR = this.getHeightAt(Math.min(3199.5, gx + 3), gz);
      const hU = this.getHeightAt(gx, Math.min(3199.5, gz + 3));
      const slope = Math.hypot(gy - hR, gy - hU);
      if (slope > 2.6 || gy > 30.0) continue;

      const sXZ = 0.85 + grassRand() * 0.75;
      const sY = 0.75 + grassRand() * 0.7;
      dummy.position.set(gx, gy - 0.04, gz);
      dummy.rotation.set(
        (grassRand() - 0.5) * 0.14,
        grassRand() * Math.PI * 2,
        (grassRand() - 0.5) * 0.14
      );
      dummy.scale.set(sXZ, sY, sXZ);
      dummy.updateMatrix();
      grassInst.setMatrixAt(grassIdx, dummy.matrix);

      const pick = grassPalette[Math.floor(grassRand() * grassPalette.length)];
      baseGrassCol.set(pick);
      if (nile.distBeyondWater < 42.0) {
        baseGrassCol.lerp(this._fertileCol, 0.25);
      }
      baseGrassCol.offsetHSL((grassRand() - 0.5) * 0.025, 0.04, (grassRand() - 0.5) * 0.06);
      grassInst.setColorAt(grassIdx, baseGrassCol);

      grassIdx++;
    }

    grassInst.count = grassIdx;
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();

    this.vegetationGroup.add(grassInst);
  }

  /**
   * Creates a 5-blade splayed 3D grass tuft clump geometry anchored at y=0
   * with darker soil-root vertex colors fading to sunlit meadow-tip colors.
   */
  private createGrassTuftGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const blades = 5;
    const baseCol = new THREE.Color('#4d6b38');
    const tipCol = new THREE.Color('#d8f5a2');

    for (let b = 0; b < blades; b++) {
      const yaw = (b / blades) * Math.PI * 2 + (b % 2) * 0.32;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const halfW = 0.24;
      const height = 0.92 + (b % 3) * 0.18;
      const lean = 0.42 + (b % 2) * 0.18;
      const rootRadius = 0.12;

      const rx = cosY * rootRadius;
      const rz = sinY * rootRadius;

      // Perpendicular width axis
      const px = -sinY * halfW;
      const pz = cosY * halfW;

      // Root left, root right, mid left, mid right, tip
      const vBase = b * 5;
      positions.push(
        rx - px, 0, rz - pz,
        rx + px, 0, rz + pz,
        rx + cosY * (lean * 0.45) - px * 0.55, height * 0.55, rz + sinY * (lean * 0.45) - pz * 0.55,
        rx + cosY * (lean * 0.45) + px * 0.55, height * 0.55, rz + sinY * (lean * 0.45) + pz * 0.55,
        rx + cosY * lean, height, rz + sinY * lean
      );

      // Smooth upward-biased normals for soft meadow shading
      for (let v = 0; v < 5; v++) {
        normals.push(cosY * 0.2, 0.96, sinY * 0.2);
      }

      const midCol = baseCol.clone().lerp(tipCol, 0.55);
      colors.push(
        baseCol.r, baseCol.g, baseCol.b,
        baseCol.r, baseCol.g, baseCol.b,
        midCol.r, midCol.g, midCol.b,
        midCol.r, midCol.g, midCol.b,
        tipCol.r, tipCol.g, tipCol.b
      );

      indices.push(
        vBase + 0, vBase + 1, vBase + 2,
        vBase + 1, vBase + 3, vBase + 2,
        vBase + 2, vBase + 3, vBase + 4
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
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

  public setAdaptiveLodBias(scale: number) {
    const clamped = THREE.MathUtils.clamp(scale, 0.55, 1.0);
    if (Math.abs(clamped - this.lodBiasScale) < 0.02) return;
    this.lodBiasScale = clamped;
    const d1 = Math.round(460 * clamped);
    const d2 = Math.round(900 * clamped);
    for (let i = 0; i < this.lodChunks.length; i++) {
      const lvls = this.lodChunks[i].levels;
      if (lvls.length >= 3) {
        lvls[1].distance = d1;
        lvls[2].distance = d2;
      }
    }
  }

  /**
   * Living Animation Update for Terrain (LOD Chunks, Flowing Nile River, High-Ridge Mist)
   */
  public updateTerrainOverflow(delta: number, elapsed: number, camera?: THREE.Camera) {
    this.grassWindUniform.value = elapsed;

    if (this.currentLodMode === 'auto' && camera) {
      this.lodFrameCounter++;
      const dx = camera.position.x - this.lastLodCamX;
      const dz = camera.position.z - this.lastLodCamZ;
      const movedEnough =
        Number.isNaN(this.lastLodCamX) ||
        dx * dx + dz * dz > 36 ||
        this.lastLodBiasApplied !== this.lodBiasScale ||
        this.lodFrameCounter % 3 === 0;
      if (movedEnough) {
        this.lastLodCamX = camera.position.x;
        this.lastLodCamZ = camera.position.z;
        this.lastLodBiasApplied = this.lodBiasScale;
        for (let i = 0; i < this.lodChunks.length; i++) {
          this.lodChunks[i].update(camera);
        }
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
