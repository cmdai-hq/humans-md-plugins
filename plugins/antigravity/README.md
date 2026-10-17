# HUMANS.md for Google Antigravity

Loads your own `~/.humans/HUMANS.md` once, when an Antigravity conversation starts. The agent receives your fields, labelled as data rather than commands, then one plain sentence per preference. See the [main README](https://github.com/cmdai-hq/humans-md-plugins#install) for installation.

- Needs Antigravity 1.4.0 or later (earlier releases never send `SessionStart`), Node 22.18 or later on the `PATH` Antigravity starts with, and macOS or Linux.
- Install it globally (`agy plugin install`, or a copy in `~/.gemini/config/plugins/`). The hook runs only from Antigravity's plugin folders, `~/.gemini/config/plugins/` and `~/.gemini/antigravity-cli/plugins/`. It does nothing anywhere else: in a project's `.agents/plugins/` folder, or in a repository under `~/.gemini/` such as `~/.gemini/antigravity/scratch/`.
- Reads `~/.humans/HUMANS.md` and nothing else. To keep the file elsewhere, make `~/.humans/HUMANS.md` a symbolic link to a file also named `HUMANS.md`.
- A missing, invalid or too large file loads as `{"status":"none"}`.
- To leave out the plain sentences, start Antigravity with `HUMANS_GUIDANCE=off` in its environment.

The plugin has one hook, `humans-md`, in `hooks.json`. On `SessionStart` it runs `hooks/session-start.mjs`. That script starts the bundled command line, `scripts/humans.mjs hook copilot`, checks the context it prints, and passes it on as one Antigravity system step. It makes no network request and writes no file.

Apache-2.0, with third-party notices in NOTICE.
