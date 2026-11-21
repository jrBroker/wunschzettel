// Runs against a local `wrangler dev` (default http://localhost:8787) with INVITE_CODE=lokaler-test-code.
import assert from "node:assert/strict";

const API = process.env.API_URL || "http://localhost:8787";
const INVITE = process.env.INVITE_CODE || "lokaler-test-code";
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
});

let wish1, wish2;
await test("Anna adds several wishes for one slot, with link", async () => {
  let r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "Buch", link: "example.com/buch" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.link, "https://example.com/buch");
  wish1 = r.data.wish.id;
  r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 1, title: "Socken" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.wish.link, null);
  wish2 = r.data.wish.id;
  r = await call("POST", "/api/wishes", { token: anna.token, body: { slot: 5, title: "Fahrrad" } });
  assert.equal(r.status, 201);
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

await test("Anna cannot claim her own wish", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: anna.token })).status, 403);
});

await test("Ben claims wish1; Carl cannot claim it too", async () => {
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: ben.token })).status, 200);
  assert.equal((await call("POST", `/api/wishes/${wish1}/claim`, { token: carl.token })).status, 409);
});

await test("Carl sees Ben's claim, Ben sees claimed_by_me", async () => {
  const c = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  const w = c.data.wishes.find((x) => x.id === wish1);
  assert.equal(w.claimed_by, ben.name);
  assert.equal(w.claimed_by_me, false);
  const b = await call("GET", `/api/users/${anna.id}/wishes`, { token: ben.token });
  assert.equal(b.data.wishes.find((x) => x.id === wish1).claimed_by_me, true);
  assert.equal(b.data.wishes.find((x) => x.id === wish2).claimed_by, null);
});

await test("PRIVACY: Anna's own list contains no claim info at all", async () => {
  const r = await call("GET", `/api/users/${anna.id}/wishes`, { token: anna.token });
  assert.equal(r.data.own, true);
  assert.equal(r.data.wishes.length, 3);
  const raw = JSON.stringify(r.data);
  assert.ok(!raw.includes("claim"), "response leaks claim fields: " + raw);
  assert.ok(!raw.includes(ben.name), "response leaks claimer name");
});

await test("Carl cannot unclaim Ben's claim; Ben can", async () => {
  await call("DELETE", `/api/wishes/${wish1}/claim`, { token: carl.token });
  let r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  assert.equal(r.data.wishes.find((x) => x.id === wish1).claimed_by, ben.name);
  await call("DELETE", `/api/wishes/${wish1}/claim`, { token: ben.token });
  r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  assert.equal(r.data.wishes.find((x) => x.id === wish1).claimed_by, null);
});

await test("Anna edits and deletes her wish (claim removed with it)", async () => {
  await call("POST", `/api/wishes/${wish2}/claim`, { token: carl.token });
  let r = await call("PUT", `/api/wishes/${wish2}`, { token: anna.token, body: { slot: 2, title: "Warme Socken", link: "" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.wish.slot, 2);
  r = await call("DELETE", `/api/wishes/${wish2}`, { token: anna.token });
  assert.equal(r.status, 200);
  r = await call("GET", `/api/users/${anna.id}/wishes`, { token: carl.token });
  assert.ok(!r.data.wishes.some((x) => x.id === wish2));
});

await test("user list shows wish counts", async () => {
  const r = await call("GET", "/api/users", { token: ben.token });
  assert.equal(r.data.users.find((u) => u.id === anna.id).wish_count, 2);
  assert.equal(r.data.users.find((u) => u.id === ben.id).wish_count, 0);
});

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
