import * as THREE from 'three';

// Procedural Canvas Textures for PBR Materials (Zero external 404 dependencies)
export function createStoneBrickTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base stone tone
  ctx.fillStyle = '#697473';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const rowHeight = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const isOdd = r % 2 === 1;
    const cols = 8;
    const colWidth = 512 / cols;
    const xOffset = isOdd ? colWidth / 2 : 0;

    for (let c = -1; c < cols + 1; c++) {
      const bx = c * colWidth + xOffset;
      const by = r * rowHeight;

      // Varied slate/granite tone
      const lum = 90 + Math.floor(Math.random() * 45);
      const tone = Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${lum - 10 + tone}, ${lum + tone}, ${lum - 5 + tone})`;
      ctx.fillRect(bx + 2, by + 2, colWidth - 4, rowHeight - 4);

      // Micro speckling
      for (let s = 0; s < 12; s++) {
        const sx = bx + 4 + Math.random() * (colWidth - 8);
        const sy = by + 4 + Math.random() * (rowHeight - 8);
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Mortar groove shadows
      ctx.fillStyle = 'rgba(20, 24, 25, 0.6)';
      ctx.fillRect(bx, by, colWidth, 2);
      ctx.fillRect(bx, by, 2, rowHeight);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWoodPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Warm cedar base
  ctx.fillStyle = '#6b4728';
  ctx.fillRect(0, 0, 512, 512);

  const planks = 10;
  const plankW = 512 / planks;

  for (let p = 0; p < planks; p++) {
    const px = p * plankW;
    const hueVar = (Math.random() - 0.5) * 18;
    ctx.fillStyle = `rgb(${107 + hueVar}, ${71 + hueVar * 0.7}, ${40 + hueVar * 0.5})`;
    ctx.fillRect(px + 1, 0, plankW - 2, 512);

    // Wood grain lines
    ctx.strokeStyle = 'rgba(45, 26, 12, 0.28)';
    ctx.lineWidth = 1.2;
    for (let l = 0; l < 8; l++) {
      ctx.beginPath();
      const lx = px + 4 + Math.random() * (plankW - 8);
      ctx.moveTo(lx, 0);
      ctx.bezierCurveTo(
        lx + (Math.random() - 0.5) * 6,
        170,
        lx + (Math.random() - 0.5) * 6,
        340,
        lx + (Math.random() - 0.5) * 6,
        512
      );
      ctx.stroke();
    }

    // Plank seams
    ctx.fillStyle = 'rgba(25, 12, 5, 0.75)';
    ctx.fillRect(px, 0, 2, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoofTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Traditional crimson terra-cotta
  ctx.fillStyle = '#8b2920';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 12;
  const rowH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    ctx.fillStyle = 'rgba(40, 10, 8, 0.55)';
    ctx.fillRect(0, y, 256, 3);

    // Scalloped tile ridges
    ctx.fillStyle = 'rgba(255, 120, 100, 0.22)';
    ctx.fillRect(0, y + 3, 256, 2);

    for (let c = 0; c < 16; c++) {
      const cx = (c + (r % 2) * 0.5) * (256 / 16);
      ctx.fillStyle = 'rgba(30, 8, 6, 0.4)';
      ctx.fillRect(cx, y, 2, rowH);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createIceSpikeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Pale glacial cyan
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#e0f2fe');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crystalline fracture lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWaterfallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Translucent glacial cyan base
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(125, 211, 252, 0.7)');
  grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.85)');
  grad.addColorStop(1, 'rgba(14, 165, 233, 0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Vertical falling water torrents & foam streaks
  for (let i = 0; i < 48; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 400;
    const h = 50 + Math.random() * 90;
    const w = 1.5 + Math.random() * 4;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 255, 255, 0.75)' : 'rgba(224, 242, 254, 0.5)';
    ctx.fillRect(x, y, w, h);
  }

  // Frothing splash crest at bottom
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let s = 0; s < 30; s++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 256, 480 + Math.random() * 32, 3 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPrayerFlagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Traditional 5 Colors: Blue (Sky), White (Air), Red (Fire), Green (Water), Yellow (Earth)
  const colors = ['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#eab308'];
  const flagW = 512 / 5;

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(i * flagW, 0, flagW, 128);

    // Woodblock print mantra marks (symbolic calligraphy)
    ctx.strokeStyle = i === 1 ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    for (let line = 0; line < 6; line++) {
      ctx.beginPath();
      const ly = 24 + line * 15;
      ctx.moveTo(i * flagW + 10, ly);
      ctx.lineTo((i + 1) * flagW - 10, ly);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDragonBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Imperial Crimson Silk
  const grad = ctx.createLinearGradient(0, 0, 256, 512);
  grad.addColorStop(0, '#991b1b');
  grad.addColorStop(0.5, '#7f1d1d');
  grad.addColorStop(1, '#450a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Golden border fretwork
  ctx.strokeStyle = '#dfba6e';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 224, 480);

  // Golden dragon crest motif (stylized imperial celestial dragon)
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  // Serpentine dragon body
  ctx.moveTo(128, 90);
  ctx.bezierCurveTo(180, 120, 200, 200, 140, 250);
  ctx.bezierCurveTo(80, 290, 70, 360, 130, 410);
  ctx.bezierCurveTo(150, 425, 120, 440, 100, 420);
  ctx.bezierCurveTo(50, 370, 60, 270, 115, 230);
  ctx.bezierCurveTo(160, 190, 150, 130, 120, 110);
  ctx.closePath();
  ctx.fill();

  // Dragon horned head
  ctx.beginPath();
  ctx.arc(128, 85, 22, 0, Math.PI * 2);
  ctx.fill();

  // Celestial pearl / sun disc
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(180, 95, 14, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates a seamless tileable tangent-space normal map (NoColorSpace)
 * using a periodic multi-octave heightfield and Sobel derivative filter.
 */
export function createTerrainSurfaceNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Periodic height function on [0..size] so edges wrap with zero seams
  const sampleHeight = (x: number, y: number): number => {
    const u = ((x % size) + size) % size / size * Math.PI * 2;
    const v = ((y % size) + size) % size / size * Math.PI * 2;

    const h1 = Math.sin(u * 4) * Math.cos(v * 4) * 0.35;
    const h2 = Math.sin(u * 9 + v * 7) * 0.22;
    const h3 = Math.cos(u * 16 - v * 14) * 0.15;
    const h4 = Math.sin(u * 28 + v * 24) * 0.08;
    return h1 + h2 + h3 + h4;
  };

  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sampleHeight(x - 1, y);
      const hR = sampleHeight(x + 1, y);
      const hD = sampleHeight(x, y - 1);
      const hU = sampleHeight(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;

      const len = Math.hypot(dx, dy, dz) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Generates a high-frequency seamless organic detail albedo map (neutral white/grey base
 * so vertex colors tint each of the 10 biome archetypes accurately while preserving micro-texture).
 */
export function createTerrainDetailAlbedoTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#e8ece6';
  ctx.fillRect(0, 0, size, size);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Seamless wrapped organic speckles (turf blades, pebbles, soil pores)
  for (let i = 0; i < 2400; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const r = 1 + Math.floor(rand() * 3);
    const bright = rand() > 0.45;
    ctx.fillStyle = bright ? 'rgba(255, 255, 255, 0.16)' : 'rgba(30, 38, 32, 0.14)';

    // Draw with periodic wrapping at edges
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size, size]) {
        if (x + ox >= -4 && x + ox <= size + 4 && y + oy >= -4 && y + oy <= size + 4) {
          ctx.fillRect(x + ox, y + oy, r, r);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Stratified granite & slate cliff/quarry texture with chisel marks and mineral veins
 */
export function createGraniteQuarryTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#6c737a';
  ctx.fillRect(0, 0, size, size);

  let seed = 4099;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Horizontal sedimentary / granite fracture strata
  for (let y = 0; y < size; y += 6) {
    const shade = 82 + Math.floor(rand() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 9}, 0.45)`;
    ctx.fillRect(0, y, size, 3 + Math.floor(rand() * 5));
  }

  // Angular rock facets & flecks
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 2 + rand() * 8;
    const h = 2 + rand() * 6;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright ? 'rgba(226, 232, 240, 0.16)' : 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(x, y, w, h);
  }

  // Fracture seams & quarry chisel cuts
  ctx.strokeStyle = 'rgba(20, 24, 31, 0.55)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let cx = rand() * size;
    let cy = rand() * size;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (rand() - 0.5) * 48;
      cy += (rand() - 0.3) * 28;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Deep vertical furrowed Himalayan cedar/pine bark texture
 */
