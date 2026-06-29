import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isSubscriptionActive, stripePriceId, stripeTrialDays } from "../../lib/billing.js";

describe("stripeTrialDays", () => {
  const original = process.env.STRIPE_TRIAL_DAYS;

  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_TRIAL_DAYS;
    else process.env.STRIPE_TRIAL_DAYS = original;
  });

  it("defaults to 14 days", () => {
    delete process.env.STRIPE_TRIAL_DAYS;
    expect(stripeTrialDays()).toBe(14);
  });

  it("reads configured trial length", () => {
    process.env.STRIPE_TRIAL_DAYS = "21";
    expect(stripeTrialDays()).toBe(21);
  });

  it("returns 0 when trial is disabled", () => {
    process.env.STRIPE_TRIAL_DAYS = "0";
    expect(stripeTrialDays()).toBe(0);
  });
});

describe("subscription access rules", () => {
  it("grants access only for trialing and active", () => {
    expect(isSubscriptionActive("trialing")).toBe(true);
    expect(isSubscriptionActive("active")).toBe(true);
    expect(isSubscriptionActive("canceled")).toBe(false);
    expect(isSubscriptionActive("unpaid")).toBe(false);
    expect(isSubscriptionActive("incomplete_expired")).toBe(false);
    expect(isSubscriptionActive("past_due")).toBe(false);
    expect(isSubscriptionActive("none")).toBe(false);
  });
});

describe("stripePriceId", () => {
  const originalPro = process.env.STRIPE_PRICE_ID_PRO;
  const originalLegacy = process.env.STRIPE_PRICE_ID;

  afterEach(() => {
    if (originalPro === undefined) delete process.env.STRIPE_PRICE_ID_PRO;
    else process.env.STRIPE_PRICE_ID_PRO = originalPro;
    if (originalLegacy === undefined) delete process.env.STRIPE_PRICE_ID;
    else process.env.STRIPE_PRICE_ID = originalLegacy;
  });

  it("prefers STRIPE_PRICE_ID_PRO over STRIPE_PRICE_ID", () => {
    process.env.STRIPE_PRICE_ID_PRO = "price_pro";
    process.env.STRIPE_PRICE_ID = "price_legacy";
    expect(stripePriceId()).toBe("price_pro");
  });
});

describe("admin access helpers", () => {
  const originalAdmin = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = "ceo@signal87.ai,mbenezra@erezcapital.io";
  });

  afterEach(() => {
    if (originalAdmin === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdmin;
  });

  it("recognizes configured admin emails after module reload", async () => {
    vi.resetModules();
    const mod = await import("../../middlewares/requireAuth.js");
    expect(mod.isAdminEmail("ceo@signal87.ai")).toBe(true);
    expect(mod.isAdminEmail("mbenezra@erezcapital.io")).toBe(true);
    expect(mod.hasComplimentaryAccess("mbenezra@erezcapital.io")).toBe(true);
    expect(mod.isAdminEmail("other@example.com")).toBe(false);
  });
});