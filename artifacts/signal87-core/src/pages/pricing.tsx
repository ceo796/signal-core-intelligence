import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { customFetch } from "@workspace/api-client-react";

type BillingStatus = {
  billingConfigured: boolean;
  trialDays: number;
  entitled: boolean;
  accessSource: "admin_email" | "approved_email" | "stripe_subscription" | "none";
  subscription: {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: string | null;
    updatedAt: string;
  } | null;
};

type CheckoutResponse = {
  url: string;
};

function statusLabel(status: BillingStatus | null): string {
  if (!status) return "Checking account status";
  if (status.accessSource === "admin_email") return "Admin access (full subscription)";
  if (status.accessSource === "approved_email") return "Approved internal access";
  if (status.accessSource === "stripe_subscription") {
    const subStatus = status.subscription?.status ?? "active";
    return subStatus === "trialing" ? "Free trial active" : `Subscription ${subStatus}`;
  }
  if (!status.billingConfigured) return "Billing setup required";
  return "No active subscription";
}

export default function Pricing() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!isLoaded || !isSignedIn) return;
      setLoadingStatus(true);
      setError(null);
      try {
        const data = await customFetch<BillingStatus>("/api/billing/status", { responseType: "json" });
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load billing status.");
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  async function startCheckout() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate("/sign-up");
      return;
    }

    setStartingCheckout(true);
    setError(null);
    try {
      const data = await customFetch<CheckoutResponse>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({}),
        responseType: "json",
      });
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Stripe Checkout.");
      setStartingCheckout(false);
    }
  }

  async function openPortal() {
    setOpeningPortal(true);
    setError(null);
    try {
      const data = await customFetch<CheckoutResponse>("/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({}),
        responseType: "json",
      });
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the billing portal.");
      setOpeningPortal(false);
    }
  }

  const canOpenPortal = Boolean(status?.subscription?.stripeCustomerId);
  const trialDays = status?.trialDays ?? 14;
  const onTrial = status?.subscription?.status === "trialing";

  return (
    <main className="min-h-screen bg-[#111211] text-[#eeeee7]">
      <header className="mx-auto flex w-[min(1120px,calc(100%-32px))] items-center justify-between py-7">
        <Link href="/" className="text-lg font-medium tracking-[-0.04em]">
          Signal87 AI
        </Link>
        <div className="flex items-center gap-4 text-sm text-[#b8bab2]">
          <Link href="/contact" className="hover:text-white">
            Book a demo
          </Link>
          {isSignedIn ? (
            status?.entitled ? (
              <Link href="/documents" className="rounded-full bg-[#f4f2e8] px-4 py-2 text-[#111211]">
                Open app
              </Link>
            ) : (
              <Link href="/sign-in" className="rounded-full border border-white/15 px-4 py-2 hover:border-white/35">
                Account
              </Link>
            )
          ) : (
            <Link href="/sign-in" className="rounded-full border border-white/15 px-4 py-2 hover:border-white/35">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-10 py-16 md:grid-cols-[0.95fr_1.05fr] md:py-24">
        <div>
          <p className="mb-5 text-sm uppercase tracking-[0.22em] text-[#6fd2ad]">Plans</p>
          <h1 className="max-w-2xl text-5xl font-normal leading-[0.98] tracking-[-0.075em] md:text-7xl">
            Start with a free trial.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#b8bab2]">
            Create an account, start your {trialDays}-day free trial through Stripe, and unlock secure document
            upload, grounded analysis, citations, and AI workflows. Your subscription renews automatically after the
            trial unless you cancel.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-[#b8bab2]">
            <div className="flex items-center justify-between gap-4">
              <span>Account status</span>
              <span className="rounded-full border border-[#6fd2ad]/35 px-3 py-1 text-[#bcebd8]">
                {loadingStatus ? "Checking" : statusLabel(status)}
              </span>
            </div>
            {status?.subscription?.currentPeriodEnd && (
              <p className="mt-3">
                {onTrial ? "Trial ends" : "Current period ends"}{" "}
                {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#171817] p-7 shadow-2xl md:p-9">
          <div className="rounded-2xl bg-[#f4f2e8] p-7 text-[#111211]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-3xl font-normal tracking-[-0.055em]">Signal87 Pro</h2>
                <p className="mt-2 text-sm text-[#59645e]">For operators, founders, funds, and teams.</p>
              </div>
              <div className="rounded-full bg-[#111211] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white">
                {trialDays}-day trial
              </div>
            </div>

            <div className="mt-8 space-y-3 text-sm text-[#26342e]">
              <div className="rounded-xl bg-white p-4">{trialDays}-day free trial, then recurring subscription via Stripe</div>
              <div className="rounded-xl bg-white p-4">Secure document upload and private workspace access</div>
              <div className="rounded-xl bg-white p-4">Grounded answers with citations and source traceability</div>
              <div className="rounded-xl bg-white p-4">Executive briefs, document chat, and multi-document analysis</div>
            </div>

            <button
              type="button"
              onClick={startCheckout}
              disabled={startingCheckout || status?.entitled}
              className="mt-8 w-full rounded-full bg-[#111211] px-5 py-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {status?.entitled
                ? "Access active"
                : startingCheckout
                  ? "Opening Stripe Checkout…"
                  : `Start ${trialDays}-day free trial`}
            </button>

            {canOpenPortal && (
              <button
                type="button"
                onClick={openPortal}
                disabled={openingPortal}
                className="mt-3 w-full rounded-full border border-[#111211]/15 px-5 py-4 text-sm font-medium text-[#111211] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                {openingPortal ? "Opening billing portal…" : "Manage billing"}
              </button>
            )}
          </div>

          <p className="mt-5 text-sm leading-6 text-[#b8bab2]">
            Cancel anytime from the Stripe billing portal before your trial ends to avoid being charged. Admin and
            approved internal emails receive complimentary full access.
          </p>
        </div>
      </section>
    </main>
  );
}