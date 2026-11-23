import * as THREE from 'three';

export type MonsterArchetypeKey = 'goblin' | 'skeleton' | 'orc' | 'death_knight' | 'boss';

export interface MonsterArtConfig {
  key: MonsterArchetypeKey;
  label: string;
  imageUrl: string;
  spriteHeight: number;
  initialAspect: number;
  auraHex: number;
  auraCss: string;
  secondaryHex: number;
  secondaryCss: string;
  shadowRadius: number;
  ringInner: number;
  ringOuter: number;
  badgeY: number;
  belowTagDist: number;
  isHoverBoss?: boolean;
}

export const MONSTER_ART_CONFIGS: Record<MonsterArchetypeKey, MonsterArtConfig> = {
  goblin: {
    key: 'goblin',
    label: 'Golden Goblin',
    imageUrl: '/assets/aistudio/Golden_Goblin_with_Treasure_Sack_3d6e0643.png',
    spriteHeight: 6.6,
    initialAspect: 0.88,
    auraHex: 0xfacc15,
    auraCss: '#facc15',
    secondaryHex: 0xd97706,
    secondaryCss: '#d97706',
    shadowRadius: 2.35,
    ringInner: 2.35,
    ringOuter: 3.15,
    badgeY: 7.55,
    belowTagDist: 5.4,
  },
  skeleton: {
    key: 'skeleton',
    label: 'Skeleton',
    imageUrl: '/assets/aistudio/Armored_Skeleton_Knight_with_Glowing_Eyes_8d07613d.png',
    spriteHeight: 7.2,
    initialAspect: 0.84,
    auraHex: 0xdc2626,
    auraCss: '#ef4444',
    secondaryHex: 0x991b1b,
    secondaryCss: '#991b1b',
    shadowRadius: 2.5,
    ringInner: 2.45,
    ringOuter: 3.25,
    badgeY: 8.15,
    belowTagDist: 5.6,
  },
  orc: {
    key: 'orc',
    label: 'Orc',
    imageUrl: '/assets/aistudio/Fierce_Orc_Warrior_with_Branch_Club_2d06f5eb.png',
    spriteHeight: 7.8,
    initialAspect: 0.96,
    auraHex: 0xea580c,
    auraCss: '#fb923c',
    secondaryHex: 0x84cc16,
    secondaryCss: '#84cc16',
    shadowRadius: 2.85,
    ringInner: 2.75,
    ringOuter: 3.65,
    badgeY: 8.75,
    belowTagDist: 5.9,
  },
  death_knight: {
    key: 'death_knight',
    label: 'Death Knight',
    imageUrl: '/assets/aistudio/Icy_Lich_King_with_Runeblade_ff11a57c.png',
    spriteHeight: 8.9,
    initialAspect: 0.86,
    auraHex: 0x38bdf8,
    auraCss: '#38bdf8',
    secondaryHex: 0x1d4ed8,
    secondaryCss: '#2563eb',
    shadowRadius: 3.1,
    ringInner: 3.05,
    ringOuter: 4.05,
    badgeY: 9.85,
    belowTagDist: 6.2,
  },
  boss: {
    key: 'boss',
    label: 'Drago',
    imageUrl: '/assets/aistudio/Spectral_Bone_Dragon_Unleashed_b4e1a44d.png',
    spriteHeight: 12.6,
    initialAspect: 1.38,
    auraHex: 0xa855f7,
    auraCss: '#c084fc',
    secondaryHex: 0xef4444,
    secondaryCss: '#ef4444',
    shadowRadius: 5.4,
    ringInner: 5.2,
    ringOuter: 6.75,
    badgeY: 13.7,
    belowTagDist: 9.4,
    isHoverBoss: false,
  },
};

export function resolveMonsterArchetypeKey(subtype?: string, level?: number, name?: string): MonsterArchetypeKey {
  const norm = `${subtype || ''} ${name || ''}`.toLowerCase();
  if (norm.includes('boss') || norm.includes('drago') || norm.includes('dragon') || (level ?? 1) >= 10) return 'boss';
  if (norm.includes('death_knight') || norm.includes('death knight') || norm.includes('lich')) return 'death_knight';
  if (norm.includes('goblin')) return 'goblin';
  if (norm.includes('skeleton')) return 'skeleton';
  return 'orc';
}

