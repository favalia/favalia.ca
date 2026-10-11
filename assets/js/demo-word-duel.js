/* Word Duel — browser demo of the solo game.
   Pick letters: right ones fly onto every dash they belong to, wrong ones bounce off the word and drop
   into the misses tray, and a heart goes with them. Six misses and the word is gone. */
(() => {
  const host = document.querySelector("[data-wd-demo]");
  if (!host) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const APP_URL = host.dataset.appstore || "https://apps.apple.com/app/id6814167260";
  const MAX_MISSES = 6;
  const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const WORDS = (
    "PLANET GARDEN PILLOW BRIDGE CASTLE ROCKET PENCIL ORANGE JACKET TURTLE WINDOW KITTEN BASKET CAMERA " +
    "DRAGON FOREST GUITAR ISLAND LADDER MIRROR RABBIT CANDLE COFFEE MONKEY PUZZLE SUMMER WINTER BUTTER " +
    "DOCTOR FLOWER HELMET JUNGLE PARROT SPIDER TOMATO VIOLIN YELLOW CLOUD BREAD TIGER CHAIR MUSIC SMILE " +
    "LEMON OCEAN PIANO ROBOT TRAIN HONEY PIZZA SNAKE WHALE BEACH GHOST HOUSE PAPER QUEEN STORM CIRCUS " +
    "BALLOON BLANKET RAINBOW KITCHEN DOLPHIN LIBRARY PICTURE MORNING CHICKEN TEACHER"
  ).split(" ");

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const icon = {
    chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" opacity=".9"/></svg>',
    redo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    heart: '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21s-8.5-5.3-10.6-10.2C-.1 6.6 2.6 2 6.8 2c2.3 0 4 1.2 5.2 3 1.2-1.8 2.9-3 5.2-3 4.2 0 6.9 4.6 5.4 8.8C20.5 15.7 12 21 12 21z"/></svg>',
  };

  host.innerHTML = `
    <div class="wd-top">
      <span class="wd-chip">${icon.chat} Everyday · Easy</span>
      <button class="wd-skip" type="button" data-skip aria-label="Skip to a new word" title="New word">${icon.redo}</button>
    </div>
    <div class="wd-stats">
      <div><small>Score</small><b data-score>0</b></div>
      <div><small>Streak</small><b data-streak>0</b></div>
    </div>
    <div class="wd-hearts" data-hearts role="img" aria-label="6 hearts left"></div>
    <div class="wd-board">
      <div class="wd-word" data-word role="group" aria-label="Hidden word"></div>
      <div class="wd-misses"><small>Misses</small><div class="wd-miss-row" data-misses></div></div>
    </div>
    <div class="wd-keys" data-keys role="group" aria-label="Letters"></div>
    <div class="wd-layer" data-layer aria-hidden="true"></div>
    <div class="wd-result" data-result hidden></div>
    <p class="sr-only" aria-live="polite" data-live></p>`;

  const $ = (s) => host.querySelector(s);
  const wordEl = $("[data-word]"), missEl = $("[data-misses]"), keysEl = $("[data-keys]");
  const heartsEl = $("[data-hearts]"), layer = $("[data-layer]"), result = $("[data-result]"), live = $("[data-live]");
  const scoreEl = $("[data-score]"), streakEl = $("[data-streak]");

  // Keyboard
  const keys = {};
  ROWS.forEach((row) => {
    const r = document.createElement("div");
    r.className = "wd-row";
    [...row].forEach((ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wd-key";
      b.textContent = ch;
      b.dataset.key = ch;
      b.setAttribute("aria-label", ch);
      r.appendChild(b);
      keys[ch] = b;
    });
    keysEl.appendChild(r);
  });
  keysEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-key]");
    if (b) guess(b.dataset.key);
  });

  // State
  let deck = [];
  let word = "", tried = [], misses = [], found = 0, done = false;
  let score = 0, streak = 0, last = "";
  const best = Number(store.get("favalia.wordduel.best") || 0);

  // ?word=PLANET plays that word first (handy for testing a solve).
  let forced = (new URLSearchParams(location.search).get("word") || "").toUpperCase();
  if (!/^[A-Z]{3,9}$/.test(forced)) forced = "";

  const nextWord = () => {
    if (forced) { const f = forced; forced = ""; return (last = f); }
    if (!deck.length) deck = WORDS.slice().sort(() => Math.random() - 0.5);
    let w = deck.pop();
    if (w === last && deck.length) w = deck.pop();
    return (last = w);
  };

  const sizeTiles = () => {
    const n = word.length || 6;
    const w = wordEl.clientWidth || 300;
    const t = Math.max(26, Math.min(52, Math.floor((w - 6 * (n - 1)) / n)));
    host.style.setProperty("--tile", t + "px");
  };

  function newWord() {
    word = nextWord();
    tried = []; misses = []; found = 0; done = false;
    result.hidden = true;
    result.innerHTML = "";
    layer.innerHTML = "";
    wordEl.innerHTML = [...word].map(() => '<div class="wd-slot"><span class="wd-tile"></span></div>').join("");
    wordEl.setAttribute("aria-label", `Hidden word, ${word.length} letters`);
    missEl.innerHTML = Array.from({ length: MAX_MISSES }, () => '<div class="wd-miss"><span class="wd-tile"></span></div>').join("");
    heartsEl.innerHTML = Array.from({ length: MAX_MISSES }, () => icon.heart).join("");
    heartsEl.setAttribute("aria-label", `${MAX_MISSES} hearts left`);
    Object.values(keys).forEach((k) => { k.className = "wd-key"; k.disabled = false; });
    sizeTiles();
    say(`New word: ${word.length} letters.`);
  }

  const say = (t) => { live.textContent = t; };

  const rectIn = (el) => {
    const r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
    return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
  };

  const flyer = (letter, cls, at) => {
    const t = document.createElement("span");
    t.className = "wd-tile wd-fly " + cls;
    t.textContent = letter;
    Object.assign(t.style, { left: at.x + "px", top: at.y + "px", width: at.w + "px", height: at.h + "px", fontSize: at.h * 0.46 + "px" });
    layer.appendChild(t);
    return t;
  };

  const settle = (anim, el) => anim.finished.then(() => el.remove(), () => el.remove());

  function flyHit(key, slot, letter, delay) {
    const target = slot.querySelector(".wd-tile");
    if (reduce || !target.animate) return Promise.resolve();
    const from = rectIn(key), to = rectIn(target);
    const t = flyer(letter, "is-hit", to);
    const dx = from.x + from.w / 2 - (to.x + to.w / 2);
    const dy = from.y + from.h / 2 - (to.y + to.h / 2);
    const s = Math.max(0.5, from.w / to.w);
    const a = t.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.9 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 46}px) scale(1.12) rotate(-6deg)`, opacity: 1, offset: 0.55 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 520, delay, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" }
    );
    return settle(a, t);
  }

  function flyMiss(key, slot, letter, onBonk) {
    const target = slot.querySelector(".wd-tile");
    if (reduce || !target.animate) { onBonk(); return Promise.resolve(); }
    const from = rectIn(key), to = rectIn(target), w = rectIn(wordEl);
    const t = flyer(letter, "is-miss", to);
    const sx = from.x + from.w / 2 - (to.x + to.w / 2), sy = from.y + from.h / 2 - (to.y + to.h / 2);
    const wx = w.x + w.w / 2 - (to.x + to.w / 2), wy = w.y + w.h / 2 - (to.y + to.h / 2);
    const a = t.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(1)` },
        { transform: `translate(${wx}px, ${wy}px) scale(1.35) rotate(-10deg)`, offset: 0.42 },
        { transform: `translate(${wx + 16}px, ${wy - 30}px) scale(1.2) rotate(14deg)`, offset: 0.6 },
        { transform: "none" },
      ],
      { duration: 820, easing: "cubic-bezier(.4,0,.3,1)" }
    );
    setTimeout(onBonk, 340);
    return settle(a, t);
  }

  function loseHeart(i) {
    const h = heartsEl.children[MAX_MISSES - 1 - i];
    h?.classList.add("is-gone");
    heartsEl.setAttribute("aria-label", `${MAX_MISSES - i - 1} hearts left`);
    wordEl.classList.remove("is-bonk");
    void wordEl.offsetWidth;
    wordEl.classList.add("is-bonk");
  }

  function guess(letter) {
    if (done || !/^[A-Z]$/.test(letter) || tried.includes(letter)) return;
    tried.push(letter);
    const key = keys[letter];
    key.disabled = true;
    const slots = [...wordEl.children];
    const at = [...word].map((c, i) => (c === letter ? i : -1)).filter((i) => i >= 0);

    if (at.length) {
      key.classList.add("is-hit");
      found += at.length;
      say(at.length > 1 ? `${letter} is in the word ${at.length} times.` : `${letter} is in the word.`);
      at.forEach((i, n) => {
        flyHit(key, slots[i], letter, n * 70).then(() => {
          slots[i].querySelector(".wd-tile").textContent = letter;
          slots[i].classList.add("is-filled");
        });
      });
      if (found === word.length) {
        done = true;
        lockKeys();
        setTimeout(() => finish(true), reduce ? 150 : 720);
      }
    } else {
      key.classList.add("is-miss");
      const i = misses.length;
      misses.push(letter);
      const slot = missEl.children[i];
      say(`No ${letter}. ${MAX_MISSES - misses.length} hearts left.`);
      flyMiss(key, slot, letter, () => loseHeart(i)).then(() => {
        slot.querySelector(".wd-tile").textContent = letter;
        slot.classList.add("is-filled");
      });
      if (misses.length >= MAX_MISSES) {
        done = true;
        lockKeys();
        setTimeout(() => {
          slots.forEach((s, j) => {
            if (!s.classList.contains("is-filled")) {
              s.querySelector(".wd-tile").textContent = word[j];
              s.classList.add("is-lost");
            }
          });
        }, reduce ? 50 : 760);
        setTimeout(() => finish(false), reduce ? 200 : 1500);
      }
    }
  }

  const lockKeys = () => Object.values(keys).forEach((k) => (k.disabled = true));

  function finish(won) {
    const m = misses.length;
    const acc = Math.max(0, 400 - m * 80);
    const perfect = won && m === 0;
    const total = won ? (400 + acc + (perfect ? 250 : 0)) * (perfect ? 2 : 1) : 0;
    const stars = !won ? 0 : m === 0 ? 3 : m <= 2 ? 2 : 1;
    const title = !won ? "Out of hearts" : perfect ? "Perfect!" : m <= 2 ? "Nice one!" : "Phew!";
    if (won) { streak += 1; score += total; } else { streak = 0; }
    if (score > best) store.set("favalia.wordduel.best", String(score));

    const tile = Math.max(22, Math.min(38, Math.floor(300 / word.length) - 5));
    const answer = [...word].map((c) => `<span class="wd-tile">${c}</span>`).join("");
    const missesTxt = m === 0 ? "no misses" : `${m} miss${m > 1 ? "es" : ""}`;
    result.innerHTML = `
      <div class="wd-card" role="dialog" aria-modal="false" aria-labelledby="wd-title">
        <div class="wd-stars" aria-label="${stars} of 3 stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? "on" : ""}" style="--i:${i}">★</span>`).join("")}</div>
        <h3 class="wd-title ${won ? "" : "is-lost"}" id="wd-title">${title}</h3>
        <div class="wd-answer ${won ? (perfect ? "is-gold" : "is-green") : "is-red"}" style="--tile:${tile}px">${answer}</div>
        ${won ? `
        <dl class="wd-rows">
          <div><dt>Solved</dt><dd>+400</dd></div>
          <div><dt>Accuracy <small>${missesTxt}</small></dt><dd>+${acc}</dd></div>
          ${perfect ? '<div><dt>Perfect bonus <small>not a single miss</small></dt><dd class="gold">+250</dd></div>' : ""}
        </dl>
        <div class="wd-total"><span>Total${perfect ? "<em>×2</em>" : ""}</span><b data-total>0</b></div>` : `
        <p class="wd-lost">The word was <b>${word}</b>. Six misses and it's gone, but your next word is waiting.</p>`}
        <div class="wd-actions">
          <button class="wd-next" type="button" data-next>Next word →</button>
          <button class="wd-share" type="button" data-share aria-label="Share your result">${icon.share}</button>
        </div>
        <p class="wd-cta">Duel a friend on the same words in the app. <a href="${APP_URL}">Get Word Duel</a></p>
      </div>`;
    result.hidden = false;
    result.querySelector("[data-next]").focus({ preventScroll: true });
    scoreEl.textContent = score.toLocaleString();
    streakEl.textContent = String(streak);
    say(won ? `${title} The word was ${word}. ${total} points.` : `Out of hearts. The word was ${word}.`);

    const totalEl = result.querySelector("[data-total]");
    if (totalEl) countUp(totalEl, total);
    if (won && !reduce) confetti(perfect ? 64 : 34);
  }

  function countUp(el, to) {
    if (reduce) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function confetti(n) {
    const colors = ["#ffd84a", "#4fe0a8", "#ff8fb1", "#8f5ef8", "#5ab0ff", "#ff9a3c"];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("i");
      c.className = "wd-confetti";
      c.style.setProperty("--x", Math.random() * 100 + "%");
      c.style.setProperty("--dx", (Math.random() - 0.5) * 160 + "px");
      c.style.setProperty("--r", (Math.random() - 0.5) * 900 + "deg");
      c.style.setProperty("--d", Math.random() * 300 + "ms");
      c.style.setProperty("--c", colors[i % colors.length]);
      layer.appendChild(c);
      setTimeout(() => c.remove(), 2200);
    }
  }

  async function share(btn) {
    const squares = tried.map((l) => (word.includes(l) ? "🟩" : "🟥")).join("");
    const text = `Word Duel · ${word.length} letters · ${misses.length === 0 ? "perfect" : misses.length + " misses"}\n${squares}`;
    const url = "https://favalia.ca/word-duel/";
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      btn.classList.add("is-copied");
      btn.setAttribute("aria-label", "Copied");
      say("Result copied.");
      setTimeout(() => { btn.classList.remove("is-copied"); btn.setAttribute("aria-label", "Share your result"); }, 1600);
    } catch { /* cancelled or blocked */ }
  }

  result.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) newWord();
    const s = e.target.closest("[data-share]");
    if (s) share(s);
  });
  $("[data-skip]").addEventListener("click", () => { streak = 0; streakEl.textContent = "0"; newWord(); });

  // Physical keyboard while the demo is on screen.
  let onScreen = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { onScreen = e.intersectionRatio > 0.35; }, { threshold: [0, 0.35, 0.6] }).observe(host);
  }
  addEventListener("keydown", (e) => {
    if (!onScreen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable], dialog[open]") || document.querySelector("dialog[open]")) return;
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k)) { e.preventDefault(); guess(k); }
    else if (e.key === "Enter" && !result.hidden && document.activeElement?.closest?.("[data-result]") == null) { e.preventDefault(); newWord(); }
  });

  if ("ResizeObserver" in window) new ResizeObserver(sizeTiles).observe(wordEl);
  newWord();
})();
