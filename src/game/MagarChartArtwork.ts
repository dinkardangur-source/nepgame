import * as THREE from 'three';
import type { TroopLevel } from './NepaleseBalanceConfig';

export const MAGAR_CHART_IMAGE_URL = '/assets/aistudio/Magar_Warrior_Progression_Chart_55c15772.png';

export type MagarChartPart = 'warrior' | 'weapon' | 'shield' | 'armor';

export interface MagarTierCrops {
  warrior: string;
  warriorCanvas?: HTMLCanvasElement;
  warriorAspect: number;
  weapon: string;
  shield: string;
  armor: string;
}

export type MagarChartCropMap = Record<TroopLevel, MagarTierCrops>;

// Normalized [xStart, xEnd] column bands for Lv.1..Lv.5 on the 1254x1254 progression chart
const COLUMN_X_BANDS: Record<TroopLevel, [number, number]> = {
  1: [0.008, 0.194],
  2: [0.205, 0.392],
  3: [0.404, 0.590],
  4: [0.600, 0.788],
  5: [0.798, 0.990],
};

// Tight vertical bands avoiding header pills, upgrade chevrons, and text labels
const PART_Y_BANDS: Record<MagarChartPart, [number, number]> = {
  warrior: [0.062, 0.535],
  weapon: [0.630, 0.692],
  shield: [0.736, 0.828],
  armor: [0.858, 0.970],
};

let cachedCropMap: MagarChartCropMap | null = null;
let loadingPromise: Promise<MagarChartCropMap> | null = null;
const threeWarriorTextureCache = new Map<
  TroopLevel,
  {
    westTexture: THREE.CanvasTexture | null;
    eastTexture: THREE.CanvasTexture | null;
    aspectRatio: number;
    listeners: Array<(aspectRatio: number, westTexture: THREE.CanvasTexture, eastTexture: THREE.CanvasTexture) => void>;
  }
>();

function createMirroredHorizontalWarriorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const flipped = document.createElement('canvas');
  flipped.width = Math.max(2, src.width);
  flipped.height = Math.max(2, src.height);
  const ctx = flipped.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, flipped.width, flipped.height);
    ctx.save();
    ctx.translate(flipped.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }
  return flipped;
}

function createWarriorCanvasTexture(canvas: HTMLCanvasElement, maxAnisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  texture.userData = { preserveSharedCache: true };
  return texture;
}

/**
 * Strips the dark charcoal studio backdrop from a cropped Magar Warrior column using
 * an edge-connected flood fill (so dark armor plates, black hair, and shaded robes
 * inside the character silhouette remain completely opaque), feathers 1px edge halos,
 * and trims tightly to the visible warrior bounds.
 */
