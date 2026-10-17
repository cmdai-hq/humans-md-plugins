# HUMANS.md for Devin

Loads your own `~/.humans/HUMANS.md` at the start of each Devin Local session, in Devin Desktop (formerly Windsurf) and the Devin CLI. The agent receives your fields, labelled as data rather than commands, then one plain sentence per preference. See the [main README](https://github.com/cmdai-hq/humans-md-plugins#install) for installation.

- Needs Node 22.18 or later on the `PATH` Devin starts with.
- Reads `~/.humans/HUMANS.md` and nothing else. To keep the file elsewhere, make `~/.humans/HUMANS.md` a symbolic link to a file also named `HUMANS.md`.
- A missing, invalid or too large file loads as `{"status":"none"}`.
- To leave out the plain sentences, start Devin with `HUMANS_GUIDANCE=off` in its environment.
- The legacy Cascade agent does not run plugins. Hooks do not run in a workspace open in Restricted Mode.

The plugin runs one `SessionStart` hook, declared in `hooks.json`: `scripts/session-start.mjs`. It starts the bundled command line, `scripts/humans.mjs hook claude` (Devin reads the same envelope as Claude Code), and passes on its output only after checking it. It makes no network request.

The plugin has the same name as the Claude Code plugin, `humans-md`, so Devin refuses to install both and the profile cannot load twice.

Apache-2.0, with third-party notices in NOTICE.
