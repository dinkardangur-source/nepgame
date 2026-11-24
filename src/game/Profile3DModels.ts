import * as THREE from 'three';

export type Profile3DIconKey =
  | 'royal_crown'
  | 'crossed_swords'
  | 'banner_crown'
  | 'spartan_helm'
  | 'fire_brazier'
  | 'xp_star'
  | 'ap_potion'
  | 'history_scroll'
  | 'treasure_chest'
  | 'trophy_cup'
  | 'victor_medal'
  | 'power_bolt'
  | 'kill_skull'
  | 'alliance_shield';

function createStarShape(outerR: number, innerR: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / points + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createShieldShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  s.moveTo(0, hh);
  s.lineTo(hw, hh * 0.72);
  s.quadraticCurveTo(hw * 0.96, -hh * 0.25, 0, -hh);
  s.quadraticCurveTo(-hw * 0.96, -hh * 0.25, -hw, hh * 0.72);
  s.closePath();
  return s;
}

function buildRoyalCrownModel(): THREE.Group {
  const g = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf6c33b,
    metalness: 0.9,
    roughness: 0.18,
  });
  const warmGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    metalness: 0.85,
    roughness: 0.26,
  });
  const crimsonVelvetMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.82,
    metalness: 0.05,
  });
  const sapphireMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.7,
    roughness: 0.1,
    metalness: 0.25,
  });
  const rubyMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.5,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Crimson velvet inner cap
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), crimsonVelvetMat);
  cushion.scale.set(1.0, 0.72, 0.92);
  cushion.position.y = 0.05;
  g.add(cushion);

  // Crown circlet base ring
  const circlet = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.43, 0.2, 28), goldMat);
  circlet.position.y = -0.18;
  g.add(circlet);

  // Lower beaded trim ring
  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 12, 32), warmGoldMat);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = -0.27;
  g.add(baseRim);

  // 5 Flared royal crown spires with gold pearl finials
  const spireCount = 5;
  for (let i = 0; i < spireCount; i++) {
    const angle = (i / spireCount) * Math.PI * 2 + Math.PI * 0.5;
    const isFront = i === 0;
    const h = isFront ? 0.54 : 0.4;
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(isFront ? 0.12 : 0.095, h, 4),
      goldMat
    );
    const radius = 0.43;
    spire.position.set(
      Math.cos(angle) * radius,
      0.06 + (isFront ? 0.05 : 0),
      Math.sin(angle) * radius
    );
    spire.rotation.y = -angle;
    spire.rotation.z = -0.16;
    g.add(spire);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(isFront ? 0.07 : 0.052, 12, 12), goldMat);
    orb.position.set(
      Math.cos(angle) * (radius + 0.05),
      h * 0.5 + 0.08 + (isFront ? 0.05 : 0),
      Math.sin(angle) * (radius + 0.05)
    );
    g.add(orb);
  }

  // Front beveled sapphire diamond jewel
  const centerSapphire = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), sapphireMat);
  centerSapphire.scale.set(0.85, 1.25, 0.55);
  centerSapphire.position.set(0, -0.12, 0.48);
  g.add(centerSapphire);

  // Side ruby studs
  for (const sx of [-0.34, 0.34]) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), rubyMat);
    gem.position.set(sx, -0.16, 0.32);
    g.add(gem);
  }

  return g;
}

function buildBannerCrownEmblem(): THREE.Group {
  const g = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.18,
  });
  const laurelMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    metalness: 0.8,
    roughness: 0.25,
  });

  // Curved golden laurel wreath arms (left & right)
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const angle = -Math.PI * 0.38 + t * Math.PI * 0.78;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), laurelMat);
      leaf.scale.set(1.5, 0.68, 0.42);
      leaf.position.set(
        dir * Math.cos(angle) * 0.58,
        Math.sin(angle) * 0.54 - 0.06,
        0
      );
      leaf.rotation.z = dir * (angle + 0.5);
      g.add(leaf);
    }
  }

  const crown = buildRoyalCrownModel();
  crown.scale.setScalar(0.68);
  crown.position.set(0, 0.04, 0.04);
  g.add(crown);

  // Wreath tie ribbon at bottom
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 10, 20), goldMat);
  tie.position.set(0, -0.58, 0.04);
  g.add(tie);

  return g;
}

function buildCrossedSwordsModel(): THREE.Group {
  const g = new THREE.Group();

  const flameGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.82,
    roughness: 0.2,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    metalness: 0.9,
    roughness: 0.15,
  });
  const guardMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.86,
    roughness: 0.24,
  });

  const makeSword = () => {
    const s = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.05, 0.045), bladeMat);
    blade.position.y = 0.22;
    s.add(blade);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.2, 4), flameGoldMat);
    tip.rotation.y = Math.PI / 4;
    tip.position.y = 0.84;
    s.add(tip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.085), guardMat);
    guard.position.y = -0.28;
    s.add(guard);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.24, 10), guardMat);
    grip.position.y = -0.43;
    s.add(grip);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), flameGoldMat);
    pommel.position.y = -0.58;
    s.add(pommel);
    return s;
  };

  const left = makeSword();
  left.rotation.z = -Math.PI / 4;
  left.position.z = 0.03;
  g.add(left);

  const right = makeSword();
  right.rotation.z = Math.PI / 4;
  right.position.z = -0.03;
  g.add(right);

  return g;
}

