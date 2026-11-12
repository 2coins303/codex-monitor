# Changelog

## 1.0.1 — 2026-11-11

- Default to auto-follow instead of silently restoring a previously selected chat.
- Discover new and resumed chats every 500 ms, including older conversations and newly created date folders.
- Continue discovery while the display is paused or showing the simulation; refresh on returning to the tab.
- Return to live monitoring five seconds after the simulated tour completes.
- Add a visible pinned notice and a **Resume auto-follow** button. Only deliberately pinned links retain a pin.
- Add regression coverage for new chats, resumed chats, removed sessions, and legacy session links.

## 1.0.0 — 2026-11-11

- Initial public release of the local Codex activity map.
- Ten animated stations and a rolling feed that refreshes every 500 ms.
- Expandable repeated-call groups, scrollback, filters, and pause/motion controls.
- Short file names, website hosts, command types, timings, model changes, and context warnings.
- Windows launcher and desktop icon; portable Node launcher for macOS and Linux.
- Synthetic event tour, preview images, animated demo, and video.
- Localhost-only server, privacy checks, generic commit identity, and no included user session data.
