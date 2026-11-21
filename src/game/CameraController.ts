import * as THREE from 'three';
import { WorldCoordinates } from './WorldCoordinates';
import { TerrainGenerator } from './TerrainGenerator';

/**
 * CameraController.ts
 * Screen-Focused Strategy Camera Controller for Three.js.
 * Features:
 * - Screen-centered forward strategy viewing angle (yaw = 0 facing the Citadel & Fortress squarely)
 * - Auto-focuses selected entities cleanly into the center of the screen
 * - Smooth exponential damping for panning, zooming, and optional orbit rotation (Right-drag or Q/E)
 * - Zero-GC pre-allocated math vectors and change-only UI notification (no 60Hz React re-render spam)
 */

export interface CameraControllerOptions {
  domElement: HTMLElement;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  terrainGenerator: TerrainGenerator;
  initialTarget?: [number, number, number];
  minZoom?: number;
  maxZoom?: number;
  onUpdate?: (info: { x: number; y: number; z: number; zoom: number }) => void;
  onSelectObject?: (obj: THREE.Object3D | null, screenPos: { x: number; y: number } | null) => void;
  pickableObjects?: THREE.Object3D[];
}

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private terrainGenerator: TerrainGenerator;

  // Camera Target in World Coordinates (Focused on My Castle / Center of 3200x3200 Continent)
  public target = new THREE.Vector3(1600, 10, 1568);
  private desiredTarget = new THREE.Vector3(1600, 10, 1568);
  private homeCoords = { x: 1600, z: 1568 };

  // Zoom management (Scale factor: 0.023x [Zoom Out 100 full 3200x3200 realm] to 3.2x deep tactical corner zoom)
  public zoom = 0.5016;
  private desiredZoom = 0.5016;
  public minZoom = 0.023;
  public maxZoom = 3.2;

  // Screen-Focused Viewing Angles:
  private readonly BASE_DISTANCE = 96;
  private pitch = 0.72;
  private desiredPitch = 0.72;
  private yaw = 0.0;
  private desiredYaw = 0.0;

  // Single-pointer & Multi-touch Input states (Full Mobile Touch Support)
  private isPointerDown = false;
  private isRightDrag = false;
  private isDragging = false;
  private primaryPointerId: number | null = null;
  private primaryPointerType = 'mouse';
  private pointerStart = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };
  private activePointers = new Map<
    number,
    { clientX: number; clientY: number; pointerType: string; button: number }
  >();
  private hadMultiTouch = false;
  private lastPinchDistance = 0;
  private lastPinchMidpoint = { x: 0, y: 0 };
  private activeKeys = new Set<string>();
  private resizeObserver: ResizeObserver | null = null;

  // Callbacks
  private onUpdate?: (info: { x: number; y: number; z: number; zoom: number }) => void;
  private onSelectObject?: (obj: THREE.Object3D | null, screenPos: { x: number; y: number } | null) => void;
  private pickableObjects: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();

  // Pre-allocated math helpers (Zero GC in update/input loop)
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private lastWorldPoint: THREE.Vector3 | null = null;
  private readonly _ndc = new THREE.Vector2();
  private readonly _intersectPt = new THREE.Vector3();
  private readonly _deltaWorld = new THREE.Vector3();
  private readonly _lookAtTarget = new THREE.Vector3();

  // Cached UI notification state to prevent redundant 60fps React re-renders
  private lastReportedX = -9999;
  private lastReportedY = -9999;
  private lastReportedZ = -9999;
  private lastReportedZoom = -9999;

  constructor(options: CameraControllerOptions) {
    this.domElement = options.domElement;
    this.terrainGenerator = options.terrainGenerator;
    this.minZoom = options.minZoom ?? 0.048;
    this.maxZoom = options.maxZoom ?? 3.2;
    this.onUpdate = options.onUpdate;
    this.onSelectObject = options.onSelectObject;
    this.pickableObjects = options.pickableObjects ?? [];

    if (options.initialTarget) {
      this.target.set(options.initialTarget[0], options.initialTarget[1], options.initialTarget[2]);
      this.desiredTarget.copy(this.target);
      this.homeCoords = { x: options.initialTarget[0], z: options.initialTarget[2] };
    }

    const aspect = (this.domElement.clientWidth || 16) / (this.domElement.clientHeight || 9);
    this.camera = new THREE.PerspectiveCamera(35, aspect, 1.5, 24000);
    this.domElement.style.touchAction = 'none';
    this.domElement.style.userSelect = 'none';
    (this.domElement.style as unknown as Record<string, string>).webkitUserSelect = 'none';

    this.bindEvents();
    this.updateCameraTransform();
  }

  /**
   * Keeps the camera target framed inside map corners dynamically according to zoom level:
   * - When zoomed in (zoom >= 0.36), allows deep inspection down to 20m from all 4 green corners.
   * - As zoom pulls out toward Zoom 100 (minZoom = 0.023), pulls margins smoothly inward
   *   so the viewport stays centered over playable green land & outer valleys without exposing void.
   */
  private clampDesiredTargetToMap() {
    const tOut = THREE.MathUtils.clamp((0.36 - this.desiredZoom) / Math.max(0.01, 0.36 - this.minZoom), 0, 1);
    const dynamicMargin = THREE.MathUtils.lerp(20, 1380, tOut * tOut);
    const clamped = WorldCoordinates.clampToMap(this.desiredTarget.x, this.desiredTarget.z, dynamicMargin);
    this.desiredTarget.x = clamped.x;
    this.desiredTarget.z = clamped.z;
  }

  public setPickables(pickables: THREE.Object3D[]) {
    this.pickableObjects = pickables;
  }

  public setHomeCoordinates(x: number, z: number, snapImmediately = false) {
    const clamped = WorldCoordinates.clampToMap(x, z);
    this.homeCoords = { x: clamped.x, z: clamped.z };
    const y = this.terrainGenerator.getHeightAt(clamped.x, clamped.z);
    if (snapImmediately) {
      this.target.set(clamped.x, y, clamped.z);
      this.desiredTarget.set(clamped.x, y, clamped.z);
      this.updateCameraTransform();
    } else {
      this.desiredTarget.set(clamped.x, y, clamped.z);
    }
  }

  /**
   * Reset view back to screen-centered My Castle focus at Default Zoom Out 85
   */
  public resetToHome() {
    this.desiredTarget.set(
      this.homeCoords.x,
      this.terrainGenerator.getHeightAt(this.homeCoords.x, this.homeCoords.z),
      this.homeCoords.z
    );
    this.desiredZoom = 0.5016;
    this.desiredYaw = 0.0;
    this.desiredPitch = 0.72;
  }

  /**
   * Focus inside the 3D Walled Imperial Citadel Kingdom courtyard (frames full wall border + surrounding forest)
   */
  public focusInsideKingdom() {
    this.desiredTarget.set(1600, 10.0, 1602);
    this.desiredZoom = 0.5016;
    this.desiredYaw = 0.0;
    this.desiredPitch = 0.78;
  }

  /**
   * Zoom Out 100 (Full 100% strategic realm overview across the 3200x3200 continent)
   */
  public zoomOutTo100() {
    this.desiredTarget.set(1600, this.terrainGenerator.getHeightAt(1600, 1600), 1600);
    this.desiredZoom = this.minZoom;
    this.desiredYaw = 0.0;
    this.desiredPitch = 0.98;
  }

  /**
   * Smoothly pan and focus camera onto any world coordinate
   */
  public panTo(x: number, z: number) {
    this.desiredTarget.x = x;
    this.desiredTarget.z = z;
    this.clampDesiredTargetToMap();
    const y = this.terrainGenerator.getHeightAt(this.desiredTarget.x, this.desiredTarget.z);
    this.desiredTarget.y = y;
  }

  /**
   * Focus camera directly onto an entity in the center of the screen
   */
  public focusOn(x: number, z: number, targetZoom?: number) {
    if (targetZoom !== undefined) {
      this.desiredZoom = THREE.MathUtils.clamp(targetZoom, this.minZoom, this.maxZoom);
    } else if (this.desiredZoom < 1.15) {
      this.desiredZoom = 1.25;
    }
    this.panTo(x, z);
  }

  /**
   * Adjust zoom step proportionally so zooming across 100% range is smooth
   */
  public adjustZoom(delta: number) {
    const scaledDelta = delta * Math.max(0.35, this.desiredZoom);
    this.desiredZoom = THREE.MathUtils.clamp(this.desiredZoom + scaledDelta, this.minZoom, this.maxZoom);
    this.clampDesiredTargetToMap();
  }

  public setZoom(z: number) {
    this.desiredZoom = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom);
    this.clampDesiredTargetToMap();
  }

  private onTouchMovePrevent = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
  };

  private onOrientationChange = () => {
    setTimeout(this.onWindowResize, 60);
    setTimeout(this.onWindowResize, 220);
  };

  private clearAllPointers = () => {
    this.activePointers.clear();
    this.isPointerDown = false;
    this.isRightDrag = false;
    this.isDragging = false;
    this.lastWorldPoint = null;
    this.primaryPointerId = null;
    this.lastPinchDistance = 0;
    this.hadMultiTouch = false;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.clearAllPointers();
    }
  };

  private bindEvents() {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.domElement.addEventListener('touchmove', this.onTouchMovePrevent, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onOrientationChange);
    window.addEventListener('blur', this.clearAllPointers);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onWindowResize();
      });
      this.resizeObserver.observe(this.domElement);
    }
  }

  public dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.domElement.removeEventListener('touchmove', this.onTouchMovePrevent);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.domElement.removeEventListener('wheel', this.onWheel);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onOrientationChange);
    window.removeEventListener('blur', this.clearAllPointers);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private getPinchMetrics(): { distance: number; midX: number; midY: number } | null {
    if (this.activePointers.size < 2) return null;
    const pts = Array.from(this.activePointers.values());
    const p1 = pts[0];
    const p2 = pts[1];
    return {
      distance: Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY),
      midX: (p1.clientX + p2.clientX) * 0.5,
      midY: (p1.clientY + p2.clientY) * 0.5,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;

    this.activePointers.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType || 'mouse',
      button: e.button,
    });

    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic pointers
    }

    if (this.activePointers.size >= 2) {
      // Transition cleanly into two-finger pinch-zoom + midpoint pan mode
      this.hadMultiTouch = true;
      this.isPointerDown = false;
      this.isDragging = true;
      this.lastWorldPoint = null;
      const metrics = this.getPinchMetrics();
      if (metrics) {
        this.lastPinchDistance = metrics.distance;
        this.lastPinchMidpoint = { x: metrics.midX, y: metrics.midY };
      }
      return;
    }

    // Single touch or mouse drag start
    this.hadMultiTouch = false;
    this.primaryPointerId = e.pointerId;
    this.primaryPointerType = e.pointerType || 'mouse';
    this.isPointerDown = true;
    this.isRightDrag = e.pointerType === 'mouse' && e.button === 2;
    this.isDragging = false;
    this.pointerStart.x = e.clientX;
    this.pointerStart.y = e.clientY;
    this.lastPointer.x = e.clientX;
    this.lastPointer.y = e.clientY;

    if (!this.isRightDrag) {
      const hit = this.getGroundIntersection(e.clientX, e.clientY);
      this.lastWorldPoint = hit ? hit.clone() : null;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) {
      if (!this.isPointerDown) return;
    } else {
      const prev = this.activePointers.get(e.pointerId)!;
      prev.clientX = e.clientX;
      prev.clientY = e.clientY;
    }

    // Multi-touch: 2-finger pinch zoom & midpoint pan
    if (this.activePointers.size >= 2) {
      const metrics = this.getPinchMetrics();
      if (metrics && this.lastPinchDistance > 0) {
        const distDelta = metrics.distance - this.lastPinchDistance;
        const rect = this.domElement.getBoundingClientRect();
        const refSize = Math.max(120, Math.min(rect.width, rect.height));
        const zoomStep = (distDelta / refSize) * 2.4;
        if (Math.abs(zoomStep) > 0.001) {
          this.adjustZoom(zoomStep);
        }

        // Midpoint two-finger pan
        const mdx = metrics.midX - this.lastPinchMidpoint.x;
        const mdy = metrics.midY - this.lastPinchMidpoint.y;
        if (Math.abs(mdx) > 0.2 || Math.abs(mdy) > 0.2) {
          const panScale = (this.BASE_DISTANCE / this.zoom) * 0.0018;
          const cosYaw = Math.cos(this.yaw);
          const sinYaw = Math.sin(this.yaw);
          this.desiredTarget.x -= (mdx * cosYaw + mdy * sinYaw) * panScale;
          this.desiredTarget.z -= (-mdx * sinYaw + mdy * cosYaw) * panScale;
          this.clampDesiredTargetToMap();
        }

        this.lastPinchDistance = metrics.distance;
        this.lastPinchMidpoint = { x: metrics.midX, y: metrics.midY };
      }
      return;
    }

    if (!this.isPointerDown || this.primaryPointerId !== e.pointerId || this.hadMultiTouch) return;

    const dx = e.clientX - this.pointerStart.x;
    const dy = e.clientY - this.pointerStart.y;
    // Touch screens get a forgiving 12px tap jitter threshold vs 5px for mouse
    const dragThreshold = this.primaryPointerType === 'touch' ? 12 : 5;

    if (!this.isDragging && Math.hypot(dx, dy) > dragThreshold) {
      this.isDragging = true;
    }

    if (this.isDragging) {
      if (this.isRightDrag) {
        const stepX = e.clientX - this.lastPointer.x;
        const stepY = e.clientY - this.lastPointer.y;
        this.desiredYaw -= stepX * 0.0055;
        this.desiredPitch = THREE.MathUtils.clamp(this.desiredPitch + stepY * 0.004, 0.45, 1.18);
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
      } else {
        const curWorldPoint = this.getGroundIntersection(e.clientX, e.clientY);
        if (this.lastWorldPoint && curWorldPoint) {
          this._deltaWorld.subVectors(this.lastWorldPoint, curWorldPoint);
          const maxPanStep = Math.max(40, (this.BASE_DISTANCE / this.zoom) * 0.45);
          if (this._deltaWorld.length() > maxPanStep) {
            this._deltaWorld.setLength(maxPanStep);
          }
          this.desiredTarget.add(this._deltaWorld);
          this.clampDesiredTargetToMap();

          const updatedHit = this.getGroundIntersection(e.clientX, e.clientY);
          if (updatedHit) {
            this.lastWorldPoint.copy(updatedHit);
          }
        } else {
          // Fallback pixel-to-world pan if ray misses horizon plane
          const stepX = e.clientX - this.lastPointer.x;
          const stepY = e.clientY - this.lastPointer.y;
          const panScale = (this.BASE_DISTANCE / this.zoom) * 0.0018;
          const cosYaw = Math.cos(this.yaw);
          const sinYaw = Math.sin(this.yaw);
          this.desiredTarget.x -= (stepX * cosYaw + stepY * sinYaw) * panScale;
          this.desiredTarget.z -= (-stepX * sinYaw + stepY * cosYaw) * panScale;
          this.clampDesiredTargetToMap();
        }
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
      }
    }
  };

  private finishPointerTracking(e: PointerEvent, allowSelection: boolean) {
    this.activePointers.delete(e.pointerId);
    try {
      if (this.domElement.hasPointerCapture(e.pointerId)) {
        this.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    if (this.activePointers.size >= 2) {
      const metrics = this.getPinchMetrics();
      if (metrics) {
        this.lastPinchDistance = metrics.distance;
        this.lastPinchMidpoint = { x: metrics.midX, y: metrics.midY };
      }
      return;
    }

    if (this.activePointers.size === 1) {
      // Dropped from 2 fingers to 1 finger; smoothly resume single-finger panning without triggering tap selection
      const entry = this.activePointers.entries().next().value as
        | [number, { clientX: number; clientY: number; pointerType: string; button: number }]
        | undefined;
      if (entry) {
        const [remId, rem] = entry;
        this.primaryPointerId = remId;
        this.primaryPointerType = rem.pointerType || 'touch';
        this.isPointerDown = true;
        this.isDragging = true;
        this.hadMultiTouch = true;
        this.lastPointer.x = rem.clientX;
        this.lastPointer.y = rem.clientY;
        const hit = this.getGroundIntersection(rem.clientX, rem.clientY);
        this.lastWorldPoint = hit ? hit.clone() : null;
      } else {
        this.isPointerDown = false;
        this.lastWorldPoint = null;
      }
      return;
    }

    // All pointers lifted
    const wasRight = this.isRightDrag;
    const wasDragging = this.isDragging;
    const wasMultiTouch = this.hadMultiTouch;
    const wasPrimary = this.primaryPointerId === e.pointerId;
    const isTouchTap = (e.pointerType || this.primaryPointerType) === 'touch';

    this.isPointerDown = false;
    this.isRightDrag = false;
    this.isDragging = false;
    this.lastWorldPoint = null;
    this.primaryPointerId = null;
    this.lastPinchDistance = 0;
    this.hadMultiTouch = false;

    if (allowSelection && wasPrimary && !wasRight && !wasDragging && !wasMultiTouch) {
      this.handleObjectSelection(e.clientX, e.clientY, isTouchTap);
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.finishPointerTracking(e, true);
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.finishPointerTracking(e, false);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.14 : -0.14;
    this.adjustZoom(zoomDelta);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

    this.activeKeys.add(e.code);

    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      this.adjustZoom(0.2);
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      this.adjustZoom(-0.2);
    } else if (e.code === 'Home' || e.code === 'KeyH') {
      this.resetToHome();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.activeKeys.delete(e.code);
  };

  private onWindowResize = () => {
    if (!this.domElement) return;
    const w = this.domElement.clientWidth;
    const h = this.domElement.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /**
   * Raycast to ground plane for accurate screen-aligned drag panning
   */
  private getGroundIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this._ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(this._ndc, this.camera);
    this.groundPlane.constant = -this.target.y;
    return this.raycaster.ray.intersectPlane(this.groundPlane, this._intersectPt);
  }

  /**
   * Raycast against pickable objects upon clicking/tapping (with generous touch hit-radius fallback)
   */
  private handleObjectSelection(clientX: number, clientY: number, isTouch = false) {
    if (!this.onSelectObject) return;

    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const probeOffsets: Array<[number, number]> = isTouch
      ? [
          [0, 0],
          [0, -14],
          [14, 0],
          [0, 14],
          [-14, 0],
          [10, -10],
          [-10, -10],
          [10, 10],
          [-10, 10],
          [0, -26],
          [24, 0],
          [-24, 0],
        ]
      : [[0, 0]];

    let hitObj: THREE.Object3D | null = null;
    for (const [ox, oy] of probeOffsets) {
      this._ndc.set(
        (((clientX + ox) - rect.left) / rect.width) * 2 - 1,
        -(((clientY + oy) - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(this._ndc, this.camera);
      const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);
      if (intersects.length > 0) {
        hitObj = intersects[0].object;
        break;
      }
    }

    if (hitObj) {
      let hit = hitObj;
      while (
        hit.parent &&
        !hit.userData?.gameEntity &&
        !hit.userData?.insidePlotId &&
        !hit.userData?.isReservedPlot &&
        !hit.userData?.gameData
      ) {
        if (hit.parent.type === 'Scene') break;
        hit = hit.parent;
      }
      this.onSelectObject(hit, { x: clientX - rect.left, y: clientY - rect.top });
    } else {
      this.onSelectObject(null, null);
    }
  }

  /**
   * Frame update loop: handles smooth keyboard pan, orbit rotation, and exponential damping
   */
  public update(delta: number) {
    if (this.activeKeys.size > 0) {
      const speed = (68 / this.zoom) * delta;
      const moveRight =
        (this.activeKeys.has('KeyD') || this.activeKeys.has('ArrowRight') ? 1 : 0) -
        (this.activeKeys.has('KeyA') || this.activeKeys.has('ArrowLeft') ? 1 : 0);
      const moveForward =
        (this.activeKeys.has('KeyS') || this.activeKeys.has('ArrowDown') ? 1 : 0) -
        (this.activeKeys.has('KeyW') || this.activeKeys.has('ArrowUp') ? 1 : 0);

      if (this.activeKeys.has('KeyQ')) {
        this.desiredYaw -= 1.4 * delta;
      }
      if (this.activeKeys.has('KeyE')) {
        this.desiredYaw += 1.4 * delta;
      }

      if (moveRight !== 0 || moveForward !== 0) {
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);

        const deltaX = (moveRight * cosYaw + moveForward * sinYaw) * speed;
        const deltaZ = (-moveRight * sinYaw + moveForward * cosYaw) * speed;

        this.desiredTarget.x += deltaX;
        this.desiredTarget.z += deltaZ;
        this.clampDesiredTargetToMap();
      }
    }

    this.desiredTarget.y = this.terrainGenerator.getHeightAt(this.desiredTarget.x, this.desiredTarget.z);

    // Smooth frame-rate independent exponential damping
    const dampSpeed = 10.0;
    this.target.x = THREE.MathUtils.damp(this.target.x, this.desiredTarget.x, dampSpeed, delta);
    this.target.z = THREE.MathUtils.damp(this.target.z, this.desiredTarget.z, dampSpeed, delta);
    this.target.y = THREE.MathUtils.damp(this.target.y, this.desiredTarget.y, dampSpeed, delta);
    this.zoom = THREE.MathUtils.damp(this.zoom, this.desiredZoom, dampSpeed, delta);
    this.yaw = THREE.MathUtils.damp(this.yaw, this.desiredYaw, dampSpeed, delta);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.desiredPitch, dampSpeed, delta);

    this.updateCameraTransform();

    // Only notify React HUD when rounded values actually change (prevents 60Hz React state thrashing)
    const rx = Math.round(this.target.x);
    const ry = Math.round(this.target.y * 10) / 10;
    const rz = Math.round(this.target.z);
    const rZoom = Math.round(this.zoom * 100) / 100;

    if (
      rx !== this.lastReportedX ||
      ry !== this.lastReportedY ||
      rz !== this.lastReportedZ ||
      rZoom !== this.lastReportedZoom
    ) {
      this.lastReportedX = rx;
      this.lastReportedY = ry;
      this.lastReportedZ = rz;
      this.lastReportedZoom = rZoom;
      this.onUpdate?.({ x: rx, y: ry, z: rz, zoom: rZoom });
    }
  }

  /**
   * Places camera along screen-focused viewing vector relative to current target
   * With yaw = 0, camera sits South (+Z) looking straight North (-Z) into the screen center.
   */
  private updateCameraTransform() {
    const dist = this.BASE_DISTANCE / this.zoom;
    const horizDist = dist * Math.cos(this.pitch);
    const vertDist = dist * Math.sin(this.pitch);

    const camX = this.target.x + horizDist * Math.sin(this.yaw);
    const camZ = this.target.z + horizDist * Math.cos(this.yaw);
    const camY = this.target.y + vertDist;

    this.camera.position.set(camX, camY, camZ);
    // Elevate lookAt slightly (+3.2m) so tall buildings and towers sit centered in screen focus
    this._lookAtTarget.set(this.target.x, this.target.y + 3.2, this.target.z);
    this.camera.lookAt(this._lookAtTarget);
  }
}
