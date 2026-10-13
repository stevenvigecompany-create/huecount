import { describe, expect, it } from "vitest";
import { hashesMatch, isHttpsUrl, matchRestoreCode, playSound, playWorld, plusConfigFrom, plusReady, sha256Hex, stripPlusParam } from "./plus.ts";

describe("plusConfigFrom", () => {
  it("keeps an https payment link and a 64-character hash", () => {
    const hash = "a".repeat(64);
    const config = plusConfigFrom("  https://buy.stripe.com/test_abc  ", hash.toUpperCase());
    expect(config.unlockUrl).toBe("https://buy.stripe.com/test_abc");
    expect(config.codeHash).toBe(hash);
    expect(plusReady(config)).toBe(true);
  });

  it("drops a missing or unsafe link", () => {
    expect(plusConfigFrom("", "ab").unlockUrl).toBe("");
    expect(plusConfigFrom("http://buy.stripe.com/test", "ab").unlockUrl).toBe("");
    expect(plusConfigFrom("javascript:alert(1)", "ab").unlockUrl).toBe("");
    expect(plusReady(plusConfigFrom("", ""))).toBe(false);
    expect(isHttpsUrl("https://huecount.vercel.app/play")).toBe(true);
  });

  it("rejects a hash that is not sha256 hex", () => {
    expect(plusConfigFrom("https://buy.stripe.com/test", "not-a-hash").codeHash).toBe("");
    expect(plusConfigFrom("https://buy.stripe.com/test", "abcd").codeHash).toBe("");
  });
});

describe("matchRestoreCode", () => {
  it("accepts the code that hashes to the configured digest", async () => {
    const code = "huecount-test-code";
    const config = plusConfigFrom("https://buy.stripe.com/test", await sha256Hex(code));
    expect(await matchRestoreCode(`  ${code}  `, config)).toBe("ok");
    expect(await matchRestoreCode("nope-nope", config)).toBe("miss");
  });

  it("stays closed when the hash was not configured", async () => {
    const config = plusConfigFrom("https://buy.stripe.com/test", "");
    expect(await matchRestoreCode("huecount-test-code", config)).toBe("unconfigured");
  });

  it("compares hashes without bailing on the first difference", () => {
    expect(hashesMatch("ab", "ab")).toBe(true);
    expect(hashesMatch("ab", "ac")).toBe(false);
    expect(hashesMatch("ab", "abc")).toBe(false);
    expect(hashesMatch("", "")).toBe(false);
  });
});

describe("entitlements", () => {
  it("keeps Studio and Tick without Plus", () => {
    expect(playWorld("studio", false)).toBe("studio");
    expect(playWorld("dusk", false)).toBe("studio");
    expect(playWorld("field", true)).toBe("field");
    expect(playSound("tick", false)).toBe("tick");
    expect(playSound("glass", false)).toBe("tick");
    expect(playSound("wood", true)).toBe("wood");
  });
});

describe("stripPlusParam", () => {
  it("reads the restore code and drops it from the address", () => {
    const { code, next } = stripPlusParam("https://huecount.vercel.app/play?plus=secret-code&x=1#top");
    expect(code).toBe("secret-code");
    expect(next).toBe("/play?x=1#top");
  });

  it("leaves a bare play url alone", () => {
    expect(stripPlusParam("https://huecount.vercel.app/play").code).toBeNull();
    expect(stripPlusParam("https://huecount.vercel.app/play").next).toBe("/play");
  });
});

describe("restore-code flow", () => {
  it("hashes with standard sha256", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("accepts a configured hash in upper case", async () => {
    const code = "HC-RESTORE-1234";
    const upper = (await sha256Hex(code)).toUpperCase();
    const config = plusConfigFrom("", upper);
    expect(config.codeHash).toBe(upper.toLowerCase());
    expect(await matchRestoreCode(code, config)).toBe("ok");
  });

  it("restores even when no payment link is set, but the offer stays closed", async () => {
    const code = "receipt-code-9876";
    const config = plusConfigFrom("", await sha256Hex(code));
    expect(plusReady(config)).toBe(false);
    expect(await matchRestoreCode(code, config)).toBe("ok");
  });

  it("rejects codes that are too short or too long before hashing", async () => {
    const short = "abc";
    const long = "x".repeat(81);
    expect(await matchRestoreCode(short, plusConfigFrom("", await sha256Hex(short)))).toBe("miss");
    expect(await matchRestoreCode(long, plusConfigFrom("", await sha256Hex(long)))).toBe("miss");
    const edge = "x".repeat(80);
    expect(await matchRestoreCode(edge, plusConfigFrom("", await sha256Hex(edge)))).toBe("ok");
  });

  it("is case sensitive on the code itself", async () => {
    const config = plusConfigFrom("", await sha256Hex("Secret-Code"));
    expect(await matchRestoreCode("secret-code", config)).toBe("miss");
  });

  it("restores from a ?plus= link end to end and cleans the address", async () => {
    const code = "link-code-4242";
    const config = plusConfigFrom("https://buy.stripe.com/test", await sha256Hex(code));
    const { code: fromUrl, next } = stripPlusParam(`https://huecount.vercel.app/play?plus=${encodeURIComponent(code)}`);
    expect(next).toBe("/play");
    expect(fromUrl).not.toBeNull();
    expect(await matchRestoreCode(fromUrl ?? "", config)).toBe("ok");
  });

  it("rejects an empty ?plus= value", async () => {
    const config = plusConfigFrom("", await sha256Hex("real-code"));
    const { code } = stripPlusParam("https://huecount.vercel.app/play?plus=");
    expect(code).toBe("");
    expect(await matchRestoreCode(code ?? "", config)).toBe("miss");
  });
});
