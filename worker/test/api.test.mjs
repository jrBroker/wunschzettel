// Runs against a local `wrangler dev` (default http://localhost:8787).
// Needs a local admin account: ADMIN_NAME / ADMIN_PASSWORD (default Iwan / testpass1).
import assert from "node:assert/strict";
import { extractImage } from "../src/index.js";

const API = process.env.API_URL || "http://localhost:8787";
const suffix = Date.now().toString(36);

async function call(method, path, { token, body, origin } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data, headers: res.headers };
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    console.error("  FAIL " + name + "\n       " + e.message);
    process.exitCode = 1;
  }
}

// ---------- preview image extraction (pure) ----------

await test("extractImage: og:image, any attribute order, entities", () => {
  const html = `<head><meta content="https://cdn.x.de/a.jpg?w=1&amp;h=2" property="og:image"></head>`;
  assert.equal(extractImage(html, "https://x.de/p"), "https://cdn.x.de/a.jpg?w=1&h=2");
});
await test("extractImage: relative URL resolved, http upgraded", () => {
  assert.equal(extractImage(`<meta property='og:image' content='/img/b.png'>`, "http://shop.de/a/b"), "https://shop.de/img/b.png");
});
await test("extractImage: twitter:image fallback, secure_url preferred", () => {
  assert.equal(extractImage(`<meta name="twitter:image" content="https://t.de/t.jpg">`, "https://t.de"), "https://t.de/t.jpg");
  const both = `<meta property="og:image" content="https://a.de/1.jpg"><meta property="og:image:secure_url" content="https://a.de/2.jpg">`;
  assert.equal(extractImage(both, "https://a.de"), "https://a.de/2.jpg");
});
await test("extractImage: JSON-LD product image (string, array, object)", () => {
  const ld = (img) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "x", image: img })}</script>`;
  assert.equal(extractImage(ld("https://s.de/p.jpg"), "https://s.de"), "https://s.de/p.jpg");
  assert.equal(extractImage(ld(["/a.jpg", "/b.jpg"]), "https://s.de/x"), "https://s.de/a.jpg");
  assert.equal(extractImage(`<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"Product","image":{"url":"https://s.de/o.jpg"}}]}</script>`, "https://s.de"), "https://s.de/o.jpg");
  assert.equal(extractImage(`<script type="application/ld+json">{kaputt</script>`, "https://s.de"), null);
});
await test("extractImage: Amazon product image markup", () => {
  const html = `<img alt="x" id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/81abc.jpg" src="https://m.media-amazon.com/images/I/41small.jpg">`;
  assert.equal(extractImage(html, "https://www.amazon.de/dp/1"), "https://m.media-amazon.com/images/I/81abc.jpg");
});
await test("extractImage: no image / javascript: rejected", () => {
  assert.equal(extractImage("<html><head><title>x</title></head>", "https://a.de"), null);
  assert.equal(extractImage(`<meta property="og:image" content="javascript:alert(1)">`, "https://a.de"), null);
});

// ---------- accounts ----------

const admin = { name: process.env.ADMIN_NAME || "Iwan", password: process.env.ADMIN_PASSWORD || "testpass1" };
{
  const r = await call("POST", "/api/login", { body: admin });
  assert.equal(r.status, 200, "admin login failed – is the local admin account set up?");
  admin.token = r.data.token;
  admin.id = r.data.user.id;
}
const INVITE = (await call("GET", "/api/invite", { token: admin.token })).data.invite;

const anna = { name: `Anna ${suffix}`, password: "geheim123" };
const ben = { name: `Ben ${suffix}`, password: "geheim456" };
const carl = { name: `Carl ${suffix}`, password: "geheim789" };

await test("register rejects wrong invite", async () => {
  const r = await call("POST", "/api/register", { body: { invite: "falsch", ...anna } });
  assert.equal(r.status, 403);
});

await test("register validates password length", async () => {
  const r = await call("POST", "/api/register", { body: { invite: INVITE, name: anna.name, password: "123" } });
  assert.equal(r.status, 400);
});

