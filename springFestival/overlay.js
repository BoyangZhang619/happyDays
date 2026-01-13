/* pageMask.js
 * PageMask: embed any webpage (iframe) and add a top overlay mask with effects.
 * Extensible via Effect plugins.
 */

class PageMask {
    /**
     * @param {Object} options
     * @param {HTMLElement|string} [options.mount=document.body] Mount container or selector
     * @param {string|null} [options.url=null] If set, create iframe to import webpage; if null, overlay current page.
     * @param {'embed'|'overlay'} [options.mode] auto: url ? 'embed' : 'overlay'
     * @param {number} [options.zIndex=999999]
     * @param {string} [options.maskColor='rgba(0,0,0,0.0)'] visual mask tint
     * @param {boolean} [options.pointerEvents=false] overlay captures pointer?
     * @param {Object} [options.effects] { snow: {...}, fireworks: {...} }
     */
    constructor(options = {}) {
        this.options = {
            mount: document.body,
            url: null,
            mode: options.url ? "embed" : "overlay",
            zIndex: 999999,
            maskColor: "rgba(0,0,0,0.0)",
            pointerEvents: false,
            effects: {},
            ...options,
        };

        this._effectsRegistry = new Map(); // name -> class
        this._effects = new Map(); // name -> instance
        this._enabled = new Set(); // enabled effect names

        // Register built-ins
        this.registerEffect("snow", SnowEffect);
        this.registerEffect("fireworks", FireworksEffect);

        // DOM + canvas
        this._raf = 0;
        this._last = 0;
        this._running = false;

        this._buildDOM();
        this._setupCanvas();
        this._bindResize();

        // Auto init effects from options
        const fx = this.options.effects || {};
        Object.keys(fx).forEach((name) => {
            this.addEffect(name, fx[name]);
            this.enable(name, true);
        });
    }

    registerEffect(name, EffectClass) {
        this._effectsRegistry.set(name, EffectClass);
        return this;
    }

    addEffect(name, config = {}) {
        const EffectClass = this._effectsRegistry.get(name);
        if (!EffectClass) throw new Error(`[PageMask] Effect not registered: ${name}`);

        // replace existing
        if (this._effects.has(name)) {
            this._effects.get(name).destroy?.();
            this._effects.delete(name);
            this._enabled.delete(name);
        }

        const instance = new EffectClass({
            mask: this,
            ctx: this._ctx,
            canvas: this._canvas,
            dpr: this._dpr,
            ...config,
        });

        this._effects.set(name, instance);
        return this;
    }

    removeEffect(name) {
        if (this._effects.has(name)) {
            this._effects.get(name).destroy?.();
            this._effects.delete(name);
        }
        this._enabled.delete(name);
        return this;
    }

    enable(name, on = true) {
        if (!this._effects.has(name)) this.addEffect(name, {});
        if (on) this._enabled.add(name);
        else this._enabled.delete(name);
        return this;
    }

    toggle(name) {
        const on = !this._enabled.has(name);
        return this.enable(name, on);
    }

    setMaskColor(color) {
        this.options.maskColor = color;
        if (this._overlay) this._overlay.style.background = color;
        return this;
    }

    setPointerEvents(enabled) {
        this.options.pointerEvents = !!enabled;
        if (this._overlay) this._overlay.style.pointerEvents = enabled ? "auto" : "none";
        return this;
    }

    setURL(url) {
        this.options.url = url;
        if (this._iframe) this._iframe.src = url;
        return this;
    }

    start() {
        if (this._running) return this;
        this._running = true;
        this._last = performance.now();
        this._tick(this._last);
        return this;
    }

