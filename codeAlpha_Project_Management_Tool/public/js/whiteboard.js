// Collaborative whiteboard. Strokes are line segments in normalised (0..1) coordinates so every screen size stays in sync.
export class Whiteboard {
  constructor(canvas, onSegment) {
    this.c = canvas;
    this.onSegment = onSegment;
    this.color = '#ffffff';
    this.size = 4;
    this.erase = false;
    this.drawing = false;
    this.last = null;
    canvas.width = 1600;
    canvas.height = 900;
    this.ctx = canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.drawing = true;
      this.last = pos(e);
      this._emit(this.last, this.last);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drawing) return;
      const p = pos(e);
      this._emit(this.last, p);
      this.last = p;
    });
    const stop = () => { this.drawing = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }
  _emit(a, b) {
    const s = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: this.color, size: this.size, erase: this.erase };
    this.draw(s);
    this.onSegment(s);
  }
  draw(s) {
    const { ctx, c } = this;
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.erase ? s.size * 4 : s.size;
    ctx.beginPath();
    ctx.moveTo(s.x0 * c.width, s.y0 * c.height);
    ctx.lineTo(s.x1 * c.width, s.y1 * c.height);
    ctx.stroke();
  }
  clear() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); }
  png() {
    const o = document.createElement('canvas');
    o.width = this.c.width; o.height = this.c.height;
    const x = o.getContext('2d');
    x.fillStyle = '#0b1020';
    x.fillRect(0, 0, o.width, o.height);
    x.drawImage(this.c, 0, 0);
    return o.toDataURL('image/png');
  }
}
