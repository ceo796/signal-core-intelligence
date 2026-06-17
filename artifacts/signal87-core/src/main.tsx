import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Build the full origin for redirect URLs (handles base path)
const redirectUrl = window.location.origin + baseUrl + "/documents";

const clerkOptions = {
  publishableKey,
  signInUrl: baseUrl + "/sign-in",
  signUpUrl: baseUrl + "/sign-up",
  afterSignOutUrl: baseUrl + "/",
  redirectUrl,
  // In production, use the proxy path for the Clerk frontend API
  // In development, let Clerk use its default
  proxyUrl: import.meta.env.PROD ? baseUrl + "/api/__clerk" : undefined,
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
