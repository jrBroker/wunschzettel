const PBKDF2_ITERATIONS = 100000; // Workers caps PBKDF2 at 100k
const MAX_TITLE = 200;
const MAX_LINK = 1000;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let res;
    try {
      res = await route(request, env);
    } catch (err) {
      if (err instanceof HttpError) res = json({ error: err.message }, err.status);
      else {
        console.error(err);
        res = json({ error: "Interner Fehler" }, 500);
      }
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Ungültige Anfrage");
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const m = request.method;
  let match;

  if (m === "POST" && path === "/api/register") return register(request, env);
  if (m === "POST" && path === "/api/login") return login(request, env);

  const me = await authenticate(request, env);

  if (m === "POST" && path === "/api/logout") return logout(request, env);
  if (m === "GET" && path === "/api/me") return json({ user: publicUser(me) });
  if (m === "GET" && path === "/api/invite") return json({ invite: await currentInvite(env) });
  if (m === "POST" && path === "/api/me/password") return changeOwnPassword(request, env, me);
  if (m === "PUT" && path === "/api/me/avatar") return setAvatar(request, env, me);
  if (path.startsWith("/api/admin/")) {
    if (!me.is_admin) throw new HttpError(403, "Nur für Admins");
    if (m === "POST" && path === "/api/admin/invite") return renewInvite(env);
    if ((match = path.match(/^\/api\/admin\/users\/(\d+)$/))) {
      if (m === "PUT") return adminRename(request, env, Number(match[1]));
      if (m === "DELETE") return adminDeleteUser(env, me, Number(match[1]));
    }
    if (m === "POST" && (match = path.match(/^\/api\/admin\/users\/(\d+)\/password$/)))
      return adminResetPassword(request, env, Number(match[1]));
  }
  if (m === "GET" && path === "/api/users") return listUsers(env);
  if (m === "GET" && (match = path.match(/^\/api\/users\/(\d+)\/wishes$/)))
    return listWishes(env, me, Number(match[1]));
  if (m === "POST" && path === "/api/wishes") return createWish(request, env, me);
  if ((match = path.match(/^\/api\/wishes\/(\d+)$/))) {
    const id = Number(match[1]);
    if (m === "PUT") return updateWish(request, env, me, id);
    if (m === "DELETE") return deleteWish(env, me, id);
  }
  if (m === "POST" && (match = path.match(/^\/api\/wishes\/(\d+)\/preview$/)))
    return refreshPreview(env, me, Number(match[1]));
  if ((match = path.match(/^\/api\/wishes\/(\d+)\/claim$/))) {
    const id = Number(match[1]);
    if (m === "POST") return claimWish(env, me, id);
    if (m === "PUT") return updateClaim(request, env, me, id);
    if (m === "DELETE") return unclaimWish(env, me, id);
  }
  if (m === "GET" && path === "/api/claims") return myClaims(env, me);
  if (m === "POST" && (match = path.match(/^\/api\/wishes\/(\d+)\/notes$/)))
    return createNote(request, env, me, Number(match[1]));
  if (m === "DELETE" && (match = path.match(/^\/api\/notes\/(\d+)$/))) return deleteNote(env, me, Number(match[1]));
  throw new HttpError(404, "Nicht gefunden");
}

// ---------- crypto helpers ----------

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}

async function sha256(text) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- auth ----------

async function createSession(env, userId) {
  const token = randomHex(32);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)")
    .bind(await sha256(token), userId)
    .run();
  return token;
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