export function createTimberBarkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#4a3222';
  ctx.fillRect(0, 0, size, size);

  let seed = 7717;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let x = 0; x < size; x += 5) {
    const tone = Math.floor((rand() - 0.5) * 26);
    ctx.fillStyle = `rgb(${74 + tone}, ${50 + Math.floor(tone * 0.7)}, ${34 + Math.floor(tone * 0.5)})`;
    ctx.fillRect(x, 0, 4, size);

    // Deep vertical bark crevices
    ctx.fillStyle = 'rgba(22, 13, 8, 0.6)';
    ctx.fillRect(x + 3, rand() * 30, 1.5, size * (0.6 + rand() * 0.4));
  }

  // Mossy/lichen flecks
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rand() > 0.35 ? 'rgba(63, 98, 18, 0.22)' : 'rgba(120, 85, 55, 0.25)';
    ctx.fillRect(rand() * size, rand() * size, 3 + rand() * 5, 4 + rand() * 10);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Freshly sawn log cross-section with concentric growth rings
 */
export function createLogEndGrainTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#d6a66a';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Outer bark rim
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.49, 0, Math.PI * 2);
  ctx.fillStyle = '#4a3222';
  ctx.fill();

  // Pale sapwood & warm heartwood
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.44);
  grad.addColorStop(0, '#9a5b2c');
  grad.addColorStop(0.55, '#c98c50');
  grad.addColorStop(1, '#e6be8a');
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Concentric growth rings
  ctx.strokeStyle = 'rgba(110, 62, 26, 0.42)';
  ctx.lineWidth = 1.2;
  for (let r = 6; r < size * 0.43; r += 4.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial drying split
  ctx.strokeStyle = 'rgba(58, 30, 12, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + size * 0.34, cy - size * 0.14);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Plowed dark-loam farmland soil with irrigation furrows
 */
export function createFarmlandSoilTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#4a311e';
  ctx.fillRect(0, 0, size, size);

  const rows = 16;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const furrowGrad = ctx.createLinearGradient(0, y, 0, y + rowH);
    furrowGrad.addColorStop(0, '#2b1b10');
    furrowGrad.addColorStop(0.45, '#593b24');
    furrowGrad.addColorStop(0.85, '#3b2617');
    furrowGrad.addColorStop(1, '#26170d');
    ctx.fillStyle = furrowGrad;
    ctx.fillRect(0, y, size, rowH);
  }

  let seed = 2029;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 450; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(130, 92, 56, 0.25)' : 'rgba(20, 12, 6, 0.28)';
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Golden-green ripening wheat / barley crop stalks texture
 */
