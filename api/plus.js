// Huecount Plus, server side. Nothing secret ships in the browser bundle.
// Env: STRIPE_PAYMENT_LINK (https), PLUS_CODE_SHA256 (hex of restore code), PLUS_TOKEN_SECRET.
import crypto from "node:crypto";

const httpsUrl = (v) => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };

function sign(secret) {
  const data = Buffer.from(JSON.stringify({ plan: "plus", iat: Math.floor(Date.now() / 1000), n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${data}.${crypto.createHmac("sha256", secret).update(data).digest("base64url")}`;
}
function verify(token, secret) {
  if (!token || !secret) return false;
  const [data, sig] = String(token).split(".");
  if (!data || !sig) return false;
  if (!eq(sig, crypto.createHmac("sha256", secret).update(data).digest("base64url"))) return false;
  try { return JSON.parse(Buffer.from(data, "base64url").toString()).plan === "plus"; } catch { return false; }
}

// Best-effort brute-force brake on the shared restore code: per-IP miss count
// in this function instance (resets on cold start). The code itself should be
// long (openssl rand -hex 16); this just makes guessing noisy and slow.
const MISS_LIMIT = 8;
const MISS_WINDOW_MS = 10 * 60 * 1000;
const misses = new Map();
function clientIp(req) {
  const h = (req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "";
  return String(Array.isArray(h) ? h[0] : h).split(",")[0].trim() || "unknown";
}
function throttled(ip, now = Date.now()) {
  const m = misses.get(ip);
  if (!m || now - m.first > MISS_WINDOW_MS) return false;
  return m.count >= MISS_LIMIT;
}
function noteMiss(ip, now = Date.now()) {
  const m = misses.get(ip);
  if (!m || now - m.first > MISS_WINDOW_MS) misses.set(ip, { first: now, count: 1 });
  else m.count += 1;
  if (misses.size > 5000) misses.clear();
}
function resetThrottle() { misses.clear(); }

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = ""; for await (const c of req) raw += c; try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

async function handler(req, res, env = process.env) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const unlockUrl = httpsUrl(env.STRIPE_PAYMENT_LINK);
  const hash = String(env.PLUS_CODE_SHA256 || "").trim().toLowerCase();
  const secret = env.PLUS_TOKEN_SECRET || "";
  const restore = /^[a-f0-9]{64}$/.test(hash) && secret.length >= 16;
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (req.method === "GET") return send(200, { unlockUrl, restore });
  if (req.method !== "POST") return send(405, { error: "method" });
  const body = await readBody(req);
  if (body.op === "verify") return send(200, { ok: verify(body.token, secret) });
  if (body.op === "restore") {
    if (!restore) return send(200, { result: "unconfigured" });
    const ip = clientIp(req);
    if (throttled(ip)) { res.setHeader("retry-after", "600"); return send(429, { result: "slow" }); }
    const code = String(body.code || "").trim();
    if (code.length < 4 || code.length > 80 || !eq(sha(code), hash)) { noteMiss(ip); return send(200, { result: "miss" }); }
    misses.delete(ip);
    return send(200, { result: "ok", token: sign(secret) });
  }
  return send(400, { error: "op" });
}
export default handler;
export { handler, verify, resetThrottle, MISS_LIMIT };
