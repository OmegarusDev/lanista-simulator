export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  clicked: boolean;
}

export class Input {
  readonly pointer: PointerState = { x: 0, y: 0, down: false, clicked: false };
  private readonly keys = new Set<string>();
  private readonly keyPressed = new Set<string>();

  attach(
    el: HTMLElement,
    toDesign: (cx: number, cy: number) => { x: number; y: number },
  ): () => void {
    const onMove = (e: PointerEvent) => {
      const p = toDesign(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
    };
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      const p = toDesign(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.down = true;
      this.pointer.clicked = true;
    };
    const onUp = () => {
      this.pointer.down = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.keys.has(e.code)) this.keyPressed.add(e.code);
      this.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  endFrame(): void {
    this.pointer.clicked = false;
    this.keyPressed.clear();
  }

  wasKeyPressed(code: string): boolean {
    return this.keyPressed.has(code);
  }
}
