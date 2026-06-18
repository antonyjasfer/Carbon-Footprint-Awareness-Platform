/**
 * @module world
 * @description Living World — HTML5 Canvas animated environment that
 *  morphs in real-time based on the user's World Health Score (0–100).
 *
 *  Score 90–100 → pristine blue sky, lush trees, crystal river, birds
 *  Score 60–89  → mild haze, yellowing, light clouds
 *  Score 30–59  → overcast, sparse trees, murky water, smoke
 *  Score 0–29   → dark sky, dead trees, toxic river, heavy pollution
 */

import { prefersReducedMotion } from './accessibility.js';

// ─────────────────────────────────────────────────────────────────────────────
// Colour interpolation helpers
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}
function rgb({ r, g, b }) { return `rgb(${r},${g},${b})`; }
function rgba({ r, g, b }, a) { return `rgba(${r},${g},${b},${a})`; }

// ─────────────────────────────────────────────────────────────────────────────
// Palette anchors (clean → polluted)
// ─────────────────────────────────────────────────────────────────────────────

const SKY_TOP_CLEAN     = { r: 30,  g: 120, b: 220 };
const SKY_TOP_POLLUTED  = { r: 55,  g: 45,  b: 40  };
const SKY_BOT_CLEAN     = { r: 120, g: 195, b: 245 };
const SKY_BOT_POLLUTED  = { r: 100, g: 80,  b: 65  };

const GROUND_CLEAN      = { r: 60,  g: 145, b: 55  };
const GROUND_POLLUTED   = { r: 85,  g: 75,  b: 50  };

const MOUNTAIN_CLEAN    = { r: 40,  g: 100, b: 40  };
const MOUNTAIN_POLLUTED = { r: 70,  g: 60,  b: 45  };

const RIVER_CLEAN       = { r: 50,  g: 160, b: 220 };
const RIVER_POLLUTED    = { r: 85,  g: 65,  b: 35  };

const TREE_CLEAN        = { r: 30,  g: 130, b: 40  };
const TREE_POLLUTED     = { r: 90,  g: 80,  b: 35  };

// ─────────────────────────────────────────────────────────────────────────────
// LivingWorld class
// ─────────────────────────────────────────────────────────────────────────────

export class LivingWorld {
  /**
   * @param {string} canvasId - id of <canvas> element
   */
  constructor(canvasId) {
    this.canvas  = document.getElementById(canvasId);
    this.ctx     = this.canvas?.getContext('2d');
    this.health  = 80;          // current (animated) 0–100
    this.target  = 80;          // target health score
    this.time    = 0;           // animation clock
    this.frame   = null;        // rAF handle
    this.clouds  = this._initClouds();
    this.birds   = this._initBirds();
    this.smoke   = this._initSmoke();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    if (this.canvas) {
      this._resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
      this._resize();
    }
  }

  /** Update target health score (0–100). */
  setHealth(score) {
    this.target = Math.max(0, Math.min(100, score));
  }

