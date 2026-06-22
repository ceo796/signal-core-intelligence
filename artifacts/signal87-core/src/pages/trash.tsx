import { Layout } from "@/components/layout";
import { Trash2 } from "lucide-react";

export default function Trash() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Trash2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="text-[15px] font-medium tracking-tight mb-1 text-foreground">Trash is empty</h1>
        <p className="text-[13px] text-muted-foreground max-w-xs">
          Deleted documents are permanently removed and cannot be recovered.
        </p>
      </div>
    </Layout>
  );
}