for (const u of [anna, ben, carl]) {
  await test(`register ${u.name}`, async () => {
    const r = await call("POST", "/api/register", { body: { invite: INVITE, ...u } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    u.token = r.data.token;
    u.id = r.data.user.id;
  });
}

await test("duplicate name (case-insensitive) rejected", async () => {
  const r = await call("POST", "/api/register", { body: { invite: INVITE, name: anna.name.toUpperCase(), password: "abcdefg" } });
  assert.equal(r.status, 409);
});

await test("login with wrong password fails", async () => {
  const r = await call("POST", "/api/login", { body: { name: anna.name, password: "nope123" } });
  assert.equal(r.status, 401);
});

await test("login works and /me returns user", async () => {
  const r = await call("POST", "/api/login", { body: anna });
  assert.equal(r.status, 200);
  const me = await call("GET", "/api/me", { token: r.data.token });
  assert.equal(me.data.user.name, anna.name);
});

await test("invite code only for logged-in users", async () => {
  assert.equal((await call("GET", "/api/invite")).status, 401);
  assert.equal((await call("GET", "/api/invite", { token: anna.token })).data.invite, INVITE);
});

await test("unauthenticated request rejected", async () => {
  assert.equal((await call("GET", "/api/users")).status, 401);
  assert.equal((await call("GET", "/api/users", { token: "deadbeef" })).status, 401);
  assert.equal((await call("GET", "/api/claims")).status, 401);
});

// ---------- wishes, price, favorite ----------

let wish1, wish2, wish3;
await test("Anna adds several wishes for one slot, with link, price, favorite", async () => {
  let r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "Buch", link: "example.com/buch", price: "24,99" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.link, "https://example.com/buch");
  assert.equal(r.data.wish.price_cents, 2499);
  assert.equal(r.data.wish.favorite, 0);
  wish1 = r.data.wish.id;
  r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "Socken", favorite: true } });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.link, null);
  assert.equal(r.data.wish.price_cents, null);
  assert.equal(r.data.wish.favorite, 1);
  wish2 = r.data.wish.id;
  r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 5, title: "Fahrrad", price: "1.299,50 €" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.price_cents, 129950);
  wish3 = r.data.wish.id;
});

await test("price formats: '30', '30.5', 'ca. 12'; invalid rejected", async () => {
  for (const [input, cents] of [["30", 3000], ["30.5", 3050], ["ca. 12", 1200]]) {
    const r = await call("PUT", `/api/wishes/${wish2}`, { token: anna.token, body: { slot: 1, title: "Socken", price: input, favorite: true } });
    assert.equal(r.data.wish.price_cents, cents, input);
  }
  for (const bad of ["abc", "12,345", "-5"]) {
    const r = await call("PUT", `/api/wishes/${wish2}`, { token: anna.token, body: { slot: 1, title: "Socken", price: bad } });
    assert.equal(r.status, 400, bad);
  }
});

await test("favorites are listed first within a slot", async () => {
  const r = await call("GET", `/api/users/${anna.id}/wishes`, { token: anna.token });
  const slot1 = r.data.wishes.filter((w) => w.slot === 1).map((w) => w.id);
  assert.deepEqual(slot1, [wish2, wish1]);
});

await test("invalid input rejected (slot, empty title, javascript: link)", async () => {
  assert.equal((await call("POST", "/api/wishes", { token: anna.token, body: { slot: 6, title: "x" } })).status, 400);
  assert.equal((await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "  " } })).status, 400);
  assert.equal((await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "x", link: "javascript:alert(1)" } })).status, 400);
});

await test("Ben cannot edit or delete Anna's wish", async () => {
  assert.equal((await call("PUT", `/api/wishes/${wish1}`, { token: ben.token, body: { slot: 1, title: "Hack" } })).status, 403);
  assert.equal((await call("DELETE", `/api/wishes/${wish1}`, { token: ben.token })).status, 403);
});

// ---------- claims / joint gifts ----------

await test("Anna cannot claim her own wish", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: anna.token })).status, 403);
});

await test("Ben claims wish1, Carl joins (joint gift), double claim is idempotent", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: ben.token })).status, 200);
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: carl.token })).status, 200);
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: carl.token })).status, 200);
  const r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  const w = r.data.wishes.find((x) => x.id === wish1);
  assert.deepEqual(w.givers.map((g) => g.name), [ben.name, carl.name]);
  assert.equal(w.claimed_by_me, true);
  assert.equal(r.data.wishes.find((x) => x.id === wish2).givers.length, 0);
});

