import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
// @ts-ignore js module
import * as plus from "./plus.js";

function call(body: unknown, env: Record<string, string>, ip = "1.2.3.4") {
  return new Promise<{ status: number; json: any; headers: Record<string, string> }>((resolve) => {
    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) { headers[k] = v; },
      end(s: string) { resolve({ status: res.statusCode, json: JSON.parse(s), headers }); },
    };
    plus.handler({ method: "POST", body, headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } }, res, env);
  });
}
const code = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const env = { STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_x", PLUS_CODE_SHA256: createHash("sha256").update(code).digest("hex"), PLUS_TOKEN_SECRET: "0123456789abcdef0123" };

describe("api/plus restore throttle", () => {
  beforeEach(() => plus.resetThrottle());

  it(`after ${8} misses from one IP, even the right code gets 429 slow`, async () => {
    for (let i = 0; i < plus.MISS_LIMIT; i++) expect((await call({ op: "restore", code: `guess-${i}` }, env)).json.result).toBe("miss");
    const blocked = await call({ op: "restore", code }, env);
    expect(blocked.status).toBe(429);
    expect(blocked.json.result).toBe("slow");
    expect(blocked.headers["retry-after"]).toBe("600");
  });

  it("another IP is not affected; a success clears the IP's count", async () => {
    for (let i = 0; i < plus.MISS_LIMIT; i++) await call({ op: "restore", code: `guess-${i}` }, env, "9.9.9.9");
    expect((await call({ op: "restore", code }, env, "5.5.5.5")).json.result).toBe("ok");
    for (let i = 0; i < plus.MISS_LIMIT - 1; i++) await call({ op: "restore", code: `g-${i}` }, env, "7.7.7.7");
    expect((await call({ op: "restore", code }, env, "7.7.7.7")).json.result).toBe("ok");
    expect((await call({ op: "restore", code: "g-x" }, env, "7.7.7.7")).json.result).toBe("miss");
  });

  it("unconfigured restore never counts or throttles", async () => {
    for (let i = 0; i < 20; i++) expect((await call({ op: "restore", code: "x".repeat(10) }, {})).json.result).toBe("unconfigured");
  });

  it("verify is never throttled", async () => {
    for (let i = 0; i < plus.MISS_LIMIT; i++) await call({ op: "restore", code: `guess-${i}` }, env);
    const r = await call({ op: "verify", token: "bad.token" }, env);
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(false);
  });
});
