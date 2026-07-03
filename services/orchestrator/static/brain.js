/* V.A.U.L.T. – neuronales Netz / „Gehirn".
 * Self-contained Canvas-2D, keine externen Abhängigkeiten.
 * Zustände: offline (leer/dunkel) · idle (Gold) · working (Magenta) · scan (Teal)
 * "Leer bis verbunden": bei offline sind fast keine Knoten sichtbar; beim ersten
 * Verbinden wächst das Netz per Boot-up-Animation herein.
 */
(function () {
  const COLORS = {
    offline: { node: "120,130,145", edge: "120,130,145" },
    idle:    { node: "216,180,90",  edge: "216,180,90"  },
    working: { node: "224,90,192",  edge: "224,90,192"  },
    scan:    { node: "53,214,195",  edge: "53,214,195"  },
  };

  class Brain {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.state = "offline";
      this.boot = 0;          // 0..1 Boot-up-Fortschritt
      this.pulse = 0;         // laufende Puls-Phase (working)
      this.nodes = [];
      this.t = 0;
      this._build(150);
      this._resize();
      window.addEventListener("resize", () => this._resize());
      requestAnimationFrame((ts) => this._loop(ts));
    }

    setState(state) {
      if (!COLORS[state]) return;
      this.state = state;
    }

    _build(n) {
      // Radiale Verteilung: dichter in der Mitte (wie ein Nervenknäuel).
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.62);   // Bias zur Mitte
        this.nodes.push({
          ba: a, br: r,
          rx: r * Math.cos(a), ry: r * Math.sin(a),
          ph: Math.random() * Math.PI * 2,          // Atem-Phase
          sp: 0.4 + Math.random() * 0.9,            // Geschwindigkeit
          order: Math.random(),                      // Reihenfolge fürs Boot-up
        });
      }
      this.nodes.sort((a, b) => a.order - b.order);
    }

    _resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = w; this.H = h;
      this.cx = w / 2; this.cy = h / 2;
      this.scale = Math.min(w, h) * 0.42;
    }

    _loop(ts) {
      const dt = 0.016;
      this.t += dt;
      // Boot-up / Herunterfahren
      const target = this.state === "offline" ? 0 : 1;
      this.boot += (target - this.boot) * 0.045;
      if (this.state === "working") this.pulse += dt * 1.6;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);

      const col = COLORS[this.state];
      const visible = Math.floor(this.nodes.length * this.boot);
      const breath = 1 + Math.sin(this.t * 0.8) * 0.02;

      // Positionen berechnen (leichte Rotation + Atmen)
      const rot = this.t * 0.05;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const pts = [];
      for (let i = 0; i < visible; i++) {
        const nd = this.nodes[i];
        const wob = Math.sin(this.t * nd.sp + nd.ph) * 0.015;
        const rx = nd.rx + wob, ry = nd.ry + wob;
        const x = (rx * cosR - ry * sinR) * this.scale * breath + this.cx;
        const y = (rx * sinR + ry * cosR) * this.scale * breath + this.cy;
        pts.push({ x, y, r: nd.br });
      }

      // Kanten (nur nahe Knoten)
      const maxD = this.scale * 0.16;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD * maxD) continue;
          let a = (1 - Math.sqrt(d2) / maxD) * 0.35 * this.boot;
          if (this.state === "working") {
            // Puls, der von der Mitte nach außen läuft
            const wave = Math.sin(this.pulse * 3 - pts[i].r * 6);
            a *= 0.6 + 0.6 * Math.max(0, wave);
          }
          ctx.strokeStyle = `rgba(${col.edge},${a})`;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }

      // Knoten
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let glow = 0.5 + 0.5 * Math.sin(this.t * 1.4 + i);
        let size = 1.3 + (1 - p.r) * 1.8;
        let alpha = (0.5 + glow * 0.5) * this.boot;
        if (this.state === "working") {
          const wave = Math.sin(this.pulse * 3 - p.r * 6);
          alpha *= 0.6 + 0.7 * Math.max(0, wave);
          size *= 1 + 0.4 * Math.max(0, wave);
        }
        ctx.fillStyle = `rgba(${col.node},${Math.min(1, alpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Zentraler Kern-Schein
      if (this.boot > 0.02) {
        const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.scale * 0.9);
        const core = this.state === "working" ? 0.14 : 0.08;
        g.addColorStop(0, `rgba(${col.node},${core * this.boot})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }

      requestAnimationFrame((ts2) => this._loop(ts2));
    }
  }

  window.Brain = Brain;
})();
