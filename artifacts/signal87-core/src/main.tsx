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
  const hostname = window.location.hostname;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");
  publishableKey = isLocalHost
    ? configuredPublishableKey
    : publishableKeyFromHost(hostname, configuredPublishableKey) || configuredPublishableKey;
} catch {
  publishableKey = configuredPublishableKey;
}

const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Build the full origin for redirect URLs (handles base path)
const redirectUrl = window.location.origin + baseUrl + "/pricing";

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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#101312",
        color: "#f5f7f2",
        padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
          padding: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
        }}
      >
        <p style={{ margin: 0, color: "#6fd2ad", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Authentication setup required
        </p>
        <h1 style={{ margin: "10px 0 0", fontSize: 24, lineHeight: 1.2 }}>
          Signal87 needs a Clerk publishable key.
        </h1>
        <p style={{ margin: "12px 0 0", color: "rgba(245,247,242,0.72)", lineHeight: 1.6 }}>
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> for local web builds or <code>CLERK_PUBLISHABLE_KEY</code> for runtime injection.
        </p>
      </section>
    </main>,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <ClerkProvider {...clerkOptions}>
      <App />
    </ClerkProvider>,
  );
}
