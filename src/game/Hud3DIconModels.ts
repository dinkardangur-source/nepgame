import * as THREE from 'three';

export type Hud3DIconKey = 'command' | 'inventory' | 'quests' | 'alliance' | 'mail' | 'castle';

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createStarShape(outerR: number, innerR: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 5 + Math.PI / 2;
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
  s.quadraticCurveTo(hw * 0.98, -hh * 0.25, 0, -hh);
  s.quadraticCurveTo(-hw * 0.98, -hh * 0.25, -hw, hh * 0.72);
  s.closePath();
  return s;
}

function createDiamondShape(rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, ry);
  s.lineTo(rx, 0);
  s.lineTo(0, -ry);
  s.lineTo(-rx, 0);
  s.closePath();
  return s;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.45, hh * 0.45);
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  s.closePath();
  return s;
}

export interface Hud3DPedestalRig {
  root: THREE.Group;
  subject: THREE.Group;
  pedestal: THREE.Group;
}

function buildCharcoalPedestal(): THREE.Group {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x363b45,
    roughness: 0.62,
    metalness: 0.24,
  });
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x262a33,
    roughness: 0.52,
    metalness: 0.3,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x525a68,
    roughness: 0.38,
    metalness: 0.5,
  });

  // Main beveled square pedestal
  const baseShape = createRoundedRectShape(1.56, 1.38, 0.1);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  baseGeo.rotateX(-Math.PI / 2);
  const baseMesh = new THREE.Mesh(baseGeo, plinthMat);
  baseMesh.position.y = -0.78;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Upper recessed collar step
  const stepShape = createRoundedRectShape(1.3, 1.14, 0.08);
  const stepGeo = new THREE.ExtrudeGeometry(stepShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  stepGeo.rotateX(-Math.PI / 2);
  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
  stepMesh.position.y = -0.52;
  stepMesh.receiveShadow = true;
  group.add(stepMesh);

  // Subtle top bevel trim ring
  const trimGeo = new THREE.BoxGeometry(1.34, 0.022, 1.18);
  const trimMesh = new THREE.Mesh(trimGeo, rimMat);
  trimMesh.position.y = -0.455;
  group.add(trimMesh);

  return group;
}

function buildCommandSubject(): THREE.Group {
  const g = new THREE.Group();

  const outerAzureMat = new THREE.MeshStandardMaterial({
    color: 0x4fb4eb,
    metalness: 0.72,
    roughness: 0.22,
  });
  const navyCoreMat = new THREE.MeshStandardMaterial({
    color: 0x0b4b94,
    metalness: 0.45,
    roughness: 0.34,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf6c33b,
    metalness: 0.88,
    roughness: 0.18,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.35,
    roughness: 0.15,
    metalness: 0.1,
  });

  // Outer hexagonal frame with circular cutout
  const hexShape = createHexShape(0.64);
  const innerHole = new THREE.Path();
  innerHole.absarc(0, 0, 0.41, 0, Math.PI * 2, true);
  hexShape.holes.push(innerHole);
  const hexGeo = new THREE.ExtrudeGeometry(hexShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 3,
  });
  hexGeo.translate(0, 0, -0.09);
  const hexMesh = new THREE.Mesh(hexGeo, outerAzureMat);
  hexMesh.position.y = 0.22;
  hexMesh.castShadow = true;
  g.add(hexMesh);

  // Inner blue recessed backing disc
  const backDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.16, 32), navyCoreMat);
  backDisc.rotation.x = Math.PI / 2;
  backDisc.position.y = 0.22;
  g.add(backDisc);

  // Golden inner bezel ring
  const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.052, 14, 36), goldMat);
  goldRing.position.set(0, 0.22, 0.075);
  g.add(goldRing);

  // Raised golden center emblem medallion
  const centerMedallion = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.11, 28), goldMat);
  centerMedallion.rotation.x = Math.PI / 2;
  centerMedallion.position.set(0, 0.22, 0.085);
  g.add(centerMedallion);

  //Glowing cyan base energy bar underneath hex point
  const glowPad = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.045, 24), cyanGlowMat);
  glowPad.position.set(0, -0.41, 0);
  g.add(glowPad);

  return g;
}

