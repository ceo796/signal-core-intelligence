import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useUser,
  useClerk,
  useAuth,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "@/pages/dashboard";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import Ask from "@/pages/ask";
import Compare from "@/pages/compare";
import Brief from "@/pages/brief";
import Activity from "@/pages/activity";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Team from "@/pages/team";
import MichaelBenezra from "@/pages/team-michael-benezra";
import MichaelChavira from "@/pages/team-michael-chavira";
import LandingPage from "@/pages/landing";
import NotFound from "@/pages/not-found";
import PendingAccess from "@/pages/pending-access";
import UpgradePage from "@/pages/upgrade";
import CheckoutSuccessPage from "@/pages/checkout-success";
import CheckoutCancelPage from "@/pages/checkout-cancel";

const queryClient = new QueryClient();

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so
// the same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace; strip the base prefix
// so wouter's setLocation doesn't double it.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Approved-user gate.
// When VITE_APPROVED_EMAILS is empty or unset, the gate is disabled and all
// authenticated users are admitted. Set it to a comma-separated list of email
// addresses in Replit Secrets to enable per-user access control.
function isApproved(user: { primaryEmailAddress?: { emailAddress?: string } | null } | null | undefined): boolean {
  if (!user) return false;
  const approvedEmails = (import.meta.env as Record<string, string | undefined>).VITE_APPROVED_EMAILS;
  if (!approvedEmails || approvedEmails.trim() === "") return true;
  const allowed = approvedEmails.split(",").map((e) => e.trim().toLowerCase());
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  return !!email && allowed.includes(email);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div className="h-screen bg-background" />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isApproved(user)) return <PendingAccess />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div className="h-screen" style={{ background: "#FFFFFF" }} />;
  if (isSignedIn && isApproved(user)) return <Redirect to="/dashboard" />;
  if (isSignedIn) return <PendingAccess />;
  return <LandingPage />;
}

function ClerkAuthTokenSync() {
  const { getToken, isSignedIn } = useAuth();

  // Keep getter reference current without making it a dependency that
  // triggers spurious effect re-runs.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (isSignedIn === true) {
      setAuthTokenGetter(() => getTokenRef.current());
    } else if (isSignedIn === false) {
      setAuthTokenGetter(null);
    }
    // isSignedIn === undefined means Clerk is still loading — leave the
    // existing getter untouched to avoid a null window during handshake.
  }, [isSignedIn]);

  // Clear only on unmount, not on every re-run.
  useEffect(() => () => { setAuthTokenGetter(null); }, []);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/signal87-logo-wordmark-white.png`,
  },
  variables: {
    colorPrimary: "hsl(0, 0%, 98%)",
    colorForeground: "hsl(0, 0%, 90%)",
    colorMutedForeground: "hsl(0, 0%, 60%)",
    colorDanger: "hsl(0, 84.2%, 60.2%)",
    colorBackground: "hsl(0, 0%, 4%)",
    colorInput: "hsl(0, 0%, 20%)",
    colorInputForeground: "hsl(0, 0%, 90%)",
    colorNeutral: "hsl(0, 0%, 15%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(0,0%,6%)] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(0,0%,90%)]",
    headerSubtitle: "text-[hsl(0,0%,60%)]",
    socialButtonsBlockButtonText: "text-[hsl(0,0%,90%)]",
    formFieldLabel: "text-[hsl(0,0%,90%)]",
    footerActionLink: "text-[hsl(0,0%,90%)]",
    footerActionText: "text-[hsl(0,0%,60%)]",
    dividerText: "text-[hsl(0,0%,60%)]",
    identityPreviewEditButton: "text-[hsl(0,0%,90%)]",
    formFieldSuccessText: "text-[hsl(160,100%,40%)]",
    alertText: "text-[hsl(0,0%,90%)]",
    logoBox: "mb-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton:
      "border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,12%)] hover:bg-[hsl(0,0%,15%)]",
    formButtonPrimary:
      "bg-[hsl(0,0%,98%)] hover:bg-[hsl(0,0%,88%)] text-[hsl(0,0%,8%)]",
    formFieldInput:
      "bg-[hsl(0,0%,20%)] border-[hsl(0,0%,25%)] text-[hsl(0,0%,90%)]",
    footerAction: "bg-[hsl(0,0%,6%)]",
    dividerLine: "bg-[hsl(0,0%,20%)]",
    alert: "bg-[hsl(0,0%,10%)]",
    otpCodeFieldInput:
      "bg-[hsl(0,0%,20%)] border-[hsl(0,0%,25%)] text-[hsl(0,0%,90%)]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

// Stable wrapper components — defined at module level to avoid unnecessary
// re-mounts when parent re-renders.
const ProtectedDocumentsList = () => (
  <ProtectedRoute>
    <DocumentsList />
  </ProtectedRoute>
);
const ProtectedDocumentDetail = () => (
  <ProtectedRoute>
    <DocumentDetail />
  </ProtectedRoute>
);
const ProtectedDocumentChat = () => (
  <ProtectedRoute>
    <DocumentChat />
  </ProtectedRoute>
);
const ProtectedDashboard = () => (
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
);
const ProtectedAsk = () => (
  <ProtectedRoute>
    <Ask />
  </ProtectedRoute>
);
const ProtectedCompare = () => (
  <ProtectedRoute>
    <Compare />
  </ProtectedRoute>
);
const ProtectedBrief = () => (
  <ProtectedRoute>
    <Brief />
  </ProtectedRoute>
);
const ProtectedActivity = () => (
  <ProtectedRoute>
    <Activity />
  </ProtectedRoute>
);
const ProtectedUpgrade = () => (
  <ProtectedRoute>
    <UpgradePage />
  </ProtectedRoute>
);

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Signal87 account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with Signal87",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthTokenSync />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            {/* Home: public landing or redirect to app */}
            <Route path="/" component={HomeRedirect} />

            {/* Auth routes — paths verbatim, /*? is required for OAuth sub-paths */}
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />

            {/* Public pages */}
            <Route path="/landing" component={LandingPage} />
            <Route path="/about" component={About} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/contact" component={Contact} />
            <Route path="/team" component={Team} />
            <Route path="/team/michael-benezra" component={MichaelBenezra} />
            <Route path="/team/michael-chavira" component={MichaelChavira} />

            {/* Protected app routes — more specific paths first */}
            <Route path="/dashboard" component={ProtectedDashboard} />
            <Route path="/documents/:id/chat" component={ProtectedDocumentChat} />
            <Route path="/documents/:id" component={ProtectedDocumentDetail} />
            <Route path="/documents" component={ProtectedDocumentsList} />
            <Route path="/ask" component={ProtectedAsk} />
            <Route path="/compare" component={ProtectedCompare} />
            <Route path="/brief" component={ProtectedBrief} />
            <Route path="/activity" component={ProtectedActivity} />
            <Route path="/upgrade" component={ProtectedUpgrade} />
            <Route path="/checkout/success" component={CheckoutSuccessPage} />
            <Route path="/checkout/cancel" component={CheckoutCancelPage} />

            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
