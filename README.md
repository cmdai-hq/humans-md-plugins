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

At the start of each session, your agent receives these fields as information, not as orders, then one plain sentence per preference:

```
Open with a brief summary.
Keep the complete message, including any appendix, within reading.max_words words.
For a reversible choice you are already allowed to make, decide and report it; this grants no permission.
Interrupt only when you are blocked.
```

A complete file: [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md).

## Before you start

- **Node 22.18 or later.** Check with `node --version`. Desktop apps (Claude Desktop, Cursor, VS Code) opened from the Dock may not see a `node` installed with nvm or Homebrew. If nothing loads there, start the app from a terminal once, or install Node from [nodejs.org](https://nodejs.org).
- **macOS is the only system tested.** Windows and Linux have not been tried.
- **On a work machine,** your administrator may block plugins or hooks.

## Install

One client is enough. Install for the ones you use.

| Client | Install |
|---|---|
| Claude Code (CLI, Desktop, VS Code) | `claude plugin install humans-md --marketplace cmdai-hq/humans-md-plugins` |
| Codex | `codex plugin marketplace add cmdai-hq/humans-md-plugins`, then `codex plugin add humans-md@humans-md`, then trust the hook in `/hooks` |
| GitHub Copilot CLI | `copilot plugin marketplace add cmdai-hq/humans-md-plugins`, then `copilot plugin install humans-md@humans-md` |
| Cursor | `agent plugin marketplace add https://github.com/cmdai-hq/humans-md-plugins` (Cursor CLI), then `/add-plugin humans-md` in a Cursor chat and install it for you |
| Any other client | `npm install -g @humans-md/cli`, then add [one hook](packages/humans-md#hook-configuration) |

Notes per client:

- **Claude Code.** In a session, the same install is `/plugin install humans-md --marketplace cmdai-hq/humans-md-plugins`; choose to install it for you. To use a file other than `~/.humans/HUMANS.md`, set **Your HUMANS.md** in `/config`. The file must be named `HUMANS.md`.
- **Codex.** Codex runs a plugin's hook only after you trust it. Open `/hooks` in Codex, review the HUMANS.md hook and trust it. Codex asks again after each update. The Codex IDE extension does not load plugins: use the [hand-written hook](packages/humans-md#hook-configuration) there.
- **GitHub Copilot.** If you turn on Copilot CLI's sandbox (`/sandbox`, off by default), hooks run inside it and may not be able to read `~/.humans`; your agent then gets no profile. VS Code lists plugins installed with Copilot CLI in its Agent Plugins view (setting `chat.plugins.enabled`). This has not been tried in VS Code yet. If you also use the Claude Code extension with this plugin, VS Code may load both.
- **Cursor.** `/add-plugin` takes a plugin name, not a URL. Without the Cursor CLI, install it with `curl https://cursor.com/install -fsS | bash`, then `agent login`. Check that the plugin's description says "each agent chat": if it says "Claude", Cursor picked the Claude Code plugin; remove the marketplace, add it again and reinstall. Cursor also imports Claude Code plugins (Settings → Agents → Third-Party Imports, on by default); if you use both, keep one of the two, or your profile may load twice. The Agents Window does not load the profile: on 3.25.6 it was missing from the first and the second message, a Cursor bug open on 2026-10-17 ([forum](https://forum.cursor.com/t/agents-window-ignores-sessionstart-additional-context-claude-code-project-hooks-no-longer-load-3-24-9/174143)). Use the editor's agent panel, which loads it.

Every plugin reads `~/.humans/HUMANS.md` and nothing else; in Claude Code you can choose another file named `HUMANS.md` in `/config`. To keep the file elsewhere, for example in a dotfiles repository, make `~/.humans/HUMANS.md` a symbolic link to a file that is also named `HUMANS.md`.

Install one plugin per client. Some clients also load another client's plugins (Cursor imports Claude Code plugins, VS Code lists Copilot CLI plugins); if your profile shows up twice, remove one.

## Write your profile

- **In Claude Code:** run `/humans-md:compile`. Describe how you like to work, or answer about nine short questions, one at a time. Claude tells you which AI provider reads your words, shows you the file, and saves it only after you say yes.
- **Anywhere else:** start from the example, then change `id`, `name` and the values:
  ```sh
  mkdir -p ~/.humans && curl -o ~/.humans/HUMANS.md https://raw.githubusercontent.com/cmdai-hq/HUMANS.md/main/examples/HUMANS.md
  ```

Check the file with `npx -y @humans-md/cli check`. Success prints `{"ok":true,"issues":[]}`.

## Check it works

Start a new session and ask: *"What does my HUMANS.md say about interruptions?"* Your agent should quote your value.

If it does not:

1. Run `npx -y @humans-md/cli check` and fix what it reports.
2. Check that `node --version` prints 22.18 or later in the place your client starts from.
3. Codex: check that the hook is trusted in `/hooks`. Cursor: open the Output panel, choose **Hooks** and look for `sessionStart`.

## Update

Claude Code does not update plugins from this marketplace by itself. To get a new version:

- Claude Code: `claude plugin update humans-md@humans-md`, or **Update now** in `/plugin`. To update automatically, turn on auto-update for humans-md in the Marketplaces tab of `/plugin`.
- Codex: `codex plugin marketplace upgrade humans-md`, then trust the hook again in `/hooks`.
- Copilot CLI: `copilot plugin update humans-md`.
- Cursor: a marketplace stays on the commit it was added at, and updating it re-reads that commit. Run `agent plugin marketplace remove humans-md`, then `agent plugin marketplace add https://github.com/cmdai-hq/humans-md-plugins`.
- Command line: `npm install -g @humans-md/cli@latest`.

Restart your client after an update.

## What your agent receives

The fields it recognizes, labelled as data, then the plain sentences shown above. Comments, unknown fields and the Markdown body are left out. If the file is missing, invalid or too large, the agent receives `{"status":"none"}`: nothing is loaded, and nothing is cut short.

To leave the plain sentences out, start Claude Code, Codex or Copilot with `HUMANS_GUIDANCE=off` set, or pass `--no-guidance` to the command line.

## Privacy and limits

- Your profile can include private notes. They reach your own agent, so your agent's AI provider processes them. Nothing is sent anywhere else: no network request, no telemetry.
- Preferences change how agents present their work to you. They never grant a permission, and your repository and tool rules win.
- Notes that look like commands to agents are left out. This filter is best-effort: do not rely on it for security.

## Status

Format version: 0.3 draft (`0.3-draft.2026-10-15.1`). Tested on macOS only. "Tested" means a real session on the version named loaded the profile from this repository's plugin, and the model quoted a value from it; it says nothing about how well a model follows the preferences. The Claude rows were tested with plugin 0.1.0, the Codex and Cursor rows with 0.2.0, each installed from this GitHub repository.

| Surface | Version | Status (2026-10-16) |
|---|---|---|
| Claude Code CLI | 2.1.301, 2.1.302 | Tested |
| Claude Desktop, Code tab | 2.42304 | Tested |
| Claude Code for VS Code | 2.1.300 | Tested (2.1.89 did not load it) |
| Codex CLI | 0.163.0 | Tested, after trusting the hook in `/hooks` |
| Cursor CLI (`agent`) | 2026.10.16 | Tested |
| Cursor editor, agent panel | 3.25.6 | Tested |
| Cursor Agents Window | 3.25.6 | Does not load it: missing from the first and second message (Cursor bug) |
| GitHub Copilot CLI | 1.0.98 | Not tested: the plugin installs from a local copy of this repository; no session has run |
| VS Code, GitHub Copilot | | Not tested |

## Uninstall

- Claude Code: `claude plugin uninstall humans-md@humans-md`, then `claude plugin marketplace remove humans-md`.
- Codex: `codex plugin remove humans-md@humans-md`, then `codex plugin marketplace remove humans-md`.
- Copilot CLI: `copilot plugin uninstall humans-md`, then `copilot plugin marketplace remove humans-md`.
- Cursor: uninstall humans-md in **Customize**.
- Command line: `npm uninstall -g @humans-md/cli`, then remove the hook from your client's configuration.

Your files in `~/.humans/` stay where they are.

## Not in these packages

Reading a colleague's profile, merging a group's profiles and organization directories.

The command line is built from a repository that is not public yet. The published file is the complete, unminified program, so you can read all of it. Report problems in [issues](https://github.com/cmdai-hq/humans-md-plugins/issues).

## License

[Apache-2.0](LICENSE), with third-party notices in [NOTICE](NOTICE). The HUMANS.md name and logo are not covered by the license. Using the format never requires a cmdAI product. Maintained by [cmdAI](https://cmdai.fr).