await test("Carl leaving the joint gift keeps Ben's claim", async () => {
  await call("DELETE", `/api/wishes/${wish1}/claim`, { token: carl.token });
  const r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  const w = r.data.wishes.find((x) => x.id === wish1);
  assert.deepEqual(w.givers.map((g) => g.name), [ben.name]);
  assert.equal(w.claimed_by_me, false);
  await call("POST", `/api/wishes/${wish1}/claim`, { token: carl.token });
});

// ---------- shopping list ----------

await test("shopping list: bought/wrapped per giver, co-givers listed", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish3}/claim`, { token: ben.token })).status, 200);
  let r = await call("PUT", `/api/wishes/${wish1}/claim`, { token: ben.token, body: { bought: true } });
  assert.equal(r.status, 200);
  r = await call("GET", "/api/claims", { token: ben.token });
  assert.equal(r.data.claims.length, 2);
  const c1 = r.data.claims.find((c) => c.id === wish1);
  assert.equal(c1.bought, 1);
  assert.equal(c1.wrapped, 0);
  assert.equal(c1.owner_name, anna.name);
  assert.equal(c1.price_cents, 2499);
  assert.deepEqual(c1.co_givers, [carl.name]);
  // Carl's own status is independent of Ben's
  r = await call("GET", "/api/claims", { token: carl.token });
  assert.equal(r.data.claims.find((c) => c.id === wish1).bought, 0);
  r = await call("PUT", `/api/wishes/${wish1}/claim`, { token: ben.token, body: { wrapped: true } });
  assert.equal(r.data.bought, 1, "partial update keeps bought");
  assert.equal(r.data.wrapped, 1);
});

await test("cannot set status on a claim you don't have", async () => {
  assert.equal((await call("PUT", `/api/wishes/${wish2}/claim`, { token: ben.token, body: { bought: true } })).status, 404);
});

await test("Anna's shopping list is empty", async () => {
  const r = await call("GET", "/api/claims", { token: anna.token });
  assert.deepEqual(r.data.claims, []);
});

// ---------- secret notes ----------

let noteId;
await test("Ben writes a note; Carl sees it (not as his own)", async () => {
  let r = await call("POST", `/api/wishes/${wish1}/notes`, { token: ben.token, body: { text: "  Größe M!  " } });
  assert.equal(r.status, 201);
  assert.equal(r.data.note.text, "Größe M!");
  noteId = r.data.note.id;
  r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  const n = r.data.wishes.find((x) => x.id === wish1).notes;
  assert.equal(n.length, 1);
  assert.equal(n[0].author, ben.name);
  assert.equal(n[0].mine, false);
});

await test("notes: owner cannot write, empty/too long rejected", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish1}/notes`, { token: anna.token, body: { text: "hi" } })).status, 403);
  assert.equal((await call("POST", `/api/wishes/${wish1}/notes`, { token: ben.token, body: { text: "   " } })).status, 400);
  assert.equal((await call("POST", `/api/wishes/${wish1}/notes`, { token: ben.token, body: { text: "x".repeat(501) } })).status, 400);
});

await test("notes: only the author can delete", async () => {
  assert.equal((await call("DELETE", `/api/notes/${noteId}`, { token: carl.token })).status, 403);
  assert.equal((await call("DELETE", `/api/notes/${noteId}`, { token: anna.token })).status, 403);
  const tmp = await call("POST", `/api/wishes/${wish1}/notes`, { token: ben.token, body: { text: "weg damit" } });
  assert.equal((await call("DELETE", `/api/notes/${tmp.data.note.id}`, { token: ben.token })).status, 200);
});

// ---------- privacy ----------

await test("PRIVACY: Anna's own list has no givers, notes or status at all", async () => {
  const r = await call("GET", `/api/users/${anna.id}/wishes`, { token: anna.token });
  assert.equal(r.data.own, true);
  assert.equal(r.data.wishes.length, 3);
  const raw = JSON.stringify(r.data);
  for (const leak of ["claim", "giver", "notes", "bought", "wrapped", "Größe", ben.name, carl.name])
    assert.ok(!raw.includes(leak), `response leaks "${leak}": ${raw}`);
});

await test("PRIVACY: owner's list via another route (user list) leaks nothing", async () => {
  const raw = JSON.stringify((await call("GET", "/api/users", { token: anna.token })).data);
  for (const leak of ["claim", "giver", "Größe"]) assert.ok(!raw.includes(leak), leak);
});

