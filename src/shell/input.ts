export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  clicked: boolean;
}

export class Input {
  readonly pointer: PointerState = { x: 0, y: 0, down: false, clicked: false };
  /** Accumulated wheel delta this frame (positive = scroll down). Cleared in endFrame. */
  wheelDelta = 0;
  /**
   * Pinch zoom delta this frame (positive = zoom in).
   * Only emitted from multi-touch on the attached stage element.
   */
  pinchDelta = 0;
  /**
   * Two-finger centroid drag this frame (CSS px, screen coords).
   * Accumulated alongside pinchDelta — lets a two-finger drag orbit the camera.
   */
  orbitDx = 0;
  orbitDy = 0;
  private readonly keys = new Set<string>();
  private readonly keyPressed = new Set<string>();
  private pinchBaseDist = 0;
  private prevCentroidX = 0;
  private prevCentroidY = 0;
  private pinchCx = 0;
  private pinchCy = 0;
  private readonly activeTouches = new Map<number, { x: number; y: number }>();

  /**
   * Current two-finger centroid (design px) — the focal point a pinch should
   * zoom toward. Only meaningful while multi-touch is active.
   */
  get pinchCentroid(): { x: number; y: number } | null {
    return this.activeTouches.size >= 2 ? { x: this.pinchCx, y: this.pinchCy } : null;
  }

  attach(
    el: HTMLElement,
    toDesign: (cx: number, cy: number) => { x: number; y: number },
  ): () => void {
    const syncPointer = (e: PointerEvent) => {
      const p = toDesign(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
    };

    const onMove = (e: PointerEvent) => {
      syncPointer(e);
    };

    const onDown = (e: PointerEvent) => {
      // Keep the page from scrolling / synthesizing extra mouse clicks on touch.
      if (e.cancelable) e.preventDefault();
      // Multi-touch pinch: don't capture / click — let touch handlers own zoom.
      if (e.pointerType === 'touch' && this.activeTouches.size >= 1) {
        syncPointer(e);
        return;
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail if the pointer already released; ignore.
      }
      syncPointer(e);
      this.pointer.down = true;
      this.pointer.clicked = true;
    };

    const onUp = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      syncPointer(e);
      // While any touch remains, the touch handlers own the pointer state —
      // lifting one finger of a pinch must not kill the surviving finger's pan.
      if (this.activeTouches.size > 0) return;
      this.pointer.down = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.keys.has(e.code)) this.keyPressed.add(e.code);
      this.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault();
      this.wheelDelta += e.deltaY;
    };

    const touchDist = (): number => {
      const pts = [...this.activeTouches.values()];
      if (pts.length < 2) return 0;
      const a = pts[0]!;
      const b = pts[1]!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    };

    const touchCentroid = (): { x: number; y: number } => {
      const pts = [...this.activeTouches.values()];
      let x = 0;
      let y = 0;
      for (const p of pts) {
        x += p.x;
        y += p.y;
      }
      return { x: x / pts.length, y: y / pts.length };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches.item(i)!;
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (this.activeTouches.size >= 2) {
        this.pinchBaseDist = touchDist();
        const c = touchCentroid();
        this.prevCentroidX = c.x;
        this.prevCentroidY = c.y;
        this.pinchCx = c.x;
        this.pinchCy = c.y;
        this.pointer.down = false;
        this.pointer.clicked = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches.item(i)!;
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (this.activeTouches.size >= 2) {
        const c = touchCentroid();
        this.orbitDx += c.x - this.prevCentroidX;
        this.orbitDy += c.y - this.prevCentroidY;
        this.prevCentroidX = c.x;
        this.prevCentroidY = c.y;
        this.pinchCx = c.x;
        this.pinchCy = c.y;
        if (this.pinchBaseDist > 8) {
          const d = touchDist();
          if (d > 8) {
            // log-ish scale: ratio > 1 → zoom in
            const ratio = d / this.pinchBaseDist;
            this.pinchDelta += (ratio - 1) * 0.85;
            this.pinchBaseDist = d;
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches.item(i)!;
        this.activeTouches.delete(t.identifier);
      }
      if (this.activeTouches.size < 2) this.pinchBaseDist = 0;
      if (this.activeTouches.size === 1) {
        // Seamless gesture hand-off: the surviving finger resumes panning
        // from the current spot — callers see a fresh pointer-down and
        // beginDrag captures the current pan, so nothing jumps.
        this.pointer.down = true;
        this.pointer.clicked = false;
      }
    };

    // Pointer Events cover mouse, touch, and pen — prefer over separate touch/mouse APIs.
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    // Non-passive: block browser page zoom/scroll; drive canvas pinch instead.
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  endFrame(): void {
    this.pointer.clicked = false;
    this.wheelDelta = 0;
    this.pinchDelta = 0;
    this.orbitDx = 0;
    this.orbitDy = 0;
    this.keyPressed.clear();
  }

  wasKeyPressed(code: string): boolean {
    return this.keyPressed.has(code);
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True while two+ fingers are down on the stage (pinch in progress). */
  get isPinching(): boolean {
    return this.activeTouches.size >= 2;
  }
}
