import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { SignUp, useAuth } from "@clerk/react";
import { customFetch } from "@workspace/api-client-react";
import { ArrowLeft, Check } from "lucide-react";

type BillingStatus = {
  billingConfigured: boolean;
  entitled: boolean;
  accessSource: "approved_email" | "stripe_subscription" | "none";
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

type WorkspaceUpgradeProps = {
  /** Landing funnel: account + payment. Upgrade: return from in-app paywall. */
  variant: "signup" | "upgrade";
};

function FeatureItem({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${accent ? "text-gray-300" : "text-gray-400"}`}>
      <Check className={`h-4 w-4 shrink-0 ${accent ? "text-violet-400" : "text-gray-600"}`} strokeWidth={2} />
      <span>{children}</span>
    </li>
  );
}

function WorkspaceUpgrade({ variant }: WorkspaceUpgradeProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountSectionRef = useRef<HTMLDivElement>(null);

  const isSignupFunnel = variant === "signup";
  const backHref = isSignupFunnel ? "/" : "/agents/hybrid";
  const backLabel = isSignupFunnel ? "Back to home" : "Back to AI Chat";

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn || loadingStatus) return;
    if (status?.entitled) {
      navigate("/documents");
    }
  }, [isLoaded, isSignedIn, loadingStatus, status?.entitled, navigate]);

  async function startCheckout() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      accountSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setStartingCheckout(true);
    setError(null);
    try {
      const data = await customFetch<CheckoutResponse>("/api/billing/create-checkout-session", {
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
      const data = await customFetch<CheckoutResponse>("/api/billing/create-portal-session", {
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

  const entitled = Boolean(status?.entitled);
  const canOpenPortal = Boolean(status?.subscription?.stripeCustomerId);
  const onSandboxTier = isLoaded && isSignedIn && !loadingStatus && !entitled;

  const headline = isSignupFunnel ? "Create your workspace" : "Upgrade your workspace";
  const subcopy = isSignupFunnel
    ? "Choose Workspace Pro, create your account, and complete secure Stripe checkout to unlock the full suite."
    : "Unlock deep Gemini reasoning over your entire document library. No limits, no web research noise.";

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#141414] p-6 text-white md:p-12">
      <header className="mx-auto mb-10 flex w-full max-w-5xl items-center justify-between md:mb-16">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Signal87 Workspace</span>
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center">
        <div className="mb-10 text-center md:mb-12">
          <h1 className="mb-3 text-4xl font-bold tracking-tight">{headline}</h1>
          <p className="mx-auto max-w-lg text-sm text-gray-400">{subcopy}</p>
        </div>

        {error && (
          <div className="mb-6 w-full max-w-3xl rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
          <div
            className={`flex flex-col justify-between rounded-2xl border border-gray-800 bg-[#1c1c1c] p-6 ${
              onSandboxTier ? "opacity-60" : "opacity-50"
            }`}
          >
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200">Sandbox</h3>
                  <p className="mt-1 text-xs text-gray-500">For basic testing</p>
                </div>
                <span className="text-2xl font-bold">$0</span>
              </div>

              <ul className="my-6 space-y-3 text-sm">
                <FeatureItem>Limited document uploads</FeatureItem>
                <FeatureItem>Standard AI reasoning response</FeatureItem>
              </ul>
            </div>

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-[#262626] py-2.5 text-sm font-medium text-gray-500"
            >
              {onSandboxTier ? "Current Tier" : "Free tier"}
            </button>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-violet-500/30 bg-[#1c1c1c] p-6 shadow-xl shadow-violet-500/5">
            <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Workspace Pro</h3>
                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                      Popular
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Full intelligence suite</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">$20</span>
                  <span className="block text-xs text-gray-500">/ month</span>
                </div>
              </div>

              <ul className="my-6 space-y-3 text-sm">
                <FeatureItem accent>Unlimited secure document uploads</FeatureItem>
                <FeatureItem accent>Priority Hybrid AI Chat (Gemini Reasoning)</FeatureItem>
                <FeatureItem accent>Advanced source tracking & citations</FeatureItem>
              </ul>
            </div>

            {entitled ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-default rounded-xl bg-violet-600/20 py-2.5 text-sm font-medium text-violet-300"
                >
                  {loadingStatus ? "Checking…" : "Current Tier"}
                </button>
                {canOpenPortal && (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={openingPortal}
                    className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50"
                  >
                    {openingPortal ? "Opening billing portal…" : "Manage billing"}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={startCheckout}
                disabled={startingCheckout || (isSignedIn && loadingStatus)}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-600/20 transition-all duration-200 hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!isSignedIn
                  ? "Create account to upgrade"
                  : startingCheckout
                  ? "Opening Stripe Checkout…"
                  : "Upgrade with Stripe"}
              </button>
            )}
          </div>
        </div>

        {isSignupFunnel && !isSignedIn && (
          <div
            id="create-account"
            ref={accountSectionRef}
            className="mt-12 w-full max-w-md scroll-mt-8 rounded-2xl border border-gray-800 bg-[#1c1c1c] p-6 md:p-8"
          >
            <h2 className="text-lg font-semibold text-white">Create your account</h2>
            <p className="mt-1 text-sm text-gray-400">
              Sign up below, then complete Stripe checkout to activate Workspace Pro.
            </p>
            <div className="mt-6">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-violet-400 hover:text-violet-300">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {isSignupFunnel && isSignedIn && !entitled && !loadingStatus && (
          <p className="mt-8 max-w-md text-center text-sm text-violet-300/90">
            Account ready — click <strong className="text-white">Upgrade with Stripe</strong> above to open secure
            checkout.
          </p>
        )}

        <div className="mt-12 flex items-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1">🔒 Secure Stripe Checkout</span>
          <span>•</span>
          <span>Cancel anytime instantly</span>
        </div>

        {status?.subscription?.currentPeriodEnd && entitled && (
          <p className="mt-4 text-xs text-gray-500">
            Current period ends {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}.
          </p>
        )}
      </main>

      <footer className="mx-auto mt-16 w-full max-w-5xl border-t border-gray-900 pt-6 text-center text-xs text-gray-600">
        © 2026 Signal87. All rights reserved.
      </footer>
    </div>
  );
}

/** Sign-up + payments page. `?from=app` keeps the in-app back link after paywall. */
export function SignUpWorkspace() {
  const fromApp =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("from") === "app";
  return <WorkspaceUpgrade variant={fromApp ? "upgrade" : "signup"} />;
}

/** Legacy /pricing URL → sign-up payments page. */
export default function PricingRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/sign-up?from=app", { replace: true });
  }, [navigate]);
  return null;
}