import { useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Check, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { toast } from "sonner";

interface Price {
  id: string;
  unitAmount: number;
  currency: string;
  recurring?: { interval: string };
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  prices: Price[];
}

async function fetchProducts(token: string | null): Promise<Product[]> {
  const res = await fetch("/api/stripe/products", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

async function startCheckout(priceId: string, email: string | undefined, token: string | null): Promise<string> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ priceId, email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to start checkout");
  }
  const data = await res.json();
  return data.url;
}

function formatPrice(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(unitAmount / 100);
}

const PRO_FEATURES = [
  "Unlimited document uploads",
  "Single-document chat with citations",
  "Multi-document comparison",
  "Executive briefs & summaries",
  "Full verification trace",
  "Priority processing",
];

export default function UpgradePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["stripe-products"],
    queryFn: async () => {
      const token = await getToken();
      return fetchProducts(token);
    },
    staleTime: 60_000,
  });

  const allPrices = products.flatMap((p) =>
    p.prices.map((price) => ({ ...price, productName: p.name, productDescription: p.description })),
  );
  const monthlyPrices = allPrices.filter((p) => p.recurring?.interval === "month");
  const yearlyPrices = allPrices.filter((p) => p.recurring?.interval === "year");
  const displayPrices = monthlyPrices.length > 0 ? monthlyPrices : yearlyPrices.length > 0 ? yearlyPrices : allPrices;

  const handleUpgrade = async (priceId: string) => {
    setLoadingPriceId(priceId);
    try {
      const token = await getToken();
      const email = user?.primaryEmailAddress?.emailAddress;
      const url = await startCheckout(priceId, email, token);
      if (url) window.location.href = url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setLoadingPriceId(null);
    }
  };

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full mb-4">
              <Zap className="w-3 h-3" />
              Upgrade to Pro
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-3">
              Unlock the full platform
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              You've reached the free plan limit. Upgrade to upload unlimited documents and access all Signal87 features.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Feature list */}
            <div className="bg-secondary/50 rounded-2xl p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Everything in Pro
              </p>
              <ul className="space-y-3">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pricing cards */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayPrices.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Pricing is being configured. Contact us to get access.
                  </p>
                  <Button variant="outline" className="text-sm">
                    Contact sales
                  </Button>
                </div>
              ) : (
                displayPrices.map((price) => (
                  <div
                    key={price.id}
                    className="bg-card border border-primary/20 rounded-2xl p-6 shadow-sm"
                  >
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-foreground">
                        {formatPrice(price.unitAmount, price.currency)}
                      </span>
                      {price.recurring && (
                        <span className="text-muted-foreground text-sm">
                          /{price.recurring.interval}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      {price.productName ?? "Pro Plan"}
                    </p>
                    <Button
                      onClick={() => handleUpgrade(price.id)}
                      disabled={loadingPriceId === price.id}
                      className="w-full"
                    >
                      {loadingPriceId === price.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        "Upgrade now"
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
