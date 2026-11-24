import * as THREE from 'three';

export type BarrierFactionColorKey = 'player' | 'enemy' | 'alliance' | 'neutral' | 'contested';

export const BARRIER_FACTION_COLORS: Record<BarrierFactionColorKey, number> = {
  player: 0x38bdf8, // Blue
  enemy: 0xef4444, // Red
  alliance: 0xfacc15, // Gold
  neutral: 0xf8fafc, // White
  contested: 0xa855f7, // Purple
};

const BARRIER_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const BARRIER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uActivation;
  uniform float uDamageCracks;
  uniform vec3 uImpactLocalPos;
  uniform float uImpactAge;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Activation / deactivation height sweep
    float normHeight = clamp(vUv.y, 0.0, 1.0);
    if (normHeight > uActivation) {
      discard;
    }

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.2);

    // Flowing diagonal energy grid & hex bands
    float bandA = sin((vUv.x * 24.0 + vUv.y * 12.0 - uTime * 2.4) * 3.14159);
    float bandB = cos((vUv.x * 16.0 - vUv.y * 16.0 + uTime * 1.7) * 3.14159);
    float energyGrid = smoothstep(0.55, 0.98, bandA * 0.5 + bandB * 0.5);

    // Subtle electric spark flickers near equator/edges
    float sparkCell = hash(floor(vUv * vec2(26.0, 14.0)) + floor(uTime * 8.0));
    float spark = step(0.975, sparkCell) * (0.6 + 0.4 * sin(uTime * 30.0));

    // Incoming impact ripple wave
    float impactWave = 0.0;
    if (uImpactAge >= 0.0 && uImpactAge < 1.2) {
      float d = length(normalize(vLocalPos) - normalize(uImpactLocalPos));
      float waveRadius = uImpactAge * 1.45;
      float ring = exp(-pow((d - waveRadius) * 9.0, 2.0));
      impactWave = ring * (1.0 - uImpactAge / 1.2) * 1.35;
    }

    // Damage cracks pattern
    float crackPattern = 0.0;
    if (uDamageCracks > 0.01) {
      float zigzag = abs(sin(vUv.x * 38.0 + sin(vUv.y * 22.0) * 2.5));
      crackPattern = (1.0 - smoothstep(0.0, 0.09, zigzag)) * uDamageCracks;
    }

    // Pulsing edge rim + activation lip
    float rimPulse = 0.78 + 0.22 * sin(uTime * 3.2);
    float activationLip = smoothstep(uActivation - 0.08, uActivation, normHeight) * (1.0 - step(0.99, uActivation));

    vec3 finalColor = uColor * (0.85 + energyGrid * 0.55 + fresnel * 1.1 * rimPulse);
    finalColor += vec3(1.0, 0.96, 0.8) * (spark * 0.9 + impactWave + activationLip * 1.4);
    finalColor = mix(finalColor, vec3(1.0, 0.28, 0.2), crackPattern * 0.85);

    float alpha = uOpacity * (0.22 + fresnel * 0.62 + energyGrid * 0.16 + spark * 0.35 + impactWave * 0.55 + crackPattern * 0.45 + activationLip * 0.6);
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.92));
  }
`;

export interface ProtectionBarrierInstance {
  group: THREE.Group;
  domeMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  shaderMat: THREE.ShaderMaterial;
  ringMat: THREE.MeshBasicMaterial;
  faction: BarrierFactionColorKey;
  targetActivation: number;
  activation: number;
  damageCracks: number;
  impactAge: number;
}

export function createProtectionBarrier(
  radius: number,
  faction: BarrierFactionColorKey = 'neutral'
): ProtectionBarrierInstance {
  const group = new THREE.Group();
  const colorHex = BARRIER_FACTION_COLORS[faction];

  const shaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: 0.72 },
      uActivation: { value: 1.0 },
      uDamageCracks: { value: 0.0 },
      uImpactLocalPos: { value: new THREE.Vector3(0, 1, 0) },
      uImpactAge: { value: 5.0 },
    },
    vertexShader: BARRIER_VERTEX_SHADER,
    fragmentShader: BARRIER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const domeGeo = new THREE.SphereGeometry(radius, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const domeMesh = new THREE.Mesh(domeGeo, shaderMat);
  domeMesh.renderOrder = 22;

  const ringGeo = new THREE.RingGeometry(Math.max(0.5, radius - 0.85), radius + 0.15, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.18;
  ringMesh.renderOrder = 21;

  group.add(domeMesh, ringMesh);

  return {
    group,
    domeMesh,
    ringMesh,
    shaderMat,
    ringMat,
    faction,
    targetActivation: 1.0,
    activation: 1.0,
    damageCracks: 0.0,
    impactAge: 5.0,
  };
}

export function setBarrierFaction(
  barrier: ProtectionBarrierInstance,
  faction: BarrierFactionColorKey
): void {
  barrier.faction = faction;
  const hex = BARRIER_FACTION_COLORS[faction];
  barrier.shaderMat.uniforms.uColor.value.setHex(hex);
  barrier.ringMat.color.setHex(hex);
}

export function triggerBarrierImpact(
  barrier: ProtectionBarrierInstance,
  localDir?: THREE.Vector3
): void {
  if (localDir) {
    barrier.shaderMat.uniforms.uImpactLocalPos.value.copy(localDir);
  } else {
    barrier.shaderMat.uniforms.uImpactLocalPos.value.set(
      (Math.random() - 0.5) * 1.4,
      0.7,
      (Math.random() - 0.5) * 1.4
    );
  }
  barrier.impactAge = 0.0;
}

export function updateProtectionBarrier(
  barrier: ProtectionBarrierInstance,
  delta: number,
  elapsed: number
): void {
  barrier.shaderMat.uniforms.uTime.value = elapsed;
  barrier.activation = THREE.MathUtils.damp(barrier.activation, barrier.targetActivation, 5.5, delta);
  barrier.shaderMat.uniforms.uActivation.value = barrier.activation;
  barrier.shaderMat.uniforms.uDamageCracks.value = barrier.damageCracks;

  if (barrier.impactAge < 2.0) {
    barrier.impactAge += delta;
  }
  barrier.shaderMat.uniforms.uImpactAge.value = barrier.impactAge;

  const visible = barrier.activation > 0.02;
  barrier.group.visible = visible;
  if (visible) {
    barrier.ringMat.opacity = (0.45 + 0.32 * Math.sin(elapsed * 3.4)) * barrier.activation;
    barrier.ringMesh.rotation.y += delta * 0.35;
  }
}

export function disposeProtectionBarrier(barrier: ProtectionBarrierInstance): void {
  barrier.domeMesh.geometry.dispose();
  barrier.ringMesh.geometry.dispose();
  barrier.shaderMat.dispose();
  barrier.ringMat.dispose();
  barrier.group.parent?.remove(barrier.group);
}