    stop() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        return this;
    }

    destroy() {
        this.stop();
        window.removeEventListener("resize", this._onResize);

        // destroy effects
        for (const e of this._effects.values()) e.destroy?.();
        this._effects.clear();
        this._enabled.clear();

        // remove DOM
        this._root?.remove();
        this._root = null;
        this._overlay = null;
        this._canvas = null;
        this._ctx = null;
        this._iframe = null;

        return this;
    }

    // ---------- Internals ----------
    _buildDOM() {
        const mount =
            typeof this.options.mount === "string"
                ? document.querySelector(this.options.mount)
                : this.options.mount;

        if (!mount) throw new Error("[PageMask] mount not found");

        this._root = document.createElement("div");
        this._root.className = "pm-root";
        this._root.style.zIndex = String(this.options.zIndex);

        // Embed mode: iframe + overlay stacked inside root
        if (this.options.mode === "embed") {
            this._iframe = document.createElement("iframe");
            this._iframe.className = "pm-iframe";
            this._iframe.src = this.options.url || "about:blank";
            this._iframe.setAttribute("referrerpolicy", "no-referrer");
            this._iframe.setAttribute("loading", "lazy");
            this._root.appendChild(this._iframe);
        } else {
            this._root.classList.add("pm-overlay-mode");
        }

        this._overlay = document.createElement("div");
        this._overlay.className = "pm-overlay";
        this._overlay.style.background = this.options.maskColor;
        this._overlay.style.pointerEvents = this.options.pointerEvents ? "auto" : "none";

        this._canvas = document.createElement("canvas");
        this._canvas.className = "pm-canvas";

        this._overlay.appendChild(this._canvas);
        this._root.appendChild(this._overlay);
        mount.appendChild(this._root);
    }

    _setupCanvas() {
        this._ctx = this._canvas.getContext("2d", { alpha: true });

        const resize = () => {
            const rect = this._overlay.getBoundingClientRect();
            this._dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

            this._canvas.style.width = rect.width + "px";
            this._canvas.style.height = rect.height + "px";
            this._canvas.width = Math.floor(rect.width * this._dpr);
            this._canvas.height = Math.floor(rect.height * this._dpr);

            // let effects know
            for (const e of this._effects.values()) e.onResize?.(rect.width, rect.height, this._dpr);
        };

        this._resizeCanvas = resize;
        resize();
    }

    _bindResize() {
        this._onResize = () => this._resizeCanvas?.();
        window.addEventListener("resize", this._onResize, { passive: true });
    }

    _tick = (t) => {
        if (!this._running) return;

        const dt = Math.min(0.05, (t - this._last) / 1000); // clamp
        this._last = t;

        const w = this._canvas.width;
        const h = this._canvas.height;

        // Clear canvas
        this._ctx.clearRect(0, 0, w, h);

        // Update & draw enabled effects
        for (const name of this._enabled) {
            const e = this._effects.get(name);
            if (!e) continue;
            e.update?.(dt);
            e.draw?.();
        }

        this._raf = requestAnimationFrame(this._tick);
    };
}

/* ---------------- Effect Base ---------------- */
class EffectBase {
    constructor(cfg) {
        this.mask = cfg.mask;
        this.ctx = cfg.ctx;
        this.canvas = cfg.canvas;
        this.dpr = cfg.dpr || 1;

        // logical size in CSS pixels (we’ll store for convenience)
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
    }

    onResize(w, h, dpr) {
        this.width = w;
        this.height = h;
        this.dpr = dpr;
    }

    // update(dt), draw(), destroy()
}

/* ---------------- Snow Effect ---------------- */
class SnowEffect extends EffectBase {
    /**
     * @param {Object} cfg
     * @param {number} [cfg.intensity=1] 0.2~3  (controls count)
     * @param {number} [cfg.speed=1] fall speed multiplier
     * @param {number} [cfg.wind=0.3] horizontal drift multiplier
     * @param {number} [cfg.size=1] flake size multiplier
     * @param {number} [cfg.opacity=0.9]
     */
    constructor(cfg) {
        super(cfg);
        this.intensity = cfg.intensity ?? 1;
        this.speed = cfg.speed ?? 1;
        this.wind = cfg.wind ?? 0.3;
        this.size = cfg.size ?? 1;
        this.opacity = cfg.opacity ?? 0.9;

        this._time = 0;
        this._flakes = [];
        this.depth = {
            // depth=0(远) -> depth=1(近)
            size: [10, 34],        // 字号范围(px, CSS像素)
            speed: [18, 95],       // 下落速度范围(px/s)
            alpha: [0.25, 0.95],   // 透明度范围
            wind: [0.12, 0.55],    // 横向漂移强度范围
            sway: [4, 22],         // 左右摆动幅度范围(px)
        };

        this.snowChars = cfg.snowChars ?? ["❄", "❅", "❆", "✻", "✼", "✽"];
        this._reseed();
    }

