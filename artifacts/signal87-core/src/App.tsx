import { useEffect, useRef, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, RedirectToSignIn, SignIn, SignUp } from "@clerk/react";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import Home from "@/pages/home";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import Activity from "@/pages/activity";
import NotesPage from "@/pages/notes";
import AnalyzePage from "@/pages/analyze";
import SkillsPage from "@/pages/skills";
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
import TrashPage from "@/pages/trash";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const publicRoutes = ["/", "/about", "/privacy", "/terms", "/contact", "/team", "/team/michael-benezra", "/team/michael-chavira", "/sign-in", "/sign-up"];

function isPublicRoute(path: string): boolean {
  return publicRoutes.some((route) => path === route || path.startsWith(route + "/"));
}

/** Same-origin production leaves VITE_API_BASE_URL blank so /api/* hits the current host. */
function ApiBaseUrlBridge() {
  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
    setBaseUrl(apiBaseUrl || null);
    return () => setBaseUrl(null);
  }, []);
  return null;
}

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

  if (isPublicRoute(location)) return children;

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) return <RedirectToSignIn />;
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
      <Route path="/dashboard"><Redirect to="/documents" /></Route>
      <Route path="/ask"><Redirect to="/documents" /></Route>
      <Route path="/brief"><Redirect to="/analyze" /></Route>
      <Route path="/compare"><Redirect to="/analyze" /></Route>
      <Route path="/documents" component={DocumentsList} />
      <Route path="/documents/:id/chat" component={DocumentChat} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/analyze" component={AnalyzePage} />
      <Route path="/skills" component={SkillsPage} />
      <Route path="/agents/hybrid" component={HybridAgent} />
      <Route path="/activity" component={Activity} />
      <Route path="/trash" component={TrashPage} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/team" component={Team} />
      <Route path="/team/michael-benezra" component={MichaelBenezra} />
      <Route path="/team/michael-chavira" component={MichaelChavira} />
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/sign-in"><SignInPage /></Route>
      <Route path="/sign-up"><SignUpPage /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function SignInPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to Signal87">
      <SignIn routing="path" path="/sign-in" />
    </AuthShell>
  );
}

function SignUpPage() {
  return (
    <AuthShell eyebrow="Create workspace" title="Start your document intelligence workspace">
      <SignUp routing="path" path="/sign-up" />
    </AuthShell>
  );
}

function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#101312] text-[#f5f7f2]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <section className="hidden border-r border-white/10 bg-[#101312] px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <img src="/signal87-logo.png" alt="Signal87" className="h-9 w-auto" />
          </div>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fd2ad]">
              Private document intelligence
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">
              Evidence-first AI for serious files.
            </h1>
            <p className="mt-5 text-base leading-7 text-white/68">
              Analyze documents, preserve source trails, and move from upload to decision with verifiable context.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-white/62">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <strong className="block text-lg text-white">Cited</strong>
              Answers
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <strong className="block text-lg text-white">Private</strong>
              Workspaces
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <strong className="block text-lg text-white">Ready</strong>
              Briefs
            </div>
          </div>
        </section>
        <section className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4 py-10 text-[#18181b]">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <img src="/signal87-logo.png" alt="Signal87" className="h-8 w-auto" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f3ff0]">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18181b]">{title}</h1>
            <div className="mt-6">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiBaseUrlBridge />
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
