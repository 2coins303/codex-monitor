# Contributing

Run `npm test` and `npm run check:release` before opening a pull request. Keep the monitor dependency-free where practical and preserve the localhost-only boundary.

Use synthetic records in tests and bug reports. Do not attach real session logs, screenshots of private work, credentials, prompts, full command arguments, or tool results. A minimal fabricated record showing field names and event types is usually enough to reproduce a parser issue.

Describe the observed behavior, expected behavior, operating system, Node version, and relevant Codex version. Explain any new fields projected to the browser and why they are needed.

The main modules are `telemetry.mjs` (log reducer), `details.mjs` (short-name extraction), `replay.mjs` (synthetic tour), `server.mjs` (local HTTP server), and `public/app.js` / `public/feed.js` (map and feed).
