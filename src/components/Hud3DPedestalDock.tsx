import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildHud3DPedestalRig,
  disposeObject3DTree,
  Hud3DIconKey,
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
  return (
    <div
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

        return (
          <button
            key={slot.key}
            type="button"
            title={slot.title}
            className={`hud-dock-btn${slot.isActive ? ' is-active' : ''}`}
            onClick={(e) => {
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
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {/* Subtle Floor Contact Glow When Active */}
            {slot.isActive && (
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

            {/* Cached Crisp 3D Snapshot Pedestal Icon */}
            <div
              className="hud-dock-icon-slot"
              style={{
                width: '100%',
                flex: 1,
                minHeight: '46px',
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Hud3DSnapshotBadge
                iconKey={slot.key}
                size={isCastle ? 46 : 42}
                fallback={
                  <div style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))' }}>
                    {renderFallbackSvg(slot.key, 30)}
                  </div>
                }
              />
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
                pointerEvents: 'none',
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
                  pointerEvents: 'none',
                }}
              >
                {slot.badgeCount}
              </span>
            )}
          </button>
        );
      })}
      <style>{`
        .hud-dock-btn {
          transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .hud-dock-btn:hover,
        .hud-dock-btn.is-active {
          transform: translateY(-3px);
        }
        .hud-dock-btn:active {
          transform: scale(0.92) translateY(2px);
        }
      `}</style>
    </div>
  );
};