    onResize(w, h, dpr) {
        super.onResize(w, h, dpr);
        this._reseed();
    }

    _reseed() {
        const count = Math.floor((this.width * this.height) / 35000 * this.intensity);
        this._flakes.length = 0;
        for (let i = 0; i < count; i++) this._flakes.push(this._spawn(true));
    }

    _spawn(randomY = false) {
        const pick = (arr) => arr[(Math.random() * arr.length) | 0];
        const lerp = (a, b, t) => a + (b - a) * t;

        // depth：远(0)~近(1)。用平方让“远处更多、近处少量”更自然
        const depth = Math.pow(Math.random(), 0.65); // 你可以改 0.5~1.2 调分布
        const char = pick(this.snowChars);

        const x = Math.random() * this.width;
        const y = randomY ? Math.random() * this.height : -20 - Math.random() * 80;

        const fontSize = lerp(this.depth.size[0], this.depth.size[1], depth) * this.size;
        const vyBase = lerp(this.depth.speed[0], this.depth.speed[1], depth) * this.speed;
        const alpha = lerp(this.depth.alpha[0], this.depth.alpha[1], depth) * this.opacity;

        const windMul = lerp(this.depth.wind[0], this.depth.wind[1], depth) * this.wind;
        const swayAmp = lerp(this.depth.sway[0], this.depth.sway[1], depth) * this.wind;

        const phase = Math.random() * Math.PI * 2;
        const rot = Math.random() * Math.PI * 2;
        const vr = (Math.random() - 0.5) * lerp(0.25, 1.0, depth); // 近处旋转更明显
        const seed = Math.random() * 1000;

        return { x, y, depth, char, fontSize, vyBase, alpha, windMul, swayAmp, phase, rot, vr, seed };
    }


    update(dt) {
        this._time += dt;

        for (const f of this._flakes) {
            // 下落
            f.y += f.vyBase * dt;

            // 横向：摆动 + 慢风（近处 windMul / swayAmp 更大）
            const sway = Math.sin(this._time * 1.2 + f.phase) * f.swayAmp;
            const drift = Math.sin((this._time + f.seed) * 0.25) * 10 * f.windMul;
            f.x += (sway + drift) * dt;

            // 旋转
            f.rot += f.vr * dt;

            // 到底重生
            if (f.y - f.fontSize > this.height + 40) {
                Object.assign(f, this._spawn(false));
            }

            // wrap
            if (f.x < -60) f.x = this.width + 60;
            if (f.x > this.width + 60) f.x = -60;
        }
    }


