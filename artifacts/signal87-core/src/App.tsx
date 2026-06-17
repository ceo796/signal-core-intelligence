import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, RedirectToSignIn } from "@clerk/react";

import Home from "@/pages/home";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import Ask from "@/pages/ask";
import Activity from "@/pages/activity";
import ExecutiveBrief from "@/pages/executive-brief";
import MultiDocumentChat from "@/pages/multi-document-chat";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Team from "@/pages/team";
import MichaelBenezra from "@/pages/team-michael-benezra";
import MichaelChavira from "@/pages/team-michael-chavira";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { SignIn, SignUp } from "@clerk/react";

const queryClient = new QueryClient();

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documents" component={DocumentsList} />
      <Route path="/documents/:id/chat" component={DocumentChat} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/ask" component={Ask} />
      <Route path="/brief" component={ExecutiveBrief} />
      <Route path="/compare" component={MultiDocumentChat} />
      <Route path="/activity" component={Activity} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/team" component={Team} />
      <Route path="/team/michael-benezra" component={MichaelBenezra} />
      <Route path="/team/michael-chavira" component={MichaelChavira} />
      <Route path="/admin" component={Admin} />
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
