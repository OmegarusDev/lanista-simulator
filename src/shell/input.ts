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
  private readonly keys = new Set<string>();
  private readonly keyPressed = new Set<string>();

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

    // Pointer Events cover mouse, touch, and pen — prefer over separate touch/mouse APIs.
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    // Non-passive so preventDefault can block scroll/zoom on the canvas.
    el.addEventListener('touchstart', silenceTouch, { passive: false });
    el.addEventListener('touchmove', silenceTouch, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', silenceTouch);
      el.removeEventListener('touchmove', silenceTouch);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  endFrame(): void {
    this.pointer.clicked = false;
    this.wheelDelta = 0;
    this.keyPressed.clear();
  }

  wasKeyPressed(code: string): boolean {
    return this.keyPressed.has(code);
  }
}

function silenceTouch(e: TouchEvent): void {
  if (e.cancelable) e.preventDefault();
}
