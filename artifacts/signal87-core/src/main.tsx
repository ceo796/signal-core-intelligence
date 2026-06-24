import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __SIGNAL87_RUNTIME_CONFIG__?: {
      VITE_CLERK_PUBLISHABLE_KEY?: string;
      VITE_CLERK_PROXY_URL?: string;
    };
  }
}

const runtimeConfig = window.__SIGNAL87_RUNTIME_CONFIG__ || {};
const configuredPublishableKey =
  runtimeConfig.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Resolve the publishable key from the current host so the same build works
// across the dev domain and custom/production domains. On generic hosts such
// as Render, fall back to the configured publishable key so the client does not
// blank-screen when Vite build-time env is unavailable inside Docker builds.
let publishableKey = configuredPublishableKey;
try {
  publishableKey =
    publishableKeyFromHost(window.location.hostname, configuredPublishableKey) || configuredPublishableKey;
} catch {
  publishableKey = configuredPublishableKey;
}

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
  proxyUrl: runtimeConfig.VITE_CLERK_PROXY_URL || import.meta.env.VITE_CLERK_PROXY_URL,
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

if (!publishableKey) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      Signal87 is missing the Clerk publishable key. Please set VITE_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY.
    </div>,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <ClerkProvider {...clerkOptions}>
      <App />
    </ClerkProvider>,
  );
}