export function getMonsterArtConfig(subtype?: string, level?: number, name?: string): MonsterArtConfig {
  return MONSTER_ART_CONFIGS[resolveMonsterArchetypeKey(subtype, level, name)];
}

export interface ProcessedMonsterCutout {
  key: MonsterArchetypeKey;
  aspectRatio: number;
  dataUrl: string;
  canvas: HTMLCanvasElement;
}

const cutoutPromiseCache = new Map<MonsterArchetypeKey, Promise<ProcessedMonsterCutout>>();
const cutoutResolvedCache = new Map<MonsterArchetypeKey, ProcessedMonsterCutout>();
const threeTextureCache = new Map<
  MonsterArchetypeKey,
  {
    texture: THREE.CanvasTexture | null;
    aspectRatio: number;
    listeners: Array<(aspectRatio: number, texture: THREE.CanvasTexture) => void>;
  }
>();

/**
 * Removes solid white background from uploaded monster PNGs using an edge-connected
 * flood fill (preserving white/bright internal bones, armor highlights, and frost runes),
 * applies soft edge anti-aliasing + fringe suppression, and crops tightly to content bounds.
 */
function keyWhiteBackgroundFromImage(img: HTMLImageElement, maxDim = 512): { canvas: HTMLCanvasElement; aspectRatio: number } {
  const srcW = img.naturalWidth || img.width || 512;
  const srcH = img.naturalHeight || img.height || 512;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(2, Math.round(srcW * scale));
  const h = Math.max(2, Math.round(srcH * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { canvas: workCanvas, aspectRatio: srcW / Math.max(1, srcH) };
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const bgMask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBackgroundCandidate = (idx: number): boolean => {
    const p = idx * 4;
    const a = data[p + 3];
    if (a <= 12) return true;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
    return minC >= 220 && maxC - minC <= 34;
  };

  const enqueue = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    if (isBackgroundCandidate(idx)) {
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

  // Clear connected white backdrop pixels
  for (let i = 0; i < total; i++) {
    if (bgMask[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Soft 1px edge feather & white-fringe cleanup on silhouette boundary pixels
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

      if (minC >= 198 && chroma <= 40) {
        const whiteness = Math.min(1, Math.max(0, (minC - 198) / 57));
        const newAlpha = Math.round(data[p + 3] * (1 - whiteness * 0.88));
        data[p + 3] = newAlpha;
        data[p] = Math.round(r * 0.78);
        data[p + 1] = Math.round(g * 0.78);
        data[p + 2] = Math.round(b * 0.78);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Find tight visible bounding box
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { canvas: workCanvas, aspectRatio: w / Math.max(1, h) };
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

  return {
    canvas: outCanvas,
    aspectRatio: cw / Math.max(1, ch),
  };
}

function buildFallbackDrawnCanvas(img: HTMLImageElement | null, cfg: MonsterArtConfig): { canvas: HTMLCanvasElement; aspectRatio: number } {
  const c = document.createElement('canvas');
  const w = img && img.naturalWidth ? Math.min(512, img.naturalWidth) : 256;
  const h = img && img.naturalHeight ? Math.min(512, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w)) : Math.round(w / cfg.initialAspect);
  c.width = Math.max(2, w);
  c.height = Math.max(2, h);
  const ctx = c.getContext('2d');
  if (ctx) {
    if (img && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, c.width, c.height);
    } else {
      // Visible glowing silhouette emblem fallback so a monster can never disappear silently
      const grad = ctx.createRadialGradient(c.width * 0.5, c.height * 0.5, 10, c.width * 0.5, c.height * 0.5, c.width * 0.48);
      grad.addColorStop(0, cfg.auraCss);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, c.width, c.height);
    }
  }
  return { canvas: c, aspectRatio: c.width / Math.max(1, c.height) };
}

function createMonsterSpriteCanvasTexture(canvas: HTMLCanvasElement, maxAnisotropy: number): THREE.CanvasTexture {
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

export function getCachedMonsterCutoutSync(key: MonsterArchetypeKey): ProcessedMonsterCutout | null {
  return cutoutResolvedCache.get(key) ?? null;
}

export function loadProcessedMonsterCutout(key: MonsterArchetypeKey): Promise<ProcessedMonsterCutout> {
  const resolved = cutoutResolvedCache.get(key);
  if (resolved) return Promise.resolve(resolved);

  const pending = cutoutPromiseCache.get(key);
  if (pending) return pending;

  const cfg = MONSTER_ART_CONFIGS[key];
  const promise = new Promise<ProcessedMonsterCutout>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const { canvas, aspectRatio } = keyWhiteBackgroundFromImage(img, 512);
        const result: ProcessedMonsterCutout = {
          key,
          aspectRatio,
          dataUrl: canvas.toDataURL('image/png'),
          canvas,
        };
        cutoutResolvedCache.set(key, result);
        resolve(result);
      } catch {
        const drawn = buildFallbackDrawnCanvas(img, cfg);
        const result: ProcessedMonsterCutout = {
          key,
          aspectRatio: drawn.aspectRatio,
          dataUrl: cfg.imageUrl,
          canvas: drawn.canvas,
        };
        cutoutResolvedCache.set(key, result);
        resolve(result);
      }
    };
    img.onerror = () => {
      const drawn = buildFallbackDrawnCanvas(null, cfg);
      const result: ProcessedMonsterCutout = {
        key,
        aspectRatio: drawn.aspectRatio,
        dataUrl: cfg.imageUrl,
        canvas: drawn.canvas,
      };
      cutoutResolvedCache.set(key, result);
      resolve(result);
    };
    img.src = cfg.imageUrl;
  });

  cutoutPromiseCache.set(key, promise);
  return promise;
}

export function prewarmMonsterCutouts(): void {
  if (typeof Image === 'undefined') return;
  (['goblin', 'skeleton', 'orc', 'death_knight', 'boss'] as MonsterArchetypeKey[]).forEach((key) => {
    void loadProcessedMonsterCutout(key);
  });
}

export function getSharedMonsterSpriteTexture(
  key: MonsterArchetypeKey,
  maxAnisotropy = 4,
  onReady?: (aspectRatio: number, texture: THREE.CanvasTexture) => void
): { texture: THREE.CanvasTexture | null; aspectRatio: number } {
  const resolvedCutout = cutoutResolvedCache.get(key);
  const existing = threeTextureCache.get(key);

  if (existing) {
    if (existing.texture) {
      onReady?.(existing.aspectRatio, existing.texture);
      return { texture: existing.texture, aspectRatio: existing.aspectRatio };
    }
    if (resolvedCutout) {
      const readyTex = createMonsterSpriteCanvasTexture(resolvedCutout.canvas, maxAnisotropy);
      existing.texture = readyTex;
      existing.aspectRatio = resolvedCutout.aspectRatio;
      onReady?.(existing.aspectRatio, readyTex);
      return { texture: readyTex, aspectRatio: existing.aspectRatio };
    }
    if (onReady) {
      existing.listeners.push(onReady);
    }
    return { texture: null, aspectRatio: existing.aspectRatio };
  }

  const cfg = MONSTER_ART_CONFIGS[key];
  if (resolvedCutout) {
    const readyTex = createMonsterSpriteCanvasTexture(resolvedCutout.canvas, maxAnisotropy);
    threeTextureCache.set(key, {
      texture: readyTex,
      aspectRatio: resolvedCutout.aspectRatio,
      listeners: [],
    });
    onReady?.(resolvedCutout.aspectRatio, readyTex);
    return { texture: readyTex, aspectRatio: resolvedCutout.aspectRatio };
  }

  const entry: {
    texture: THREE.CanvasTexture | null;
    aspectRatio: number;
    listeners: Array<(aspectRatio: number, texture: THREE.CanvasTexture) => void>;
  } = {
    texture: null,
    aspectRatio: cfg.initialAspect,
    listeners: onReady ? [onReady] : [],
  };
  threeTextureCache.set(key, entry);

  loadProcessedMonsterCutout(key).then((cutout) => {
    entry.aspectRatio = cutout.aspectRatio;
    if (!entry.texture) {
      entry.texture = createMonsterSpriteCanvasTexture(cutout.canvas, maxAnisotropy);
    }
    const listeners = entry.listeners.splice(0, entry.listeners.length);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](cutout.aspectRatio, entry.texture);
    }
  });

  return { texture: null, aspectRatio: entry.aspectRatio };
}

