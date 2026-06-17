import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-slate-400" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-3">Checkout cancelled</h1>
        <p className="text-muted-foreground mb-8">
          No charge was made. You can upgrade any time from your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
          <Button onClick={() => navigate("/upgrade")} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            View plans
          </Button>
        </div>
      </div>
    </div>
  );
}