// ---------- editing & deleting ----------

await test("editing a wish keeps claims and notes", async () => {
  const r = await call("PUT", `/api/wishes/${wish1}`, { token: anna.token, body: { slot: 2, title: "Buch (Hardcover)", link: "example.com/buch", price: "29" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.wish.slot, 2);
  const v = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  const w = v.data.wishes.find((x) => x.id === wish1);
  assert.equal(w.givers.length, 2);
  assert.equal(w.notes.length, 1);
});

await test("removing the link clears the image", async () => {
  const r = await call("PUT", `/api/wishes/${wish1}`, { token: anna.token, body: { slot: 2, title: "Buch", link: "" } });
  assert.equal(r.data.wish.link, null);
  assert.equal(r.data.wish.image_url, null);
});

await test("deleting a wish removes its claims and notes", async () => {
  const r = await call("DELETE", `/api/wishes/${wish1}`, { token: anna.token });
  assert.equal(r.status, 200);
  const b = await call("GET", "/api/claims", { token: ben.token });
  assert.ok(!b.data.claims.some((c) => c.id === wish1));
  assert.equal(b.data.claims.length, 1);
  assert.equal((await call("DELETE", `/api/notes/${noteId}`, { token: ben.token })).status, 404);
});

await test("user list shows wish counts", async () => {
  const r = await call("GET", "/api/users", { token: ben.token });
  assert.equal(r.data.users.find((u) => u.id === anna.id).wish_count, 2);
  assert.equal(r.data.users.find((u) => u.id === ben.id).wish_count, 0);
});

// ---------- live preview fetch (needs internet) ----------

let treeWish;
await test("preview image is fetched from a real page (Wikipedia) in a second step", async () => {
  const r = await call("POST", "/api/wishes", {
    token: carl.token,
    body: { slot: 3, title: "Weihnachtsbaum", link: "https://de.wikipedia.org/wiki/Weihnachtsbaum" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.image_url, null, "saving never waits for the image");
  treeWish = r.data.wish.id;
  const p = await call("POST", `/api/wishes/${treeWish}/preview`, { token: carl.token });
  assert.equal(p.status, 200);
  assert.match(p.data.wish.image_url || "", /^https:\/\/[a-z]+\.wikimedia\.org\/.+\.jpg/i);
});

await test("only the owner can refresh a preview", async () => {
  assert.equal((await call("POST", `/api/wishes/${treeWish}/preview`, { token: ben.token })).status, 403);
});

await test("image kept on unrelated edit, cleared when link changes", async () => {
  let r = await call("PUT", `/api/wishes/${treeWish}`, { token: carl.token, body: { slot: 4, title: "Baum", link: "https://de.wikipedia.org/wiki/Weihnachtsbaum" } });
  assert.ok(r.data.wish.image_url, "kept");
  r = await call("PUT", `/api/wishes/${treeWish}`, { token: carl.token, body: { slot: 4, title: "Baum", link: "https://example.com/anders" } });
  assert.equal(r.data.wish.image_url, null, "cleared");
});

await test("unreachable link: preview returns no image, wish stays", async () => {
  const r = await call("POST", "/api/wishes", { token: carl.token, body: { slot: 3, title: "Nix", link: "https://does-not-exist.invalid/x" } });
  assert.equal(r.status, 201);
  const p = await call("POST", `/api/wishes/${r.data.wish.id}/preview`, { token: carl.token });
  assert.equal(p.status, 200);
  assert.equal(p.data.wish.image_url, null);
  assert.equal(p.data.wish.title, "Nix");
});

// ---------- avatar ----------

await test("avatar: set, shown everywhere, invalid rejected, reset", async () => {
  assert.equal((await call("GET", "/api/me", { token: carl.token })).data.user.avatar, null);
  assert.equal((await call("PUT", "/api/me/avatar", { token: carl.token, body: { avatar: 49 } })).status, 200, "last cat");
  for (const bad of [0, 50, 2.5, "3", -1]) {
    assert.equal((await call("PUT", "/api/me/avatar", { token: carl.token, body: { avatar: bad } })).status, 400, String(bad));
  }
  const r = await call("PUT", "/api/me/avatar", { token: carl.token, body: { avatar: 21 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.avatar, 21);
  assert.equal((await call("GET", "/api/me", { token: carl.token })).data.user.avatar, 21);
  assert.equal((await call("GET", "/api/users", { token: anna.token })).data.users.find((u) => u.id === carl.id).avatar, 21);
  assert.equal((await call("GET", `/api/users/${carl.id}/wishes`, { token: anna.token })).data.owner.avatar, 21);
  assert.equal((await call("POST", "/api/login", { body: carl })).data.user.avatar, 21);
  // shows up as owner_avatar in someone's shopping list
  const w = (await call("POST", "/api/wishes", { token: carl.token, body: { slot: 1, title: `Avatar-Test ${suffix}` } })).data.wish;
  await call("POST", `/api/wishes/${w.id}/claim`, { token: anna.token });
  assert.equal((await call("GET", "/api/claims", { token: anna.token })).data.claims.find((c) => c.id === w.id).owner_avatar, 21);
  await call("DELETE", `/api/wishes/${w.id}`, { token: carl.token });
  assert.equal((await call("PUT", "/api/me/avatar", { token: carl.token, body: { avatar: null } })).data.user.avatar, null);
  assert.equal((await call("PUT", "/api/me/avatar", { body: { avatar: 1 } })).status, 401);
});

// ---------- own password ----------

await test("change own password: wrong current, too short, success", async () => {
  assert.equal((await call("POST", "/api/me/password", { token: ben.token, body: { current: "falsch", password: "neues123" } })).status, 403);
  assert.equal((await call("POST", "/api/me/password", { token: ben.token, body: { current: ben.password, password: "123" } })).status, 400);
  const other = (await call("POST", "/api/login", { body: ben })).data.token; // a second device
  const r = await call("POST", "/api/me/password", { token: ben.token, body: { current: ben.password, password: "neues123" } });
  assert.equal(r.status, 200);
  assert.equal((await call("GET", "/api/me", { token: ben.token })).status, 200, "current device stays signed in");
  assert.equal((await call("GET", "/api/me", { token: other })).status, 401, "other devices are signed out");
  assert.equal((await call("POST", "/api/login", { body: ben })).status, 401, "old password no longer works");
  ben.password = "neues123";
  assert.equal((await call("POST", "/api/login", { body: ben })).status, 200);
});

// ---------- admin ----------

await test("/api/me reports admin flag", async () => {
  assert.equal((await call("GET", "/api/me", { token: admin.token })).data.user.is_admin, true);
  assert.equal((await call("GET", "/api/me", { token: anna.token })).data.user.is_admin, false);
});

await test("non-admins get 403 on every admin endpoint", async () => {
  const t = anna.token;
  assert.equal((await call("POST", "/api/admin/invite", { token: t })).status, 403);
  assert.equal((await call("PUT", `/api/admin/users/${ben.id}`, { token: t, body: { name: "x" + suffix } })).status, 403);
  assert.equal((await call("DELETE", `/api/admin/users/${ben.id}`, { token: t })).status, 403);
  assert.equal((await call("POST", `/api/admin/users/${ben.id}/password`, { token: t, body: { password: "hacked1" } })).status, 403);
  assert.equal((await call("POST", "/api/login", { body: ben })).status, 200, "Ben's password unchanged");
});

await test("admin resets a password: old sessions end, new password works", async () => {
  const before = (await call("POST", "/api/login", { body: anna })).data.token;
  assert.equal((await call("POST", `/api/admin/users/${anna.id}/password`, { token: admin.token, body: { password: "12" } })).status, 400);
  const r = await call("POST", `/api/admin/users/${anna.id}/password`, { token: admin.token, body: { password: "vorlaeufig1" } });
  assert.equal(r.status, 200);
  assert.equal((await call("GET", "/api/me", { token: before })).status, 401);
  anna.password = "vorlaeufig1";
  const l = await call("POST", "/api/login", { body: anna });
  assert.equal(l.status, 200);
  anna.token = l.data.token;
  assert.equal((await call("POST", `/api/admin/users/999999/password`, { token: admin.token, body: { password: "abcdef" } })).status, 404);
});

await test("admin renames a person; clashes and bad names rejected", async () => {
  const newName = `Anni ${suffix}`;
  let r = await call("PUT", `/api/admin/users/${anna.id}`, { token: admin.token, body: { name: newName } });
  assert.equal(r.status, 200);
  assert.equal((await call("GET", "/api/me", { token: anna.token })).data.user.name, newName);
  assert.equal((await call("PUT", `/api/admin/users/${anna.id}`, { token: admin.token, body: { name: ben.name.toLowerCase() } })).status, 409);
  assert.equal((await call("PUT", `/api/admin/users/${anna.id}`, { token: admin.token, body: { name: "x" } })).status, 400);
  anna.name = newName;
  assert.equal((await call("POST", "/api/login", { body: anna })).status, 200, "login with the new name");
});

await test("admin still cannot see gift info on own list", async () => {
  const w = (await call("POST", "/api/wishes", { token: admin.token, body: { slot: 4, title: `Admin-Wunsch ${suffix}` } })).data.wish;
  await call("POST", `/api/wishes/${w.id}/claim`, { token: ben.token });
  await call("POST", `/api/wishes/${w.id}/notes`, { token: ben.token, body: { text: "pssst" } });
  const raw = JSON.stringify((await call("GET", `/api/users/${admin.id}/wishes`, { token: admin.token })).data);
  for (const leak of ["giver", "notes", "pssst", ben.name]) assert.ok(!raw.includes(leak), leak);
  await call("DELETE", `/api/wishes/${w.id}`, { token: admin.token });
});

await test("admin renews invite: old code dead, new code works", async () => {
  const r = await call("POST", "/api/admin/invite", { token: admin.token });
  assert.equal(r.status, 200);
  const fresh = r.data.invite;
  assert.notEqual(fresh, INVITE);
  assert.equal((await call("GET", "/api/invite", { token: anna.token })).data.invite, fresh);
  assert.equal((await call("POST", "/api/register", { body: { invite: INVITE, name: `Dora ${suffix}`, password: "abcdef" } })).status, 403);
  const d = await call("POST", "/api/register", { body: { invite: fresh, name: `Dora ${suffix}`, password: "abcdef" } });
  assert.equal(d.status, 201);
  assert.equal(d.data.user.is_admin, false);
  carl.dora = d.data.user.id;
});

await test("admin deletes a person with all their traces; cannot delete self", async () => {
  // Ben gifts Anna's wish and writes a note; Anna gifts nothing. Delete Ben.
  const annaWish = (await call("GET", `/api/users/${anna.id}/wishes`, { token: ben.token })).data.wishes[0];
  await call("POST", `/api/wishes/${annaWish.id}/claim`, { token: ben.token });
  await call("POST", `/api/wishes/${annaWish.id}/notes`, { token: ben.token, body: { text: "von Ben" } });
  assert.equal((await call("DELETE", `/api/admin/users/${admin.id}`, { token: admin.token })).status, 400);
  assert.equal((await call("DELETE", `/api/admin/users/${ben.id}`, { token: admin.token })).status, 200);
  assert.equal((await call("GET", "/api/me", { token: ben.token })).status, 401);
  assert.equal((await call("POST", "/api/login", { body: ben })).status, 401);
  const users = (await call("GET", "/api/users", { token: admin.token })).data.users;
  assert.ok(!users.some((u) => u.id === ben.id));
  const w = (await call("GET", `/api/users/${anna.id}/wishes`, { token: admin.token })).data.wishes.find((x) => x.id === annaWish.id);
  assert.ok(!w.givers.some((g) => g.id === ben.id), "Ben's claim gone");
  assert.ok(!w.notes.some((n) => n.text === "von Ben"), "Ben's note gone");
  assert.equal((await call("DELETE", `/api/admin/users/${ben.id}`, { token: admin.token })).status, 404);
});

// ---------- misc ----------

await test("CORS only for allowed origins", async () => {
  const ok = await call("GET", "/api/users", { token: ben.token, origin: "http://localhost:8080" });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:8080");
  const bad = await call("GET", "/api/users", { token: ben.token, origin: "https://evil.example" });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

await test("logout invalidates token", async () => {
  await call("POST", "/api/logout", { token: carl.token });
  assert.equal((await call("GET", "/api/me", { token: carl.token })).status, 401);
});

console.log(`\n${passed} Tests bestanden${process.exitCode ? ", einige FEHLGESCHLAGEN" : ""}`);
