import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/home";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Team from "@/pages/team";
import MichaelBenezra from "@/pages/team-michael-benezra";
import MichaelChavira from "@/pages/team-michael-chavira";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documents" component={DocumentsList} />
      <Route path="/documents/:id/chat" component={DocumentChat} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/team" component={Team} />
      <Route path="/team/michael-benezra" component={MichaelBenezra} />
      <Route path="/team/michael-chavira" component={MichaelChavira} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
