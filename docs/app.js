(() => {
  "use strict";

  const API = window.API_URL;
  const app = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  const TOKEN_KEY = "wunschzettel-token";
  const USER_KEY = "wunschzettel-user";

  // ---------- storage ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  let token = store.get(TOKEN_KEY);
  let me = null;
  try { me = JSON.parse(store.get(USER_KEY) || "null"); } catch {}

  function setSession(t, user) {
    token = t; me = user;
    store.set(TOKEN_KEY, t);
    store.set(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    token = null; me = null;
    store.del(TOKEN_KEY); store.del(USER_KEY);
  }

  // ---------- api ----------
  class ApiError extends Error {
    constructor(status, msg) { super(msg); this.status = status; }
  }
  async function api(method, path, body) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = "Bearer " + token;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError(0, "Der Server ist gerade nicht erreichbar.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token && path !== "/api/login") {
        clearSession();
        route();
      }
      throw new ApiError(res.status, data.error || "Etwas ist schiefgelaufen.");
    }
    return data;
  }

  // ---------- dom helpers ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function svg(markup) {
    const t = document.createElement("template");
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  }
  function render(...nodes) {
    // replaceChildren would turn null into the text "null"
    app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  }

  let toastTimer;
  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast" + (isError ? " error" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch { return null; }
  }
  function prettyHost(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
  }

  const AVATAR_COLORS = ["#c8473a", "#2f8a5f", "#c99228", "#3d6fb0", "#8a4fb0", "#b0567f", "#2f8a8a", "#b06a2f"];
  function avatar(name) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return h("div", { class: "avatar", style: `background:${AVATAR_COLORS[hash % AVATAR_COLORS.length]}`, "aria-hidden": "true" },
      [...name][0].toUpperCase());
  }

  // ---------- icons ----------
  const STAR_PATH = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z";
  const icons = {
    star: (cls) => svg(`<svg viewBox="0 0 24 24" class="${cls || ""}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`),
    edit: () => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`),
    trash: () => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`),
    external: () => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>`),
    heart: (filled) => svg(`<svg viewBox="0 0 24 24" class="heart ${filled ? "on" : "off"}" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3 4 6.8 4c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3C21 4 23.1 8 21.6 11.6 19.5 16.4 12 21 12 21z"/></svg>`),
    note: () => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>`),
    x: () => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`),
    lock: () => svg(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9V7A5 5 0 0 0 7 7v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-8-2a3 3 0 0 1 6 0v2H9z"/></svg>`),
  };

  function candlesIcon(lit) {
    let parts = `<ellipse cx="32" cy="37" rx="31" ry="3.5" fill="#2f6b4c"/>`;
    for (let i = 0; i < 4; i++) {
      const x = 5 + i * 15;
      parts += `<rect x="${x}" y="17" width="9" height="19" rx="2" fill="${i < lit ? "#d2503f" : "#7a3a33"}"/>`;
      parts += `<line x1="${x + 4.5}" y1="17" x2="${x + 4.5}" y2="14" stroke="#3a2a1a" stroke-width="1.2"/>`;
      if (i < lit) {
        parts += `<circle cx="${x + 4.5}" cy="9" r="6" fill="#e9b44c" opacity=".18"/>`;
        parts += `<path class="flame" style="animation-delay:${i * 0.3}s" d="M${x + 4.5} 2.5c2.6 3.2 3 5.2 3 6.6a3 3 0 0 1-6 0c0-1.4.4-3.4 3-6.6z" fill="#ffc861"/>`;
      }
    }
    return svg(`<svg viewBox="0 0 64 40" class="slot-icon" aria-hidden="true">${parts}</svg>`);
  }
  function christmasIcon() {
    return svg(`<svg viewBox="0 0 64 40" class="slot-icon" aria-hidden="true">
      <circle cx="32" cy="20" r="17" fill="#e9b44c" opacity=".14"/>
      <g transform="translate(18 6) scale(1.17)"><path d="${STAR_PATH}" fill="#ffc861"/></g>
    </svg>`);
  }

  // ---------- season dates ----------
  const DAY = 86400000;
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function seasonYear() {
    const now = new Date();
    return now.getMonth() === 11 && now.getDate() > 26 ? now.getFullYear() + 1 : now.getFullYear();
  }
  function slots() {
    const y = seasonYear();
    const eve = new Date(y, 11, 24);
    const fourth = new Date(y, 11, 24 - eve.getDay()); // Sunday on/before Dec 24
    const list = [1, 2, 3, 4].map((n) => ({
      n, label: `${n}. Advent`, date: new Date(fourth.getTime() - (4 - n) * 7 * DAY),
    }));
    list.push({ n: 5, label: "Heiligabend", date: eve });
    const today = startOfToday();
    const next = list.find((s) => s.date >= today);
    for (const s of list) {
      s.past = s.date < today;
      s.next = s === next;
      s.today = s.date.getTime() === today.getTime();
    }
    return list;
  }
  const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "long" });

  function slotHead(s) {
    return h("div", { class: "slot-head" },
      s.n === 5 ? christmasIcon() : candlesIcon(s.n),
      h("div", null,
        h("h2", { class: "slot-title" }, s.label),
        h("div", { class: "slot-date" }, dateFmt.format(s.date))),
      s.today ? h("span", { class: "slot-badge" }, "Heute") : s.next ? h("span", { class: "slot-badge" }, "Als Nächstes") : null);
  }
  function slotCard(s, ...content) {
    const cls = ["card", "slot", s.past && "past", s.next && "next", s.n === 5 && "christmas"].filter(Boolean).join(" ");
    return h("section", { class: cls, "data-slot": s.n }, slotHead(s), ...content);
  }

  // ---------- views ----------
  function showLoading() {
    render(h("div", { class: "loading" }, h("div", { class: "spinner", role: "status", "aria-label": "Lädt" })));
  }

  function authView(invite) {
    topbar.hidden = true;
    const isRegister = !!invite;
    const err = h("p", { class: "form-error", role: "alert" });
    const nameInput = h("input", { class: "input", id: "name", name: "name", autocomplete: "username", required: true, maxlength: "30" });
    const pwInput = h("input", {
      class: "input", id: "pw", name: "password", type: "password", required: true,
      autocomplete: isRegister ? "new-password" : "current-password", minlength: isRegister ? "6" : null,
    });
    const submit = h("button", { class: "btn btn-primary", type: "submit" }, isRegister ? "Mitmachen" : "Anmelden");

    const form = h("form", {
      class: "auth-form",
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = "";
        submit.disabled = true;
        try {
          const data = isRegister
            ? await api("POST", "/api/register", { invite, name: nameInput.value, password: pwInput.value })
            : await api("POST", "/api/login", { name: nameInput.value, password: pwInput.value });
          setSession(data.token, data.user);
          if (isRegister) toast(`Willkommen, ${data.user.name}!`);
          goHome();
        } catch (ex) {
          err.textContent = ex.message;
          submit.disabled = false;
        }
      },
    },
      h("div", { class: "field" }, h("label", { for: "name" }, isRegister ? "Dein Name" : "Name"), nameInput),
      h("div", { class: "field" },
        h("label", { for: "pw" }, isRegister ? "Passwort wählen (mind. 6 Zeichen)" : "Passwort"), pwInput),
      err, submit);

    render(h("div", { class: "auth" },
      h("div", { class: "card auth-card" },
        icons.star("auth-hero"),
        h("h1", null, isRegister ? "Du bist eingeladen!" : "Unser Wunschzettel"),
        h("p", { class: "lead" }, isRegister
          ? "Leg dir einen Namen und ein Passwort an, dann kannst du deine Wünsche eintragen."
          : "Melde dich an, um Wünsche einzutragen und die Listen der Familie zu sehen."),
        form,
        isRegister
          ? h("p", { class: "auth-hint" }, "Schon dabei? ", h("a", { href: "#/" }, "Hier anmelden"))
          : h("p", { class: "auth-hint" }, "Noch kein Konto? Du brauchst einen Einladungslink aus der Familie."))));
    nameInput.focus();
  }

  async function homeView() {
    showLoading();
    const { users } = await api("GET", "/api/users");
    const today = startOfToday();
    const eve = new Date(seasonYear(), 11, 24);
    const days = Math.round((eve - today) / DAY);
    const sorted = [...users].sort((a, b) => (b.id === me.id) - (a.id === me.id));

    render(
      h("div", { class: "hero" },
        h("div", null,
          h("h1", null, "Hallo ", h("em", null, me.name), ","),
          h("p", null, "hier sind die Wunschzettel der ganzen Familie.")),
        h("div", { class: "countdown" },
          days < 0
            ? h("span", null, h("strong", null, "Frohe"), " Weihnachten!")
            : days === 0
              ? h("span", null, h("strong", null, "Heute"), " ist Heiligabend!")
              : [h("strong", null, String(days)), h("span", null, days === 1 ? "Tag bis" : "Tage bis", h("br"), "Heiligabend")])),
      window.dailyTextFor
        ? h("figure", { class: "daily" }, icons.star("daily-star"),
          h("blockquote", null, window.dailyTextFor(today)))
        : null,
      h("h2", { class: "section-title" }, "Familie"),
      h("div", { class: "family-grid" },
        sorted.map((u) => h("a", { class: "card person" + (u.id === me.id ? " me" : ""), href: `#/liste/${u.id}` },
          avatar(u.name),
          h("div", { class: "person-info" },
            h("div", { class: "person-name" }, u.name, u.id === me.id ? h("span", { class: "tag" }, "Du") : null),
            h("div", { class: "person-meta" },
              u.wish_count === 0 ? "Noch keine Wünsche" : u.wish_count === 1 ? "1 Wunsch" : `${u.wish_count} Wünsche`)))))
    );
  }

  async function listView(userId) {
    showLoading();
    const data = await api("GET", `/api/users/${userId}/wishes`);
    if (data.own) ownList(data);
    else otherList(data);
  }

  function listHeader(owner, own) {
    return [
      h("a", { class: "back", href: "#/" }, "← Zur Familie"),
      h("div", { class: "list-head" },
        avatar(owner.name),
        h("div", null, h("h1", null, own ? "Mein Wunschzettel" : `Wunschzettel von ${owner.name}`))),
    ];
  }

  function linkEl(link) {
    const href = safeUrl(link);
    if (!href) return null;
    return h("a", { class: "wish-link", href, target: "_blank", rel: "noopener noreferrer" }, prettyHost(href), icons.external());
  }

  function formatPrice(cents) {
    const digits = cents % 100 ? 2 : 0;
    return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function priceInputValue(cents) {
    return cents == null ? "" : (cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
  }

  function thumb(w) {
    const href = w.link ? safeUrl(w.link) : null;
    if (!w.image_url || !safeUrl(w.image_url)) return null;
    const img = h("img", { class: "thumb", src: w.image_url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => (href ? img.parentElement : img).remove());
    return href ? h("a", { class: "thumb-link", href, target: "_blank", rel: "noopener noreferrer", tabindex: "-1", "aria-hidden": "true" }, img) : img;
  }

  function wishMeta(w) {
    const parts = [];
    if (w.price_cents != null) parts.push(h("span", { class: "price" }, "ca. " + formatPrice(w.price_cents)));
    if (w.link) parts.push(linkEl(w.link));
    return parts.length ? h("div", { class: "wish-meta" }, parts) : null;
  }

  function wishTitle(w) {
    return h("div", { class: "wish-title" },
      w.favorite ? h("span", { class: "fav-mark", title: "Herzenswunsch" }, icons.heart(true), h("span", { class: "sr-only" }, "Herzenswunsch: ")) : null,
      w.title);
  }

  function joinNames(names) {
    return names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
  }

  function favToggle(initial) {
    const btn = h("button", { class: "fav-toggle", type: "button", title: "Herzenswunsch", "aria-label": "Herzenswunsch", "aria-pressed": String(!!initial) },
      icons.heart(false), icons.heart(true));
    btn.addEventListener("click", () => btn.setAttribute("aria-pressed", String(btn.getAttribute("aria-pressed") !== "true")));
    btn.isOn = () => btn.getAttribute("aria-pressed") === "true";
    return btn;
  }

  // --- own list (editable, no gift info) ---
  function ownList(data) {
    const state = { wishes: data.wishes, editing: null };

    function sortWishes() {
      state.wishes.sort((a, b) => a.slot - b.slot || b.favorite - a.favorite || a.id - b.id);
    }

    function draw(focusSlot) {
      const y = window.scrollY;
      sortWishes();
      render(
        ...listHeader(data.owner, true),
        h("div", { class: "notice" }, icons.lock(),
          h("div", null, "Trag für jeden Termin so viele Wünsche ein, wie du magst. Mit dem Herz markierst du Herzenswünsche. ",
            h("strong", null, "Wer dir was schenkt und was die anderen notieren, bleibt für dich geheim."))),
        h("div", { class: "timeline" }, slots().map((s) => {
          const items = state.wishes.filter((w) => w.slot === s.n);
          return slotCard(s,
            items.length
              ? h("ul", { class: "wishes" }, items.map((w) => state.editing === w.id ? editItem(w) : ownItem(w)))
              : h("p", { class: "empty" }, "Noch nichts eingetragen."),
            s.n <= 4 ? h("p", { class: "slot-hint" }, "Advents-Geschenke bitte bis ca. 50 €") : null,
            addForm(s.n));
        })));
      window.scrollTo(0, y);
      if (focusSlot) app.querySelector(`[data-slot="${focusSlot}"] .add-form input[name=title]`)?.focus();
    }

    async function loadPreview(w) {
      if (!w.link || w.image_url) return;
      try {
        const { wish } = await api("POST", `/api/wishes/${w.id}/preview`);
        const current = state.wishes.find((x) => x.id === w.id);
        if (!current || !wish.image_url || current.link !== wish.link) return;
        current.image_url = wish.image_url;
        // Insert just the image; a full redraw would wipe whatever the user is typing.
        const li = app.querySelector(`li[data-wish="${w.id}"]`);
        if (li && !li.querySelector(".thumb")) li.prepend(thumb(current));
      } catch {}
    }

    function ownItem(w) {
      return h("li", { class: "wish" + (w.favorite ? " fav" : ""), "data-wish": w.id },
        thumb(w),
        h("div", { class: "wish-body" }, wishTitle(w), wishMeta(w)),
        h("div", { class: "wish-actions" },
          h("button", { class: "btn-icon btn", type: "button", title: "Bearbeiten", "aria-label": `${w.title} bearbeiten`,
            onclick: () => { state.editing = w.id; draw(); app.querySelector(".edit-form input")?.focus(); } }, icons.edit()),
          h("button", { class: "btn-icon btn", type: "button", title: "Löschen", "aria-label": `${w.title} löschen`,
            onclick: async () => {
              if (!confirm(`„${w.title}“ wirklich löschen?`)) return;
              try {
                await api("DELETE", `/api/wishes/${w.id}`);
                state.wishes = state.wishes.filter((x) => x.id !== w.id);
                draw();
                toast("Wunsch gelöscht");
              } catch (e) { toast(e.message, true); }
            } }, icons.trash())));
    }

    function editItem(w) {
      const title = h("input", { class: "input", name: "title", value: w.title, maxlength: "200", required: true, "aria-label": "Wunsch" });
      const link = h("input", { class: "input", name: "link", value: w.link || "", placeholder: "Link (optional)", "aria-label": "Link" });
      const price = h("input", { class: "input", name: "price", value: priceInputValue(w.price_cents), placeholder: "Preis €", inputmode: "decimal", "aria-label": "Ungefährer Preis in Euro" });
      const fav = favToggle(w.favorite);
      const slotSel = h("select", { class: "input", "aria-label": "Termin" },
        slots().map((s) => h("option", { value: s.n, selected: s.n === w.slot }, s.label)));
      const save = h("button", { class: "btn btn-gold btn-sm", type: "submit" }, "Speichern");
      return h("li", { class: "wish" },
        h("form", { class: "edit-form", onsubmit: async (e) => {
          e.preventDefault();
          save.disabled = true;
          try {
            const { wish } = await api("PUT", `/api/wishes/${w.id}`,
              { slot: Number(slotSel.value), title: title.value, link: link.value, price: price.value, favorite: fav.isOn() });
            state.wishes = state.wishes.map((x) => (x.id === w.id ? wish : x));
            state.editing = null;
            draw();
            toast("Gespeichert");
            loadPreview(wish);
          } catch (ex) {
            toast(ex.message, true);
            save.disabled = false;
          }
        } },
          title, link,
          h("div", { class: "edit-row" }, price, fav, slotSel),
          h("div", { class: "row" },
            h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { state.editing = null; draw(); } }, "Abbrechen"),
            save)));
    }

    function addForm(slot) {
      const title = h("input", { class: "input f-title", name: "title", placeholder: "Was wünschst du dir?", maxlength: "200", required: true, "aria-label": "Neuer Wunsch" });
      const link = h("input", { class: "input f-link", name: "link", placeholder: "Link (optional)", "aria-label": "Link zum Wunsch" });
      const price = h("input", { class: "input f-price", name: "price", placeholder: "Preis €", inputmode: "decimal", "aria-label": "Ungefährer Preis in Euro (optional)" });
      const fav = favToggle(false);
      fav.classList.add("f-fav");
      const btn = h("button", { class: "btn btn-gold f-add", type: "submit" }, "Hinzufügen");
      return h("form", { class: "add-form", onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        try {
          const { wish } = await api("POST", "/api/wishes", { slot, title: title.value, link: link.value, price: price.value, favorite: fav.isOn() });
          state.wishes.push(wish);
          draw(slot);
          loadPreview(wish);
        } catch (ex) {
          toast(ex.message, true);
          btn.disabled = false;
        }
      } }, title, link, price, fav, btn);
    }

    draw();
  }

  // --- someone else's list (gifting + secret notes) ---
  function otherList(data) {
    const state = { wishes: data.wishes, openNotes: new Set() };

    async function reload() {
      const fresh = await api("GET", `/api/users/${data.owner.id}/wishes`);
      state.wishes = fresh.wishes;
      draw();
    }

    function draw() {
      const y = window.scrollY;
      const open = state.wishes.filter((w) => !w.givers.length).length;
      render(
        ...listHeader(data.owner, false),
        h("div", { class: "notice" }, icons.lock(),
          h("div", null, "Markiere, was du schenkst, damit nichts doppelt kommt. Für teure Wünsche könnt ihr zusammenlegen. ",
            h("strong", null, `${data.owner.name} sieht weder Markierungen noch Notizen.`),
            state.wishes.length ? ` Noch offen: ${open} von ${state.wishes.length}.` : "")),
        h("div", { class: "timeline" }, slots().map((s) => {
          const items = state.wishes.filter((w) => w.slot === s.n);
          return slotCard(s, items.length
            ? h("ul", { class: "wishes" }, items.map(otherItem))
            : h("p", { class: "empty" }, "Hier ist noch nichts eingetragen."));
        })));
      window.scrollTo(0, y);
    }

    function otherItem(w) {
      const cls = "wish" + (w.claimed_by_me ? " mine-claim" : w.givers.length ? " claimed" : "") + (w.favorite ? " fav" : "");
      let status = null, action;
      if (w.givers.length) {
        const names = w.givers.filter((g) => g.id !== me.id).map((g) => g.name);
        if (w.claimed_by_me) names.unshift("Du");
        const solo = names.length === 1;
        status = solo
          ? (names[0] === "Du" ? "Du schenkst das" : `${names[0]} schenkt das`)
          : `${joinNames(names)} schenken das zusammen`;
      }
      if (w.claimed_by_me) {
        action = h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => toggle(w, false) },
          w.givers.length > 1 ? "Aussteigen" : "Rückgängig");
      } else if (w.givers.length) {
        action = h("button", { class: "btn btn-ghost btn-sm", type: "button", title: "Zusammen mit den anderen schenken", onclick: () => toggle(w, true) }, "Mitschenken");
      } else {
        action = h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: () => toggle(w, true) }, "Ich schenke das");
      }
      return h("li", { class: cls },
        thumb(w),
        h("div", { class: "wish-body" },
          wishTitle(w),
          wishMeta(w),
          status ? h("div", { class: "wish-status" }, "✓ ", status) : null),
        h("div", { class: "wish-actions wide" }, action),
        notesBlock(w));
    }

    function notesBlock(w) {
      const input = h("input", { class: "input", placeholder: "z. B. Größe M, hab ich bestellt …", maxlength: "500", required: true, "aria-label": "Geheime Notiz" });
      const details = h("details", { class: "notes", open: state.openNotes.has(w.id) },
        h("summary", null, icons.note(), w.notes.length ? `Geheime Notizen (${w.notes.length})` : "Geheime Notiz schreiben"),
        w.notes.length ? h("ul", { class: "note-list" }, w.notes.map((n) => h("li", { class: "note" },
          h("div", null, h("strong", null, n.mine ? "Du" : n.author), ": ", n.text),
          n.mine ? h("button", { class: "btn-icon btn", type: "button", title: "Notiz löschen", "aria-label": "Notiz löschen",
            onclick: async () => {
              try { await api("DELETE", `/api/notes/${n.id}`); await reload(); } catch (e) { toast(e.message, true); }
            } }, icons.x()) : null))) : null,
        h("form", { class: "note-form", onsubmit: async (e) => {
          e.preventDefault();
          try {
            await api("POST", `/api/wishes/${w.id}/notes`, { text: input.value });
            state.openNotes.add(w.id);
            await reload();
            app.querySelector(`[data-notes="${w.id}"] .note-form input`)?.focus();
          } catch (ex) { toast(ex.message, true); }
        } }, input, h("button", { class: "btn btn-ghost btn-sm", type: "submit" }, "Notieren")));
      details.dataset.notes = w.id;
      details.addEventListener("toggle", () => {
        if (details.open) state.openNotes.add(w.id); else state.openNotes.delete(w.id);
      });
      return details;
    }

    async function toggle(w, claim) {
      try {
        await api(claim ? "POST" : "DELETE", `/api/wishes/${w.id}/claim`);
        await reload();
        toast(claim ? `Notiert: Du schenkst „${w.title}“` : "Markierung entfernt");
      } catch (e) {
        toast(e.message, true);
        if (e.status === 404) reload().catch(showError);
      }
    }

    draw();
  }

  // --- my shopping list ---
  async function shoppingView() {
    showLoading();
    const { claims } = await api("GET", "/api/claims");
    const slotLabels = Object.fromEntries(slots().map((s) => [s.n, s.label]));

    function draw() {
      const y = window.scrollY;
      const bought = claims.filter((c) => c.bought).length;
      const wrapped = claims.filter((c) => c.wrapped).length;
      const share = claims.reduce((sum, c) => sum + (c.price_cents ?? 0) / (1 + c.co_givers.length), 0);
      const hasPrices = claims.some((c) => c.price_cents != null);

      const groups = [];
      for (const c of claims) {
        let g = groups.find((x) => x.id === c.owner_id);
        if (!g) groups.push((g = { id: c.owner_id, name: c.owner_name, items: [] }));
        g.items.push(c);
      }

      render(
        h("a", { class: "back", href: "#/" }, "← Zur Familie"),
        h("div", { class: "list-head" }, h("h1", null, "Meine Einkäufe")),
        claims.length
          ? h("div", { class: "card stats" },
            stat(String(claims.length), claims.length === 1 ? "Geschenk" : "Geschenke"),
            stat(`${bought}/${claims.length}`, "gekauft"),
            stat(`${wrapped}/${claims.length}`, "eingepackt"),
            hasPrices ? stat(formatPrice(Math.round(share)), "dein Anteil ca.") : null)
          : h("div", { class: "card empty-state" },
            h("p", null, "Du hast noch nichts markiert."),
            h("p", { class: "muted" }, "Öffne die Wunschzettel der Familie und klick auf „Ich schenke das“."),
            h("a", { class: "btn btn-gold", href: "#/" }, "Zur Familie")),
        h("div", { class: "timeline" }, groups.map((g) => h("section", { class: "card slot" },
          h("a", { class: "person-head", href: `#/liste/${g.id}` }, avatar(g.name), h("h2", { class: "slot-title" }, `Für ${g.name}`)),
          h("ul", { class: "wishes" }, g.items.map(shopItem))))));
      window.scrollTo(0, y);
    }

    function stat(value, label) {
      return h("div", { class: "stat" }, h("strong", null, value), h("span", null, label));
    }

    function shopItem(c) {
      const done = c.bought && c.wrapped;
      return h("li", { class: "wish shop" + (done ? " done" : "") },
        thumb(c),
        h("div", { class: "wish-body" },
          wishTitle(c),
          h("div", { class: "wish-meta" },
            h("span", null, slotLabels[c.slot]),
            c.price_cents != null ? h("span", { class: "price" }, "ca. " + formatPrice(c.price_cents)) : null,
            c.link ? linkEl(c.link) : null),
          c.co_givers.length ? h("div", { class: "wish-status" }, "Zusammen mit " + joinNames(c.co_givers)) : null),
        h("div", { class: "wish-actions wide checks" },
          check(c, "bought", "Gekauft"),
          check(c, "wrapped", "Eingepackt")));
    }

    function check(c, field, label) {
      const id = `${field}-${c.id}`;
      const box = h("input", { type: "checkbox", id, checked: !!c[field] });
      box.addEventListener("change", async () => {
        box.disabled = true;
        try {
          const res = await api("PUT", `/api/wishes/${c.id}/claim`, { [field]: box.checked });
          c.bought = res.bought;
          c.wrapped = res.wrapped;
          draw();
        } catch (e) {
          toast(e.message, true);
          box.checked = !box.checked;
          box.disabled = false;
        }
      });
      return h("label", { class: "check", for: id }, box, h("span", null, label));
    }

    draw();
  }

  function inviteLink(code) {
    return `${location.origin}${location.pathname}#/einladung/${encodeURIComponent(code)}`;
  }
  async function copyInvite(code) {
    const link = inviteLink(code);
    try {
      await navigator.clipboard.writeText(link);
      toast("Einladungslink kopiert. Schick ihn an die Familie!");
    } catch {
      prompt("Diesen Link an die Familie schicken:", link);
    }
  }

  // --- account page (password, logout) + admin tools ---
  async function accountView() {
    showLoading();
    const { user } = await api("GET", "/api/me");
    setSession(token, user); // picks up admin flag or a rename done by an admin
    const users = user.is_admin ? (await api("GET", "/api/users")).users : [];
    const state = { users, open: null, confirmInvite: null };

    function draw() {
      const y = window.scrollY;
      render(
        h("a", { class: "back", href: "#/" }, "← Zur Familie"),
        h("div", { class: "list-head" }, avatar(me.name),
          h("div", null, h("h1", null, me.name), me.is_admin ? h("span", { class: "tag" }, "Admin") : null)),
        passwordCard(),
        me.is_admin ? adminCard() : null,
        h("div", { class: "account-footer" },
          h("button", { class: "btn btn-ghost", type: "button", onclick: logout }, "Abmelden")));
      window.scrollTo(0, y);
    }

    function passwordCard() {
      const err = h("p", { class: "form-error", role: "alert" });
      const cur = h("input", { class: "input", id: "pw-cur", type: "password", autocomplete: "current-password", required: true });
      const pw1 = h("input", { class: "input", id: "pw-new", type: "password", autocomplete: "new-password", minlength: "6", required: true });
      const pw2 = h("input", { class: "input", id: "pw-rep", type: "password", autocomplete: "new-password", minlength: "6", required: true });
      const btn = h("button", { class: "btn btn-gold", type: "submit" }, "Passwort ändern");
      return h("section", { class: "card panel" },
        h("h2", { class: "panel-title" }, "Passwort ändern"),
        h("form", { class: "stack", onsubmit: async (e) => {
          e.preventDefault();
          err.textContent = "";
          if (pw1.value !== pw2.value) { err.textContent = "Die neuen Passwörter stimmen nicht überein."; return; }
          btn.disabled = true;
          try {
            await api("POST", "/api/me/password", { current: cur.value, password: pw1.value });
            toast("Passwort geändert. Andere Geräte sind jetzt abgemeldet.");
            cur.value = pw1.value = pw2.value = "";
          } catch (ex) { err.textContent = ex.message; }
          btn.disabled = false;
        } },
          h("div", { class: "field" }, h("label", { for: "pw-cur" }, "Aktuelles Passwort"), cur),
          h("div", { class: "field" }, h("label", { for: "pw-new" }, "Neues Passwort (mind. 6 Zeichen)"), pw1),
          h("div", { class: "field" }, h("label", { for: "pw-rep" }, "Neues Passwort wiederholen"), pw2),
          err, h("div", null, btn)));
    }

    function adminCard() {
      return h("section", { class: "card panel" },
        h("h2", { class: "panel-title" }, "Verwaltung"),
        h("p", { class: "muted" }, "Auch als Admin siehst du nicht, wer dir etwas schenkt."),
        h("h3", { class: "sub-title" }, "Einladungslink"),
        h("div", { class: "row-wrap" },
          h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: async () => {
            try { await copyInvite((await api("GET", "/api/invite")).invite); } catch (e) { toast(e.message, true); }
          } }, "Link kopieren"),
          state.confirmInvite === "invite"
            ? [h("span", { class: "warn" }, "Der alte Link funktioniert danach nicht mehr."),
              h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: async () => {
                state.confirmInvite = null;
                try { const { invite } = await api("POST", "/api/admin/invite"); draw(); await copyInvite(invite); }
                catch (e) { toast(e.message, true); draw(); }
              } }, "Ja, neuen Link erstellen"),
              h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { state.confirmInvite = null; draw(); } }, "Abbrechen")]
            : h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { state.confirmInvite = "invite"; draw(); } }, "Neuen Link erstellen")),
        h("h3", { class: "sub-title" }, "Familienmitglieder"),
        h("ul", { class: "admin-list" }, state.users.map(adminRow)));
    }

    function adminRow(u) {
      const self = u.id === me.id;
      const open = state.open && state.open.id === u.id ? state.open.kind : null;
      let panel = null;
      if (open === "rename") {
        const input = h("input", { class: "input", value: u.name, maxlength: "30", required: true, "aria-label": "Neuer Name" });
        panel = h("form", { class: "inline-form", onsubmit: async (e) => {
          e.preventDefault();
          try {
            const r = await api("PUT", `/api/admin/users/${u.id}`, { name: input.value });
            u.name = r.user.name;
            if (self) setSession(token, { ...me, name: u.name });
            state.open = null; draw(); toast("Name geändert");
          } catch (ex) { toast(ex.message, true); }
        } }, input, h("button", { class: "btn btn-gold btn-sm", type: "submit" }, "Speichern"), cancelBtn());
        setTimeout(() => input.focus());
      } else if (open === "password") {
        const input = h("input", { class: "input", value: suggestPassword(), minlength: "6", required: true, "aria-label": "Vorläufiges Passwort" });
        panel = h("form", { class: "inline-form", onsubmit: async (e) => {
          e.preventDefault();
          try {
            await api("POST", `/api/admin/users/${u.id}/password`, { password: input.value });
            state.open = null; draw();
            toast(`Neues Passwort für ${u.name} gesetzt. Jetzt einfach weitergeben.`);
          } catch (ex) { toast(ex.message, true); }
        } },
          h("span", { class: "muted small" }, "Vorläufiges Passwort, das du weitergibst:"),
          input, h("button", { class: "btn btn-gold btn-sm", type: "submit" }, "Setzen"), cancelBtn());
      } else if (open === "delete") {
        panel = h("div", { class: "inline-form" },
          h("span", { class: "warn" }, `${u.name} mit allen Wünschen, Markierungen und Notizen entfernen?`),
          h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: async () => {
            try {
              await api("DELETE", `/api/admin/users/${u.id}`);
              state.users = state.users.filter((x) => x.id !== u.id);
              state.open = null; draw(); toast(`${u.name} wurde entfernt`);
            } catch (ex) { toast(ex.message, true); }
          } }, "Endgültig entfernen"), cancelBtn());
      }
      const action = (kind, label) => h("button", { class: "btn btn-ghost btn-sm" + (open === kind ? " active" : ""), type: "button",
        onclick: () => { state.open = open === kind ? null : { id: u.id, kind }; draw(); } }, label);
      return h("li", { class: "admin-row" },
        h("div", { class: "admin-person" }, avatar(u.name), h("strong", null, u.name), self ? h("span", { class: "tag" }, "Du") : null),
        h("div", { class: "row-wrap" },
          action("rename", "Umbenennen"),
          self ? null : action("password", "Passwort zurücksetzen"),
          self ? null : action("delete", "Entfernen")),
        panel);
    }

    function cancelBtn() {
      return h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { state.open = null; draw(); } }, "Abbrechen");
    }

    draw();
  }

  function suggestPassword() {
    const words = ["Stern", "Kerze", "Schnee", "Engel", "Glocke", "Zimt", "Tanne", "Rentier", "Keks", "Schlitten"];
    const n = crypto.getRandomValues(new Uint32Array(2));
    return `${words[n[0] % words.length]}-${1000 + (n[1] % 9000)}`;
  }

  async function logout() {
    try { await api("POST", "/api/logout"); } catch {}
    clearSession();
    goHome();
  }

  function showError(e) {
    if (e.status === 401) return;
    render(h("div", { class: "card auth-card", style: "margin:40px auto" },
      h("h1", null, "Hoppla"),
      h("p", { class: "lead" }, e.message),
      h("a", { class: "btn btn-gold", href: "#/" }, "Zur Startseite")));
  }

  // ---------- router ----------
  function goHome() {
    if (location.hash === "#/") route();
    else location.hash = "#/"; // hashchange triggers route()
  }

  async function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const invite = hash.match(/^\/einladung\/(.+)$/);

    if (!token) {
      authView(invite ? decodeURIComponent(invite[1]) : null);
      return;
    }
    topbar.hidden = false;
    if (invite) {
      history.replaceState(null, "", "#/");
      toast("Du bist schon angemeldet.");
    }
    const list = hash.match(/^\/liste\/(\d+)$/);
    document.getElementById("shopBtn").classList.toggle("active", hash === "/einkauf");
    document.getElementById("accountBtn").classList.toggle("active", hash === "/konto");
    try {
      if (list) await listView(Number(list[1]));
      else if (hash === "/einkauf") await shoppingView();
      else if (hash === "/konto") await accountView();
      else await homeView();
    } catch (e) {
      showError(e);
    }
  }

  document.getElementById("inviteBtn").addEventListener("click", async () => {
    try {
      const { invite } = await api("GET", "/api/invite");
      await copyInvite(invite);
    } catch (e) { toast(e.message, true); }
  });

  window.addEventListener("hashchange", () => { window.scrollTo(0, 0); route(); });
  route();

  // ---------- snow ----------
  const canvas = document.getElementById("snow");
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    let flakes = [], w = 0, hgt = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth; hgt = innerHeight;
      canvas.width = w * dpr; canvas.height = hgt * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, w / 12));
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * hgt,
        r: Math.random() * 2.2 + 0.6, s: Math.random() * 0.6 + 0.25,
        d: Math.random() * Math.PI * 2, o: Math.random() * 0.5 + 0.3,
      }));
    };
    resize();
    addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, w, hgt);
      for (const f of flakes) {
        f.y += f.s; f.d += 0.01; f.x += Math.sin(f.d) * 0.3;
        if (f.y > hgt + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${f.o})`;
        ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
})();
