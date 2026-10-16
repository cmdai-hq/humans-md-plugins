# HUMANS.md for Cursor

Loads your own `~/.humans/HUMANS.md` at the start of each Cursor agent chat. The agent receives your fields, labelled as data rather than commands, then one plain sentence per preference. See the [main README](https://github.com/cmdai-hq/humans-md-plugins#cursor) for installation.

- Needs Node 22.18 or later on the `PATH` Cursor starts with.
- Reads `~/.humans/HUMANS.md` and nothing else. To keep the file elsewhere, make `~/.humans/HUMANS.md` a symbolic link to a file also named `HUMANS.md`.
- A missing, invalid or too large file loads as `{"status":"none"}`.
- To leave out the plain sentences, start Cursor with `HUMANS_GUIDANCE=off` in its environment.

The plugin runs one `sessionStart` hook: `hooks/session-start.mjs`. It starts the bundled command line, `scripts/humans.mjs hook cursor`, and passes on its output only after checking it. It makes no network request.

Apache-2.0, with third-party notices in NOTICE.
