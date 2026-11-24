import * as THREE from 'three';

export interface ShadowProjectionState {
  /** Vector pointing from camera target toward active sun/moon light */
  sunOffset: THREE.Vector3;
  /** Base contact shadow opacity (0..1) synchronized to Day / Dusk / Night */
  contactOpacity: number;
  /** Horizontal shift multiplier opposite the light direction */
  contactOffsetFactor: number;
  /** Directional stretch multiplier along shadow ray (1.0 overhead -> ~1.28 dusk) */
  elongation: number;
  /** Horizontal yaw angle (radians) pointing away from light for directional ovals */
  shadowYaw: number;
  /** Normalized XZ direction in which shadows fall (away from sun/moon) */
  fallDirX: number;
  fallDirZ: number;
}

export interface ContactShadowEntry {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  shiftAmount: number;
  directionalStretch: boolean;
  baseScaleX: number;
  baseScaleZ: number;
}

let cachedRadialShadowTex: THREE.CanvasTexture | null = null;
let cachedOctagonalShadowTex: THREE.CanvasTexture | null = null;

/**
 * Smooth multi-stop radial ambient-occlusion & ground-contact shadow texture.
 * Deep umbra core fading seamlessly to zero alpha at the perimeter so zero hard ring edges appear.
 */
export function getSharedRadialShadowTexture(): THREE.CanvasTexture {
  if (cachedRadialShadowTex) return cachedRadialShadowTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, size * 0.04, cx, cy, size * 0.48);
    grad.addColorStop(0.0, 'rgba(4, 7, 15, 0.88)');
    grad.addColorStop(0.28, 'rgba(5, 9, 18, 0.72)');
    grad.addColorStop(0.55, 'rgba(6, 10, 20, 0.42)');
    grad.addColorStop(0.78, 'rgba(6, 10, 20, 0.16)');
    grad.addColorStop(1.0, 'rgba(6, 10, 20, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { preserveSharedCache: true };
  tex.needsUpdate = true;
  cachedRadialShadowTex = tex;
  return tex;
}

/**
 * Soft rounded-square / octagonal ambient-occlusion shadow texture tailored to walled castles,
 * citadels, Congress podiums, and rectangular keeps.
 */
export function getSharedOctagonalShadowTexture(): THREE.CanvasTexture {
  if (cachedOctagonalShadowTex) return cachedOctagonalShadowTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      const ny = (y - half + 0.5) / half; // -1..1
      for (let x = 0; x < size; x++) {
        const nx = (x - half + 0.5) / half; // -1..1
        const ax = Math.abs(nx);
        const ay = Math.abs(ny);

        // Smooth chamfered/octagonal Minkowski + Chebyshev blend for architectural footprints
        const boxDist = Math.max(ax, ay);
        const octDist = (ax + ay) * 0.7071;
        const radialDist = Math.hypot(nx, ny);
        const d = Math.max(boxDist * 0.62 + octDist * 0.38, radialDist * 0.84);

        let alpha = 0;
        if (d < 0.96) {
          const t = Math.max(0, Math.min(1, (d - 0.12) / 0.84));
          // Smooth quintic falloff for soft feathered outer edge and strong core contact AO
          const inv = 1 - t;
          alpha = Math.round(255 * 0.86 * (inv * inv * (0.45 + 0.55 * inv)));
        }

        const idx = (y * size + x) * 4;
        data[idx] = 4;
        data[idx + 1] = 7;
        data[idx + 2] = 15;
        data[idx + 3] = alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { preserveSharedCache: true };
  tex.needsUpdate = true;
  cachedOctagonalShadowTex = tex;
  return tex;
}

export function createContactShadowMaterial(
  shape: 'radial' | 'octagonal' = 'radial',
  initialOpacity = 0.68
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: shape === 'octagonal' ? getSharedOctagonalShadowTexture() : getSharedRadialShadowTexture(),
    transparent: true,
    opacity: initialOpacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
  });
}

/**
 * Builds a terrain-conformed 4x4 grid contact shadow plane that drapes over hilly World Map
 * terrain without clipping into slopes or floating above ridges.
 */
export function createTerrainConformedContactShadow(options: {
  width: number;
  depth: number;
  worldX: number;
  worldZ: number;
  baseGroundY: number;
  yOffset?: number;
  getHeightAt: (x: number, z: number) => number;
  material: THREE.Material;
  shiftAmount?: number;
  directionalStretch?: boolean;
  renderOrder?: number;
}): { mesh: THREE.Mesh; entry: ContactShadowEntry } {
  const {
    width,
    depth,
    worldX,
    worldZ,
    baseGroundY,
    yOffset = 0.06,
    getHeightAt,
    material,
    shiftAmount = 0.85,
    directionalStretch = true,
    renderOrder = 2,
  } = options;

  const geo = new THREE.PlaneGeometry(width, depth, 4, 4);
  const posAttr = geo.attributes.position;

  // Before rotating -PI/2 around X:
  // rotated (vx, vy, vz) -> (vx, vz, -vy)
  // So world coordinates = (worldX + vx, worldZ - vy), height offset = sampleY - baseGroundY + yOffset
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const sampleY = getHeightAt(worldX + vx, worldZ - vy);
    posAttr.setZ(i, sampleY - baseGroundY + yOffset);
  }
  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = renderOrder;
  mesh.userData = { isContactShadow: true };

  return {
    mesh,
    entry: {
      mesh,
      baseX: 0,
      baseY: 0,
      baseZ: 0,
      shiftAmount,
      directionalStretch,
      baseScaleX: 1,
      baseScaleZ: 1,
    },
  };
}

/**
 * Builds a single-quad flat ground contact shadow plane (used on flat courtyard floors
 * inside the Citadel or compact unit/monster footprints).
 */
export function createFlatContactShadow(options: {
  width: number;
  depth: number;
  x?: number;
  y?: number;
  z?: number;
  material: THREE.Material;
  shiftAmount?: number;
  directionalStretch?: boolean;
  renderOrder?: number;
}): { mesh: THREE.Mesh; entry: ContactShadowEntry } {
  const {
    width,
    depth,
    x = 0,
    y = 0.05,
    z = 0,
    material,
    shiftAmount = 0.65,
    directionalStretch = true,
    renderOrder = 2,
  } = options;

  const geo = new THREE.PlaneGeometry(width, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = renderOrder;
  mesh.userData = { isContactShadow: true };

  return {
    mesh,
    entry: {
      mesh,
      baseX: x,
      baseY: y,
      baseZ: z,
      shiftAmount,
      directionalStretch,
      baseScaleX: 1,
      baseScaleZ: 1,
    },
  };
}

/**
 * Zero-allocation frame synchronization of registered ground contact shadows with
 * current Day / Dusk / Night sun projection direction and elongation.
 */
export function syncContactShadowEntries(
  entries: ContactShadowEntry[],
  state: ShadowProjectionState
): void {
  const offsetScale = state.contactOffsetFactor;
  const shiftX = state.fallDirX * offsetScale;
  const shiftZ = state.fallDirZ * offsetScale;
  const extraStretch = Math.max(0, state.elongation - 1);
  const stretchX = 1 + extraStretch * Math.abs(state.fallDirX);
  const stretchZ = 1 + extraStretch * Math.abs(state.fallDirZ);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.mesh.visible) continue;
    e.mesh.position.set(
      e.baseX + shiftX * e.shiftAmount,
      e.baseY,
      e.baseZ + shiftZ * e.shiftAmount
    );
    if (e.directionalStretch) {
      e.mesh.scale.set(e.baseScaleX * stretchX, e.baseScaleZ * stretchZ, 1);
    }
  }
}