async function authenticate(request, env) {
  const token = bearer(request);
  if (!token) throw new HttpError(401, "Bitte anmelden");
  const tokenHash = await sha256(token);
  const user = await env.DB.prepare(
    "SELECT u.id, u.name, u.is_admin, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  )
    .bind(tokenHash)
    .first();
  if (!user) throw new HttpError(401, "Bitte anmelden");
  return { ...publicUser(user), tokenHash };
}

function publicUser(u) {
  return { id: u.id, name: u.name, is_admin: !!u.is_admin, avatar: u.avatar ?? null };
}

const AVATAR_COUNT = 49; // must match docs/avatars.js

async function setAvatar(request, env, me) {
  const { avatar } = await body(request);
  if (avatar !== null && !(Number.isInteger(avatar) && avatar >= 1 && avatar <= AVATAR_COUNT))
    throw new HttpError(400, "Diesen Avatar gibt es nicht");
  await env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(avatar, me.id).run();
  return json({ user: publicUser({ ...me, avatar }) });
}

function cleanName(name) {
  name = String(name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 30) throw new HttpError(400, "Der Name muss 2 bis 30 Zeichen lang sein");
  return name;
}

function checkPassword(password) {
  if (typeof password !== "string" || password.length < 6)
    throw new HttpError(400, "Das Passwort braucht mindestens 6 Zeichen");
  if (password.length > 200) throw new HttpError(400, "Das Passwort ist zu lang");
}

async function setPassword(env, userId, password) {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(hash, salt, userId).run();
}

// A code renewed by an admin lives in the DB; until then the INVITE_CODE secret applies.
async function currentInvite(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'invite_code'").first();
  return row ? row.value : env.INVITE_CODE;
}

async function register(request, env) {
  const { invite, name: rawName, password } = await body(request);
  const code = await currentInvite(env);
  if (!code || !timingSafeEqual(String(invite || ""), code)) throw new HttpError(403, "Der Einladungslink ist ungültig");
  const name = cleanName(rawName);
  checkPassword(password);

  const exists = await env.DB.prepare("SELECT id FROM users WHERE name = ?").bind(name).first();
  if (exists) throw new HttpError(409, "Diesen Namen gibt es schon");

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const row = await env.DB.prepare(
    "INSERT INTO users (name, pw_hash, pw_salt) VALUES (?, ?, ?) RETURNING id, name, is_admin, avatar"
  )
    .bind(name, hash, salt)
    .first();
  const token = await createSession(env, row.id);
  return json({ token, user: publicUser(row) }, 201);
}

async function login(request, env) {
  const { name, password } = await body(request);
  const user = await env.DB.prepare("SELECT id, name, is_admin, avatar, pw_hash, pw_salt FROM users WHERE name = ?")
    .bind(String(name || "").trim().replace(/\s+/g, " "))
    .first();
  const fail = new HttpError(401, "Name oder Passwort falsch");
  if (!user) {
    await hashPassword(String(password || ""), "00".repeat(16)); // keep timing similar
    throw fail;
  }
  const hash = await hashPassword(String(password || ""), user.pw_salt);
  if (!timingSafeEqual(hash, user.pw_hash)) throw fail;
  const token = await createSession(env, user.id);
  return json({ token, user: publicUser(user) });
}

async function logout(request, env) {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(bearer(request))).run();
  return json({ ok: true });
}

async function changeOwnPassword(request, env, me) {
  const { current, password } = await body(request);
  const user = await env.DB.prepare("SELECT pw_hash, pw_salt FROM users WHERE id = ?").bind(me.id).first();
  const hash = await hashPassword(String(current || ""), user.pw_salt);
  if (!timingSafeEqual(hash, user.pw_hash)) throw new HttpError(403, "Das aktuelle Passwort stimmt nicht");
  checkPassword(password);
  await setPassword(env, me.id, password);
  // Sign out every other device, keep this one.
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(me.id, me.tokenHash).run();
  return json({ ok: true });
}

// ---------- admin ----------

async function existingUser(env, id) {
  const user = await env.DB.prepare("SELECT id, name, is_admin, avatar FROM users WHERE id = ?").bind(id).first();
  if (!user) throw new HttpError(404, "Diese Person gibt es nicht");
  return user;
}

async function adminResetPassword(request, env, id) {
  const user = await existingUser(env, id);
  const { password } = await body(request);
  checkPassword(password);
  await setPassword(env, user.id, password);
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
  return json({ ok: true });
}

async function adminRename(request, env, id) {
  const user = await existingUser(env, id);
  const name = cleanName((await body(request)).name);
  const clash = await env.DB.prepare("SELECT id FROM users WHERE name = ? AND id != ?").bind(name, user.id).first();
  if (clash) throw new HttpError(409, "Diesen Namen gibt es schon");
  await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, user.id).run();
  return json({ user: publicUser({ ...user, name }) });
}

async function adminDeleteUser(env, me, id) {
  const user = await existingUser(env, id);
  if (user.id === me.id) throw new HttpError(400, "Du kannst dich nicht selbst entfernen");
  const theirWishes = "SELECT id FROM wishes WHERE user_id = ?";
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM notes WHERE user_id = ? OR wish_id IN (${theirWishes})`).bind(id, id),
    env.DB.prepare(`DELETE FROM claims WHERE user_id = ? OR wish_id IN (${theirWishes})`).bind(id, id),
    env.DB.prepare("DELETE FROM wishes WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

async function renewInvite(env) {
  const code = randomHex(12);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('invite_code', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(code)
    .run();
  return json({ invite: code });
}

// ---------- data ----------

async function listUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.avatar, COUNT(w.id) AS wish_count
     FROM users u LEFT JOIN wishes w ON w.user_id = u.id
     GROUP BY u.id ORDER BY u.name COLLATE NOCASE`
  ).all();
  return json({ users: results });
}

