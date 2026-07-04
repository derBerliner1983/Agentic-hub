/* V.A.U.L.T. – neuronales Netz / „Gehirn".
 * Self-contained Canvas-2D, keine externen Abhängigkeiten.
 * Zustände: offline (leer/dunkel) · idle (Gold) · working (Magenta)
 * "Leer bis verbunden": bei offline sind fast keine Knoten sichtbar; beim ersten
 * Verbinden wächst das Netz per Boot-up-Animation herein.
 * Hirn-Segmente: jeder Knoten gehört zu einer Domäne (inbox/research/content/ops);
 * läuft ein Task einer Domäne, leuchtet nur DIESES Segment auf.
 */
(function () {
  const RGB = {
    offline: "82,82,91",       // Zinc – dezent
    idle:    "52,211,153",     // Emerald (Akzent)
    working: "96,165,250",     // Info-Blau
    scan:    "251,191,36",     // Amber
  };
  // Domänen im Uhrzeigersinn -> Winkelsektoren
  const DOMAINS = ["inbox", "research", "content", "ops"];

  class Brain {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.state = "offline";
      this.activeDomain = null;
      this.boot = 0;
      this.pulse = 0;
      this.nodes = [];
      this.t = 0;
      this._build(160);
      this._resize();
      window.addEventListener("resize", () => this._resize());
      requestAnimationFrame(() => this._loop());
    }

    setState(state) { if (RGB[state]) this.state = state; }
    setActiveDomain(domain) { this.activeDomain = domain || null; }

    _build(n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.62);
        const sector = Math.floor(((a / (Math.PI * 2)) % 1) * DOMAINS.length);
        this.nodes.push({
          rx: r * Math.cos(a), ry: r * Math.sin(a), br: r,
          ph: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 0.9,
          order: Math.random(),
          domain: DOMAINS[sector],
        });
      }
      this.nodes.sort((a, b) => a.order - b.order);
    }

    _resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = w; this.H = h; this.cx = w / 2; this.cy = h / 2;
      this.scale = Math.min(w, h) * 0.42;
    }

    // Farbe + Intensität eines Knotens abhängig von Zustand/Domäne
    _nodeStyle(node, base) {
      if (this.state !== "working") return { rgb: RGB[this.state], boost: 1 };
      // Working: aktives Segment leuchtet magenta, Rest bleibt schwach gold
      if (this.activeDomain && node.domain !== this.activeDomain) {
        return { rgb: RGB.idle, boost: 0.28 };
      }
      return { rgb: RGB.working, boost: 1 };
    }

    _loop() {
      const dt = 0.016;
      this.t += dt;
      const target = this.state === "offline" ? 0 : 1;
      this.boot += (target - this.boot) * 0.045;
      if (this.state === "working") this.pulse += dt * 1.6;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);

      const visible = Math.floor(this.nodes.length * this.boot);
      const breath = 1 + Math.sin(this.t * 0.8) * 0.02;
      const rot = this.t * 0.05;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);

      const pts = [];
      for (let i = 0; i < visible; i++) {
        const nd = this.nodes[i];
        const wob = Math.sin(this.t * nd.sp + nd.ph) * 0.015;
        const rx = nd.rx + wob, ry = nd.ry + wob;
        pts.push({
          x: (rx * cosR - ry * sinR) * this.scale * breath + this.cx,
          y: (rx * sinR + ry * cosR) * this.scale * breath + this.cy,
          r: nd.br, node: nd,
        });
      }

      // Kanten
      const maxD = this.scale * 0.16;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD * maxD) continue;
          const s = this._nodeStyle(pts[i].node);
          let a = (1 - Math.sqrt(d2) / maxD) * 0.32 * this.boot * s.boost;
          if (this.state === "working" && s.boost === 1) {
            const wave = Math.sin(this.pulse * 3 - pts[i].r * 6);
            a *= 0.6 + 0.6 * Math.max(0, wave);
          }
          ctx.strokeStyle = `rgba(${s.rgb},${a})`;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }

      // Knoten
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const s = this._nodeStyle(p.node);
        const glow = 0.5 + 0.5 * Math.sin(this.t * 1.4 + i);
        let size = 1.3 + (1 - p.r) * 1.8;
        let alpha = (0.5 + glow * 0.5) * this.boot * s.boost;
        if (this.state === "working" && s.boost === 1) {
          const wave = Math.sin(this.pulse * 3 - p.r * 6);
          alpha *= 0.6 + 0.7 * Math.max(0, wave);
          size *= 1 + 0.4 * Math.max(0, wave);
        }
        ctx.fillStyle = `rgba(${s.rgb},${Math.min(1, alpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Kern-Schein
      if (this.boot > 0.02) {
        const rgb = this.state === "working" ? RGB.working : RGB[this.state];
        const core = this.state === "working" ? 0.14 : 0.08;
        const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.scale * 0.9);
        g.addColorStop(0, `rgba(${rgb},${core * this.boot})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }

      requestAnimationFrame(() => this._loop());
    }
  }

  window.Brain = Brain;
})();
