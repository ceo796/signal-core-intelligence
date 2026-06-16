import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

export interface SubscriptionStatus {
  plan: "free" | "pro";
  subscriptionStatus: string | null;
  documentCount: number;
  documentLimit: number | null;
}

async function fetchSubscription(token: string | null): Promise<SubscriptionStatus> {
  const res = await fetch("/api/stripe/subscription", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch subscription");
  return res.json();
}

export function useSubscription() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<SubscriptionStatus>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const token = await getToken();
      return fetchSubscription(token);
    },
    enabled: !!isSignedIn,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
