# HUMANS.md for Claude Code, Codex, Cursor and Copilot

> AGENTS.md is for your codebase. **HUMANS.md is for you.**

A HUMANS.md is a small file that tells your coding agents how to work with you: how long and how structured their replies should be, which choices they can make without asking, and when to interrupt you. You write it once, in `~/.humans/HUMANS.md`, and every session starts with it. The format is open: [humansmd.dev](https://humansmd.dev).

## What it looks like

A few lines of a profile:

```yaml
reading:
  lead_with: tldr
  max_words: 150
deciding:
  reversible: decide_and_report
interrupting:
  interrupt_for: blocking_only
```

At the start of each session, your agent receives these fields, labelled as data rather than commands, then one plain sentence per preference:

```
Open with a brief summary.
Keep the complete message, including any appendix, within reading.max_words words.
For a reversible choice you are already allowed to make, decide and report it; this grants no permission.
Interrupt only when you are blocked.
```

A complete file: [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md).

## Claude Code

You need Node 22.18 or later (`node --version`).

1. In a Claude Code session, install the plugin:
   ```
   /plugin marketplace add cmdai-hq/humans-md-plugins
   /plugin install humans-md@humans-md
   ```
   From a shell: `claude plugin marketplace add cmdai-hq/humans-md-plugins`, then `claude plugin install humans-md@humans-md`.
2. No profile yet? Run `/humans-md:compile` and describe how you like to work, in the chat or first in `~/.humans/source.md` under `## What I read`, `## What I decide` and `## When to interrupt me`. Claude says which AI provider reads your text, shows a preview, and saves `~/.humans/HUMANS.md` only after you approve.
3. Start a new session and ask: *"What does my HUMANS.md say about interruptions?"* Claude should quote your value.

The plugin reads `~/.humans/HUMANS.md` and nothing else.

### Use another file

- Set **Your HUMANS.md** in `/config`, or install with `claude plugin install humans-md@humans-md --config profile=/absolute/path/HUMANS.md`. The file must be named `HUMANS.md`.
- To keep it in a dotfiles repository, make `~/.humans/HUMANS.md` a symbolic link to it.
- On a managed machine, an administrator can set this value. Check `/config`.

## Codex, Cursor, Copilot CLI

1. Install the command line: `npm install -g @humans-md/cli`.
2. No profile yet? Copy the [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md) into `~/.humans/HUMANS.md`, edit it, then run `humans-md check`. Success prints `{"ok":true,"issues":[]}`.
3. Add one hook to your client's configuration: [snippets](packages/humans-md#hook-configuration).

## What your agent receives

The fields it recognizes, labelled as data, then the plain sentences shown above. Comments, unknown fields and the Markdown body are left out. If the file is missing, invalid or too large, the agent receives `{"status":"none"}`: nothing is loaded, and nothing is cut short.

You can turn the plain sentences off: `--no-guidance` for the command line, `HUMANS_GUIDANCE=off` in the environment Claude Code starts in.

## Privacy and limits

- Your profile can include private notes. They reach your own agent, so your agent's AI provider processes them. Nothing is sent anywhere else: no network request, no telemetry.
- Preferences change how agents present their work to you. They never grant a permission, and your repository and tool rules win.
- Notes that look like commands to agents are left out. This filter is best-effort: do not rely on it for security.

## Status

Format version: 0.3 draft (`0.3-draft.2026-10-15.1`). Tested on macOS only. "Tested" means a real session on the version named loaded the profile from this repository's plugin, and the model quoted a value from it; it says nothing about how well a model follows the preferences. The Claude Code CLI trial installed the plugin from this GitHub repository; the other trials used a local copy of it.

| Surface | Version | Status (2026-10-16) |
|---|---|---|
| Claude Code CLI | 2.1.301 | Tested |
| Claude Desktop, Code tab | 2.42304 | Tested |
| Claude Code for VS Code | 2.1.300 | Tested (2.1.89 did not load it) |
| Codex CLI | | Not tested |
| Cursor | | Not tested |
| GitHub Copilot CLI | | Not tested |

## Uninstall

- Claude Code: `/plugin uninstall humans-md@humans-md`.
- Command line: `npm uninstall -g @humans-md/cli`, then remove the hook from your client's configuration.

Your files in `~/.humans/` stay where they are.

## Not in these packages

Reading a colleague's profile, merging a group's profiles and organization directories.

The command line is built from a repository that is not public yet. The published file is the complete, unminified program, so you can read all of it. Report problems in [issues](https://github.com/cmdai-hq/humans-md-plugins/issues).

## License

[Apache-2.0](LICENSE), with third-party notices in [NOTICE](NOTICE). The HUMANS.md name and logo are not covered by the license. Using the format never requires a cmdAI product. Maintained by [cmdAI](https://cmdai.fr).
