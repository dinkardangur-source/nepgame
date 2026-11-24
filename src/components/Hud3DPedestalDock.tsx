import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildHud3DPedestalRig,
  disposeObject3DTree,
  Hud3DIconKey,
  Hud3DPedestalRig,
} from '../game/Hud3DIconModels';

export interface Hud3DDockSlot {
  key: Hud3DIconKey;
  label: string;
  subLabel?: string;
  isActive: boolean;
  badgeCount?: number;
  badgeColor?: string;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

interface Hud3DPedestalDockProps {
  slots: Hud3DDockSlot[];
  renderFallbackSvg: (key: Hud3DIconKey, size?: number) => React.ReactNode;
}

let cachedSoftwareGl: boolean | null = null;
function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

const cachedThumbnails = new Map<Hud3DIconKey, string>();
let thumbnailsPromise: Promise<void> | null = null;

function ensureHud3DThumbnails(): Promise<void> {
  if (cachedThumbnails.size === 6) return Promise.resolve();
  if (thumbnailsPromise) return thumbnailsPromise;

  thumbnailsPromise = new Promise((resolve) => {
    try {
      const size = 96;
      const offscreen = document.createElement('canvas');
      offscreen.width = size;
      offscreen.height = size;
      const renderer = new THREE.WebGLRenderer({
        canvas: offscreen,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(size, size, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();

      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
      scene.add(hemi);
      const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.2);
      keyLight.position.set(2.5, 4.0, 3.2);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.1);
      rimLight.position.set(-2.6, 2.2, -2.0);
      scene.add(rimLight);

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
      camera.position.set(1.2, 1.35, 3.25);
      camera.lookAt(0, 0.02, 0);

      const keys: Hud3DIconKey[] = ['command', 'inventory', 'quests', 'alliance', 'mail', 'castle'];
      for (const key of keys) {
        const rig = buildHud3DPedestalRig(key);
        rig.root.rotation.y = -0.28;
        scene.add(rig.root);
        renderer.render(scene, camera);
        cachedThumbnails.set(key, offscreen.toDataURL('image/png'));
        scene.remove(rig.root);
        disposeObject3DTree(rig.root);
      }

      envTex.dispose();
      renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext();
      renderer.dispose();
    } catch {
      // Fallback handled cleanly by SVG
    } finally {
      resolve();
    }
  });

  return thumbnailsPromise;
}

export const Hud3DSnapshotBadge: React.FC<{
  iconKey: Hud3DIconKey;
  size?: number;
  fallback?: React.ReactNode;
}> = ({ iconKey, size = 34, fallback }) => {
  const [src, setSrc] = useState<string | null>(() => cachedThumbnails.get(iconKey) || null);

  useEffect(() => {
    if (cachedThumbnails.has(iconKey)) {
      setSrc(cachedThumbnails.get(iconKey) || null);
      return;
    }
    let mounted = true;
    void ensureHud3DThumbnails().then(() => {
      if (mounted && cachedThumbnails.has(iconKey)) {
        setSrc(cachedThumbnails.get(iconKey) || null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [iconKey]);

  if (!src) {
    return <>{fallback ?? null}</>;
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
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
      }}
    />
  );
};

export const Hud3DPedestalDock: React.FC<Hud3DPedestalDockProps> = ({
  slots,
  renderFallbackSvg,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hoveredKeyRef = useRef<Hud3DIconKey | null>(null);
  const activeKeyMapRef = useRef<Record<string, boolean>>({});
  const spinImpulseRef = useRef<Record<string, number>>({});
  const [webglFailed, setWebglFailed] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<Hud3DIconKey | null>(null);

  useEffect(() => {
    const map: Record<string, boolean> = {};
    slots.forEach((s) => {
      map[s.key] = s.isActive;
    });
    activeKeyMapRef.current = map;
  }, [slots]);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount || webglFailed) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'block';
    canvas.style.zIndex = '1';
    mount.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
    camera.position.set(1.05, 1.38, 3.38);
    camera.lookAt(0, -0.02, 0);

    const keys: Hud3DIconKey[] = ['command', 'inventory', 'quests', 'alliance', 'mail', 'castle'];
    const slotScenes = new Map<
      Hud3DIconKey,
      {
        scene: THREE.Scene;
        rig: Hud3DPedestalRig;
        rotY: number;
        liftY: number;
        scale: number;
      }
    >();

    for (const key of keys) {
      const scene = new THREE.Scene();
      scene.environment = envTex;

      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.92);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.25);
      keyLight.position.set(2.4, 4.2, 3.4);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.15);
      rimLight.position.set(-2.6, 2.0, -2.2);
      scene.add(rimLight);

      const rig = buildHud3DPedestalRig(key);
      rig.root.rotation.y = -0.26;
      scene.add(rig.root);

      slotScenes.set(key, {
        scene,
        rig,
        rotY: -0.26,
        liftY: 0,
        scale: 1,
      });
    }

    let frameId = 0;
    let disposed = false;
    let prevTime = performance.now();

    const syncSize = () => {
      if (!renderer || !mount) return { w: 0, h: 0 };
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
      }
      return { w, h };
    };

    const renderFrame = (now: number) => {
      if (!renderer || disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      const { w, h } = syncSize();
      if (w <= 1 || h <= 1) return;
      const mountRect = mount.getBoundingClientRect();

      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);

      const elapsed = now * 0.001;

      slots.forEach((slot, idx) => {
        const slotEl = slotRefs.current[slot.key];
        const entry = slotScenes.get(slot.key);
        if (!slotEl || !entry) return;

        const sr = slotEl.getBoundingClientRect();
        const vpW = Math.max(1, Math.round(sr.width));
        const vpH = Math.max(1, Math.round(sr.height));
        const vpX = Math.round(sr.left - mountRect.left);
        // Three.js WebGL viewport Y=0 is at the bottom edge of the canvas
        const vpY = Math.round(mountRect.bottom - sr.bottom);

        const isHovered = hoveredKeyRef.current === slot.key;
        const isActive = Boolean(activeKeyMapRef.current[slot.key]);
        const impulse = spinImpulseRef.current[slot.key] || 0;
        if (impulse > 0.001) {
          spinImpulseRef.current[slot.key] = THREE.MathUtils.damp(impulse, 0, 5.5, dt);
        }

        const idleBob = prefersReducedMotion || isSoftwareGl ? 0 : Math.sin(elapsed * 2.1 + idx * 0.9) * 0.035;
        const idleYaw = prefersReducedMotion || isSoftwareGl ? 0 : Math.sin(elapsed * 1.15 + idx * 0.85) * 0.14;
        const targetLift = (isHovered || isActive ? 0.09 : 0) + idleBob;
        const targetScale = isHovered ? 1.1 : isActive ? 1.06 : 1.0;
        const targetRotY = -0.26 + idleYaw + (isHovered ? 0.34 : 0) + impulse;

        entry.liftY = THREE.MathUtils.damp(entry.liftY, targetLift, 11, dt);
        entry.scale = THREE.MathUtils.damp(entry.scale, targetScale, 12, dt);
        entry.rotY = THREE.MathUtils.damp(entry.rotY, targetRotY, 10, dt);

        entry.rig.subject.position.y = entry.liftY;
        entry.rig.root.rotation.y = entry.rotY;
        entry.rig.root.scale.setScalar(entry.scale);

        camera.aspect = vpW / vpH;
        camera.updateProjectionMatrix();

        renderer!.setViewport(vpX, vpY, vpW, vpH);
        renderer!.setScissor(vpX, vpY, vpW, vpH);
        renderer!.render(entry.scene, camera);
      });
    };

    const afterDraw = (cb: () => void) => {
      if (!renderer || disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 120);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 160);
        }
      };
      frameId = window.setTimeout(poll, 8);
    };

    const tick = () => {
      if (disposed) return;
      renderFrame(performance.now());
      if (prefersReducedMotion) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const resizeObserver = new ResizeObserver(() => {
      renderFrame(performance.now());
    });
    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      slotScenes.forEach(({ rig, scene }) => {
        scene.remove(rig.root);
        disposeObject3DTree(rig.root);
      });
      envTex.dispose();
      renderer?.getContext().getExtension('WEBGL_lose_context')?.loseContext();
      renderer?.dispose();
      if (canvas.parentElement === mount) {
        mount.removeChild(canvas);
      }
    };
  }, [webglFailed, slots.length]);

  return (
    <div
      ref={containerRef}
      className="hud-bottom-actions"
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: 55,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      {slots.map((slot) => {
        const isCastle = slot.key === 'castle';
        const isPressed = pressedKey === slot.key;
        const isHovered = hoveredKey === slot.key;

        return (
          <button
            key={slot.key}
            type="button"
            title={slot.title}
            onPointerDown={() => setPressedKey(slot.key)}
            onPointerUp={() => setPressedKey(null)}
            onPointerEnter={() => {
              hoveredKeyRef.current = slot.key;
              setHoveredKey(slot.key);
            }}
            onPointerLeave={() => {
              setPressedKey((prev) => (prev === slot.key ? null : prev));
              if (hoveredKeyRef.current === slot.key) hoveredKeyRef.current = null;
              setHoveredKey((prev) => (prev === slot.key ? null : prev));
            }}
            onPointerCancel={() => setPressedKey(null)}
            onClick={(e) => {
              spinImpulseRef.current[slot.key] = (spinImpulseRef.current[slot.key] || 0) + Math.PI * 2;
              slot.onClick(e);
            }}
            style={{
              position: 'relative',
              zIndex: 2,
              width: isCastle ? '66px' : '58px',
              height: isCastle ? '72px' : '66px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              touchAction: 'manipulation',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              transform: isPressed
                ? 'scale(0.92) translateY(2px)'
                : slot.isActive || isHovered
                  ? 'translateY(-3px)'
                  : 'none',
              transition: 'transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Subtle Floor Contact Glow When Active or Hovered */}
            {(slot.isActive || isHovered) && (
              <div
                style={{
                  position: 'absolute',
                  inset: '4px 3px 10px 3px',
                  borderRadius: '10px',
                  background:
                    'radial-gradient(circle at 50% 62%, rgba(56, 189, 248, 0.34) 0%, rgba(250, 204, 21, 0.14) 55%, transparent 78%)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* 3D Viewport Target Area */}
            <div
              ref={(el) => {
                slotRefs.current[slot.key] = el;
              }}
              style={{
                width: '100%',
                flex: 1,
                minHeight: '46px',
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {webglFailed && (
                <div style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))' }}>
                  {renderFallbackSvg(slot.key, 30)}
                </div>
              )}
            </div>

            {/* Frosted Acrylic & Silver-Trimmed Navy Pedestal Nameplate */}
            <div
              style={{
                position: 'relative',
                zIndex: 3,
                width: '94%',
                minHeight: '16px',
                padding: '2px 4px',
                borderRadius: '3px',
                background: slot.isActive
                  ? 'linear-gradient(180deg, #1d4ed8 0%, #0f2957 100%)'
                  : 'linear-gradient(180deg, #183664 0%, #0a1830 100%)',
                borderTop: '1.5px solid rgba(226, 232, 240, 0.85)',
                borderLeft: '1.5px solid rgba(203, 213, 225, 0.72)',
                borderRight: '1.5px solid rgba(203, 213, 225, 0.72)',
                borderBottom: '2px solid rgba(148, 163, 184, 0.85)',
                boxShadow: slot.isActive
                  ? '0 3px 10px rgba(56, 189, 248, 0.45), inset 0 1px 0 rgba(255,255,255,0.28)'
                  : '0 3px 8px rgba(0, 0, 0, 0.78), inset 0 1px 0 rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
              }}
            >
              <span
                style={{
                  font: "800 9px 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.05em',
                  color: slot.isActive ? '#fef08a' : '#f8fafc',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {slot.label}
              </span>
            </div>

            {/* Unread / Claimable Counter */}
            {typeof slot.badgeCount === 'number' && slot.badgeCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '1px',
                  right: '0px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: slot.badgeColor || '#dc2626',
                  border: '1.5px solid #fef08a',
                  color: '#ffffff',
                  font: "800 9.5px 'Barlow Condensed', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.85)',
                  zIndex: 5,
                }}
              >
                {slot.badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
