# HUMANS.md for Gemini CLI

Loads your own `~/.humans/HUMANS.md` when a Gemini CLI session starts. The agent receives your fields, labelled as data rather than commands, then one plain sentence per preference. See the [main README](https://github.com/cmdai-hq/humans-md-plugins#install) for installation.

**Not tested in Gemini CLI.** This extension is written from [Gemini CLI's documentation](https://geminicli.com/docs/extensions/reference/) as read on 2026-11-10, when the latest release was 0.67.0. It has not been run in a Gemini CLI session yet.

- Needs Node 22.18 or later on the `PATH` Gemini CLI starts with, and macOS or Linux: the hook command is written for a POSIX shell.
- Needs hooks left on: the setting `hooksConfig.enabled`, on by default. `/hooks panel` should list the hook as `humans-md`.
- Reads `~/.humans/HUMANS.md` and nothing else. To keep the file elsewhere, make `~/.humans/HUMANS.md` a symbolic link to a file also named `HUMANS.md`.
- A missing, invalid or too large file loads as `{"status":"none"}`. When the file is there but was not loaded as written, the hook also returns one `systemMessage` line. Gemini CLI documents that field as "Displayed immediately to the user in the terminal".
- Loads when a session starts, is resumed, or is cleared with `/clear`. It is not loaded again after a compression: `/compress` replaces the conversation with a summary, Gemini CLI also compresses long conversations by itself, and no session-start hook runs then. Your profile comes back with `/clear` or a new session.
- `HUMANS_GUIDANCE=off`, which leaves out the plain sentences in other clients, may not reach this hook: Gemini CLI documents that an extension only gets standard environment variables such as `HOME` and `PATH`.

The extension has one hook, `humans-md`, declared in `hooks/hooks.json`. On `SessionStart` it runs `hooks/session-start.mjs`. That script starts the bundled command line, `scripts/humans.mjs hook claude` (Gemini CLI documents the same `hookSpecificOutput.additionalContext` envelope as Claude Code), and passes on its output only after checking it. It makes no network request and writes no file.

Apache-2.0, with third-party notices in NOTICE.