function buildSpartanHelmModel(): THREE.Group {
  const g = new THREE.Group();

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xe6a832,
    metalness: 0.88,
    roughness: 0.22,
  });
  const darkVisorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.6,
  });
  const plumeMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x92400e,
    emissiveIntensity: 0.35,
    roughness: 0.48,
    metalness: 0.2,
  });

  // Main domed cranium
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), bronzeMat);
  dome.position.y = 0.08;
  g.add(dome);

  // Cheek plates & nasal bar
  const lowerShell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.44, 20, 1, true, Math.PI * 0.22, Math.PI * 1.56), bronzeMat);
  lowerShell.position.y = -0.14;
  g.add(lowerShell);

  const noseGuard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.1), bronzeMat);
  noseGuard.position.set(0, -0.06, 0.39);
  g.add(noseGuard);

  const innerShadow = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.4, 16), darkVisorMat);
  innerShadow.position.y = -0.13;
  g.add(innerShadow);

  // Tall Spartan crest comb
  const crestShape = new THREE.Shape();
  crestShape.moveTo(-0.08, 0.36);
  crestShape.quadraticCurveTo(-0.22, 0.72, 0.0, 0.76);
  crestShape.quadraticCurveTo(0.28, 0.74, 0.36, 0.26);
  crestShape.lineTo(0.18, 0.26);
  crestShape.closePath();
  const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
  });
  crestGeo.translate(0, 0, -0.055);
  const crest = new THREE.Mesh(crestGeo, plumeMat);
  crest.rotation.y = Math.PI / 2;
  g.add(crest);

  // Brow band
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.04, 10, 24), bronzeMat);
  brow.rotation.x = Math.PI / 2;
  brow.position.y = 0.06;
  g.add(brow);

  return g;
}

function buildFireBrazierModel(): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.84,
    metalness: 0.14,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.86,
    roughness: 0.24,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf97316,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const flameOuterMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xea580c,
    emissiveIntensity: 1.2,
    roughness: 0.25,
  });

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.22, 16), stoneMat);
  foot.position.y = -0.36;
  g.add(foot);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.2, 0.32, 16), goldMat);
  bowl.position.y = -0.1;
  g.add(bowl);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.048, 10, 24), goldMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;
  g.add(rim);

  const coals = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), emberMat);
  coals.scale.set(1, 0.35, 1);
  coals.position.y = 0.07;
  g.add(coals);

  const mainFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 10), flameOuterMat);
  mainFlame.position.y = 0.38;
  g.add(mainFlame);

  const coreFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.46, 8), emberMat);
  coreFlame.position.set(0.03, 0.32, 0.03);
  g.add(coreFlame);

  const tongueLeft = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 7), flameOuterMat);
  tongueLeft.position.set(-0.16, 0.26, 0.04);
  tongueLeft.rotation.z = 0.28;
  g.add(tongueLeft);

  const tongueRight = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 7), flameOuterMat);
  tongueRight.position.set(0.16, 0.25, -0.02);
  tongueRight.rotation.z = -0.25;
  g.add(tongueRight);

  return g;
}

function buildXpStarModel(): THREE.Group {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.88,
    roughness: 0.18,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.72,
    roughness: 0.2,
  });
  const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.58, 0.26, 5), {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.038,
    bevelSegments: 2,
  });
  starGeo.translate(0, 0, -0.07);
  const star = new THREE.Mesh(starGeo, goldMat);
  g.add(star);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 20), innerMat);
  core.rotation.x = Math.PI / 2;
  g.add(core);

  return g;
}

function buildApPotionModel(): THREE.Group {
  const g = new THREE.Group();

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.65,
  });
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.88,
    roughness: 0.22,
  });
  const corkMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.8,
  });

  const elixir = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 18), liquidMat);
  elixir.position.y = -0.14;
  g.add(elixir);

  const flaskBulb = new THREE.Mesh(new THREE.SphereGeometry(0.41, 22, 20), glassMat);
  flaskBulb.position.y = -0.14;
  g.add(flaskBulb);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.34, 16), glassMat);
  neck.position.y = 0.34;
  g.add(neck);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 10, 22), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.46;
  g.add(collar);

  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.16, 14), corkMat);
  cork.position.y = 0.56;
  g.add(cork);

  return g;
}

function buildHistoryScrollModel(): THREE.Group {
  const g = new THREE.Group();

  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xf6e6bf,
    roughness: 0.72,
    metalness: 0.05,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.6,
    metalness: 0.15,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.86,
    roughness: 0.22,
  });
  const sealMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.15,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.68, 0.1), paperMat);
  g.add(body);

  for (const ry of [-0.36, 0.36]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.88, 18), paperMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, ry, 0.05);
    g.add(roll);

    for (const sx of [-0.47, 0.47]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 12), woodMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(sx, ry, 0.05);
      g.add(cap);
    }
  }

  const waxSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 18), sealMat);
  waxSeal.rotation.x = Math.PI / 2;
  waxSeal.position.set(0.16, -0.14, 0.08);
  g.add(waxSeal);

  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), goldMat);
  band.position.set(-0.04, 0.1, 0.06);
  g.add(band);

  return g;
}