  /** Begin animation loop. */
  start() {
    if (!this.ctx) return;
    const tick = () => {
      this._update();
      this._draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Stop animation loop. */
  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  // ── Init helpers ─────────────────────────────────────────────────────────

  _initClouds() {
    return Array.from({ length: 7 }, (_, i) => ({
      x:     (i * 180 + Math.random() * 100) % 1400,
      y:     20 + Math.random() * 80,
      w:     90 + Math.random() * 80,
      h:     30 + Math.random() * 25,
      speed: 0.15 + Math.random() * 0.25,
    }));
  }

  _initBirds() {
    return Array.from({ length: 6 }, (_, i) => ({
      x:     100 + i * 180 + Math.random() * 60,
      y:     60  + Math.random() * 80,
      speed: 0.6 + Math.random() * 0.4,
      flap:  Math.random() * Math.PI * 2,
    }));
  }

  _initSmoke() {
    // Three smoke stacks
    return Array.from({ length: 12 }, (_, i) => ({
      stack: i % 3,
      x:     0,
      y:     0,
      vy:    -(0.4 + Math.random() * 0.4),
      vx:    (Math.random() - 0.5) * 0.2,
      life:  Math.random(),      // 0–1 lifetime
      size:  4 + Math.random() * 6,
      alpha: 0.6 + Math.random() * 0.3,
    }));
  }

  // ── Update ───────────────────────────────────────────────────────────────

  _update() {
    if (!prefersReducedMotion) {
      this.time   += 0.008;
      this.health += (this.target - this.health) * 0.018; // smooth chase
    } else {
      this.health = this.target;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    const pollution = 1 - this.health / 100; // 0 = clean, 1 = dirty

    // Move clouds (faster when polluted)
    for (const c of this.clouds) {
      c.x += c.speed * (1 + pollution * 0.5);
      if (c.x > w + c.w) c.x = -c.w;
    }

    // Move birds (only visible when health > 40)
    for (const b of this.birds) {
      b.x += b.speed;
      b.flap += 0.15;
      if (b.x > w + 20) b.x = -20;
    }

    // Animate smoke particles
    if (pollution > 0.4) {
      for (const p of this.smoke) {
        p.life += 0.008;
        if (p.life >= 1) {
          p.life = 0;
          // Reset to stack position
          const stackX = this._smokeStackX(p.stack, w);
          p.x = stackX;
          p.y = h * 0.57 - 10;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = -(0.3 + Math.random() * 0.5);
        }
        p.x += p.vx;
        p.y += p.vy;
      }
    }
  }

  _smokeStackX(idx, w) {
    const positions = [w * 0.63, w * 0.69, w * 0.75];
    return positions[idx] ?? w * 0.65;
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  _draw() {
    const { ctx, canvas, health, time } = this;
    const w = canvas.width, h = canvas.height;
    const t = 1 - health / 100; // pollution factor

    ctx.clearRect(0, 0, w, h);

    this._drawSky(w, h, t);
    this._drawSun(w, h, t, time);
    this._drawClouds(w, h, t);
    this._drawMountains(w, h, t);
    this._drawGround(w, h, t);
    this._drawRiver(w, h, t, time);
    this._drawCity(w, h, t);
    this._drawSmoke(w, h, t);
    this._drawTrees(w, h, t, time);
    if (health > 40) this._drawBirds(w, h, t);
    this._drawHUD(w, h);
  }

  _drawSky(w, h, t) {
    const topC = lerpColor(SKY_TOP_CLEAN, SKY_TOP_POLLUTED, t);
    const botC = lerpColor(SKY_BOT_CLEAN, SKY_BOT_POLLUTED, t);
    const grad = this.ctx.createLinearGradient(0, 0, 0, h * 0.55);
    grad.addColorStop(0, rgb(topC));
    grad.addColorStop(1, rgb(botC));
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h * 0.55);
  }

  _drawSun(w, h, t, time) {
    const ctx = this.ctx;
    // Sun position oscillates gently
    const sunX = w * 0.75 + Math.sin(time * 0.3) * w * 0.05;
    const sunY = h * 0.12 + Math.cos(time * 0.2) * h * 0.03;
    const sunR = Math.max(20, w * 0.035);
    const sunAlpha = Math.max(0.1, 1 - t * 1.2);

    // Glow
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
    glow.addColorStop(0, `rgba(255, 240, 100, ${sunAlpha * 0.4})`);
    glow.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
    ctx.fill();

    // Sun disc
    ctx.fillStyle = `rgba(255, 235, 80, ${sunAlpha})`;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawClouds(w, h, t) {
    const ctx = this.ctx;
    const cloudColor = lerpColor({ r: 240, g: 245, b: 255 }, { r: 140, g: 120, b: 100 }, t);
    const alpha = 0.7 + t * 0.25;

    for (const c of this.clouds) {
      ctx.fillStyle = rgba(cloudColor, alpha);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.w * 0.2, c.y + c.h * 0.1, c.w * 0.35, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.2, c.y + c.h * 0.15, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMountains(w, h, t) {
    const ctx = this.ctx;
    const mtnC = lerpColor(MOUNTAIN_CLEAN, MOUNTAIN_POLLUTED, t);

    const drawMtn = (x, peakY, wBase, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - wBase / 2, h * 0.56);
      ctx.lineTo(x, peakY);
      ctx.lineTo(x + wBase / 2, h * 0.56);
      ctx.closePath();
      ctx.fill();
    };

    // Back mountains (darker)
    const backC = rgb(lerpColor(mtnC, { r: 20, g: 60, b: 20 }, 0.3));
    drawMtn(w * 0.1,  h * 0.3, w * 0.28, backC);
    drawMtn(w * 0.35, h * 0.28, w * 0.3, backC);

    // Front mountains
    drawMtn(w * 0.05, h * 0.38, w * 0.22, rgb(mtnC));
    drawMtn(w * 0.28, h * 0.35, w * 0.25, rgb(mtnC));

    // Snow caps (only when healthy)
    if (t < 0.4) {
      const snowAlpha = 1 - t / 0.4;
      ctx.fillStyle = `rgba(255,255,255,${snowAlpha * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(w * 0.05, h * 0.38);
      ctx.lineTo(w * 0.05 - w * 0.025, h * 0.38 + h * 0.04);
      ctx.lineTo(w * 0.05 + w * 0.025, h * 0.38 + h * 0.04);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawGround(w, h, t) {
    const ctx = this.ctx;
    const gndC = lerpColor(GROUND_CLEAN, GROUND_POLLUTED, t);
    const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    grad.addColorStop(0, rgb(gndC));
    grad.addColorStop(1, rgb(lerpColor(gndC, { r: 40, g: 35, b: 25 }, 0.4)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }

  _drawRiver(w, h, t, time) {
    const ctx = this.ctx;
    const riverC = lerpColor(RIVER_CLEAN, RIVER_POLLUTED, t);
    const riverY = h * 0.63;
    const riverH = h * 0.1;

    // River body
    ctx.fillStyle = rgba(riverC, 0.85);
    ctx.beginPath();
    ctx.moveTo(0, riverY);
    ctx.lineTo(w * 0.35, riverY + riverH * 0.2);
    ctx.lineTo(w * 0.65, riverY - riverH * 0.1);
    ctx.lineTo(w, riverY + riverH * 0.15);
    ctx.lineTo(w, riverY + riverH);
    ctx.lineTo(0, riverY + riverH);
    ctx.closePath();
    ctx.fill();

    // Ripple highlights (only when clean)
    if (t < 0.6) {
      const rippleAlpha = (1 - t / 0.6) * 0.4;
      ctx.strokeStyle = `rgba(255,255,255,${rippleAlpha})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const rx = (w * 0.1 + i * w * 0.22 + Math.sin(time * 2 + i) * 12) % w;
        ctx.beginPath();
        ctx.ellipse(rx, riverY + riverH * 0.4, 18, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawCity(w, h, t) {
    const ctx = this.ctx;
    const buildingC  = lerpColor({ r: 60, g: 70, b: 90 }, { r: 50, g: 45, b: 40 }, t);
    const windowC    = lerpColor({ r: 255, g: 240, b: 150 }, { r: 100, g: 80, b: 60 }, t);

    const buildings = [
      { x: w * 0.55, w: w * 0.06, h: h * 0.14 },
      { x: w * 0.62, w: w * 0.07, h: h * 0.19 },
      { x: w * 0.70, w: w * 0.05, h: h * 0.12 },
      { x: w * 0.76, w: w * 0.06, h: h * 0.16 },
      { x: w * 0.83, w: w * 0.05, h: h * 0.1  },
      { x: w * 0.89, w: w * 0.07, h: h * 0.22 },
      { x: w * 0.97, w: w * 0.05, h: h * 0.13 },
    ];

    const groundY = h * 0.56;

    for (const b of buildings) {
      // Building body
      ctx.fillStyle = rgb(buildingC);
      ctx.fillRect(b.x, groundY - b.h, b.w, b.h);

      // Windows (2×3 grid)
      ctx.fillStyle = rgba(windowC, 0.8);
      const cols = 2, rows = 3;
      const cellW = b.w / (cols + 1);
      const cellH = b.h / (rows + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(
            b.x + cellW * (c + 0.5) - 2,
            groundY - b.h + cellH * (r + 0.5) - 3,
            4, 5
          );
        }
      }
    }

    // Smoke stacks (only when polluted)
    if (t > 0.3) {
      ctx.fillStyle = rgb(lerpColor({ r: 70, g: 70, b: 80 }, { r: 60, g: 55, b: 50 }, t));
      const stacks = [w * 0.63, w * 0.69, w * 0.75];
      for (const sx of stacks) {
        ctx.fillRect(sx - 3, groundY - h * 0.23, 6, h * 0.07);
      }
    }
  }

  _drawSmoke(w, h, t) {
    if (t <= 0.3) return;
    const ctx     = this.ctx;
    const alpha   = (t - 0.3) / 0.7;

    for (const p of this.smoke) {
      const age = p.life; // 0–1
      const a   = alpha * p.alpha * (1 - age) * 0.7;
      const sz  = p.size * (1 + age * 2);
      ctx.fillStyle = `rgba(80,70,60,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawTrees(w, h, t, time) {
    const ctx = this.ctx;
    const groundY = h * 0.56;
    const treeCount = Math.round(lerp(1, 8, 1 - t)); // 1 dead tree → 8 lush trees

    const positions = [
      w * 0.04, w * 0.12, w * 0.20, w * 0.45, w * 0.50,
      w * 0.53, w * 0.95, w * 0.98,
    ];

    for (let i = 0; i < Math.min(treeCount + 2, positions.length); i++) {
      const alive = i < treeCount;
      const sway  = prefersReducedMotion ? 0 : Math.sin(time * 0.8 + i * 1.3) * 2;
      this._drawTree(ctx, positions[i], groundY, h, t, alive, sway);
    }
  }

  _drawTree(ctx, x, groundY, h, t, alive, sway) {
    const trunkH = h * 0.07;
    const trunkW = h * 0.012;
    const foliageR = h * 0.065;

    // Trunk
    const trunkC = alive
      ? lerpColor({ r: 101, g: 67, b: 33 }, { r: 80, g: 60, b: 40 }, t)
      : { r: 60, g: 50, b: 35 };
    ctx.fillStyle = rgb(trunkC);
    ctx.fillRect(x - trunkW / 2 + sway * 0.3, groundY - trunkH, trunkW, trunkH);

    if (!alive) {
      // Bare branches
      ctx.strokeStyle = rgb(trunkC);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, groundY - trunkH);
      ctx.lineTo(x - foliageR * 0.5 + sway, groundY - trunkH - foliageR * 0.6);
      ctx.moveTo(x, groundY - trunkH * 0.7);
      ctx.lineTo(x + foliageR * 0.4 + sway, groundY - trunkH - foliageR * 0.3);
      ctx.stroke();
      return;
    }

    // Foliage (3 layered circles)
    const leafC = lerpColor(TREE_CLEAN, TREE_POLLUTED, t);
    const leafDark = lerpColor(
      { r: TREE_CLEAN.r - 20, g: TREE_CLEAN.g - 20, b: TREE_CLEAN.b },
      { r: TREE_POLLUTED.r - 10, g: TREE_POLLUTED.g - 10, b: TREE_POLLUTED.b },
      t
    );

    ctx.fillStyle = rgb(leafDark);
    ctx.beginPath();
    ctx.arc(x + sway * 0.5, groundY - trunkH - foliageR * 0.5, foliageR * 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgb(leafC);
    ctx.beginPath();
    ctx.arc(x + sway, groundY - trunkH - foliageR * 0.8, foliageR * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba(lerpColor(leafC, { r: 200, g: 230, b: 180 }, 0.3), 0.7);
    ctx.beginPath();
    ctx.arc(x + sway * 1.2, groundY - trunkH - foliageR * 1.0, foliageR * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBirds(w, h, t) {
    const ctx = this.ctx;
    const alpha = Math.max(0, (this.health - 40) / 60);
    ctx.strokeStyle = `rgba(30,30,30,${alpha * 0.7})`;
    ctx.lineWidth = 1.5;

    for (const b of this.birds) {
      const wingAngle = Math.sin(b.flap) * 0.4;
      ctx.beginPath();
      ctx.moveTo(b.x - 7, b.y + Math.sin(wingAngle) * 4);
      ctx.quadraticCurveTo(b.x, b.y - 3, b.x + 7, b.y + Math.sin(wingAngle) * 4);
      ctx.stroke();
    }
  }

  _drawHUD(w, h) {
    const ctx   = this.ctx;
    const score = Math.round(this.health);

    // Health bar
    const barW = Math.min(180, w * 0.25);
    const barH = 6;
    const barX = w - barW - 16;
    const barY = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 24, 6);
    ctx.fill();

    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    // Fill
    const barColor = score > 60 ? '#22c55e' : score > 30 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = barColor;
    ctx.roundRect(barX, barY, barW * (score / 100), barH, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.max(10, w * 0.012)}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`🌍 Planet Health: ${score}%`, barX, barY + barH + 14);
  }

  // ── Resize ───────────────────────────────────────────────────────────────

  _resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width  = parent.clientWidth  || 800;
    this.canvas.height = parent.clientHeight || 380;
  }
}