function keyWarriorBackdrop(
  img: HTMLImageElement,
  nx0: number,
  ny0: number,
  nx1: number,
  ny1: number
): { dataUrl: string; canvas: HTMLCanvasElement; aspectRatio: number } {
  const sx = Math.max(0, Math.round(nx0 * img.naturalWidth));
  const sy = Math.max(0, Math.round(ny0 * img.naturalHeight));
  const sw = Math.max(16, Math.round((nx1 - nx0) * img.naturalWidth));
  const sh = Math.max(16, Math.round((ny1 - ny0) * img.naturalHeight));

  const w = 240;
  const h = Math.max(64, Math.round((sh / sw) * w));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { dataUrl: MAGAR_CHART_IMAGE_URL, canvas: workCanvas, aspectRatio: w / h };
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const bgMask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // Sample average studio backdrop color from the top-left & top-right corners of the crop
  let refR = 38;
  let refG = 40;
  let refB = 45;
  {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let cnt = 0;
    for (let y = 2; y < Math.min(h, 14); y++) {
      for (const x of [2, 4, w - 3, w - 5]) {
        const p = (y * w + x) * 4;
        sumR += data[p];
        sumG += data[p + 1];
        sumB += data[p + 2];
        cnt++;
      }
    }
    if (cnt > 0) {
      refR = sumR / cnt;
      refG = sumG / cnt;
      refB = sumB / cnt;
    }
  }

  const isStudioBackdrop = (idx: number): boolean => {
    const p = idx * 4;
    if (data[p + 3] <= 12) return true;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const chroma = maxC - minC;
    const dr = Math.abs(r - refR);
    const dg = Math.abs(g - refG);
    const db = Math.abs(b - refB);
    const colorDist = dr + dg + db;
    // Matches the low-chroma slate gradient studio background (including floor reflection)
    return chroma <= 20 && minC >= 18 && maxC <= 96 && colorDist <= 115;
  };

  const enqueue = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    if (isStudioBackdrop(idx)) {
      bgMask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < w) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < h) enqueue(x, y + 1);
  }

  for (let i = 0; i < total; i++) {
    if (bgMask[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Soft 1px silhouette anti-alias & slate-fringe cleanup
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (bgMask[idx]) continue;
      const touchesBg =
        bgMask[idx - 1] ||
        bgMask[idx + 1] ||
        bgMask[idx - w] ||
        bgMask[idx + w];
      if (!touchesBg) continue;

      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const chroma = maxC - minC;
      if (chroma <= 22 && maxC <= 110) {
        data[p + 3] = Math.round(data[p + 3] * 0.45);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Tightly crop to visible warrior pixels
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    let url = MAGAR_CHART_IMAGE_URL;
    try {
      url = workCanvas.toDataURL('image/png');
    } catch {
      // Ignore
    }
    return { dataUrl: url, canvas: workCanvas, aspectRatio: w / h };
  }

  const pad = 4;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cw;
  outCanvas.height = ch;
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    outCtx.clearRect(0, 0, cw, ch);
    outCtx.drawImage(workCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
  }

  let dataUrl = MAGAR_CHART_IMAGE_URL;
  try {
    dataUrl = outCanvas.toDataURL('image/png');
  } catch {
    dataUrl = MAGAR_CHART_IMAGE_URL;
  }

  return {
    dataUrl,
    canvas: outCanvas,
    aspectRatio: cw / Math.max(1, ch),
  };
}

function createCroppedDataUrl(
  img: HTMLImageElement,
  nx0: number,
  ny0: number,
  nx1: number,
  ny1: number
): string {
  const sx = Math.max(0, Math.round(nx0 * img.naturalWidth));
  const sy = Math.max(0, Math.round(ny0 * img.naturalHeight));
  const sw = Math.max(16, Math.round((nx1 - nx0) * img.naturalWidth));
  const sh = Math.max(16, Math.round((ny1 - ny0) * img.naturalHeight));

  const targetW = 210;
  const targetH = Math.max(48, Math.round((sh / sw) * targetW));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return MAGAR_CHART_IMAGE_URL;

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  const grad = ctx.createRadialGradient(
    targetW * 0.5,
    targetH * 0.5,
    Math.min(targetW, targetH) * 0.32,
    targetW * 0.5,
    targetH * 0.5,
    Math.max(targetW, targetH) * 0.72
  );
  grad.addColorStop(0, 'rgba(10, 16, 26, 0)');
  grad.addColorStop(1, 'rgba(10, 16, 26, 0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, targetW, targetH);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return MAGAR_CHART_IMAGE_URL;
  }
}

export function getMagarChartCropsSync(): MagarChartCropMap | null {
  return cachedCropMap;
}

export function loadMagarChartCrops(): Promise<MagarChartCropMap> {
  if (cachedCropMap) return Promise.resolve(cachedCropMap);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const fallback: MagarChartCropMap = {
      1: { warrior: MAGAR_CHART_IMAGE_URL, warriorAspect: 0.44, weapon: MAGAR_CHART_IMAGE_URL, shield: MAGAR_CHART_IMAGE_URL, armor: MAGAR_CHART_IMAGE_URL },
      2: { warrior: MAGAR_CHART_IMAGE_URL, warriorAspect: 0.44, weapon: MAGAR_CHART_IMAGE_URL, shield: MAGAR_CHART_IMAGE_URL, armor: MAGAR_CHART_IMAGE_URL },
      3: { warrior: MAGAR_CHART_IMAGE_URL, warriorAspect: 0.44, weapon: MAGAR_CHART_IMAGE_URL, shield: MAGAR_CHART_IMAGE_URL, armor: MAGAR_CHART_IMAGE_URL },
      4: { warrior: MAGAR_CHART_IMAGE_URL, warriorAspect: 0.44, weapon: MAGAR_CHART_IMAGE_URL, shield: MAGAR_CHART_IMAGE_URL, armor: MAGAR_CHART_IMAGE_URL },
      5: { warrior: MAGAR_CHART_IMAGE_URL, warriorAspect: 0.44, weapon: MAGAR_CHART_IMAGE_URL, shield: MAGAR_CHART_IMAGE_URL, armor: MAGAR_CHART_IMAGE_URL },
    };

    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      cachedCropMap = fallback;
      resolve(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const result: Partial<MagarChartCropMap> = {};
        const levels: TroopLevel[] = [1, 2, 3, 4, 5];
        for (const lv of levels) {
          const [cx0, cx1] = COLUMN_X_BANDS[lv];
          const gx0 = cx0 + 0.012;
          const gx1 = cx1 - 0.012;
          const keyedWarrior = keyWarriorBackdrop(img, cx0, PART_Y_BANDS.warrior[0], cx1, PART_Y_BANDS.warrior[1]);
          result[lv] = {
            warrior: keyedWarrior.dataUrl,
            warriorCanvas: keyedWarrior.canvas,
            warriorAspect: keyedWarrior.aspectRatio,
            weapon: createCroppedDataUrl(img, gx0, PART_Y_BANDS.weapon[0], gx1, PART_Y_BANDS.weapon[1]),
            shield: createCroppedDataUrl(img, gx0, PART_Y_BANDS.shield[0], gx1, PART_Y_BANDS.shield[1]),
            armor: createCroppedDataUrl(img, gx0, PART_Y_BANDS.armor[0], gx1, PART_Y_BANDS.armor[1]),
          };
        }
        cachedCropMap = result as MagarChartCropMap;
        resolve(cachedCropMap);
      } catch {
        cachedCropMap = fallback;
        resolve(fallback);
      }
    };
    img.onerror = () => {
      cachedCropMap = fallback;
      resolve(fallback);
    };
    img.src = MAGAR_CHART_IMAGE_URL;
  });

  return loadingPromise;
}

