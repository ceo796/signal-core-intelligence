import { Layout } from "@/components/layout";
import { Trash2 } from "lucide-react";

export default function Trash() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight mb-1">Trash is empty</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Deleted documents are permanently removed and cannot be recovered.
        </p>
      </div>
    </Layout>
  );
}
