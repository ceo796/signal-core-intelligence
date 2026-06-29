import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { stripeTrialDays } from "../../lib/billing.js";

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
    const mod = await import("../../middlewares/requireAuth.js?reload=1");
    expect(mod.isAdminEmail("ceo@signal87.ai")).toBe(true);
    expect(mod.isAdminEmail("mbenezra@erezcapital.io")).toBe(true);
    expect(mod.hasComplimentaryAccess("mbenezra@erezcapital.io")).toBe(true);
    expect(mod.isAdminEmail("other@example.com")).toBe(false);
  });
});