export function createWheatCropTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
  bgGrad.addColorStop(0, '#eab308');
  bgGrad.addColorStop(0.55, '#ca8a04');
  bgGrad.addColorStop(1, '#4d7c0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  let seed = 8821;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 380; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const h = 10 + rand() * 24;
    ctx.strokeStyle = rand() > 0.35 ? 'rgba(254, 240, 138, 0.55)' : 'rgba(101, 163, 13, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + (rand() - 0.5) * 4, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Dark quartz/basalt mountain rock threaded with shimmering gold ore veins
 */
export function createGoldOreRockTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#3b414c';
  ctx.fillRect(0, 0, size, size);

  let seed = 5501;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Basalt & quartz rock grain
  for (let i = 0; i < 500; i++) {
    const lum = 42 + Math.floor(rand() * 52);
    ctx.fillStyle = `rgba(${lum}, ${lum + 3}, ${lum + 8}, 0.55)`;
    ctx.fillRect(rand() * size, rand() * size, 3 + rand() * 8, 3 + rand() * 7);
  }

  // Milky quartz & shimmering aurum ore veins
  for (let v = 0; v < 14; v++) {
    ctx.strokeStyle = v % 2 === 0 ? 'rgba(250, 204, 21, 0.85)' : 'rgba(254, 240, 138, 0.72)';
    ctx.lineWidth = 1.5 + rand() * 2.5;
    ctx.beginPath();
    let vx = rand() * size;
    let vy = rand() * size;
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 5; s++) {
      vx += (rand() - 0.4) * 44;
      vy += (rand() - 0.4) * 44;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Weathered limestone plaster + timber framing for realistic medieval/Himalayan castle keeps
 */
export function createCastlePlasterTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#ddd6c7';
  ctx.fillRect(0, 0, size, size);

  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(120, 110, 95, 0.14)';
    ctx.fillRect(rand() * size, rand() * size, 3 + rand() * 8, 3 + rand() * 6);
  }

  // Timber half-timbered frame beams
  ctx.fillStyle = '#4a2e1b';
  ctx.fillRect(0, 0, size, 16);
  ctx.fillRect(0, size - 16, size, 16);
  ctx.fillRect(0, size / 2 - 7, size, 14);
  for (let x = 0; x < size; x += 64) {
    ctx.fillRect(x, 0, 12, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
