/* Cookie consent banner (English / French).
   The loader in <head> keeps Google Analytics and Tag Manager off until a choice is saved here.
   "Reject all" is as easy as "Accept all"; [data-consent-open] links reopen the choices at any time. */
(() => {
  const api = window.favaliaConsent;
  if (!api) return;
  const script = document.currentScript;
  const privacy = script?.dataset.privacy || "/privacy/";

  const T = {
    en: {
      title: "Cookies: your call",
      text: "We'd like to use Google Analytics to count visits and see which games people enjoy. It stays off unless you say yes, and you can change your mind any time with “Cookie settings” at the bottom of every page.",
      policy: "Privacy policy",
      other: "Français",
      necessary: ["Necessary", "Remember your theme, demo scores and this choice, in your browser only. Always on."],
      analytics: ["Analytics", "Google Analytics: pages viewed, device type and approximate location. No ads."],
      marketing: ["Marketing", "Lets us measure our ad campaigns with Google. Off unless you turn it on."],
      reject: "Reject all", accept: "Accept all", choose: "Choose", save: "Save choices",
      saved: "Saved. Change it any time with “Cookie settings”.",
      status: (c) => !c ? "You haven't made a choice yet." :
        `Your choice: analytics ${c.analytics ? "on" : "off"}, marketing ${c.marketing ? "on" : "off"} (saved ${new Date(c.t).toLocaleDateString("en-CA")}).`,
    },
    fr: {
      title: "Témoins : à vous de choisir",
      text: "Nous aimerions utiliser Google Analytics pour compter les visites et voir quels jeux vous plaisent. C'est désactivé tant que vous ne dites pas oui, et vous pouvez changer d'avis en tout temps avec « Paramètres des témoins » au bas de chaque page.",
      policy: "Politique de confidentialité",
      other: "English",
      necessary: ["Nécessaires", "Mémorisent votre thème, vos scores des démos et ce choix, dans votre navigateur seulement. Toujours actifs."],
      analytics: ["Mesure d'audience", "Google Analytics : pages vues, type d'appareil et emplacement approximatif. Aucune publicité."],
      marketing: ["Marketing", "Nous permet de mesurer nos campagnes publicitaires avec Google. Désactivé sauf si vous l'activez."],
      reject: "Tout refuser", accept: "Tout accepter", choose: "Personnaliser", save: "Enregistrer mes choix",
      saved: "C'est noté. Modifiez votre choix en tout temps avec « Paramètres des témoins ».",
      status: (c) => !c ? "Vous n'avez pas encore fait de choix." :
        `Votre choix : mesure d'audience ${c.analytics ? "activée" : "désactivée"}, marketing ${c.marketing ? "activé" : "désactivé"} (enregistré le ${new Date(c.t).toLocaleDateString("fr-CA")}).`,
    },
  };
  const docFr = (document.documentElement.lang || "").startsWith("fr");
  const navFr = (navigator.languages || [navigator.language || ""]).some((l) => String(l).toLowerCase().startsWith("fr"));
  let lang = docFr || navFr ? "fr" : "en";

  let box = null, returnFocus = null;

  const row = (key, checked, disabled) => {
    const [name, desc] = T[lang][key];
    return `<label class="consent-row">
        <span><b>${name}</b><small>${desc}</small></span>
        <input type="checkbox" role="switch" data-c="${key}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
      </label>`;
  };

  function render(showChoices) {
    const t = T[lang], c = api.get();
    box.lang = lang;
    box.innerHTML = `
      <div class="consent-card">
        <div class="consent-head">
          <h2 id="consent-title">${t.title}</h2>
          <button class="consent-lang" type="button" data-act="lang" lang="${lang === "en" ? "fr" : "en"}">${t.other}</button>
        </div>
        <p id="consent-text">${t.text} <a href="${privacy}${lang === "fr" ? "#fr" : ""}">${t.policy}</a></p>
        <div class="consent-choices" ${showChoices ? "" : "hidden"}>
          ${row("necessary", true, true)}
          ${row("analytics", c ? c.analytics : false)}
          ${row("marketing", c ? c.marketing : false)}
        </div>
        <div class="consent-actions">
          <button class="btn btn--sm" type="button" data-act="reject">${t.reject}</button>
          <button class="btn btn--sm" type="button" data-act="accept">${t.accept}</button>
          <button class="btn btn--sm btn--ghost" type="button" data-act="${showChoices ? "save" : "choose"}">${showChoices ? t.save : t.choose}</button>
        </div>
      </div>`;
  }

  function open(showChoices, fromEl) {
    if (!box) {
      box = document.createElement("section");
      box.className = "consent";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "false");
      box.setAttribute("aria-labelledby", "consent-title");
      box.setAttribute("aria-describedby", "consent-text");
      box.addEventListener("click", onClick);
      box.addEventListener("keydown", (e) => { if (e.key === "Escape" && api.get()) close(); });
      document.body.appendChild(box);
    }
    returnFocus = fromEl || null;
    render(showChoices);
    box.hidden = false;
    if (fromEl) box.querySelector(showChoices ? "input:not([disabled])" : "button")?.focus();
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    returnFocus?.focus?.();
    updateStatus();
  }

  function clearCookies(pattern) {
    const host = location.hostname;
    const parts = host.split(".");
    const domains = ["", host, "." + host, parts.length > 1 ? "." + parts.slice(-2).join(".") : ""];
    document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => pattern.test(n)).forEach((n) => {
      domains.forEach((d) => { document.cookie = `${n}=; Max-Age=0; path=/${d ? "; domain=" + d : ""}`; });
    });
  }

  function choose(analytics, marketing) {
    const before = api.get();
    api.save(analytics, marketing);
    if (!analytics) clearCookies(/^(_ga|_ga_.+|_gid|_gat.*)$/);
    if (!marketing) clearCookies(/^(_gcl_.+|_gac_.+)$/);
    // Withdrawing consent after Google's scripts loaded: reload so nothing keeps running from before.
    if (before && ((before.analytics && !analytics) || (before.marketing && !marketing))) { location.reload(); return; }
    close();
  }

  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "lang") {
      const open = !box.querySelector(".consent-choices").hidden;
      lang = lang === "en" ? "fr" : "en";
      render(open);
      box.querySelector('[data-act="lang"]').focus();
    } else if (act === "accept") choose(true, true);
    else if (act === "reject") choose(false, false);
    else if (act === "choose") { render(true); box.querySelector("input:not([disabled])")?.focus(); }
    else if (act === "save") choose(box.querySelector('[data-c="analytics"]').checked, box.querySelector('[data-c="marketing"]').checked);
  }

  function updateStatus() {
    document.querySelectorAll("[data-consent-status]").forEach((el) => {
      const l = el.closest("[lang]")?.lang?.startsWith("fr") ? "fr" : "en";
      el.textContent = T[l].status(api.get());
    });
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-consent-open]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.consentLang) lang = a.dataset.consentLang;
    open(true, a);
  });

  updateStatus();
  if (!api.get()) open(false);
})();