function buildInventorySubject(): THREE.Group {
  const g = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9b541e,
    roughness: 0.56,
    metalness: 0.12,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf1b632,
    metalness: 0.86,
    roughness: 0.2,
  });
  const treasureGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.15,
  });

  // Lower chest box body
  const baseBody = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.44, 0.66), woodMat);
  baseBody.position.y = -0.14;
  baseBody.castShadow = true;
  g.add(baseBody);

  // Lower golden corner trims & bottom frame
  const bottomTrim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.74), goldMat);
  bottomTrim.position.y = -0.34;
  g.add(bottomTrim);

  const rimTrim = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.075, 0.73), goldMat);
  rimTrim.position.y = 0.07;
  g.add(rimTrim);

  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.32, 0.32]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.44, 0.11), goldMat);
      post.position.set(sx, -0.14, sz);
      g.add(post);
    }
  }

  // Warm glowing treasure seam inside chest
  const treasureCore = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.09, 0.56), treasureGlowMat);
  treasureCore.position.y = 0.11;
  g.add(treasureCore);

  // Pivoted curved barrel lid (slightly ajar to match reference glow)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.12, -0.32);
  lidGroup.rotation.x = -0.15;

  const lidWood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.94, 24, 1, false, 0, Math.PI),
    woodMat
  );
  lidWood.rotation.z = Math.PI / 2;
  lidWood.rotation.y = Math.PI / 2;
  lidWood.position.set(0, 0.02, 0.32);
  lidGroup.add(lidWood);

  // 3 Gold arch straps over lid
  for (const xPos of [-0.43, 0, 0.43]) {
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.355, 0.355, 0.1, 24, 1, false, 0, Math.PI),
      goldMat
    );
    strap.rotation.z = Math.PI / 2;
    strap.rotation.y = Math.PI / 2;
    strap.position.set(xPos, 0.02, 0.32);
    lidGroup.add(strap);
  }

  // Lid bottom lip trim
  const lidLip = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.075, 0.72), goldMat);
  lidLip.position.set(0, 0.015, 0.32);
  lidGroup.add(lidLip);

  // Upper lock diamond gem
  const topClasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gemMat);
  topClasp.scale.set(0.9, 1.0, 0.55);
  topClasp.position.set(0, 0.04, 0.71);
  lidGroup.add(topClasp);

  g.add(lidGroup);

  // Lower lock plate + cyan sapphire clasp
  const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.08), goldMat);
  lockPlate.position.set(0, -0.02, 0.37);
  g.add(lockPlate);

  const frontGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), gemMat);
  frontGem.scale.set(0.9, 1.05, 0.5);
  frontGem.position.set(0, -0.02, 0.42);
  g.add(frontGem);

  return g;
}

function buildQuestsSubject(): THREE.Group {
  const g = new THREE.Group();

  const royalBlueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.44,
    roughness: 0.26,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf4c038,
    metalness: 0.88,
    roughness: 0.18,
  });

  // Outer gold shield silhouette
  const outerShape = createShieldShape(0.98, 1.16);
  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  outerGeo.translate(0, 0, -0.06);
  const outerMesh = new THREE.Mesh(outerGeo, goldMat);
  outerMesh.position.y = 0.2;
  outerMesh.castShadow = true;
  g.add(outerMesh);

  // Inner royal-blue shield inset
  const innerShape = createShieldShape(0.8, 0.96);
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  innerGeo.translate(0, 0, -0.045);
  const innerMesh = new THREE.Mesh(innerGeo, royalBlueMat);
  innerMesh.position.y = 0.2;
  g.add(innerMesh);

  // Raised golden 5-pointed star emblem
  const starShape = createStarShape(0.28, 0.12);
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  const starMesh = new THREE.Mesh(starGeo, goldMat);
  starMesh.position.set(0, 0.24, 0.095);
  g.add(starMesh);

  return g;
}

function buildSwordMesh(bladeMat: THREE.Material, guardMat: THREE.Material, gripMat: THREE.Material): THREE.Group {
  const sword = new THREE.Group();

  // Blade
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.035), bladeMat);
  blade.position.y = 0.24;
  sword.add(blade);

  // Blade tip pyramid
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), bladeMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 0.84;
  sword.add(tip);

  // Crossguard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.065, 0.07), guardMat);
  guard.position.y = -0.26;
  sword.add(guard);

  // Grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.24, 12), gripMat);
  grip.position.y = -0.4;
  sword.add(grip);

  // Pommel
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 14), guardMat);
  pommel.position.y = -0.54;
  sword.add(pommel);

  return sword;
}

