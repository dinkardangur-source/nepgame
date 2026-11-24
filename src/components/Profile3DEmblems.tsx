import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildProfile3DModel,
  disposeProfile3DGroup,
  Profile3DIconKey,
} from '../game/Profile3DModels';

const ALL_PROFILE_3D_KEYS: Profile3DIconKey[] = [
  'royal_crown',
  'crossed_swords',
  'banner_crown',
  'spartan_helm',
  'fire_brazier',
  'xp_star',
  'ap_potion',
  'history_scroll',
  'treasure_chest',
  'trophy_cup',
  'victor_medal',
  'power_bolt',
  'kill_skull',
  'alliance_shield',
];

const cachedProfileIcons = new Map<Profile3DIconKey, string>();
let profileBakePromise: Promise<void> | null = null;

function isSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function ensureProfile3DBakes(): Promise<void> {
  if (cachedProfileIcons.size === ALL_PROFILE_3D_KEYS.length) {
    return Promise.resolve();
  }
  if (profileBakePromise) return profileBakePromise;

  profileBakePromise = new Promise((resolve) => {
    // Delay slightly so main WorldMap + Hud3DPedestalDock initialize smoothly first
    window.setTimeout(() => {
      try {
        const size = 112;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(size, size, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        pmrem.dispose();

        const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.95);
        scene.add(hemi);
        const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.3);
        keyLight.position.set(2.2, 3.6, 3.2);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.1);
        rimLight.position.set(-2.5, 1.8, -2.0);
        scene.add(rimLight);

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
        camera.position.set(0.35, 0.45, 2.45);
        camera.lookAt(0, 0, 0);

        for (const key of ALL_PROFILE_3D_KEYS) {
          const model = buildProfile3DModel(key);
          model.rotation.y = key === 'crossed_swords' || key === 'xp_star' ? 0.16 : -0.26;
          if (key === 'royal_crown' || key === 'banner_crown') {
            model.position.y = 0.05;
          }
          scene.add(model);
          renderer.render(scene, camera);
          cachedProfileIcons.set(key, canvas.toDataURL('image/png'));
          scene.remove(model);
          disposeProfile3DGroup(model);
        }

        envTex.dispose();
        renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext();
        renderer.dispose();
      } catch {
        // Fallback SVG renders gracefully when WebGL is unavailable
      } finally {
        resolve();
      }
    }, 60);
  });

  return profileBakePromise;
}

function renderFallbackSvg(key: Profile3DIconKey, size: number) {
  switch (key) {
    case 'royal_crown':
    case 'banner_crown':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <path d="M5 22L3 10L11 15L16 6L21 15L29 10L27 22H5Z" fill="#facc15" stroke="#92400e" strokeWidth="1.4" />
          <polygon points="16,12 18.5,16 16,20 13.5,16" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="0.9" />
        </svg>
      );
    case 'crossed_swords':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <line x1="6" y1="26" x2="26" y2="6" stroke="#fde047" strokeWidth="3" strokeLinecap="round" />
          <line x1="26" y1="26" x2="6" y2="6" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'fire_brazier':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <path d="M16 4C19 9 22 12 20 17C18.5 20 13.5 20 12 17C10 12 13 9 16 4Z" fill="#fb923c" />
          <path d="M8 19H24L21 26H11L8 19Z" fill="#d97706" stroke="#fef08a" strokeWidth="1.2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <polygon points="16,4 26,10 24,22 16,28 8,22 6,10" fill="#eab308" stroke="#fef08a" strokeWidth="1.4" />
        </svg>
      );
  }
}

