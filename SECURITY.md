# Security and privacy

Codex Monitor is a local companion intended for a single computer. Do not expose its port through a reverse proxy, tunnel, public host, or network bind. It has no account system and does not provide remote-access authentication.

The app deliberately does not serve arbitrary filesystem paths or raw logs. Avoid adding a feature that turns tool arguments, messages, or tool output into browser-visible content. Names and metadata already displayed locally may still be confidential.

Report a suspected vulnerability with a minimal synthetic reproduction. Never include real secrets or private logs in a public issue. If this repository provides GitHub's private vulnerability reporting, use that route for sensitive details.
