import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Pricing from "@/pages/pricing";

export default function NotFound() {
  if (window.location.pathname === "/pricing") {
    return <Pricing />;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          This page doesn't exist. Return to your document library to continue.
        </p>
        <Link href="/documents">
          <Button variant="secondary" className="mt-2">
            Go to Documents
          </Button>
        </Link>
      </div>
    </div>
  );
}
