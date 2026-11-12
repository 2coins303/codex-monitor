# Setup and troubleshooting

## Get started

Requires **Node.js 22 or newer** and a local Codex installation that writes session logs. A supported [Node.js LTS release](https://nodejs.org/) is recommended. No API key, account connection, npm dependencies, or build step is needed.

1. Select **Code → Download ZIP** on this repository, then extract the ZIP to a permanent folder. You can also clone the repository with Git.
2. On **Windows**, double-click **Start.cmd**. It starts the local service and opens your browser.
3. On **macOS or Linux**, open a terminal in the extracted folder and run `npm run open`.
4. Start a local Codex conversation. **Auto-follow active chats** detects its local log and switches automatically, checking every 500 ms.

The default address is **http://127.0.0.1:43187**. The monitor discovers sessions under your own home folder's `.codex/sessions` directory. If your Codex sessions are elsewhere, see [configuration](#configuration).

### Windows desktop icon

Double-click **Create Desktop Shortcut.vbs** once. It creates a **Codex Monitor** shortcut with the included monitor icon and a hidden launcher. Keep the project folder in the same location afterward.

If Windows Script Host or VBScript is unavailable on your computer, use **Start.cmd** or `npm run open`. No PowerShell policy change is needed.

### Foreground mode

```sh
npm start
```

Open the address printed in your terminal. Press **Ctrl+C** in that terminal to stop the server. `Start.cmd`, the desktop shortcut, and `npm run open` use a background server that remains running after you close the browser and stops when your computer restarts. They reuse an existing healthy server on the configured port. Nothing is added to system startup.

## Configuration

Set environment variables before launching. No `.env` loader is included.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CODEX_HOME` | `.codex` under your home directory | Base directory for Codex data |
| `CODEX_MAP_SESSIONS` | `CODEX_HOME/sessions` | Override the sessions directory directly |
| `CODEX_MAP_PORT` | `43187` | Local port, from 1024 through 65535 |

PowerShell example:

```powershell
$env:CODEX_MAP_SESSIONS = 'D:\Codex\sessions'
$env:CODEX_MAP_PORT = '43188'
node launcher.mjs
```

macOS/Linux example:

```sh
CODEX_MAP_SESSIONS="$HOME/.codex/sessions" CODEX_MAP_PORT=43188 node launcher.mjs
```

Use the launcher or printed address when selecting a custom port. Opening `public/index.html` directly redirects to the default port.

## Troubleshooting

**No sessions found:** start a local Codex chat and check `CODEX_HOME` or `CODEX_MAP_SESSIONS`. You can still run the simulated tour.

**A new chat is not appearing:** leave **Auto-follow active chats** selected, or click **Resume auto-follow** if you pinned a chat. Send the first message so Codex creates its local log. New and resumed chats are discovered every 500 ms, including in new date folders; the most recently modified log wins when multiple chats are active. Discovery continues while paused or testing, and returning to a hidden tab triggers an immediate refresh. The browser may throttle painting in background tabs.

**The wrong chat is active:** selecting a specific session pins that view intentionally and shows a pinned notice. **Resume auto-follow** removes the pin. Fresh views ignore the old saved session preference; an explicit link with `follow=pinned` retains a deliberate pin on reload.

**Port occupied or page cannot connect:** run `npm start` to see the error, or choose another `CODEX_MAP_PORT`. Avoid opening the HTML file directly when the service is stopped.

**Desktop shortcut stopped working:** the project folder may have moved. Remove or rename the old shortcut and run **Create Desktop Shortcut.vbs** from the new location.