const WISH_COLUMNS = "w.id, w.slot, w.title, w.link, w.price_cents, w.favorite, w.image_url";
const WISH_ORDER = "ORDER BY w.slot, w.favorite DESC, w.id";

function placeholders(n) {
  return Array(n).fill("?").join(",");
}

async function listWishes(env, me, ownerId) {
  const owner = await env.DB.prepare("SELECT id, name, avatar FROM users WHERE id = ?").bind(ownerId).first();
  if (!owner) throw new HttpError(404, "Diese Person gibt es nicht");

  const { results: wishes } = await env.DB.prepare(`SELECT ${WISH_COLUMNS} FROM wishes w WHERE w.user_id = ? ${WISH_ORDER}`)
    .bind(ownerId)
    .all();

  // The owner must never learn who gifts what or read notes, so neither is even queried for them.
  if (owner.id === me.id) return json({ owner, own: true, wishes });

  const ids = wishes.map((w) => w.id);
  let claims = [];
  let notes = [];
  if (ids.length) {
    const [c, n] = await env.DB.batch([
      env.DB.prepare(
        `SELECT c.wish_id, u.id, u.name FROM claims c JOIN users u ON u.id = c.user_id
         WHERE c.wish_id IN (${placeholders(ids.length)}) ORDER BY c.created_at, u.id`
      ).bind(...ids),
      env.DB.prepare(
        `SELECT n.id, n.wish_id, n.text, n.created_at, n.user_id, u.name AS author FROM notes n JOIN users u ON u.id = n.user_id
         WHERE n.wish_id IN (${placeholders(ids.length)}) ORDER BY n.id`
      ).bind(...ids),
    ]);
    claims = c.results;
    notes = n.results;
  }
  return json({
    owner,
    own: false,
    wishes: wishes.map((w) => {
      const givers = claims.filter((c) => c.wish_id === w.id).map(({ id, name }) => ({ id, name }));
      return {
        ...w,
        givers,
        claimed_by_me: givers.some((g) => g.id === me.id),
        notes: notes
          .filter((n) => n.wish_id === w.id)
          .map((n) => ({ id: n.id, text: n.text, author: n.author, created_at: n.created_at, mine: n.user_id === me.id })),
      };
    }),
  });
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).replace(/[€\s]/g, "").replace(/^ca\.?/i, "");
  if (!s) return null;
  // Accept "29,99", "29.99", "1.299,50", "1299"
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new HttpError(400, "Der Preis sieht nicht gültig aus");
  const cents = Math.round(parseFloat(normalized) * 100);
  if (cents > 100000000) throw new HttpError(400, "Der Preis ist zu hoch");
  return cents;
}

function validateWish(input) {
  const slot = Number(input.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) throw new HttpError(400, "Ungültiger Termin");
  const title = String(input.title || "").trim();
  if (!title) throw new HttpError(400, "Bitte einen Wunsch eintragen");
  if (title.length > MAX_TITLE) throw new HttpError(400, `Der Wunsch darf höchstens ${MAX_TITLE} Zeichen haben`);
  let link = String(input.link || "").trim();
  if (link) {
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    let parsed;
    try {
      parsed = new URL(link);
    } catch {
      throw new HttpError(400, "Der Link sieht nicht gültig aus");
    }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes("."))
      throw new HttpError(400, "Der Link sieht nicht gültig aus");
    if (link.length > MAX_LINK) throw new HttpError(400, "Der Link ist zu lang");
    link = parsed.href;
  }
  return { slot, title, link: link || null, price_cents: parsePrice(input.price), favorite: input.favorite ? 1 : 0 };
}

// ---------- link preview image ----------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tagAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return attrs;
}

function safeImageUrl(candidate, base) {
  try {
    const url = new URL(decodeEntities(candidate.trim()), base);
    if (url.protocol === "http:") url.protocol = "https:"; // the site is https; http images would be blocked
    if (url.protocol !== "https:" || url.href.length > MAX_LINK) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function extractImage(html, baseUrl) {
  const found = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = tagAttrs(tag);
    const key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (a.content && !found[key]) found[key] = a.content;
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = tagAttrs(tag);
    if ((a.rel || "").toLowerCase() === "image_src" && a.href && !found.image_src) found.image_src = a.href;
  }
  for (const key of ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src", "image", "image_src"]) {
    if (found[key]) {
      const url = safeImageUrl(found[key], baseUrl);
      if (url) return url;
    }
  }
  for (const candidate of [jsonLdImage(html), amazonImage(html)]) {
    const url = candidate && safeImageUrl(candidate, baseUrl);
    if (url) return url;
  }
  return null;
}

// Shops often describe products as JSON-LD (schema.org) instead of og:image.
function jsonLdImage(html) {
  const pick = (img) => {
    if (typeof img === "string") return img;
    if (Array.isArray(img)) return pick(img[0]);
    if (img && typeof img === "object") return img.url || img.contentUrl || null;
    return null;
  };
  const find = (node, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 6) return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = find(n, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (node.image) {
      const r = pick(node.image);
      if (r) return r;
    }
    for (const v of Object.values(node)) {
      const r = find(v, depth + 1);
      if (r) return r;
    }
    return null;
  };
  for (const [, raw] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const r = find(JSON.parse(raw));
      if (r) return r;
    } catch {}
  }
  return null;
}

