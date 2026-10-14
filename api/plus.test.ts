import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
// @ts-ignore js module
import * as plus from "./plus.js";
function call(method: string, body: unknown, env: Record<string, string>) {
  return new Promise<{ status: number; json: any }>((resolve) => {
    const res: any = { statusCode: 200, setHeader() {}, end(s: string) { resolve({ status: res.statusCode, json: JSON.parse(s) }); } };
    plus.handler({ method, body }, res, env);
  });
}
const code = "receipt-code-1234";
const env = { STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_x", PLUS_CODE_SHA256: createHash("sha256").update(code).digest("hex"), PLUS_TOKEN_SECRET: "0123456789abcdef0123" };
describe("api/plus", () => {
  it("shows coming soon with no payment link", async () => {
    expect((await call("GET", null, {})).json).toEqual({ unlockUrl: "", restore: false });
    expect((await call("GET", null, { STRIPE_PAYMENT_LINK: "http://x" })).json.unlockUrl).toBe("");
  });
  it("exposes the link but never the hash", async () => {
    const r = await call("GET", null, env);
    expect(r.json.unlockUrl).toBe(env.STRIPE_PAYMENT_LINK);
    expect(JSON.stringify(r.json)).not.toContain(env.PLUS_CODE_SHA256);
  });
  it("restores only with the right code and mints a verifiable token", async () => {
    expect((await call("POST", { op: "restore", code: "nope" }, env)).json.result).toBe("miss");
    expect((await call("POST", { op: "restore", code }, {})).json.result).toBe("unconfigured");
    const ok = await call("POST", { op: "restore", code }, env);
    expect(ok.json.result).toBe("ok");
    expect((await call("POST", { op: "verify", token: ok.json.token }, env)).json.ok).toBe(true);
  });
  it("rejects forged tokens", async () => {
    expect((await call("POST", { op: "verify", token: "eyJwbGFuIjoicGx1cyJ9.forged" }, env)).json.ok).toBe(false);
    expect((await call("POST", { op: "verify", token: "" }, env)).json.ok).toBe(false);
  });
});