    draw() {
        const ctx = this.ctx;
        const dpr = this.dpr;

        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 可选：给雪花一点柔光（喜欢就留，不喜欢删）
        ctx.shadowColor = "rgba(255,255,255,0.25)";
        ctx.shadowBlur = 6 * dpr;

        for (const f of this._flakes) {
            const x = f.x * dpr;
            const y = f.y * dpr;
            const fontSize = Math.max(8, f.fontSize) * dpr;

            ctx.globalAlpha = f.alpha; // 分层透明度

            ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols",sans-serif`;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(f.rot);
            ctx.fillText(f.char, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

}

/* ---------------- Fireworks Effect ---------------- */
class FireworksEffect extends EffectBase {
    /**
     * @param {Object} cfg
     * @param {number} [cfg.rate=0.6] launches per second
     * @param {number} [cfg.power=1] rocket speed multiplier
     * @param {number} [cfg.burst=1] particle count multiplier
     * @param {number} [cfg.gravity=1] gravity multiplier
     * @param {number} [cfg.opacity=0.9]
     */
    constructor(cfg) {
        super(cfg);

        this.rate = cfg.rate ?? 0.6;
        this.power = cfg.power ?? 1;
        this.burst = cfg.burst ?? 1;
        this.gravity = cfg.gravity ?? 1;
        this.opacity = cfg.opacity ?? 0.9;

        this._acc = 0;
        this._rockets = [];
        this._particles = [];
    }

    update(dt) {
        this._acc += dt;

        // spawn rockets
        const interval = 1 / Math.max(0.0001, this.rate);
        while (this._acc >= interval) {
            this._acc -= interval;
            this._rockets.push(this._newRocket());
        }

        // update rockets
        const g = 220 * this.gravity; // px/s^2
        for (let i = this._rockets.length - 1; i >= 0; i--) {
            const r = this._rockets[i];
            r.vy += g * dt * 0.12; // slight gravity
            r.x += r.vx * dt;
            r.y += r.vy * dt;

            // trail age
            r.life += dt;

            // explode condition
            if (r.vy > -80 * this.power || r.y < this.height * (0.18 + Math.random() * 0.25)) {
                this._explode(r);
                this._rockets.splice(i, 1);
            }
        }

        // update particles
        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            p.vx *= Math.pow(0.985, dt * 60);
            p.vy *= Math.pow(0.985, dt * 60);

            p.vy += g * dt * 0.35;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            p.age += dt;
            const t = p.age / p.ttl;
            p.alpha = Math.max(0, 1 - t);

            if (p.age >= p.ttl || p.alpha <= 0) this._particles.splice(i, 1);
        }

        // keep arrays bounded (safety)
        if (this._particles.length > 4000) this._particles.splice(0, this._particles.length - 4000);
    }

    draw() {
        const ctx = this.ctx;
        const dpr = this.dpr;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        // rockets
        for (const r of this._rockets) {
            // head
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.arc(r.x * dpr, r.y * dpr, 2.2 * dpr, 0, Math.PI * 2);
            ctx.fill();

            // small trail
            ctx.globalAlpha = this.opacity * 0.35;
            ctx.beginPath();
            ctx.arc((r.x - r.vx * 0.03) * dpr, (r.y - r.vy * 0.03) * dpr, 3.8 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = this.opacity;
        }

        // particles
        for (const p of this._particles) {
            ctx.globalAlpha = this.opacity * p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _newRocket() {
        const x = this.width * (0.15 + Math.random() * 0.7);
        const y = this.height + 10;

        const vx = (Math.random() - 0.5) * 60;
        const vy = -(520 + Math.random() * 380) * this.power;

        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue} 100% 65%)`;

        return { x, y, vx, vy, color, life: 0, hue };
    }

    _explode(rocket) {
        const count = Math.floor((80 + Math.random() * 90) * this.burst);
        const baseHue = rocket.hue;

        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 70 + Math.random() * 260;

            const hue = (baseHue + (Math.random() * 70 - 35) + 360) % 360;
            const color = `hsl(${hue} 100% 65%)`;

            this._particles.push({
                x: rocket.x,
                y: rocket.y,
                vx: Math.cos(a) * s + rocket.vx * 0.2,
                vy: Math.sin(a) * s + rocket.vy * 0.08,
                ttl: 0.9 + Math.random() * 0.8,
                age: 0,
                alpha: 1,
                size: 1.2 + Math.random() * 2.0,
                color,
            });
        }
    }
}
const mask = new PageMask({
    mode: "overlay",
    maskColor: "rgba(0,0,0,0.08)",
    effects: { snow: { intensity: 0.9 } },
});
mask.addEffect("snow", {
    intensity: 1.4,
    wind: 0.35,
    speed: 1.0,
    size: 1.0,
    opacity: 1.0,
    snowChars: ["❄", "❅", "❆", "✻", "✼", "✽", "❈", "✥"],
});
mask.addEffect("fireworks", {
    rate: 0.8,
    power: 1.0,
    explosion: {
        size: [50, 100],
        speed: [200, 400],
        particles: [100, 300],
    },
});
mask.enable("fireworks", true);
mask.enable("snow", true).start();