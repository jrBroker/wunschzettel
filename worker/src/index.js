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
  if (m === "GET" && path === "/api/me") return json({ user: me });
  if (m === "GET" && path === "/api/invite") return json({ invite: env.INVITE_CODE });
  if (m === "GET" && path === "/api/users") return listUsers(env);
  if (m === "GET" && (match = path.match(/^\/api\/users\/(\d+)\/wishes$/)))
    return listWishes(env, me, Number(match[1]));
  if (m === "POST" && path === "/api/wishes") return createWish(request, env, me);
  if ((match = path.match(/^\/api\/wishes\/(\d+)$/))) {
    const id = Number(match[1]);
    if (m === "PUT") return updateWish(request, env, me, id);
    if (m === "DELETE") return deleteWish(env, me, id);
  }
  if ((match = path.match(/^\/api\/wishes\/(\d+)\/claim$/))) {
    const id = Number(match[1]);
    if (m === "POST") return claimWish(env, me, id);
    if (m === "DELETE") return unclaimWish(env, me, id);
  }
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
  const user = await env.DB.prepare(
    "SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  )
    .bind(await sha256(token))
    .first();
  if (!user) throw new HttpError(401, "Bitte anmelden");
  return user;
}

function cleanName(name) {
  name = String(name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 30) throw new HttpError(400, "Der Name muss 2 bis 30 Zeichen lang sein");
  return name;
}

async function register(request, env) {
  const { invite, name: rawName, password } = await body(request);
  if (!env.INVITE_CODE || !timingSafeEqual(String(invite || ""), env.INVITE_CODE))
    throw new HttpError(403, "Der Einladungslink ist ungültig");
  const name = cleanName(rawName);
  if (typeof password !== "string" || password.length < 6)
    throw new HttpError(400, "Das Passwort braucht mindestens 6 Zeichen");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE name = ?").bind(name).first();
  if (exists) throw new HttpError(409, "Diesen Namen gibt es schon");

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const row = await env.DB.prepare("INSERT INTO users (name, pw_hash, pw_salt) VALUES (?, ?, ?) RETURNING id, name")
    .bind(name, hash, salt)
    .first();
  const token = await createSession(env, row.id);
  return json({ token, user: row }, 201);
}

async function login(request, env) {
  const { name, password } = await body(request);
  const user = await env.DB.prepare("SELECT id, name, pw_hash, pw_salt FROM users WHERE name = ?")
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
  return json({ token, user: { id: user.id, name: user.name } });
}

async function logout(request, env) {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(bearer(request))).run();
  return json({ ok: true });
}

// ---------- data ----------

async function listUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, COUNT(w.id) AS wish_count
     FROM users u LEFT JOIN wishes w ON w.user_id = u.id
     GROUP BY u.id ORDER BY u.name COLLATE NOCASE`
  ).all();
  return json({ users: results });
}

async function listWishes(env, me, ownerId) {
  const owner = await env.DB.prepare("SELECT id, name FROM users WHERE id = ?").bind(ownerId).first();
  if (!owner) throw new HttpError(404, "Diese Person gibt es nicht");

  // The owner must never learn who claimed what, so claims are not even queried for them.
  if (owner.id === me.id) {
    const { results } = await env.DB.prepare(
      "SELECT id, slot, title, link FROM wishes WHERE user_id = ? ORDER BY slot, id"
    )
      .bind(ownerId)
      .all();
    return json({ owner, own: true, wishes: results });
  }

  const { results } = await env.DB.prepare(
    `SELECT w.id, w.slot, w.title, w.link, c.user_id AS claimed_by_id, cu.name AS claimed_by
     FROM wishes w
     LEFT JOIN claims c ON c.wish_id = w.id
     LEFT JOIN users cu ON cu.id = c.user_id
     WHERE w.user_id = ? ORDER BY w.slot, w.id`
  )
    .bind(ownerId)
    .all();
  const wishes = results.map(({ claimed_by_id, ...w }) => ({ ...w, claimed_by_me: claimed_by_id === me.id }));
  return json({ owner, own: false, wishes });
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
  return { slot, title, link: link || null };
}

async function ownWish(env, me, id) {
  const wish = await env.DB.prepare("SELECT id, user_id FROM wishes WHERE id = ?").bind(id).first();
  if (!wish) throw new HttpError(404, "Wunsch nicht gefunden");
  if (wish.user_id !== me.id) throw new HttpError(403, "Das ist nicht dein Wunsch");
  return wish;
}

async function createWish(request, env, me) {
  const w = validateWish(await body(request));
  const row = await env.DB.prepare(
    "INSERT INTO wishes (user_id, slot, title, link) VALUES (?, ?, ?, ?) RETURNING id, slot, title, link"
  )
    .bind(me.id, w.slot, w.title, w.link)
    .first();
  return json({ wish: row }, 201);
}

async function updateWish(request, env, me, id) {
  await ownWish(env, me, id);
  const w = validateWish(await body(request));
  const row = await env.DB.prepare(
    "UPDATE wishes SET slot = ?, title = ?, link = ? WHERE id = ? RETURNING id, slot, title, link"
  )
    .bind(w.slot, w.title, w.link, id)
    .first();
  return json({ wish: row });
}

async function deleteWish(env, me, id) {
  await ownWish(env, me, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM claims WHERE wish_id = ?").bind(id),
    env.DB.prepare("DELETE FROM wishes WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

async function claimWish(env, me, id) {
  const wish = await env.DB.prepare("SELECT id, user_id FROM wishes WHERE id = ?").bind(id).first();
  if (!wish) throw new HttpError(404, "Wunsch nicht gefunden");
  if (wish.user_id === me.id) throw new HttpError(403, "Eigene Wünsche kannst du nicht markieren");
  const res = await env.DB.prepare("INSERT OR IGNORE INTO claims (wish_id, user_id) VALUES (?, ?)")
    .bind(id, me.id)
    .run();
  if (res.meta.changes === 0) {
    const c = await env.DB.prepare("SELECT user_id FROM claims WHERE wish_id = ?").bind(id).first();
    if (c && c.user_id !== me.id) throw new HttpError(409, "Das schenkt schon jemand anderes");
  }
  return json({ ok: true });
}

async function unclaimWish(env, me, id) {
  await env.DB.prepare("DELETE FROM claims WHERE wish_id = ? AND user_id = ?").bind(id, me.id).run();
  return json({ ok: true });
}
