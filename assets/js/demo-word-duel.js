/* Word Duel — browser demo of the solo game, in the page's language (English, French or Spanish).
   Pick letters: right ones fly onto every dash they belong to, wrong ones bounce off the word and drop
   into the misses tray, and a heart goes with them. Six misses and the word is gone.
   Like the app: AZERTY in French, an Ñ key in Spanish, words played without accents. */
(() => {
  const host = document.querySelector("[data-wd-demo]");
  if (!host) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const APP_URL = host.dataset.appstore || "https://apps.apple.com/app/id6814167260";
  const MAX_MISSES = 6;
  const LANG = ["fr", "es"].includes((document.documentElement.lang || "").slice(0, 2)) ? document.documentElement.lang.slice(0, 2) : "en";
  const LOCALE = { en: "en-CA", fr: "fr-CA", es: "es-ES" }[LANG];
  const ROWS = {
    en: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
    fr: ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"],
    es: ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"],
  }[LANG];
  const WORDS = {
    en: "PLANET GARDEN PILLOW BRIDGE CASTLE ROCKET PENCIL ORANGE JACKET TURTLE WINDOW KITTEN BASKET CAMERA " +
      "DRAGON FOREST GUITAR ISLAND LADDER MIRROR RABBIT CANDLE COFFEE MONKEY PUZZLE SUMMER WINTER BUTTER " +
      "DOCTOR FLOWER HELMET JUNGLE PARROT SPIDER TOMATO VIOLIN YELLOW CLOUD BREAD TIGER CHAIR MUSIC SMILE " +
      "LEMON OCEAN PIANO ROBOT TRAIN HONEY PIZZA SNAKE WHALE BEACH GHOST HOUSE PAPER QUEEN STORM CIRCUS " +
      "BALLOON BLANKET RAINBOW KITCHEN DOLPHIN LIBRARY PICTURE MORNING CHICKEN TEACHER",
    fr: "MAISON JARDIN CHEVAL BATEAU FROMAGE CHAPEAU POMME LAPIN NUAGE SOLEIL MUSIQUE VOYAGE CERISE TORTUE " +
      "BOUGIE COUSSIN CITRON ORANGE GUITARE DRAGON CAMION SINGE BALEINE RENARD HIBOU CAROTTE BANANE PAPIER " +
      "CRAYON LIVRE TIGRE POISSON MONTAGNE PLAGE NEIGE HIVER AUTOMNE CUISINE BONBON SOURIS PIANO ROBOT TRAIN " +
      "AVION BALLON JOUET CADEAU FLEUR ARBRE OISEAU GIRAFE LOUTRE CANARD COCHON MOUTON POULET VACHE FOURMI",
    es: "MANZANA CABALLO PLANETA CASTILLO COHETE NARANJA TORTUGA VENTANA CESTA BOSQUE GUITARRA ESPEJO CONEJO " +
      "VERANO INVIERNO SELVA ARAÑA TOMATE AMARILLO TIGRE SILLA SONRISA PIANO SERPIENTE BALLENA MONTAÑA PIÑA " +
      "SUEÑO LLUVIA PLAYA ZAPATO PERRO GALLETA CAMISA PELOTA MARIPOSA CARACOL CEBRA BARCO COCHE CIUDAD PUERTA " +
      "LIBRO QUESO HUEVO LECHE JIRAFA CAMELLO PALOMA REGALO DULCE FRESA BANANA CEREZA RATONES CUADERNO",
  }[LANG].split(" ");
  const TEXT = {
    en: {
      chip: "Everyday · Easy", skip: "Skip to a new word", newWord: "New word", score: "Score", streak: "Streak",
      misses: "Misses", letters: "Letters", hidden: (n) => `Hidden word, ${n} letters`, hearts: (n) => `${n} hearts left`,
      sayNew: (n) => `New word: ${n} letters.`,
      sayHit: (l, n) => n > 1 ? `${l} is in the word ${n} times.` : `${l} is in the word.`,
      sayMiss: (l, n) => `No ${l}. ${n} hearts left.`,
      perfect: "Perfect!", nice: "Nice one!", phew: "Phew!", out: "Out of hearts",
      stars: (n) => `${n} of 3 stars`, solved: "Solved", accuracy: "Accuracy",
      missesTxt: (m) => m === 0 ? "no misses" : `${m} miss${m > 1 ? "es" : ""}`,
      bonus: "Perfect bonus", bonusNote: "not a single miss", total: "Total",
      lost: (w) => `The word was <b>${w}</b>. Six misses and it's gone, but your next word is waiting.`,
      next: "Next word →", share: "Share your result", copied: "Copied", sayCopied: "Result copied.",
      cta: "Duel a friend on the same words in the app.", get: "Get Word Duel",
      sayWon: (t, w, p) => `${t} The word was ${w}. ${p} points.`, sayLost: (w) => `Out of hearts. The word was ${w}.`,
      shareText: (n, m) => `Word Duel · ${n} letters · ${m === 0 ? "perfect" : m + " misses"}`,
    },
    fr: {
      chip: "Quotidien · Facile", skip: "Passer à un nouveau mot", newWord: "Nouveau mot", score: "Score", streak: "Série",
      misses: "Ratés", letters: "Lettres", hidden: (n) => `Mot caché, ${n} lettres`, hearts: (n) => `${n} cœurs restants`,
      sayNew: (n) => `Nouveau mot\u00a0: ${n} lettres.`,
      sayHit: (l, n) => n > 1 ? `La lettre ${l} est ${n} fois dans le mot.` : `La lettre ${l} est dans le mot.`,
      sayMiss: (l, n) => `Pas de ${l}. Encore ${n} cœurs.`,
      perfect: `Parfait\u202f!`, nice: `Bien joué\u202f!`, phew: `Ouf\u202f!`, out: "Plus de cœurs",
      stars: (n) => `${n} étoiles sur 3`, solved: "Trouvé", accuracy: "Précision",
      missesTxt: (m) => m === 0 ? "aucun raté" : `${m} raté${m > 1 ? "s" : ""}`,
      bonus: "Bonus parfait", bonusNote: "pas un seul raté", total: "Total",
      lost: (w) => `Le mot était <b>${w}</b>. Six ratés et il est perdu, mais ton prochain mot t'attend.`,
      next: "Mot suivant →", share: "Partager ton résultat", copied: "Copié", sayCopied: "Résultat copié.",
      cta: "Défie un ami sur les mêmes mots dans l'app.", get: "Obtenir Word Duel",
      sayWon: (t, w, p) => `${t} Le mot était ${w}. ${p} points.`, sayLost: (w) => `Plus de cœurs. Le mot était ${w}.`,
      shareText: (n, m) => `Word Duel · ${n} lettres · ${m === 0 ? "parfait" : m + " raté" + (m > 1 ? "s" : "")}`,
    },
    es: {
      chip: "Cotidianas · Fácil", skip: "Pasar a otra palabra", newWord: "Nueva palabra", score: "Puntos", streak: "Racha",
      misses: "Fallos", letters: "Letras", hidden: (n) => `Palabra oculta, ${n} letras`, hearts: (n) => `Quedan ${n} corazones`,
      sayNew: (n) => `Nueva palabra: ${n} letras.`,
      sayHit: (l, n) => n > 1 ? `La ${l} está ${n} veces en la palabra.` : `La ${l} está en la palabra.`,
      sayMiss: (l, n) => `No hay ${l}. Quedan ${n} corazones.`,
      perfect: "¡Perfecto!", nice: "¡Bien hecho!", phew: "¡Uf!", out: "Sin corazones",
      stars: (n) => `${n} de 3 estrellas`, solved: "Resuelta", accuracy: "Precisión",
      missesTxt: (m) => m === 0 ? "sin fallos" : `${m} fallo${m > 1 ? "s" : ""}`,
      bonus: "Bonus perfecto", bonusNote: "ni un solo fallo", total: "Total",
      lost: (w) => `La palabra era <b>${w}</b>. Seis fallos y se pierde, pero tu próxima palabra te espera.`,
      next: "Siguiente palabra →", share: "Compartir tu resultado", copied: "Copiado", sayCopied: "Resultado copiado.",
      cta: "Reta a un amigo con las mismas palabras en la app.", get: "Descargar Word Duel",
      sayWon: (t, w, p) => `${t} La palabra era ${w}. ${p} puntos.`, sayLost: (w) => `Sin corazones. La palabra era ${w}.`,
      shareText: (n, m) => `Word Duel · ${n} letras · ${m === 0 ? "perfecta" : m + " fallo" + (m > 1 ? "s" : "")}`,
    },
  }[LANG];
  const LETTER = /^[A-ZÑ]$/;

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
      <span class="wd-chip">${icon.chat} ${TEXT.chip}</span>
      <button class="wd-skip" type="button" data-skip aria-label="${TEXT.skip}" title="${TEXT.newWord}">${icon.redo}</button>
    </div>
    <div class="wd-stats">
      <div><small>${TEXT.score}</small><b data-score>0</b></div>
      <div><small>${TEXT.streak}</small><b data-streak>0</b></div>
    </div>
    <div class="wd-hearts" data-hearts role="img" aria-label="${TEXT.hearts(6)}"></div>
    <div class="wd-board">
      <div class="wd-word" data-word role="group" aria-label="${TEXT.hidden(6)}"></div>
      <div class="wd-misses"><small>${TEXT.misses}</small><div class="wd-miss-row" data-misses></div></div>
    </div>
    <div class="wd-keys" data-keys role="group" aria-label="${TEXT.letters}"></div>
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
  if (!/^[A-ZÑ]{3,9}$/.test(forced)) forced = "";

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
    wordEl.setAttribute("aria-label", TEXT.hidden(word.length));
    missEl.innerHTML = Array.from({ length: MAX_MISSES }, () => '<div class="wd-miss"><span class="wd-tile"></span></div>').join("");
    heartsEl.innerHTML = Array.from({ length: MAX_MISSES }, () => icon.heart).join("");
    heartsEl.setAttribute("aria-label", TEXT.hearts(MAX_MISSES));
    Object.values(keys).forEach((k) => { k.className = "wd-key"; k.disabled = false; });
    sizeTiles();
    say(TEXT.sayNew(word.length));
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
    heartsEl.setAttribute("aria-label", TEXT.hearts(MAX_MISSES - i - 1));
    wordEl.classList.remove("is-bonk");
    void wordEl.offsetWidth;
    wordEl.classList.add("is-bonk");
  }

  function guess(letter) {
    if (done || !LETTER.test(letter) || !keys[letter] || tried.includes(letter)) return;
    tried.push(letter);
    const key = keys[letter];
    key.disabled = true;
    const slots = [...wordEl.children];
    const at = [...word].map((c, i) => (c === letter ? i : -1)).filter((i) => i >= 0);

    if (at.length) {
      key.classList.add("is-hit");
      found += at.length;
      say(TEXT.sayHit(letter, at.length));
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
      say(TEXT.sayMiss(letter, MAX_MISSES - misses.length));
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
    const title = !won ? TEXT.out : perfect ? TEXT.perfect : m <= 2 ? TEXT.nice : TEXT.phew;
    if (won) { streak += 1; score += total; } else { streak = 0; }
    if (score > best) store.set("favalia.wordduel.best", String(score));

    const tile = Math.max(22, Math.min(38, Math.floor(300 / word.length) - 5));
    const answer = [...word].map((c) => `<span class="wd-tile">${c}</span>`).join("");
    const missesTxt = TEXT.missesTxt(m);
    result.innerHTML = `
      <div class="wd-card" role="dialog" aria-modal="false" aria-labelledby="wd-title">
        <div class="wd-stars" aria-label="${TEXT.stars(stars)}">${[0, 1, 2].map((i) => `<span class="${i < stars ? "on" : ""}" style="--i:${i}">★</span>`).join("")}</div>
        <h3 class="wd-title ${won ? "" : "is-lost"}" id="wd-title">${title}</h3>
        <div class="wd-answer ${won ? (perfect ? "is-gold" : "is-green") : "is-red"}" style="--tile:${tile}px">${answer}</div>
        ${won ? `
        <dl class="wd-rows">
          <div><dt>${TEXT.solved}</dt><dd>+400</dd></div>
          <div><dt>${TEXT.accuracy} <small>${missesTxt}</small></dt><dd>+${acc}</dd></div>
          ${perfect ? `<div><dt>${TEXT.bonus} <small>${TEXT.bonusNote}</small></dt><dd class="gold">+250</dd></div>` : ""}
        </dl>
        <div class="wd-total"><span>${TEXT.total}${perfect ? "<em>×2</em>" : ""}</span><b data-total>0</b></div>` : `
        <p class="wd-lost">${TEXT.lost(word)}</p>`}
        <div class="wd-actions">
          <button class="wd-next" type="button" data-next>${TEXT.next}</button>
          <button class="wd-share" type="button" data-share aria-label="${TEXT.share}">${icon.share}</button>
        </div>
        <p class="wd-cta">${TEXT.cta} <a href="${APP_URL}">${TEXT.get}</a></p>
      </div>`;
    result.hidden = false;
    result.querySelector("[data-next]").focus({ preventScroll: true });
    scoreEl.textContent = score.toLocaleString(LOCALE);
    streakEl.textContent = String(streak);
    say(won ? TEXT.sayWon(title, word, total) : TEXT.sayLost(word));

    const totalEl = result.querySelector("[data-total]");
    if (totalEl) countUp(totalEl, total);
    if (won && !reduce) confetti(perfect ? 64 : 34);
  }

  function countUp(el, to) {
    if (reduce) { el.textContent = to.toLocaleString(LOCALE); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString(LOCALE);
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
    const text = `${TEXT.shareText(word.length, misses.length)}\n${squares}`;
    const url = `https://favalia.ca/${LANG === "en" ? "" : LANG + "/"}word-duel/`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      btn.classList.add("is-copied");
      btn.setAttribute("aria-label", TEXT.copied);
      say(TEXT.sayCopied);
      setTimeout(() => { btn.classList.remove("is-copied"); btn.setAttribute("aria-label", TEXT.share); }, 1600);
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
    if (LETTER.test(k) && keys[k]) { e.preventDefault(); guess(k); }
    else if (e.key === "Enter" && !result.hidden && document.activeElement?.closest?.("[data-result]") == null) { e.preventDefault(); newWord(); }
  });

  if ("ResizeObserver" in window) new ResizeObserver(sizeTiles).observe(wordEl);
  newWord();
})();
