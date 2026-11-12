# Privacy

The server listens only on **127.0.0.1**, checks the request Host and Origin, and serves a fixed set of assets. The app has no external frontend assets, analytics, model calls, or remote uploads. It does not modify Codex's settings or logs.

Prompts, replies, reasoning, full commands, URL paths, and tool-result contents are not sent to the browser. The local parser examines tool arguments to identify categories and short names, and examines result status fields to detect failures. Short file names, hosts, workspace names, session identifiers, model names, and timing remain visible locally; these names can still be sensitive when sharing your screen.

This repository contains application code, generated artwork, generic documentation, and synthetic tests/demo data. It contains no live session logs, personal screenshots, or installed desktop shortcuts.

## Limitations

- Codex's internal log format can change. Events appear when Codex writes them, which may lag behind the work. The 500 ms refresh does not make delayed log records arrive sooner.
- This is a companion browser window, not a pane inside Codex. Remote-only conversations cannot be monitored unless their logs are available locally.
- Model rows count distinct usage reports, not timed model requests. Context is the last reported input-token count divided by the reported window.
- Agent orbits represent agent tool calls in progress, not the entire lifetime of child agents. Hooks and skills light up only when their activity is identifiable in the log.
- Nested calls share their parent batch's completion time. A batch error does not identify which nested call failed.
- A call with no completion record becomes unconfirmed after 90 seconds. An interrupted turn leaves unmatched calls marked unknown.
- Large sessions load the most recent 6 MiB; counts cover the loaded portion. The UI retains 160 events and shows up to 60 grouped feed rows. Error badges count errors in retained events.
- The desktop launchers have been exercised on Windows. Cross-platform Node tests run through GitHub Actions; macOS/Linux desktop integration may differ.