function amazonImage(html) {
  const m =
    html.match(/data-old-hires="(https:[^"]+)"/) ||
    html.match(/"hiRes":"(https:[^"]+)"/) ||
    html.match(/id="landingImage"[^>]*?\ssrc="(https:[^"]+)"/) ||
    html.match(/id="imgBlkFront"[^>]*?\ssrc="(https:[^"]+)"/);
  return m ? m[1] : null;
}

export async function fetchPreviewImage(link) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WunschzettelLinkPreview/1.0)",
        Accept: "text/html,application/xhtml+xml,image/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return null;
    const type = res.headers.get("content-type") || "";
    if (type.startsWith("image/")) {
      res.body.cancel();
      return safeImageUrl(link, link);
    }
    if (!type.includes("html")) {
      res.body.cancel();
      return null;
    }
    // Try the <head> first. If it has no image, scan the body chunk by chunk and stop at the first hit:
    // shop pages (Amazon ~2.5 MB) are too big to parse in one go within the Worker CPU limit.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const base = res.url || link;
    let head = "";
    let carry = ""; // unscanned tail of the previous chunk, so markers split across chunks are still found
    let read = 0;
    try {
      while (read < 3500000) {
        const { done, value } = await reader.read();
        if (done) break;
        read += value.length;
        const chunk = decoder.decode(value, { stream: true });
        if (head !== null) {
          const seam = head.slice(-7) + chunk;
          head += chunk;
          if (/<\/head>/i.test(seam) || head.length > 300000) {
            const fromHead = extractImage(head, base);
            if (fromHead) return fromHead;
            carry = head.slice(-2000);
            head = null;
          }
          continue;
        }
        const buf = carry + chunk;
        const found = amazonImage(buf) || jsonLdImage(buf);
        const url = found && safeImageUrl(found, base);
        if (url) return url;
        // Keep an unfinished JSON-LD block whole (bounded), otherwise just a short tail.
        const ld = buf.lastIndexOf("application/ld+json");
        const start = ld === -1 || buf.indexOf("</script>", ld) !== -1 ? -1 : buf.lastIndexOf("<script", ld);
        carry = start !== -1 && buf.length - start < 200000 ? buf.slice(start) : buf.slice(-2000);
      }
      return head ? extractImage(head, base) : null;
    } finally {
      reader.cancel().catch(() => {});
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- wishes ----------

async function ownWish(env, me, id) {
  const wish = await env.DB.prepare("SELECT id, user_id, link, image_url FROM wishes WHERE id = ?").bind(id).first();
  if (!wish) throw new HttpError(404, "Wunsch nicht gefunden");
  if (wish.user_id !== me.id) throw new HttpError(403, "Das ist nicht dein Wunsch");
  return wish;
}

const RETURN_WISH = "RETURNING id, slot, title, link, price_cents, favorite, image_url";

// The image is fetched in a separate request so a slow or blocked shop can never prevent saving a wish.
async function refreshPreview(env, me, id) {
  const wish = await ownWish(env, me, id);
  const image = wish.link ? await fetchPreviewImage(wish.link) : null;
  const row = await env.DB.prepare(`UPDATE wishes SET image_url = ? WHERE id = ? ${RETURN_WISH}`).bind(image, id).first();
  return json({ wish: row });
}

async function createWish(request, env, me) {
  const w = validateWish(await body(request));
  const row = await env.DB.prepare(
    `INSERT INTO wishes (user_id, slot, title, link, price_cents, favorite) VALUES (?, ?, ?, ?, ?, ?) ${RETURN_WISH}`
  )
    .bind(me.id, w.slot, w.title, w.link, w.price_cents, w.favorite)
    .first();
  return json({ wish: row }, 201);
}

async function updateWish(request, env, me, id) {
  const old = await ownWish(env, me, id);
  const w = validateWish(await body(request));
  const image = w.link && w.link === old.link ? old.image_url : null;
  const row = await env.DB.prepare(
    `UPDATE wishes SET slot = ?, title = ?, link = ?, price_cents = ?, favorite = ?, image_url = ? WHERE id = ? ${RETURN_WISH}`
  )
    .bind(w.slot, w.title, w.link, w.price_cents, w.favorite, image, id)
    .first();
  return json({ wish: row });
}

async function deleteWish(env, me, id) {
  await ownWish(env, me, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM claims WHERE wish_id = ?").bind(id),
    env.DB.prepare("DELETE FROM notes WHERE wish_id = ?").bind(id),
    env.DB.prepare("DELETE FROM wishes WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

// ---------- claims (who gifts what) ----------

async function foreignWish(env, me, id, ownMessage) {
  const wish = await env.DB.prepare("SELECT id, user_id FROM wishes WHERE id = ?").bind(id).first();
  if (!wish) throw new HttpError(404, "Wunsch nicht gefunden");
  if (wish.user_id === me.id) throw new HttpError(403, ownMessage);
  return wish;
}

async function claimWish(env, me, id) {
  await foreignWish(env, me, id, "Eigene Wünsche kannst du nicht markieren");
  await env.DB.prepare("INSERT OR IGNORE INTO claims (wish_id, user_id) VALUES (?, ?)").bind(id, me.id).run();
  return json({ ok: true });
}

async function updateClaim(request, env, me, id) {
  const input = await body(request);
  const claim = await env.DB.prepare("SELECT bought, wrapped FROM claims WHERE wish_id = ? AND user_id = ?")
    .bind(id, me.id)
    .first();
  if (!claim) throw new HttpError(404, "Du schenkst diesen Wunsch nicht");
  const bought = "bought" in input ? (input.bought ? 1 : 0) : claim.bought;
  const wrapped = "wrapped" in input ? (input.wrapped ? 1 : 0) : claim.wrapped;
  await env.DB.prepare("UPDATE claims SET bought = ?, wrapped = ? WHERE wish_id = ? AND user_id = ?")
    .bind(bought, wrapped, id, me.id)
    .run();
  return json({ ok: true, bought, wrapped });
}

async function unclaimWish(env, me, id) {
  await env.DB.prepare("DELETE FROM claims WHERE wish_id = ? AND user_id = ?").bind(id, me.id).run();
  return json({ ok: true });
}

async function myClaims(env, me) {
  const { results: rows } = await env.DB.prepare(
    `SELECT ${WISH_COLUMNS}, c.bought, c.wrapped, o.id AS owner_id, o.name AS owner_name, o.avatar AS owner_avatar
     FROM claims c JOIN wishes w ON w.id = c.wish_id JOIN users o ON o.id = w.user_id
     WHERE c.user_id = ? ORDER BY o.name COLLATE NOCASE, w.slot, w.id`
  )
    .bind(me.id)
    .all();
  let others = [];
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    ({ results: others } = await env.DB.prepare(
      `SELECT c.wish_id, u.name FROM claims c JOIN users u ON u.id = c.user_id
       WHERE c.wish_id IN (${placeholders(ids.length)}) AND c.user_id != ? ORDER BY c.created_at`
    )
      .bind(...ids, me.id)
      .all());
  }
  return json({
    claims: rows.map((r) => ({
      ...r,
      co_givers: others.filter((o) => o.wish_id === r.id).map((o) => o.name),
    })),
  });
}

// ---------- secret notes ----------

const MAX_NOTE = 500;

async function createNote(request, env, me, id) {
  await foreignWish(env, me, id, "Zu eigenen Wünschen kannst du keine Notizen schreiben");
  const text = String((await body(request)).text || "").trim();
  if (!text) throw new HttpError(400, "Die Notiz ist leer");
  if (text.length > MAX_NOTE) throw new HttpError(400, `Die Notiz darf höchstens ${MAX_NOTE} Zeichen haben`);
  const note = await env.DB.prepare(
    "INSERT INTO notes (wish_id, user_id, text) VALUES (?, ?, ?) RETURNING id, text, created_at"
  )
    .bind(id, me.id, text)
    .first();
  return json({ note: { ...note, author: me.name, mine: true } }, 201);
}

async function deleteNote(env, me, id) {
  const note = await env.DB.prepare("SELECT user_id FROM notes WHERE id = ?").bind(id).first();
  if (!note) throw new HttpError(404, "Notiz nicht gefunden");
  if (note.user_id !== me.id) throw new HttpError(403, "Du kannst nur eigene Notizen löschen");
  await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