export const Profile3DBadge: React.FC<{
  iconKey: Profile3DIconKey;
  size?: number;
  style?: React.CSSProperties;
}> = ({ iconKey, size = 28, style }) => {
  const [src, setSrc] = useState<string | null>(() => cachedProfileIcons.get(iconKey) || null);

  useEffect(() => {
    if (cachedProfileIcons.has(iconKey)) {
      setSrc(cachedProfileIcons.get(iconKey) || null);
      return;
    }
    let mounted = true;
    void ensureProfile3DBakes().then(() => {
      if (mounted && cachedProfileIcons.has(iconKey)) {
        setSrc(cachedProfileIcons.get(iconKey) || null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [iconKey]);

  if (!src) {
    return (
      <span
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'inline-grid',
          placeItems: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        {renderFallbackSvg(iconKey, size)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={iconKey}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.65))',
        ...style,
      }}
    />
  );
};

export const Profile3DCrestViewport: React.FC<{
  modelKey?: Profile3DIconKey;
  accentColor?: string;
}> = ({ modelKey = 'royal_crown', accentColor = '#facc15' }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dragYawRef = useRef<number>(0);
  const targetYawRef = useRef<number>(0.2);
  const isDraggingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || failed) return;

    const isSw = isSoftwareWebGL();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSw,
        powerPreference: 'high-performance',
      });
    } catch {
      setFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xfef3c7, 0x1e293b, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d0, 2.4);
    key.position.set(2.5, 4.0, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rim.position.set(-2.5, 2.0, -2.5);
    scene.add(rim);

    // Sculpted royal pedestal plinth + active 3D crest model
    const rig = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.78, 0.22, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.48 })
    );
    plinth.position.y = -0.58;
    rig.add(plinth);

    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.69, 0.035, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.18 })
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = -0.47;
    rig.add(goldRing);

    const subject = buildProfile3DModel(modelKey);
    subject.position.y = 0.08;
    subject.scale.setScalar(1.08);
    rig.add(subject);
    scene.add(rig);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.35, 2.75);
    camera.lookAt(0, -0.05, 0);

    let disposed = false;
    let frameId = 0;
    let prev = performance.now();

    const syncSize = () => {
      if (!renderer || !mount) return;
      const r = mount.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };

    const draw = (now: number) => {
      if (!renderer || disposed) return;
      syncSize();
      const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
      prev = now;
      if (!isDraggingRef.current && !prefersReducedMotion) {
        targetYawRef.current += dt * 0.55;
      }
      dragYawRef.current = THREE.MathUtils.damp(dragYawRef.current, targetYawRef.current, 9, dt);
      rig.rotation.y = dragYawRef.current;
      subject.position.y = 0.08 + (prefersReducedMotion ? 0 : Math.sin(now * 0.0022) * 0.04);
      renderer.render(scene, camera);
    };

    const afterDraw = (cb: () => void) => {
      if (!renderer || disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 100);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 120);
        }
      };
      frameId = window.setTimeout(poll, 8);
    };

    const tick = () => {
      if (disposed) return;
      draw(performance.now());
      if (prefersReducedMotion) return;
      if (isSw) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.remove(rig);
      disposeProfile3DGroup(rig);
      envTex.dispose();
      renderer?.getContext().getExtension('WEBGL_lose_context')?.loseContext();
      renderer?.dispose();
      if (canvas.parentElement === mount) {
        mount.removeChild(canvas);
      }
    };
  }, [failed, modelKey]);

  if (failed) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle, rgba(234,179,8,0.22), rgba(15,23,42,0.9))',
        }}
      >
        <Profile3DBadge iconKey={modelKey} size={72} />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      onPointerDown={(e) => {
        isDraggingRef.current = true;
        lastXRef.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;
        targetYawRef.current += dx * 0.015;
      }}
      onPointerUp={() => {
        isDraggingRef.current = false;
      }}
      onPointerLeave={() => {
        isDraggingRef.current = false;
      }}
      title="Drag to rotate 3D Royal Emblem"
      style={{
        width: '100%',
        height: '100%',
        cursor: 'grab',
        touchAction: 'none',
        background: `radial-gradient(circle at 50% 45%, ${accentColor}33 0%, rgba(15, 23, 42, 0.92) 72%)`,
      }}
    />
  );
};
