import * as THREE from 'three';
import type { VFXManager } from './VFXManager';
import type { AnimationController } from './AnimationController';

export type ResourceNodeKind = 'wood' | 'food' | 'stone' | 'gold' | 'crystal';

export interface AnimatedResourceNode {
  id: string;
  kind: ResourceNodeKind;
  group: THREE.Group;
  windParts: THREE.Object3D[];
  pulseParts: THREE.Object3D[];
  shakeTimer: number;
  ambientTimer: number;
  gatherPulseTimer: number;
  remaining: number;
  maxAmount: number;
}

export class ResourceInteractionManager {
  public readonly nodes: AnimatedResourceNode[] = [];
  private readonly vfx: VFXManager;
  private readonly _tempPos = new THREE.Vector3();

  constructor(vfx: VFXManager) {
    this.vfx = vfx;
  }

  public createAnimatedResourceNode(
    id: string,
    kind: ResourceNodeKind,
    position: [number, number, number] = [0, 0, 0]
  ): AnimatedResourceNode {
    const group = new THREE.Group();
    group.position.set(position[0], position[1], position[2]);
    group.userData.isAnimatedResourceNode = true;

    const windParts: THREE.Object3D[] = [];
    const pulseParts: THREE.Object3D[] = [];

    if (kind === 'wood') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, flatShading: true });
      const offsets = [
        [-0.9, 0, -0.5, 1.0],
        [0.85, 0, 0.4, 0.85],
        [0.05, 0, -0.95, 1.1],
      ];
      for (const [ox, oy, oz, sc] of offsets) {
        const tree = new THREE.Group();
        tree.position.set(ox, oy, oz);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * sc, 0.24 * sc, 1.5 * sc, 7), trunkMat);
        trunk.position.y = 0.75 * sc;
        const crown1 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * sc, 1.7 * sc, 7), leafMat);
        crown1.position.y = 1.9 * sc;
        const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.62 * sc, 1.3 * sc, 7), leafMat);
        crown2.position.y = 2.75 * sc;
        tree.add(trunk, crown1, crown2);
        group.add(tree);
        windParts.push(crown1, crown2);
      }
    } else if (kind === 'food') {
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x573b26, roughness: 0.95 });
      const wheatMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.8 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.25, 12), soilMat);
      base.position.y = 0.12;
      group.add(base);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.55 + (i % 3) * 0.4;
        const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.25, 6), wheatMat);
        stalk.position.set(Math.cos(a) * r, 0.72, Math.sin(a) * r);
        group.add(stalk);
        windParts.push(stalk);
      }
    } else if (kind === 'stone') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, flatShading: true });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92, flatShading: true });
      const b1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), rockMat);
      b1.position.set(0, 0.85, 0);
      b1.scale.set(1.2, 0.85, 1.0);
      const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), darkMat);
      b2.position.set(-1.05, 0.52, 0.45);
      const b3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rockMat);
      b3.position.set(1.0, 0.48, -0.4);
      group.add(b1, b2, b3);
    } else if (kind === 'gold') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, flatShading: true });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.85,
      });
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), rockMat);
      boulder.position.y = 0.82;
      group.add(boulder);
      for (let i = 0; i < 4; i++) {
        const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), goldMat);
        const a = (i / 4) * Math.PI * 2;
        vein.position.set(Math.cos(a) * 0.78, 0.9 + (i % 2) * 0.3, Math.sin(a) * 0.78);
        group.add(vein);
        pulseParts.push(vein);
      }
    } else {
      // Crystal
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const crysMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        roughness: 0.14,
        metalness: 0.45,
      });
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 0.35, 8), baseMat);
      plinth.position.y = 0.18;
      group.add(plinth);
      for (let i = 0; i < 5; i++) {
        const h = i === 0 ? 2.4 : 1.35 + (i % 2) * 0.4;
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crysMat);
        shard.scale.set(0.68, h, 0.68);
        const a = (i / 4) * Math.PI * 2;
        shard.position.set(i === 0 ? 0 : Math.cos(a) * 0.75, h * 0.45, i === 0 ? 0 : Math.sin(a) * 0.75);
        if (i !== 0) {
          shard.rotation.z = Math.cos(a) * 0.28;
          shard.rotation.x = Math.sin(a) * 0.28;
        }
        group.add(shard);
        pulseParts.push(shard);
      }
    }

    const node: AnimatedResourceNode = {
      id,
      kind,
      group,
      windParts,
      pulseParts,
      shakeTimer: 0,
      ambientTimer: Math.random() * 1.5,
      gatherPulseTimer: 0,
      remaining: 15000,
      maxAmount: 15000,
    };
    this.nodes.push(node);
    return node;
  }

  public triggerGatherImpact(
    node: AnimatedResourceNode,
    troopController?: AnimationController | null
  ): void {
    node.shakeTimer = 0.28;
    node.remaining = Math.max(0, node.remaining - 120);
    node.group.getWorldPosition(this._tempPos);
    this._tempPos.y += 0.9;

    if (troopController) {
      const targetState = node.kind === 'stone' || node.kind === 'gold' || node.kind === 'crystal' ? 'MINE' : 'GATHER';
      troopController.playState(targetState);
    }

    switch (node.kind) {
      case 'wood':
        this.vfx.spawnBurst(this._tempPos, 'wood_chip', 8, { speed: 4.5, gravity: -11, life: 0.55 });
        this.vfx.spawnBurst(this._tempPos, 'leaf', 5, { speed: 2.2, gravity: -1.8, life: 1.1 });
        break;
      case 'food':
        this.vfx.spawnBurst(this._tempPos, 'food_sparkle', 8, { speed: 2.4, gravity: 1.2, life: 0.75 });
        this.vfx.spawnBurst(this._tempPos, 'dust', 4, { speed: 1.8, gravity: -2, life: 0.55 });
        break;
      case 'stone':
        this.vfx.spawnBurst(this._tempPos, 'rock_debris', 9, { speed: 5.2, gravity: -13, life: 0.6 });
        this.vfx.spawnBurst(this._tempPos, 'dust', 6, { speed: 2.6, gravity: -1.5, life: 0.7 });
        break;
      case 'gold':
        this.vfx.spawnBurst(this._tempPos, 'spark', 6, { speed: 4.5, gravity: -9, life: 0.45 });
        this.vfx.spawnBurst(this._tempPos, 'gold_sparkle', 8, { speed: 2.2, gravity: 1.6, life: 0.95 });
        break;
      case 'crystal':
        this.vfx.spawnBurst(this._tempPos, 'crystal_shard', 9, { speed: 4.4, gravity: -5.5, life: 0.75 });
        this.vfx.spawnShockwave(node.group.position, 0x38bdf8, 3.8, 0.55);
        break;
    }
  }

  public update(delta: number, elapsed: number): void {
    const dt = Math.min(0.05, delta);
    for (const node of this.nodes) {
      // Wind sway for Wood & Food
      for (let i = 0; i < node.windParts.length; i++) {
        const part = node.windParts[i];
        part.rotation.z = Math.sin(elapsed * 2.2 + i * 0.7) * (node.kind === 'food' ? 0.16 : 0.06);
        part.rotation.x = Math.cos(elapsed * 1.7 + i * 0.5) * (node.kind === 'food' ? 0.12 : 0.04);
      }

      // Pulse glow for Gold & Crystal
      for (let i = 0; i < node.pulseParts.length; i++) {
        const p = node.pulseParts[i] as THREE.Mesh;
        const mat = p.material as THREE.MeshStandardMaterial;
        if (mat && typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity =
            (node.kind === 'crystal' ? 0.65 : 0.4) + Math.sin(elapsed * 3.5 + i) * 0.25;
        }
      }

      // Chop / mining shake reaction
      if (node.shakeTimer > 0) {
        node.shakeTimer = Math.max(0, node.shakeTimer - dt);
        const amp = node.shakeTimer * 0.45;
        node.group.rotation.z = Math.sin(elapsed * 45) * amp;
      } else if (node.group.rotation.z !== 0) {
        node.group.rotation.z = 0;
      }

      // Ambient sparkles / falling leaves / crystal energy wave
      node.ambientTimer += dt;
      if (node.ambientTimer >= 1.6) {
        node.ambientTimer = 0;
        node.group.getWorldPosition(this._tempPos);
        if (node.kind === 'wood') {
          this._tempPos.y += 2.2;
          this.vfx.spawnBurst(this._tempPos, 'leaf', 2, { speed: 1.1, gravity: -1.4, life: 1.3 });
        } else if (node.kind === 'gold') {
          this._tempPos.y += 1.0;
          this.vfx.spawnBurst(this._tempPos, 'gold_sparkle', 2, { speed: 1.0, gravity: 1.2, life: 0.9 });
        } else if (node.kind === 'crystal') {
          this.vfx.spawnShockwave(this._tempPos, 0x38bdf8, 2.8, 0.75);
        }
      }
    }
  }

  public clear(): void {
    this.nodes.length = 0;
  }
}