function buildAllianceSubject(): THREE.Group {
  const g = new THREE.Group();

  const emeraldMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    metalness: 0.36,
    roughness: 0.28,
  });
  const darkEmeraldMat = new THREE.MeshStandardMaterial({
    color: 0x0f7640,
    metalness: 0.32,
    roughness: 0.34,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf4c038,
    metalness: 0.88,
    roughness: 0.18,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.16,
  });
  const guardSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.86,
    roughness: 0.26,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x5c3419,
    roughness: 0.72,
    metalness: 0.1,
  });

  // Two crossed broadswords behind shield (hilts pointing upward like the reference)
  const swordLeft = buildSwordMesh(steelMat, guardSteelMat, gripMat);
  swordLeft.rotation.z = (Math.PI * 3) / 4;
  swordLeft.position.set(0, 0.2, -0.1);
  g.add(swordLeft);

  const swordRight = buildSwordMesh(steelMat, guardSteelMat, gripMat);
  swordRight.rotation.z = (-Math.PI * 3) / 4;
  swordRight.position.set(0, 0.2, -0.13);
  g.add(swordRight);

  // Gold shield rim
  const outerShape = createShieldShape(0.88, 1.04);
  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 3,
  });
  outerGeo.translate(0, 0, -0.05);
  const outerShield = new THREE.Mesh(outerGeo, goldMat);
  outerShield.position.set(0, 0.22, 0.03);
  outerShield.castShadow = true;
  g.add(outerShield);

  // Emerald shield field
  const innerShape = createShieldShape(0.72, 0.86);
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  innerGeo.translate(0, 0, -0.035);
  const innerShield = new THREE.Mesh(innerGeo, emeraldMat);
  innerShield.position.set(0, 0.22, 0.035);
  g.add(innerShield);

  // Inner dark green diamond border + gold center lozenge
  const rimDiamond = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createDiamondShape(0.18, 0.27), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012 }),
    darkEmeraldMat
  );
  rimDiamond.position.set(0, 0.24, 0.095);
  g.add(rimDiamond);

  const centerLozenge = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createDiamondShape(0.1, 0.17), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.012 }),
    goldMat
  );
  centerLozenge.position.set(0, 0.24, 0.125);
  g.add(centerLozenge);

  return g;
}

function buildMailSubject(): THREE.Group {
  const g = new THREE.Group();

  const goldEnvelopeMat = new THREE.MeshStandardMaterial({
    color: 0xf4c23e,
    metalness: 0.82,
    roughness: 0.24,
  });
  const goldFlapMat = new THREE.MeshStandardMaterial({
    color: 0xe3a826,
    metalness: 0.84,
    roughness: 0.26,
  });
  const crimsonWaxMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.16,
    roughness: 0.34,
  });
  const sapphireGemMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.7,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Main rounded rectangular gold envelope body
  const envShape = createRoundedRectShape(1.1, 0.78, 0.07);
  const envGeo = new THREE.ExtrudeGeometry(envShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 3,
  });
  envGeo.translate(0, 0, -0.08);
  const envMesh = new THREE.Mesh(envGeo, goldEnvelopeMat);
  envMesh.position.y = 0.18;
  envMesh.castShadow = true;
  g.add(envMesh);

  // Embossed triangular top flap
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.5, 0.35);
  flapShape.lineTo(0.5, 0.35);
  flapShape.lineTo(0, -0.04);
  flapShape.closePath();
  const flapGeo = new THREE.ExtrudeGeometry(flapShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  const flapMesh = new THREE.Mesh(flapGeo, goldFlapMat);
  flapMesh.position.set(0, 0.18, 0.11);
  g.add(flapMesh);

  // Crimson beveled diamond wax seal frame
  const waxShape = createDiamondShape(0.22, 0.24);
  const waxGeo = new THREE.ExtrudeGeometry(waxShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.016,
    bevelSegments: 2,
  });
  const waxMesh = new THREE.Mesh(waxGeo, crimsonWaxMat);
  waxMesh.position.set(0, 0.14, 0.135);
  g.add(waxMesh);

  // Glowing faceted cyan gem inset
  const gemMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.115, 0), sapphireGemMat);
  gemMesh.scale.set(0.88, 1.05, 0.52);
  gemMesh.position.set(0, 0.14, 0.185);
  g.add(gemMesh);

  return g;
}

