/* Inki Ace — browser demo.
   Hold and drag to fly; the guns fire on their own. Fuel drains, so catch the parachute cans.
   Three hits and you're shot down. Let go and time slows, then the game pauses. */
(() => {
  const host = document.querySelector("[data-ia-demo]");
  if (!host) return;
  const stage = host.querySelector(".demo-stage");
  const canvas = stage.querySelector("canvas");
  const overlay = host.querySelector("[data-overlay]");
  const ctx = canvas.getContext("2d");

  const W = 360, H = 600;
  const FONT = '800 13px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const SMALL = '800 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  let scale = 1, dpr = 1;
  let col = { paper: "#fffefb", ink: "#1b1b1d", faint: "#6b6861" };
  const readColors = () => {
    const cs = getComputedStyle(host);
    col = {
      paper: cs.getPropertyValue("--demo-paper").trim() || col.paper,
      ink: cs.getPropertyValue("--demo-ink").trim() || col.ink,
      faint: cs.getPropertyValue("--demo-faint").trim() || col.faint,
    };
  };

  // ---------- State ----------
  let state = "ready"; // ready | waiting | run | paused | over
  let holding = false, keyboardMode = false, letGo = 0, ts = 1, shake = 0;
  let player, bullets, enemies, shots, pickups, booms, splats, texts, clouds, waves;
  let t, score, kills, timers, reason;
  let best = Number(store.get("favalia.inkiace.best") || 0);
  const keys = new Set();
  const WEAPONS = { M: "TWIN NIB", S: "SPLATTER" };

  function reset() {
    player = { x: W / 2, y: H - 120, lives: 3, inv: 0, fuel: 100, weapon: "M", lv: 1, fireT: 0 };
    bullets = []; enemies = []; shots = []; pickups = []; booms = []; splats = []; texts = [];
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: rand(-20, W - 60), y: i * 140 + rand(0, 60), s: rand(0.8, 1.3) }));
    waves = Array.from({ length: 22 }, () => ({ x: rand(10, W - 10), y: rand(0, H) }));
    t = 0; score = 0; kills = 0; shake = 0; reason = "";
    timers = { wave: 0.8, heli: 7, bomber: 30, fuel: 7, crate: 12 };
    holding = false; letGo = 0; ts = 1;
  }

  // ---------- Spawning ----------
  function spawnWave() {
    const kind = Math.floor(Math.random() * 3);
    const vy = Math.min(165, 96 + t * 0.9);
    if (kind === 0) {
      const n = 4;
      for (let i = 0; i < n; i++) enemies.push(scout(W * (i + 0.5) / n, -24 - (i % 2) * 26, vy, 0));
    } else if (kind === 1) {
      const cx = rand(90, W - 90);
      [[0, 0], [-34, -26], [34, -26], [-68, -52], [68, -52]].forEach(([dx, dy]) => enemies.push(scout(cx + dx, -24 + dy, vy, 0)));
    } else {
      const cx = rand(80, W - 80);
      for (let i = 0; i < 5; i++) enemies.push(scout(cx, -24 - i * 34, vy * 0.9, 46, i * 0.6));
    }
  }
  const scout = (x, y, vy, amp, ph = 0) => ({ type: "scout", x, bx: x, y, vy, amp, ph, hp: 1, r: 14, fireT: rand(1.2, 3.4), hit: 0 });

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    player.fuel -= 2.2 * dt;
    if (player.fuel <= 0) { player.fuel = 0; return over("fuel"); }

    // Keyboard flying
    let kx = 0, ky = 0;
    if (keys.has("left")) kx -= 1;
    if (keys.has("right")) kx += 1;
    if (keys.has("up")) ky -= 1;
    if (keys.has("down")) ky += 1;
    if (kx || ky) {
      const k = (270 * dt) / Math.hypot(kx, ky);
      player.x = clamp(player.x + kx * k, 18, W - 18);
      player.y = clamp(player.y + ky * k, 70, H - 30);
    }

    // Guns
    player.fireT -= dt;
    if (player.fireT <= 0) {
      player.fireT = 0.12;
      const { x, y, weapon, lv } = player;
      if (weapon === "M") {
        const xs = lv === 1 ? [-5, 5] : lv === 2 ? [-11, -4, 4, 11] : [-15, -9, -3, 3, 9, 15];
        xs.forEach((dx) => bullets.push({ x: x + dx, y: y - 18, vx: dx * (lv > 1 ? 3 : 0), vy: -660 }));
      } else {
        const n = lv === 1 ? 3 : lv === 2 ? 5 : 7;
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 0.16;
          bullets.push({ x, y: y - 18, vx: Math.sin(a) * 620, vy: -Math.cos(a) * 620 });
        }
      }
    }
    for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    bullets = bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < W + 20);

    // Spawns
    for (const k in timers) timers[k] -= dt;
    if (timers.wave <= 0) { timers.wave = rand(1.7, 2.7) - Math.min(0.9, t * 0.012); spawnWave(); }
    if (timers.heli <= 0) {
      timers.heli = rand(8, 11);
      enemies.push({ type: "heli", x: rand(60, W - 60), y: -34, ty: rand(110, 210), vx: rand(-55, 55) || 40, hp: 5, r: 17, fireT: 1.3, life: 9, hit: 0 });
    }
    if (timers.bomber <= 0) {
      timers.bomber = 34;
      enemies.push({ type: "bomber", x: W / 2, bx: W / 2, y: -70, vy: 26, hp: 28, max: 28, r: 36, fireT: 2.2, hit: 0 });
    }
    if (timers.fuel <= 0) { timers.fuel = rand(7, 10); pickups.push({ type: "fuel", x: rand(50, W - 50), y: -40, vy: 58, ph: rand(0, 6) }); }
    if (timers.crate <= 0) {
      timers.crate = rand(13, 18);
      const letter = Math.random() < 0.6 ? (player.weapon === "M" ? "S" : "M") : player.weapon;
      pickups.push({ type: "crate", letter, x: rand(60, W - 60), y: -40, vy: 52, ph: rand(0, 6) });
    }

    // Enemies
    const aim = (e, speed) => {
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      shots.push({ x: e.x, y: e.y + 10, vx: (dx / d) * speed, vy: (dy / d) * speed });
    };
    const shotSpeed = Math.min(230, 150 + t * 0.8);
    for (const e of enemies) {
      e.hit = Math.max(0, e.hit - dt);
      if (e.type === "scout") {
        e.y += e.vy * dt;
        e.x = e.bx + Math.sin(t * 2.2 + e.ph) * e.amp;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > 40 && e.y < H * 0.55) { e.fireT = rand(2.2, 3.6); aim(e, shotSpeed); }
      } else if (e.type === "heli") {
        e.life -= dt;
        if (e.life <= 0) e.y -= 110 * dt;
        else if (e.y < e.ty) e.y += 90 * dt;
        else {
          e.x += e.vx * dt;
          if (e.x < 40 || e.x > W - 40) e.vx *= -1;
          e.fireT -= dt;
          if (e.fireT <= 0) { e.fireT = 1.5; aim(e, shotSpeed); }
        }
      } else {
        e.y += (e.y < 130 ? e.vy : 5) * dt;
        e.x = e.bx + Math.sin(t * 0.7) * 60;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > 40) {
          e.fireT = 1.9;
          [-0.38, -0.13, 0.13, 0.38].forEach((a) => shots.push({ x: e.x, y: e.y + 26, vx: Math.sin(a) * 150, vy: Math.cos(a) * 150 }));
        }
      }
    }
    enemies = enemies.filter((e) => e.y < H + 70 && e.y > -260 && e.hp > 0);
    for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
    shots = shots.filter((s) => s.y < H + 20 && s.y > -20 && s.x > -20 && s.x < W + 20);
    for (const p of pickups) { p.y += p.vy * dt; p.x += Math.sin(t * 1.6 + p.ph) * 22 * dt; }
    pickups = pickups.filter((p) => p.y < H + 40 && !p.got);

    // Hits on enemies
    for (const b of bullets) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < e.r * e.r) {
          b.y = -999;
          e.hp -= 1;
          e.hit = 0.06;
          if (e.hp <= 0) destroy(e);
          break;
        }
      }
    }

    // Hits on the player
    if (player.inv > 0) player.inv -= dt;
    for (const s of shots) {
      if ((s.x - player.x) ** 2 + (s.y - player.y) ** 2 < 13 * 13) { s.y = H + 99; hurt(); }
    }
    for (const e of enemies) {
      if (e.hp > 0 && (e.x - player.x) ** 2 + (e.y - player.y) ** 2 < (e.r + 9) ** 2) {
        hurt();
        e.hp -= 3;
        if (e.hp <= 0) destroy(e);
      }
    }
    for (const p of pickups) {
      if ((p.x - player.x) ** 2 + (p.y - player.y) ** 2 < 26 * 26) {
        p.got = true;
        if (p.type === "fuel") {
          player.fuel = Math.min(100, player.fuel + 38);
          score += 50;
          texts.push({ x: p.x, y: p.y, t: 0, s: "+FUEL" });
        } else {
          if (p.letter === player.weapon) player.lv = Math.min(3, player.lv + 1);
          else player.weapon = p.letter;
          texts.push({ x: p.x, y: p.y, t: 0, s: `${WEAPONS[player.weapon]} LV${player.lv}` });
        }
      }
    }

    // Effects
    for (const b of booms) b.t += dt;
    booms = booms.filter((b) => b.t < 0.45);
    for (const s of splats) s.y += 60 * dt;
    splats = splats.filter((s) => s.y < H + 40);
    for (const x of texts) x.t += dt;
    texts = texts.filter((x) => x.t < 1);
    for (const c of clouds) { c.y += 28 * dt; if (c.y > H + 40) { c.y = -60; c.x = rand(-20, W - 60); } }
    for (const w of waves) { w.y += 60 * dt; if (w.y > H + 10) { w.y = -10; w.x = rand(10, W - 10); } }
    shake = Math.max(0, shake - dt);
  }

  function destroy(e) {
    const pts = e.type === "bomber" ? 1500 : e.type === "heli" ? 300 : 100;
    score += pts;
    kills += 1;
    booms.push({ x: e.x, y: e.y, t: 0, r: e.type === "bomber" ? 46 : e.type === "heli" ? 28 : 22 });
    splats.push({ x: e.x + rand(-6, 6), y: e.y, r: e.r * 0.9, seed: Math.random() * 10 });
    texts.push({ x: e.x, y: e.y - 10, t: 0, s: "+" + pts });
    if (e.type !== "scout" && Math.random() < 0.6) pickups.push({ type: "fuel", x: e.x, y: e.y, vy: 58, ph: 0 });
  }

  function hurt() {
    if (player.inv > 0) return;
    player.lives -= 1;
    player.inv = 1.7;
    shake = 0.3;
    booms.push({ x: player.x, y: player.y, t: 0, r: 20 });
    if (player.lives <= 0) over("shot");
  }

  function over(why) {
    reason = why;
    state = "over";
    holding = false;
    const isBest = score > best;
    if (isBest) { best = score; store.set("favalia.inkiace.best", String(best)); }
    showOverlay(`
      <span class="tag">${isBest ? "New best" : "Mission over"}</span>
      <h3>${why === "fuel" ? "Out of fuel" : "Shot down"}</h3>
      <p class="score">${score.toLocaleString()} pts · ${kills} down · Best ${best.toLocaleString()}</p>
      <p>${why === "fuel" ? "Catch the parachute fuel cans. Helicopters and bombers often drop one." : "Keep moving: bullets are aimed at where you are, not where you're going."}</p>
      <button class="btn" type="button" data-fly>Fly again</button>`);
    setTouch();
  }

  // ---------- Input ----------
  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  let grab = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "run" && state !== "waiting" && state !== "paused") return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    const p = toWorld(e);
    grab = { dx: player.x - p.x, dy: player.y - p.y };
    holding = true;
    keyboardMode = false;
    if (state !== "run") go();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!holding || state !== "run") return;
    const p = toWorld(e);
    player.x = clamp(p.x + grab.dx, 18, W - 18);
    player.y = clamp(p.y + grab.dy, 70, H - 30);
  });
  const release = () => { holding = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const KEYMAP = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down" };
  let onScreen = false;
  addEventListener("keydown", (e) => {
    const k = KEYMAP[e.key];
    if (!k || !onScreen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
    if (state === "ready" || state === "over") return;
    e.preventDefault();
    keys.add(k);
    keyboardMode = true;
    if (state !== "run") go();
  });
  addEventListener("keyup", (e) => { const k = KEYMAP[e.key]; if (k) keys.delete(k); });
  addEventListener("blur", () => keys.clear());

  overlay.addEventListener("click", (e) => {
    if (e.target.closest("[data-fly]")) { reset(); wait(); }
  });

  function go() {
    state = "run";
    letGo = 0;
    overlay.hidden = true;
    setTouch();
  }
  function wait() {
    state = "waiting";
    overlay.innerHTML = '<span class="demo-pill">☝ Hold &amp; drag to fly</span>';
    overlay.classList.add("is-pass");
    overlay.hidden = false;
    setTouch();
  }
  function pause() {
    state = "paused";
    holding = false;
    overlay.innerHTML = '<span class="demo-pill">Paused · hold to fly on</span>';
    overlay.classList.add("is-pass");
    overlay.hidden = false;
  }
  function showOverlay(html) {
    overlay.classList.remove("is-pass");
    overlay.innerHTML = `<div class="demo-card">${html}</div>`;
    overlay.hidden = false;
    overlay.querySelector("[data-fly]")?.focus({ preventScroll: true });
  }
  const setTouch = () => { canvas.style.touchAction = state === "ready" || state === "over" ? "pan-y" : "none"; };

  // ---------- Drawing ----------
  const line = (pts, close) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath();
  };
  const mirror = (half) => half.concat(half.slice().reverse().map(([x, y]) => [-x, y]));
  const JET = mirror([[0, -21], [2.6, -15], [4, -6], [16, 4], [16, 8.5], [4, 6.5], [3.6, 11], [9.5, 16.5], [9.5, 19.5], [0.8, 17.5]]);

  function jet(x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    line(JET, true);
    ctx.fillStyle = col.paper;
    ctx.fill();
    ctx.lineWidth = 2.2 / s;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -9, 1.8, 4.4, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 6); ctx.lineTo(-6, 5.6);
    ctx.moveTo(10, 6); ctx.lineTo(6, 5.6);
    ctx.stroke();
    ctx.restore();
  }

  function scoutArt(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.2, 13, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    line([[-16, -1], [16, -1], [15, 5], [-15, 5]], true);
    ctx.fill(); ctx.stroke();
    line([[-6, -11], [6, -11]]);
    ctx.stroke();
    const p = Math.abs(Math.cos(t * 40)) * 7 + 1;
    line([[-p, 14.5], [p, 14.5]]);
    ctx.stroke();
    ctx.restore();
  }

  function heliArt(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    line([[-9, -6], [-9, 9]]); ctx.stroke();
    line([[9, -6], [9, 9]]); ctx.stroke();
    line([[0, -9], [0, -30]]); ctx.stroke();
    line([[-5, -30], [5, -30]]); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.rotate(t * 14);
    line([[-23, 0], [23, 0]]); ctx.stroke();
    line([[0, -23], [0, 23]]); ctx.stroke();
    ctx.restore();
  }

  function bomberArt(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    line([[-48, -8], [48, -8], [42, 7], [-42, 7]], true);
    ctx.fill(); ctx.stroke();
    line([[-15, -31], [15, -31], [13, -25], [-13, -25]], true);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-7, -36, 14, 72, 7) : ctx.rect(-7, -36, 14, 72);
    ctx.fill(); ctx.stroke();
    [-34, -19, 19, 34].forEach((dx) => {
      ctx.beginPath(); ctx.arc(dx, 0, 6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(dx, 0, 2, 0, TAU); ctx.fillStyle = col.ink; ctx.fill(); ctx.fillStyle = col.paper;
    });
    ctx.restore();
    if (e.hp < e.max) {
      ctx.strokeRect(e.x - 30, e.y - 50, 60, 6);
      ctx.fillStyle = col.ink;
      ctx.fillRect(e.x - 30, e.y - 50, 60 * (e.hp / e.max), 6);
      ctx.fillStyle = col.paper;
    }
  }

  function pickupArt(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.type === "fuel") {
      ctx.beginPath();
      ctx.arc(0, -20, 13, Math.PI, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      line([[-13, -20], [-5, -7]]); ctx.stroke();
      line([[13, -20], [5, -7]]); ctx.stroke();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-7, -7, 14, 17, 3) : ctx.rect(-7, -7, 14, 17);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.ink;
      ctx.font = SMALL;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("F", 0, 2);
    } else {
      ctx.beginPath(); ctx.arc(0, -26, 12, 0, TAU); ctx.fill(); ctx.stroke();
      line([[0, -14], [0, -9]]); ctx.stroke();
      ctx.fillRect(-11, -9, 22, 19);
      ctx.strokeRect(-11, -9, 22, 19);
      ctx.fillStyle = col.ink;
      ctx.font = FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.letter, 0, 1);
    }
    ctx.restore();
  }

  function boom(b) {
    const k = b.t / 0.45, r = b.r * (0.4 + k * 0.8);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = 1 - k * 0.7;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU, rr = i % 2 ? r * 0.5 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 90 * s, y);
    ctx.moveTo(x + 8 * s, y);
    ctx.arc(x + 22 * s, y - 8 * s, 14 * s, Math.PI * 0.95, Math.PI * 1.75);
    ctx.arc(x + 48 * s, y - 15 * s, 19 * s, Math.PI * 1.15, Math.PI * 1.9);
    ctx.arc(x + 74 * s, y - 8 * s, 13 * s, Math.PI * 1.25, Math.PI * 0.05);
    ctx.stroke();
  }

  function render() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.fillStyle = col.paper;
    ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate(rand(-3, 3) * shake * 3, rand(-3, 3) * shake * 3);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = col.ink;
    ctx.fillStyle = col.paper;

    // Sea marks and clouds (background, faint)
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col.faint;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const w of waves) {
      ctx.moveTo(w.x - 6, w.y);
      ctx.quadraticCurveTo(w.x - 3, w.y - 3, w.x, w.y);
      ctx.quadraticCurveTo(w.x + 3, w.y + 3, w.x + 6, w.y);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    for (const c of clouds) cloud(c.x, c.y, c.s);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = col.faint;
    for (const s of splats) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) ctx.arc(s.x + Math.cos(s.seed + i * 1.3) * s.r * 0.45, s.y + Math.sin(s.seed + i * 1.7) * s.r * 0.45, s.r * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col.ink;
    ctx.fillStyle = col.paper;
    ctx.lineWidth = 2.2;

    for (const p of pickups) pickupArt(p);
    for (const e of enemies) {
      ctx.fillStyle = e.hit > 0 ? col.ink : col.paper;
      if (e.type === "scout") scoutArt(e);
      else if (e.type === "heli") heliArt(e);
      else bomberArt(e);
    }
    ctx.fillStyle = col.paper;

    // Player
    const blink = player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0;
    if (!blink && state !== "over") {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 120;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.6;
      line([[player.x - 5, player.y + 20], [player.x - 5, player.y + 46]]); ctx.stroke();
      line([[player.x + 5, player.y + 20], [player.x + 5, player.y + 46]]); ctx.stroke();
      ctx.restore();
      jet(player.x, player.y);
    }

    // Bullets
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (const b of bullets) {
      const d = Math.hypot(b.vx, b.vy) || 1;
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (b.vx / d) * 8, b.y - (b.vy / d) * 8);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    for (const s of shots) {
      ctx.beginPath(); ctx.arc(s.x, s.y, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, TAU); ctx.fillStyle = col.ink; ctx.fill(); ctx.fillStyle = col.paper;
    }
    ctx.lineWidth = 2.2;
    for (const b of booms) boom(b);

    ctx.fillStyle = col.ink;
    ctx.font = SMALL;
    ctx.textAlign = "center";
    for (const x of texts) {
      ctx.globalAlpha = 1 - x.t;
      ctx.fillText(x.s, x.x, x.y - x.t * 30);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < player.lives ? 1 : 0.2;
      jet(20 + i * 20, 22, 0.42);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.ink;
    ctx.strokeStyle = col.ink;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(12, 40, 72, 8);
    ctx.fillRect(12, 40, 72 * (player.fuel / 100), 8);
    ctx.font = SMALL;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`FUEL ${Math.ceil(player.fuel)}%`, 90, 44.5);
    if (player.fuel < 25 && Math.floor(t * 3) % 2 === 0) ctx.fillText("LOW!", 90, 58);
    ctx.textAlign = "right";
    ctx.font = FONT;
    ctx.fillText(String(score).padStart(6, "0"), W - 12, 22);
    ctx.font = SMALL;
    ctx.fillText(`✶ ${kills}   ${WEAPONS[player.weapon]} LV${player.lv}`, W - 12, 42);
    if (state === "run" && !holding && !keyboardMode && ts < 0.95) {
      ctx.textAlign = "center";
      ctx.font = FONT;
      ctx.fillText("HOLD TO KEEP FLYING", W / 2, H / 2);
    }
  }

  // ---------- Loop ----------
  let last = 0, visible = true;
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!visible || document.hidden) {
      if (state === "run") pause();
      return;
    }
    if (state === "run") {
      const flying = holding || keyboardMode;
      ts += ((flying ? 1 : 0.22) - ts) * Math.min(1, real * 8);
      letGo = flying ? 0 : letGo + real;
      if (letGo > 1.3) pause();
      else update(real * ts);
    }
    render();
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = r.width / W;
  }

  readColors();
  addEventListener("themechange", readColors);
  reset();
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; onScreen = e.intersectionRatio > 0.3; }, { threshold: [0, 0.3, 0.6] }).observe(stage);
  }
  showOverlay(`
    <span class="tag">Inki Ace · Demo</span>
    <h3>Take off</h3>
    <p>Hold and drag anywhere on the sky to fly. Your guns fire on their own. Catch parachute fuel cans before the tank runs dry, and grab the <b>S</b> and <b>M</b> crates for new guns.</p>
    <button class="btn" type="button" data-fly>Fly</button>
    <p class="muted" style="font-size:14px">Keyboard: arrow keys or WASD</p>`);
  setTouch();
  requestAnimationFrame(frame);

  // Test hook: open the page with ?debug to inspect the demo from the console.
  if (/[?&]debug\b/.test(location.search)) {
    window.__inkiAce = {
      get state() { return state; }, get player() { return player; }, get score() { return score; }, get kills() { return kills; },
      get enemies() { return enemies.length; }, get ts() { return ts; }, get t() { return t; },
    };
  }
})();
