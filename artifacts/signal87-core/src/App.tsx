import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, RedirectToSignIn } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Home from "@/pages/home";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import Activity from "@/pages/activity";
import AnalyzePage from "@/pages/analyze";
import HybridAgent from "@/pages/hybrid-agent";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Team from "@/pages/team";
import MichaelBenezra from "@/pages/team-michael-benezra";
import MichaelChavira from "@/pages/team-michael-chavira";
import Admin from "@/pages/admin";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { SignIn, SignUp } from "@clerk/react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry client errors (4xx). A 401 — e.g. when the Clerk session
      // cookie can't establish inside the embedded preview iframe — will never
      // succeed on retry; the default 3 retries with exponential backoff just
      // add several seconds of "loading" lag before the error finally surfaces.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === "number" && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      // Avoid refetch churn; navigating between pages reuses cached data.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const publicRoutes = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/team",
  "/team/michael-benezra",
  "/team/michael-chavira",
  "/sign-in",
  "/sign-up",
];

function isPublicRoute(path: string): boolean {
  return publicRoutes.some(
    (route) => path === route || path.startsWith(route + "/"),
  );
}

// Bridges Clerk's session token into the centralized API fetch layer so every
// /api/* request carries `Authorization: Bearer <token>`. This is required
// inside the embedded preview iframe, where the Clerk session cookie isn't
// available and cookie-only auth 401s. Cookies still work in a standalone tab
// and in production — the bearer token is simply attached in addition.
function ApiAuthBridge() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    setAuthTokenGetter(() => getTokenRef.current());
    return () => setAuthTokenGetter(null);
  }, []);

  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isPublicRoute(location)) {
    return children;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return children;
}

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Redirects — old routes → new destinations */}
      <Route path="/dashboard"><Redirect to="/documents" /></Route>
      <Route path="/ask"><Redirect to="/documents" /></Route>
      <Route path="/brief"><Redirect to="/analyze" /></Route>
      <Route path="/compare"><Redirect to="/analyze" /></Route>
      {/* Primary app routes */}
      <Route path="/documents" component={DocumentsList} />
      <Route path="/documents/:id/chat" component={DocumentChat} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/analyze" component={AnalyzePage} />
      <Route path="/agents/hybrid" component={HybridAgent} />
      <Route path="/activity" component={Activity} />
      {/* Public pages */}
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/team" component={Team} />
      <Route path="/team/michael-benezra" component={MichaelBenezra} />
      <Route path="/team/michael-chavira" component={MichaelChavira} />
      {/* Admin + settings */}
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/sign-in">
        <SignInPage />
      </Route>
      <Route path="/sign-up">
        <SignUpPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignIn />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignUp />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiAuthBridge />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <Router />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
