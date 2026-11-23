import * as THREE from 'three';
import { getHeroPortraitUrl } from './HeroPortraits';

interface HeroDirectionalEntry {
  westTexture: THREE.CanvasTexture | null;
  eastTexture: THREE.CanvasTexture | null;
  aspectRatio: number;
  listeners: Array<(aspectRatio: number, westTexture: THREE.CanvasTexture, eastTexture: THREE.CanvasTexture) => void>;
}

const HERO_CUTOUT_ASPECT = 0.78;
const heroTextureCache = new Map<string, HeroDirectionalEntry>();

function createHeroCanvasTexture(canvas: HTMLCanvasElement, maxAnisotropy: number): THREE.CanvasTexture {
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

function drawRoyalShieldPath(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number): void {
  const cx = w * 0.5;
  const topY = inset + 22;
  const shoulderY = topY + 28;
  const midY = h * 0.62;
  const tipY = h - inset - 10;
  const left = inset + 12;
  const right = w - inset - 12;

  ctx.beginPath();
  ctx.moveTo(cx, topY - 16);
  ctx.quadraticCurveTo(cx + (right - cx) * 0.55, topY - 6, right, shoulderY);
  ctx.lineTo(right - 8, midY);
  ctx.quadraticCurveTo(right - 22, tipY - 22, cx, tipY);
  ctx.quadraticCurveTo(left + 22, tipY - 22, left + 8, midY);
  ctx.lineTo(left, shoulderY);
  ctx.quadraticCurveTo(cx - (cx - left) * 0.55, topY - 6, cx, topY - 16);
  ctx.closePath();
}

/**
 * Renders the selected Nepalese Hero portrait inside a transparent-edged royal
 * commander crest medallion with an asymmetric forward lance-plume & heraldic
 * crown finial so West/East mirrored variants visibly face their march direction.
 */
function buildHeroCutoutCanvas(
  img: HTMLImageElement | null,
  crestColor = '#facc15',
  facingEast = false
): HTMLCanvasElement {
  const w = 256;
  const h = 328;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, w, h);

  if (facingEast) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // Soft outer golden radiance
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.48, 34, w * 0.5, h * 0.48, w * 0.52);
  glow.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
  glow.addColorStop(0.7, 'rgba(250, 204, 21, 0.12)');
  glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Asymmetric directional royal khukuri/halberd blade protruding left (West) in base art
  ctx.save();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.78);
  ctx.lineTo(w * 0.14, h * 0.12);
  ctx.lineTo(w * 0.22, h * 0.06);
  ctx.lineTo(w * 0.27, h * 0.20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flowing crimson war tassel on the forward blade
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.22);
  ctx.quadraticCurveTo(w * 0.04, h * 0.28, w * 0.08, h * 0.42);
  ctx.quadraticCurveTo(w * 0.16, h * 0.36, w * 0.21, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Outer beveled shield rim
  ctx.save();
  drawRoyalShieldPath(ctx, w, h, 8);
  const rimGrad = ctx.createLinearGradient(0, 12, w, h - 12);
  rimGrad.addColorStop(0, '#fef08a');
  rimGrad.addColorStop(0.45, crestColor);
  rimGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#78350f';
  ctx.stroke();
  ctx.restore();

  // Inner clipped Hero portrait artwork
  ctx.save();
  drawRoyalShieldPath(ctx, w, h, 17);
  ctx.clip();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  if (img && img.naturalWidth > 0) {
    const innerX = 18;
    const innerY = 26;
    const innerW = w - 36;
    const innerH = h - 46;
    const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const boxAspect = innerW / innerH;
    let drawW = innerW;
    let drawH = innerH;
    let drawX = innerX;
    let drawY = innerY;
    if (imgAspect > boxAspect) {
      drawW = innerH * imgAspect;
      drawX = innerX - (drawW - innerW) * 0.5;
    } else {
      drawH = innerW / imgAspect;
      drawY = innerY - (drawH - innerH) * 0.18;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  // Subtle bottom vignette for grounded visual anchor
  const vGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
  vGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  vGrad.addColorStop(1, 'rgba(15, 23, 42, 0.52)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, h * 0.65, w, h * 0.35);
  ctx.restore();

  // Crisp inner gold border & top crown diamond
  ctx.save();
  drawRoyalShieldPath(ctx, w, h, 17);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fef9c3';
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 6);
  ctx.lineTo(w * 0.5 + 11, 20);
  ctx.lineTo(w * 0.5, 34);
  ctx.lineTo(w * 0.5 - 11, 20);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#92400e';
  ctx.stroke();
  ctx.restore();

  if (facingEast) {
    ctx.restore();
  }

  return canvas;
}

export function getSharedHeroDirectionalTextures(
  heroId: string,
  crestColor = '#facc15',
  maxAnisotropy = 4,
  onReady?: (aspectRatio: number, westTexture: THREE.CanvasTexture, eastTexture: THREE.CanvasTexture) => void
): { westTexture: THREE.CanvasTexture | null; eastTexture: THREE.CanvasTexture | null; aspectRatio: number } {
  const cacheKey = `${heroId}::${crestColor}`;
  const existing = heroTextureCache.get(cacheKey);
  if (existing) {
    if (existing.westTexture && existing.eastTexture) {
      onReady?.(existing.aspectRatio, existing.westTexture, existing.eastTexture);
      return {
        westTexture: existing.westTexture,
        eastTexture: existing.eastTexture,
        aspectRatio: existing.aspectRatio,
      };
    }
    if (onReady) {
      existing.listeners.push(onReady);
    }
    return { westTexture: null, eastTexture: null, aspectRatio: existing.aspectRatio };
  }

  const entry: HeroDirectionalEntry = {
    westTexture: null,
    eastTexture: null,
    aspectRatio: HERO_CUTOUT_ASPECT,
    listeners: onReady ? [onReady] : [],
  };
  heroTextureCache.set(cacheKey, entry);

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return { westTexture: null, eastTexture: null, aspectRatio: entry.aspectRatio };
  }

  const finalize = (img: HTMLImageElement | null) => {
    const westCanvas = buildHeroCutoutCanvas(img, crestColor, false);
    const eastCanvas = buildHeroCutoutCanvas(img, crestColor, true);
    entry.westTexture = createHeroCanvasTexture(westCanvas, maxAnisotropy);
    entry.eastTexture = createHeroCanvasTexture(eastCanvas, maxAnisotropy);
    const listeners = entry.listeners.splice(0, entry.listeners.length);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](entry.aspectRatio, entry.westTexture, entry.eastTexture);
    }
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => finalize(img);
  img.onerror = () => finalize(null);
  img.src = getHeroPortraitUrl(heroId);

  return { westTexture: null, eastTexture: null, aspectRatio: entry.aspectRatio };
}
