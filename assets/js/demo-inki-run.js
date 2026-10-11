/* Inki Run — browser demo.
   The runner runs by himself and never jumps. Draw lines to get him past holes (bridges) and rocks
   (ramps that start on the ground). Time slows while you draw. Every line costs ✎1; each obstacle
   cleared gives one back. */
(() => {
  const host = document.querySelector("[data-ir-demo]");
  if (!host) return;
  const stage = host.querySelector(".demo-stage");
  const canvas = stage.querySelector("canvas");
  const overlay = host.querySelector("[data-overlay]");
  const ctx = canvas.getContext("2d");

  const LANG = ["fr", "es"].includes((document.documentElement.lang || "").slice(0, 2)) ? document.documentElement.lang.slice(0, 2) : "en";
  const TX = {
    en: {
      tag: "Inki Run · Demo", title: "Draw the way",
      intro: "Your runner never jumps. Draw a <b>bridge</b> over each hole and a <b>ramp</b> over each rock. Time slows down while you draw.",
      start: "Start running", again: "Run again", best: "New best", over: "Run over", crash: "Crash!", fell: "He fell in!",
      score: (m, b) => `${m} m · Best ${b} m`,
      tipRock: "Start ramps on the ground, before the rock, then go up and over.",
      tipHole: "Draw from edge to edge, and start a little before the hole.",
      bridge: "DRAW A BRIDGE", ramp: "DRAW A RAMP", slow: "TIME SLOWED · KEEP DRAWING", noInk: "OUT OF INK · CLEAR AN OBSTACLE", hi: "HI",
    },
    fr: {
      tag: "Inki Run · Démo", title: "Trace la voie",
      intro: "Ton coureur ne saute jamais. Trace un <b>pont</b> au-dessus de chaque trou et une <b>rampe</b> par-dessus chaque rocher. Le temps ralentit pendant que tu dessines.",
      start: "C'est parti", again: "Recommencer", best: "Nouveau record", over: "Fin de la course", crash: "Aïe\u202f!", fell: "Il est tombé\u202f!",
      score: (m, b) => `${m} m · Record ${b} m`,
      tipRock: "Commence tes rampes au sol, avant le rocher, puis monte par-dessus.",
      tipHole: "Trace d'un bord à l'autre, en commençant un peu avant le trou.",
      bridge: "TRACE UN PONT", ramp: "TRACE UNE RAMPE", slow: "TEMPS RALENTI · CONTINUE", noInk: "PLUS D'ENCRE · PASSE UN OBSTACLE", hi: "REC",
    },
    es: {
      tag: "Inki Run · Demo", title: "Dibuja el camino",
      intro: "Tu corredor nunca salta. Dibuja un <b>puente</b> sobre cada agujero y una <b>rampa</b> sobre cada roca. El tiempo va más lento mientras dibujas.",
      start: "A correr", again: "Correr otra vez", best: "Nuevo récord", over: "Fin de la carrera", crash: "¡Choque!", fell: "¡Se cayó!",
      score: (m, b) => `${m} m · Récord ${b} m`,
      tipRock: "Empieza las rampas en el suelo, antes de la roca, y pasa por encima.",
      tipHole: "Dibuja de borde a borde, empezando un poco antes del agujero.",
      bridge: "DIBUJA UN PUENTE", ramp: "DIBUJA UNA RAMPA", slow: "TIEMPO LENTO · SIGUE DIBUJANDO", noInk: "SIN TINTA · SUPERA UN OBSTÁCULO", hi: "MÁX",
    },
  }[LANG];
  const H = 300, GROUND = 214;
  let RUN_AT = 0.24;
  const STEP = 22, SNAP = 7, GRAVITY = 1500, MAX_SLOPE = 1.9;
  const START_INK = 5, MAX_INK = 9, MAX_LINE = 560;
  const FONT = '800 14px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const SMALL = '800 11px "JetBrains Mono", ui-monospace, Menlo, monospace';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

  let W = 720, scale = 1, dpr = 1;
  let col = { paper: "#fffefb", ink: "#1b1b1d", faint: "#6b6861" };
  const readColors = () => {
    const cs = getComputedStyle(host);
    col = {
      paper: cs.getPropertyValue("--demo-paper").trim() || col.paper,
      ink: cs.getPropertyValue("--demo-ink").trim() || col.ink,
      faint: cs.getPropertyValue("--demo-faint").trim() || col.faint,
    };
  };

  // ---------- World ----------
  let state = "intro";
  let pieces, openStart, genX, rocks, lines, obstacles, clouds, popups;
  let runner, camX, ink, ts, drawing, current, inkFlash, dyingT, reason;
  let best = Number(store.get("favalia.inkirun.best") || 0);
  const buf = [];

  function reset() {
    pieces = []; openStart = -600; genX = 560;
    rocks = []; lines = []; obstacles = []; popups = [];
    clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 230 + rand(0, 90), y: rand(30, 104), s: rand(0.75, 1.2) }));
    runner = { x: 0, y: GROUND, vy: 0, grounded: true, phase: 0, falling: false };
    camX = -W * RUN_AT; ink = START_INK; ts = 1; drawing = false; current = null; inkFlash = 0; dyingT = 0; reason = "";
    generate();
  }

  function generate() {
    while (genX < camX + W + 700) {
      const n = obstacles.length;
      const diff = Math.min(1, genX / 9000);
      const type = n === 0 ? "hole" : n === 1 ? "rock" : Math.random() < 0.58 ? "hole" : "rock";
      const gap = rand(340, 470) - diff * 95;
      if (type === "hole") {
        const w = rand(74, 100) + diff * 52;
        pieces.push({ x0: openStart, x1: genX });
        obstacles.push({ type, x0: genX, x1: genX + w, guide: n < 2 });
        openStart = genX + w;
        genX += w + gap;
      } else {
        const w = rand(34, 50), h = rand(34, 44) + diff * 10;
        rocks.push({ x: genX, w, h });
        obstacles.push({ type, x0: genX, x1: genX + w, h, guide: n < 2 });
        genX += w + gap;
      }
    }
    const cut = camX - 160;
    pieces = pieces.filter((p) => p.x1 > cut);
    rocks = rocks.filter((r) => r.x + r.w > cut);
    obstacles = obstacles.filter((o) => o.x1 > cut);
    lines = lines.filter((L) => L === current || L.maxX > cut);
  }

  const groundAt = (x) => {
    if (x >= openStart) return true;
    for (const p of pieces) if (x >= p.x0 && x <= p.x1) return true;
    return false;
  };

  function surfaces(x) {
    buf.length = 0;
    if (groundAt(x)) buf.push(GROUND);
    for (const r of rocks) if (x >= r.x - 1 && x <= r.x + r.w + 1) buf.push(GROUND - r.h);
    for (const L of lines) {
      const p = L.pts;
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i];
        const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
        if (x < lo || x > hi || hi - lo < 0.5) continue;
        const k = (b.y - a.y) / (b.x - a.x);
        if (Math.abs(k) > MAX_SLOPE) continue;
        buf.push(a.y + k * (x - a.x));
      }
    }
    return buf;
  }

  function step(h) {
    if (state === "dying") {
      dyingT += h;
      if (runner.falling) { runner.vy += GRAVITY * h; runner.y += runner.vy * h; }
      if (dyingT > 0.9) gameOver();
      return;
    }
    // Narrow screens see less road ahead, so the runner starts slower there.
    const speed = (160 + Math.min(150, runner.x * 0.018)) * Math.max(0.72, Math.min(1, W / 700));
    runner.x += speed * h;
    runner.phase += speed * h * 0.055;

    const S = surfaces(runner.x);
    if (runner.grounded) {
      let s = Infinity;
      for (const y of S) if (y >= runner.y - STEP && y <= runner.y + SNAP && y < s) s = y;
      if (s < Infinity) runner.y = s;
      else { runner.grounded = false; runner.vy = 0; }
    }
    if (!runner.grounded) {
      runner.vy += GRAVITY * h;
      const ny = runner.y + runner.vy * h;
      let land = Infinity;
      for (const y of S) if (y >= runner.y - 1 && y <= ny + 1 && y < land) land = y;
      if (land < Infinity) { runner.y = land; runner.vy = 0; runner.grounded = true; }
      else runner.y = ny;
    }

    // Only the feet decide.
    for (const r of rocks) {
      if (runner.x + 5 > r.x && runner.x - 5 < r.x + r.w && runner.y > GROUND - r.h + 5) return die("rock");
    }
    if (runner.y > GROUND + 5 && groundAt(runner.x + 3)) return die("wall");
    if (!runner.grounded && runner.y > GROUND + 14) return die("hole");

    for (const o of obstacles) {
      if (!o.passed && runner.x > o.x1 + 8) {
        o.passed = true;
        if (ink < MAX_INK) { ink += 1; popups.push({ x: runner.x + 6, y: runner.y - 66, t: 0, text: "+1 ✎" }); }
      }
    }
  }

  function die(why) {
    reason = why;
    state = "dying";
    dyingT = 0;
    endStroke(true);
    runner.falling = why === "hole" || why === "wall";
    if (!runner.falling) popups.push({ x: runner.x + 4, y: runner.y - 30, t: 0, text: "✶", big: true });
  }

  function gameOver() {
    state = "over";
    const m = Math.floor(runner.x / 10);
    const isBest = m > best;
    if (isBest) { best = m; store.set("favalia.inkirun.best", String(best)); }
    const title = reason === "rock" ? TX.crash : TX.fell;
    const tip = reason === "rock" ? TX.tipRock : TX.tipHole;
    showOverlay(`
      <span class="tag">${isBest ? TX.best : TX.over}</span>
      <h3>${title}</h3>
      <p class="score">${TX.score(m, best)}</p>
      <p>${tip}</p>
      <button class="btn" type="button" data-start>${TX.again}</button>`);
  }

  // ---------- Input ----------
  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale + camX, y: (e.clientY - r.top) / scale };
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "run" || drawing) return;
    e.preventDefault();
    if (ink <= 0) { inkFlash = 1; return; }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    const p = toWorld(e);
    current = { pts: [p], len: 0, maxX: p.x };
    lines.push(current);
    drawing = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const co = e.getCoalescedEvents?.();
    for (const ev of co && co.length ? co : [e]) {
      const p = toWorld(ev), pts = current.pts, last = pts[pts.length - 1];
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 6) continue;
      pts.push(p);
      current.len += d;
      current.maxX = Math.max(current.maxX, p.x);
      if (current.len > MAX_LINE) { endStroke(); break; }
    }
  });
  const endStroke = (discard) => {
    if (!drawing) return;
    drawing = false;
    if (discard || current.pts.length < 2 || current.len < 14) {
      if (!discard) lines.splice(lines.indexOf(current), 1);
    } else {
      ink -= 1;
    }
    current = null;
  };
  canvas.addEventListener("pointerup", () => endStroke());
  canvas.addEventListener("pointercancel", () => endStroke());
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  overlay.addEventListener("click", (e) => { if (e.target.closest("[data-start]")) start(); });

  function start() {
    reset();
    state = "run";
    overlay.hidden = true;
    canvas.focus?.({ preventScroll: true });
  }
  function showOverlay(html) {
    overlay.innerHTML = `<div class="demo-card">${html}</div>`;
    overlay.hidden = false;
    overlay.querySelector("[data-start]")?.focus({ preventScroll: true });
  }

  // ---------- Drawing ----------
  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 70 * s, y);
    ctx.moveTo(x + 6 * s, y);
    ctx.arc(x + 18 * s, y - 6 * s, 11 * s, Math.PI * 0.95, Math.PI * 1.75);
    ctx.arc(x + 38 * s, y - 12 * s, 15 * s, Math.PI * 1.15, Math.PI * 1.9);
    ctx.arc(x + 58 * s, y - 6 * s, 10 * s, Math.PI * 1.25, Math.PI * 0.05);
    ctx.stroke();
  }

  function rock(r) {
    const x = r.x, w = r.w, top = GROUND - r.h, rad = Math.min(13, w / 3);
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, top + rad);
    ctx.quadraticCurveTo(x, top, x + rad, top);
    ctx.lineTo(x + w - rad, top);
    ctx.quadraticCurveTo(x + w, top, x + w, top + rad);
    ctx.lineTo(x + w, GROUND);
    ctx.fillStyle = col.paper;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.38, top + r.h * 0.5);
    ctx.lineTo(x + w * 0.5, top + r.h * 0.64);
    ctx.lineTo(x + w * 0.64, top + r.h * 0.44);
    ctx.stroke();
  }

  function runnerFigure(fx, fy) {
    const p = runner.phase;
    const air = !runner.grounded || state === "dying";
    const still = state === "intro";
    const hipX = fx, hipY = fy - 19, neckX = fx + 3, neckY = fy - 33;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const leg = (phi, spread) => {
      const th = still ? spread : air ? spread * 1.4 : Math.sin(phi) * 0.85;
      const bend = still ? 0.15 : air ? 0.9 : Math.max(0, Math.cos(phi)) * 1.15;
      const kx = hipX + 10 * Math.sin(th), ky = hipY + 10 * Math.cos(th);
      const sh = th - bend;
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(kx + 10 * Math.sin(sh), ky + 10 * Math.cos(sh));
    };
    leg(p, 0.35);
    leg(p + Math.PI, -0.3);
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(neckX, neckY);
    const arm = (phi, up) => {
      const sx = neckX - 0.5, sy = neckY + 3;
      const th = air ? up : still ? 0.25 * up : -Math.sin(phi) * 0.95;
      const ex = sx + 8 * Math.sin(th), ey = sy + 8 * Math.cos(th);
      const fa = air ? th + 0.6 : th + 1.5;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + 7 * Math.sin(fa), ey + 7 * Math.cos(fa) * (air ? 1 : -1));
    };
    arm(p, 2.6);
    arm(p + Math.PI, -2.4);
    ctx.stroke();
    // Head with a little cap.
    ctx.beginPath();
    ctx.arc(neckX + 2, neckY - 7.5, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = col.paper;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(neckX - 4, neckY - 11);
    ctx.lineTo(neckX + 12, neckY - 11.5);
    ctx.stroke();
  }

  function guide(o) {
    if (lines.some((L) => L.pts.length > 1 && L.maxX > o.x0 - 30 && L.pts[0].x < o.x1)) return;
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = col.faint;
    ctx.beginPath();
    if (o.type === "hole") {
      ctx.moveTo(o.x0 - 30, GROUND - 3);
      ctx.lineTo(o.x1 + 30, GROUND - 3);
    } else {
      ctx.moveTo(o.x0 - 96, GROUND - 1);
      ctx.lineTo(o.x0 - 4, GROUND - o.h - 10);
      ctx.lineTo(o.x1 + 22, GROUND - o.h - 10);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const lx = o.type === "hole" ? (o.x0 + o.x1) / 2 : o.x0 - 40;
    const ly = o.type === "hole" ? GROUND - 40 : GROUND - o.h - 42;
    label(lx, ly, o.type === "hole" ? TX.bridge : TX.ramp);
    ctx.restore();
  }

  function label(x, y, text) {
    ctx.font = SMALL;
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = col.ink;
    ctx.fillRect(x - w / 2, y - 12, w, 20);
    ctx.fillStyle = col.paper;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y - 1.5);
  }

  function render(dt) {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.fillStyle = col.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clouds (parallax)
    ctx.strokeStyle = col.faint;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    const span = W + 260;
    for (const c of clouds) {
      const sx = ((((c.x - camX * 0.3) % span) + span) % span) - 130;
      cloud(sx, c.y, c.s);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(-camX, 0);
    ctx.strokeStyle = col.ink;

    // Ground
    const vis0 = camX - 30, vis1 = camX + W + 30;
    const segs = pieces.map((p) => [p.x0, p.x1]).concat([[openStart, vis1 + 50]]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of segs) {
      if (b < vis0 || a > vis1) continue;
      ctx.moveTo(Math.max(a, vis0), GROUND);
      ctx.lineTo(Math.min(b, vis1), GROUND);
      if (a > vis0) { ctx.moveTo(a, GROUND); ctx.lineTo(a, GROUND + 22); }
      if (b < vis1) { ctx.moveTo(b, GROUND); ctx.lineTo(b, GROUND + 22); }
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(vis0 / 23) * 23; x < vis1; x += 23) {
      const r = hash(x), len = 3 + r * 11, dy = 14 + hash(x + 7) * 34;
      if (!groundAt(x) || !groundAt(x + len)) continue;
      ctx.moveTo(x, GROUND + dy);
      ctx.lineTo(x + len, GROUND + dy);
    }
    ctx.stroke();

    for (const r of rocks) if (r.x < vis1 && r.x + r.w > vis0) rock(r);
    if (state === "run" || state === "intro") for (const o of obstacles) if (o.guide && !o.passed && o.x0 < vis1) guide(o);

    // Lines
    ctx.strokeStyle = col.ink;
    for (const L of lines) {
      const p = L.pts;
      if (p.length < 2) continue;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
      const e = p[p.length - 1];
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col.ink;
      ctx.fill();
    }

    runnerFigure(runner.x, runner.y);

    // Popups
    for (const pu of popups) {
      pu.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - pu.t / 0.9);
      ctx.fillStyle = col.ink;
      ctx.font = pu.big ? '800 40px "JetBrains Mono", monospace' : SMALL;
      ctx.textAlign = "center";
      ctx.fillText(pu.text, pu.x, pu.y - pu.t * 34);
    }
    ctx.globalAlpha = 1;
    popups = popups.filter((p) => p.t < 0.9);
    ctx.restore();

    // HUD
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    inkFlash = Math.max(0, inkFlash - dt * 2);
    const flash = inkFlash > 0 && Math.floor(inkFlash * 8) % 2 === 0;
    ctx.fillStyle = flash ? col.ink : col.paper;
    ctx.fillRect(10, 10, 96, 30);
    ctx.lineWidth = 2;
    ctx.strokeStyle = col.ink;
    ctx.strokeRect(10, 10, 96, 30);
    ctx.fillStyle = flash ? col.paper : col.ink;
    ctx.fillText(`✎ ×${ink ?? START_INK}`, 20, 26);
    for (let i = 0; i < MAX_INK; i++) {
      ctx.fillStyle = col.ink;
      if (i < (ink ?? START_INK)) ctx.fillRect(68 + i * 4, 21, 2.5, 10);
    }
    const m = Math.max(0, Math.floor((runner?.x || 0) / 10));
    ctx.textAlign = "right";
    ctx.fillStyle = col.ink;
    ctx.fillText(`${TX.hi} ${String(best).padStart(5, "0")}  ${String(m).padStart(5, "0")}`, W - 14, 26);
    if (drawing) {
      ctx.textAlign = "center";
      label(W / 2, 28, TX.slow);
      ctx.strokeStyle = col.ink;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeRect(5, 5, W - 10, H - 10);
      ctx.setLineDash([]);
    }
    if (state === "run" && inkFlash > 0) label(W / 2, 62, TX.noInk);
  }

  // ---------- Loop ----------
  let last = 0, visible = true;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = t; return; }
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (state === "run" || state === "dying") {
      ts += ((drawing ? 0.3 : 1) - ts) * Math.min(1, dt * 10);
      const total = dt * ts;
      const n = Math.max(1, Math.ceil((total * 320) / 2));
      for (let i = 0; i < n && (state === "run" || state === "dying"); i++) step(total / n);
      camX += (runner.x - W * RUN_AT - camX) * (state === "dying" ? 0 : 1);
      generate();
    }
    render(dt);
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = r.height / H;
    W = r.width / scale;
    RUN_AT = W < 500 ? 0.16 : 0.24;
    if (state !== "run" && state !== "dying") camX = runner.x - W * RUN_AT;
  }

  readColors();
  addEventListener("themechange", readColors);
  reset();
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else addEventListener("resize", resize);
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  showOverlay(`
    <span class="tag">${TX.tag}</span>
    <h3>${TX.title}</h3>
    <p>${TX.intro}</p>
    <button class="btn" type="button" data-start>${TX.start}</button>`);
  requestAnimationFrame(frame);

  // Test hook: open the page with ?debug to inspect the demo from the console.
  if (/[?&]debug\b/.test(location.search)) {
    window.__inkiRun = {
      get state() { return state; }, get camX() { return camX; }, get W() { return W; }, get scale() { return scale; },
      get runner() { return runner; }, get obstacles() { return obstacles; }, get ink() { return ink; }, get lines() { return lines; },
    };
  }
})();
