/* Favalia site: theme, menu, reveal, videos, screenshot viewer. No dependencies. */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");

  /* ---------- Day / Night ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches;
  const announceTheme = () => {
    const dark = isDark();
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to day theme" : "Switch to night theme");
      b.title = dark ? "Day" : "Night";
    });
    window.dispatchEvent(new CustomEvent("themechange", { detail: { dark } }));
  };
  document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      root.dataset.theme = isDark() ? "light" : "dark";
      store.set("favalia-theme", root.dataset.theme);
      announceTheme();
    })
  );
  darkQuery.addEventListener?.("change", () => { if (!root.dataset.theme) announceTheme(); });
  announceTheme();

  /* ---------- Header ---------- */
  const header = document.querySelector(".site-header");
  const menu = document.getElementById("site-menu");
  const menuBtn = document.querySelector("[data-menu-toggle]");
  const onScroll = () => header?.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    header.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  };
  menuBtn?.addEventListener("click", () => setMenu(menu.hidden));
  menu?.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menu && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  matchMedia("(min-width: 921px)").addEventListener?.("change", (e) => { if (e.matches) setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || reduceMotion.matches) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Videos: play only while on screen ---------- */
  const videos = document.querySelectorAll("video[data-autoplay]");
  if (reduceMotion.matches) {
    videos.forEach((v) => {
      const btn = document.createElement("button");
      btn.className = "tap-play";
      btn.type = "button";
      btn.setAttribute("aria-label", "Play video");
      btn.innerHTML = '<span><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';
      btn.addEventListener("click", () => { v.controls = true; v.play(); btn.remove(); });
      v.parentElement.appendChild(btn);
    });
  } else if ("IntersectionObserver" in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          const p = v.play();
          p?.catch?.(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.35 });
    videos.forEach((v) => vio.observe(v));
  }

  /* ---------- Screenshot rails ---------- */
  document.querySelectorAll("[data-rail]").forEach((wrap) => {
    const rail = wrap.querySelector(".shots");
    wrap.querySelectorAll("[data-rail-step]").forEach((b) =>
      b.addEventListener("click", () => {
        rail.scrollBy({ left: Number(b.dataset.railStep) * rail.clientWidth * 0.8, behavior: reduceMotion.matches ? "auto" : "smooth" });
      })
    );
  });

  /* ---------- Lightbox ---------- */
  const shots = [...document.querySelectorAll("[data-lightbox]")];
  if (shots.length && typeof HTMLDialogElement === "function") {
    const dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Screenshot");
    const chev = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    dlg.innerHTML = `
      <img alt="">
      <button class="lb-btn lb-close" type="button" aria-label="Close">${chev("M6 6l12 12M18 6L6 18")}</button>
      <button class="lb-btn lb-prev" type="button" aria-label="Previous screenshot">${chev("M15 5l-7 7 7 7")}</button>
      <button class="lb-btn lb-next" type="button" aria-label="Next screenshot">${chev("M9 5l7 7-7 7")}</button>`;
    document.body.appendChild(dlg);
    const img = dlg.querySelector("img");
    let group = [], index = 0;
    const show = (i) => {
      index = (i + group.length) % group.length;
      const s = group[index];
      img.src = s.dataset.lightbox;
      img.alt = s.querySelector("img")?.alt || "";
    };
    shots.forEach((s) =>
      s.addEventListener("click", () => {
        group = shots.filter((x) => x.closest(".shots") === s.closest(".shots"));
        show(group.indexOf(s));
        dlg.showModal();
      })
    );
    dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
    dlg.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
    dlg.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