function buildCastleSubject(): THREE.Group {
  const g = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x6f757e,
    roughness: 0.9,
    metalness: 0.06,
    flatShading: true,
  });
  const turfMat = new THREE.MeshStandardMaterial({
    color: 0x5fb03b,
    roughness: 0.78,
    metalness: 0.05,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xbcb19b,
    roughness: 0.82,
    metalness: 0.06,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x3b536d,
    roughness: 0.5,
    metalness: 0.22,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0x1e6b2e,
    roughness: 0.82,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x5c361a,
    roughness: 0.76,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.25,
    roughness: 0.45,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf4c038,
    metalness: 0.85,
    roughness: 0.22,
  });

  // Floating faceted highland cliff island
  const islandRock = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.62, 8), rockMat);
  islandRock.rotation.x = Math.PI;
  islandRock.position.y = -0.08;
  islandRock.castShadow = true;
  g.add(islandRock);

  const islandRockB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), rockMat);
  islandRockB.scale.set(1.25, 0.6, 1.15);
  islandRockB.position.set(0.05, 0.02, -0.03);
  g.add(islandRockB);

  // Lush emerald meadow plateau
  const meadow = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.62, 0.12, 10), turfMat);
  meadow.position.y = 0.22;
  g.add(meadow);

  // Miniature conical pine trees along island rim
  const treePositions: Array<[number, number, number]> = [
    [-0.48, 0.28, 0.24],
    [-0.5, 0.28, -0.18],
    [0.49, 0.28, 0.22],
    [0.48, 0.28, -0.2],
    [-0.22, 0.28, 0.44],
  ];
  for (const [tx, ty, tz] of treePositions) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 7), pineMat);
    t.position.set(tx, ty + 0.08, tz);
    g.add(t);
  }

  // Curtain walls & gatehouse
  const wallBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.56), wallMat);
  wallBox.position.y = 0.39;
  wallBox.castShadow = true;
  g.add(wallBox);

  const gateDoor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.05), timberMat);
  gateDoor.position.set(0, 0.35, 0.28);
  g.add(gateDoor);

  // 4 Corner Turrets + Slate-Blue Conical Roofs
  for (const cx of [-0.28, 0.28]) {
    for (const cz of [-0.28, 0.28]) {
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.36, 10), wallMat);
      turret.position.set(cx, 0.45, cz);
      g.add(turret);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.16, 10), roofMat);
      roof.position.set(cx, 0.71, cz);
      g.add(roof);
    }
  }

  // Tall Central Keep Tower + Spire + Banner
  const keep = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.24), wallMat);
  keep.position.y = 0.6;
  keep.castShadow = true;
  g.add(keep);

  const keepCrown = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.27), wallMat);
  keepCrown.position.y = 0.85;
  g.add(keepCrown);

  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 6), roofMat);
  keepRoof.position.y = 0.98;
  g.add(keepRoof);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), goldMat);
  pole.position.y = 1.13;
  g.add(pole);

  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.015), bannerMat);
  flag.position.set(0.06, 1.17, 0);
  g.add(flag);

  return g;
}

export function buildHud3DPedestalRig(key: Hud3DIconKey): Hud3DPedestalRig {
  const root = new THREE.Group();
  const pedestal = buildCharcoalPedestal();
  root.add(pedestal);

  let subject: THREE.Group;
  switch (key) {
    case 'command':
      subject = buildCommandSubject();
      break;
    case 'inventory':
      subject = buildInventorySubject();
      break;
    case 'quests':
      subject = buildQuestsSubject();
      break;
    case 'alliance':
      subject = buildAllianceSubject();
      break;
    case 'mail':
      subject = buildMailSubject();
      break;
    case 'castle':
      subject = buildCastleSubject();
      break;
  }

  root.add(subject);
  return { root, subject, pedestal };
}

export function disposeObject3DTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
}