export function getSharedMagarWarriorDirectionalTextures(
  level: TroopLevel,
  maxAnisotropy = 4,
  onReady?: (aspectRatio: number, westTexture: THREE.CanvasTexture, eastTexture: THREE.CanvasTexture) => void
): { westTexture: THREE.CanvasTexture | null; eastTexture: THREE.CanvasTexture | null; aspectRatio: number } {
  const cachedCanvas = cachedCropMap?.[level]?.warriorCanvas;
  const cachedAspect = cachedCropMap?.[level]?.warriorAspect || 0.44;
  const existing = threeWarriorTextureCache.get(level);

  if (existing) {
    if (existing.westTexture && existing.eastTexture) {
      onReady?.(existing.aspectRatio, existing.westTexture, existing.eastTexture);
      return {
        westTexture: existing.westTexture,
        eastTexture: existing.eastTexture,
        aspectRatio: existing.aspectRatio,
      };
    }
    if (cachedCanvas) {
      const westTex = createWarriorCanvasTexture(cachedCanvas, maxAnisotropy);
      const eastTex = createWarriorCanvasTexture(
        createMirroredHorizontalWarriorCanvas(cachedCanvas),
        maxAnisotropy
      );
      existing.westTexture = westTex;
      existing.eastTexture = eastTex;
      existing.aspectRatio = cachedAspect;
      onReady?.(existing.aspectRatio, westTex, eastTex);
      return { westTexture: westTex, eastTexture: eastTex, aspectRatio: existing.aspectRatio };
    }
    if (onReady) {
      existing.listeners.push(onReady);
    }
    return { westTexture: null, eastTexture: null, aspectRatio: existing.aspectRatio };
  }

  if (cachedCanvas) {
    const westTex = createWarriorCanvasTexture(cachedCanvas, maxAnisotropy);
    const eastTex = createWarriorCanvasTexture(
      createMirroredHorizontalWarriorCanvas(cachedCanvas),
      maxAnisotropy
    );
    threeWarriorTextureCache.set(level, {
      westTexture: westTex,
      eastTexture: eastTex,
      aspectRatio: cachedAspect,
      listeners: [],
    });
    onReady?.(cachedAspect, westTex, eastTex);
    return { westTexture: westTex, eastTexture: eastTex, aspectRatio: cachedAspect };
  }

  const entry: {
    westTexture: THREE.CanvasTexture | null;
    eastTexture: THREE.CanvasTexture | null;
    aspectRatio: number;
    listeners: Array<(aspectRatio: number, westTexture: THREE.CanvasTexture, eastTexture: THREE.CanvasTexture) => void>;
  } = {
    westTexture: null,
    eastTexture: null,
    aspectRatio: 0.44,
    listeners: onReady ? [onReady] : [],
  };
  threeWarriorTextureCache.set(level, entry);

  loadMagarChartCrops().then((crops) => {
    const tierData = crops[level];
    if (tierData?.warriorCanvas) {
      entry.aspectRatio = tierData.warriorAspect || 0.44;
      if (!entry.westTexture) {
        entry.westTexture = createWarriorCanvasTexture(tierData.warriorCanvas, maxAnisotropy);
      }
      if (!entry.eastTexture) {
        entry.eastTexture = createWarriorCanvasTexture(
          createMirroredHorizontalWarriorCanvas(tierData.warriorCanvas),
          maxAnisotropy
        );
      }
    }
    if (entry.westTexture && entry.eastTexture) {
      const listeners = entry.listeners.splice(0, entry.listeners.length);
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](entry.aspectRatio, entry.westTexture, entry.eastTexture);
      }
    }
  });

  return { westTexture: null, eastTexture: null, aspectRatio: entry.aspectRatio };
}

export function getSharedMagarWarriorTexture(
  level: TroopLevel,
  maxAnisotropy = 4,
  onReady?: (aspectRatio: number, texture: THREE.CanvasTexture) => void
): { texture: THREE.CanvasTexture | null; aspectRatio: number } {
  const { westTexture, aspectRatio } = getSharedMagarWarriorDirectionalTextures(
    level,
    maxAnisotropy,
    onReady ? (ratio, west) => onReady(ratio, west) : undefined
  );
  return { texture: westTexture, aspectRatio };
}