function buildTrophyCupModel(): THREE.Group {
  const g = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf6c33b,
    metalness: 0.9,
    roughness: 0.16,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.45,
    roughness: 0.42,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.18, 20), baseMat);
  plinth.position.y = -0.45;
  g.add(plinth);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.28, 16), goldMat);
  stem.position.y = -0.22;
  g.add(stem);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.18, 0.56, 22), goldMat);
  cup.position.y = 0.18;
  g.add(cup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 10, 26), goldMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.46;
  g.add(rim);

  for (const dir of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 10, 18, Math.PI), goldMat);
    handle.rotation.z = dir * (Math.PI / 2);
    handle.position.set(dir * 0.36, 0.22, 0);
    g.add(handle);
  }

  return g;
}

function buildVictorMedalModel(): THREE.Group {
  const g = new THREE.Group();

  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.15,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.88,
    roughness: 0.18,
  });

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.08), crimsonMat);
  ribbon.position.y = 0.28;
  g.add(ribbon);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 24), goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.14;
  g.add(ring);

  const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.24, 0.1, 5), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
  });
  const star = new THREE.Mesh(starGeo, crimsonMat);
  star.position.set(0, -0.14, 0.05);
  g.add(star);

  return g;
}

function buildPowerBoltModel(): THREE.Group {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.55,
    metalness: 0.85,
    roughness: 0.18,
  });
  const s = new THREE.Shape();
  s.moveTo(0.1, 0.62);
  s.lineTo(-0.34, 0.02);
  s.lineTo(0.02, 0.02);
  s.lineTo(-0.14, -0.62);
  s.lineTo(0.36, 0.06);
  s.lineTo(0.02, 0.06);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.07);
  g.add(new THREE.Mesh(geo, goldMat));
  return g;
}

function buildKillSkullModel(): THREE.Group {
  const g = new THREE.Group();
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.4,
    roughness: 0.32,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.7,
  });

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 16), silverMat);
  cranium.position.y = 0.1;
  g.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.28), silverMat);
  jaw.position.set(0, -0.22, 0.08);
  g.add(jaw);

  for (const ex of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), darkMat);
    eye.position.set(ex, 0.06, 0.3);
    g.add(eye);
  }

  return g;
}

function buildAllianceShieldModel(): THREE.Group {
  const g = new THREE.Group();
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    metalness: 0.55,
    roughness: 0.28,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.88,
    roughness: 0.2,
  });
  const shieldGeo = new THREE.ExtrudeGeometry(createShieldShape(0.84, 1.0), {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
  });
  shieldGeo.translate(0, 0, -0.06);
  g.add(new THREE.Mesh(shieldGeo, goldMat));

  const innerGeo = new THREE.ExtrudeGeometry(createShieldShape(0.68, 0.82), {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
  });
  innerGeo.translate(0, 0, -0.04);
  g.add(new THREE.Mesh(innerGeo, blueMat));

  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldMat);
  crown.scale.set(1, 1.2, 0.6);
  crown.position.set(0, 0.04, 0.12);
  g.add(crown);

  return g;
}

function buildTreasureChestMiniModel(): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9b541e, roughness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.88, roughness: 0.2 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.42, 0.58), woodMat);
  body.position.y = -0.14;
  g.add(body);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.64), goldMat);
  rim.position.y = 0.06;
  g.add(rim);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.84, 20, 1, false, 0, Math.PI), woodMat);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.y = 0.12;
  g.add(lid);

  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 20, 1, false, 0, Math.PI), goldMat);
  strap.rotation.z = Math.PI / 2;
  strap.rotation.y = Math.PI / 2;
  strap.position.y = 0.12;
  g.add(strap);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
  gem.position.set(0, 0.03, 0.34);
  g.add(gem);

  return g;
}

export function buildProfile3DModel(key: Profile3DIconKey): THREE.Group {
  switch (key) {
    case 'royal_crown':
      return buildRoyalCrownModel();
    case 'crossed_swords':
      return buildCrossedSwordsModel();
    case 'banner_crown':
      return buildBannerCrownEmblem();
    case 'spartan_helm':
      return buildSpartanHelmModel();
    case 'fire_brazier':
      return buildFireBrazierModel();
    case 'xp_star':
      return buildXpStarModel();
    case 'ap_potion':
      return buildApPotionModel();
    case 'history_scroll':
      return buildHistoryScrollModel();
    case 'treasure_chest':
      return buildTreasureChestMiniModel();
    case 'trophy_cup':
      return buildTrophyCupModel();
    case 'victor_medal':
      return buildVictorMedalModel();
    case 'power_bolt':
      return buildPowerBoltModel();
    case 'kill_skull':
      return buildKillSkullModel();
    case 'alliance_shield':
      return buildAllianceShieldModel();
  }
}

export function disposeProfile3DGroup(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else mesh.material.dispose();
    }
  });
}
