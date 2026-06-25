# transitions.dev usage

This project includes the global motion-token install block from [transitions.dev](https://github.com/Jakubantalik/transitions.dev) in `artifacts/signal87-core/src/transitions-dev.css`, and imports it from `artifacts/signal87-core/src/index.css`.

Use it when adding a specific transition from the transitions.dev catalog:

1. Pick the matching transition from the catalog, such as menu dropdown, modal open/close, panel reveal, page side-by-side, icon swap, skeleton reveal, shimmer text, tooltip, tabs sliding, or accordion expand.
2. Paste only that transition's namespaced `t-*` CSS snippet into the component stylesheet or global stylesheet.
3. Do not duplicate the `:root` token block; it is already loaded for the SPA.
4. Keep each snippet's `@media (prefers-reduced-motion: reduce)` guard.
5. Wire the documented classes and state attributes in the JSX, adapting only selectors and markup as needed.

The tokens are semantic CSS variables, so future snippets can use values like `--dropdown-open-dur`, `--modal-ease`, `--page-slide-distance`, `--shimmer-dur`, and `--acc-expand` without adding a dependency or changing the app boot path.
