import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/home";
import DocumentsList from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import DocumentChat from "@/pages/document-chat";
import MultiDocumentChat from "@/pages/multi-document-chat";
import ExecutiveBrief from "@/pages/executive-brief";
import AdminStats from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documents" component={DocumentsList} />
      <Route path="/compare" component={MultiDocumentChat} />
      <Route path="/brief" component={ExecutiveBrief} />
      <Route path="/documents/:id/chat" component={DocumentChat} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/admin" component={AdminStats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

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
