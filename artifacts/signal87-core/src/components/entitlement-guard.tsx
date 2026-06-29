import { type ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";

type BillingStatus = {
  entitled: boolean;
};

const exemptPaths = new Set(["/pricing", "/settings"]);

function isExemptPath(path: string): boolean {
  return [...exemptPaths].some((route) => path === route || path.startsWith(`${route}/`));
}

/** Redirect signed-in users without a trial/subscription to pricing. */
export function EntitlementGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location, navigate] = useLocation();

  const statusQuery = useQuery({
    queryKey: ["billing", "entitlement"],
    queryFn: () => customFetch<BillingStatus>("/api/billing/status", { responseType: "json" }),
    enabled: isLoaded && isSignedIn && !isExemptPath(location),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isExemptPath(location)) return;
    if (statusQuery.isLoading || statusQuery.isFetching) return;
    if (statusQuery.data && !statusQuery.data.entitled) {
      navigate("/pricing", { replace: true });
    }
  }, [
    isLoaded,
    isSignedIn,
    location,
    navigate,
    statusQuery.data,
    statusQuery.isLoading,
    statusQuery.isFetching,
  ]);

  if (isLoaded && isSignedIn && !isExemptPath(location) && statusQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return children;
}