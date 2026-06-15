import { useClerk } from "@clerk/react";
import { ShieldAlert } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PendingAccess() {
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <img
            src={`${basePath}/signal87-logo.png`}
            alt="Signal87"
            className="h-10 w-auto"
          />
        </div>
        <div className="flex justify-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-foreground">
            Access Pending
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account has been created. Access to Signal87 AI is currently
            approval-based. Please contact the Signal87 team to activate your
            account.
          </p>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
