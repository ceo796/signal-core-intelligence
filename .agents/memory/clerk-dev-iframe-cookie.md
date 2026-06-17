---
name: Clerk dev session cookie in embedded iframe
description: Why a signed-in user gets backend 401s in the Replit preview/canvas iframe, and how to tell it apart from real auth bugs.
---

# Clerk dev session cookie fails inside the Replit preview/canvas iframe

**Symptom:** Frontend thinks the user is signed in (renders protected pages, fires API calls), but every protected `/api` request returns 401. Backend diagnostic shows the `__session` cookie IS present on the request, yet `getAuth(req).userId` is `null` with empty `sessionClaims`.

**Root cause:** Clerk *development* instances use a short-lived (~60s) session token that the frontend SDK must continuously refresh. Inside an embedded cross-site iframe (Replit's preview pane and the canvas board), the browser treats Clerk's cookies as third-party and blocks the SDK from refreshing/writing them, so the backend ends up with a stale/unverifiable token.

**Why:** Browser third-party-cookie restrictions (Chrome phase-out, Safari ITP). It's a browser-level limitation, not a code bug. Production is unaffected because the app runs top-level on its own domain with first-party cookies.

**How to apply / diagnose (differential):**
- 401 (not 403) + `__session` cookie present + `userId:null`/empty claims + frontend `isSignedIn` true ⇒ iframe cookie staleness. **Dev fix: open the app in a standalone browser tab**, not the embedded preview/canvas iframe.
- 403 ⇒ approved-email gate, not a session problem.
- No `__session` cookie on the request ⇒ user not actually signed in, or cookie not being sent.
- Still fails in a standalone tab ⇒ a real key/instance mismatch or middleware-order bug — then debug the code, not the transport.
- Don't chase cookie-present-but-unverifiable as a backend verification bug when keys exist and middleware order is correct; the transport (iframe) is the issue.
