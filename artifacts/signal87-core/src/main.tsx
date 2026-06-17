import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import App from "./App";
import "./index.css";

// Resolve the publishable key from the current host so the same build works
// across the dev domain and custom/production domains.
const publishableKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Build the full origin for redirect URLs (handles base path)
const redirectUrl = window.location.origin + baseUrl + "/documents";

const clerkOptions = {
  publishableKey,
  signInUrl: baseUrl + "/sign-in",
  signUpUrl: baseUrl + "/sign-up",
  afterSignOutUrl: baseUrl + "/",
  redirectUrl,
  // Clerk frontend API proxy URL. Empty in dev (Clerk talks to its dev FAPI
  // directly); auto-populated by the deploy pipeline in production.
  proxyUrl: import.meta.env.VITE_CLERK_PROXY_URL,
  appearance: {
    baseTheme: dark,
    variables: {
      colorPrimary: "hsl(262 83% 58%)",
      colorBackground: "hsl(0 0% 4%)",
      colorText: "hsl(0 0% 90%)",
      colorTextSecondary: "hsl(0 0% 60%)",
      colorInputBackground: "hsl(0 0% 6%)",
      colorInputText: "hsl(0 0% 90%)",
      colorDanger: "hsl(0 84.2% 60.2%)",
      borderRadius: "0.75rem",
    },
    elements: {
      card: "shadow-lg",
      formButtonPrimary: "font-medium",
    },
  },
};

createRoot(document.getElementById("root")!).render(
  <ClerkProvider {...clerkOptions}>
    <App />
  </ClerkProvider>,
);
