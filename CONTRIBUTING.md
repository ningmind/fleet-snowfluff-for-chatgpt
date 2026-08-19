# Contributing

Contributions are welcome, especially fixes for ChatGPT Desktop UI updates.

## Guidelines

1. Keep the injector reversible. Do not patch `ChatGPT.app`, `app.asar`, or the app signature.
2. Keep the DevTools endpoint local; do not expose it on a public interface.
3. Preserve both Light and Dark appearances when changing selectors or colors.
4. Avoid broad selectors that can hide application controls or reduce text contrast.
5. Keep desktop-pet state detection conservative. Do not claim stable tool-level events unless ChatGPT exposes a supported interface.
6. Do not add third-party artwork unless its redistribution terms are documented.

## Checks

```bash
npm run check
```

For visual changes, test both themes and include screenshots that do not expose private conversations, project names, or account information.

