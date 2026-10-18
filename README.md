# HUMANS.md for your coding agents

> AGENTS.md is for your codebase. **HUMANS.md is for you.**

A HUMANS.md is a small file that tells your coding agents how to work with you: how long and how structured their replies should be, which choices they can make without asking, and when to interrupt you. You write it once, in `~/.humans/HUMANS.md`, and every session starts with it. The format is open: [humansmd.dev](https://humansmd.dev).

```yaml
reading:
  lead_with: tldr
  max_words: 150
deciding:
  reversible: decide_and_report
interrupting:
  interrupt_for: blocking_only
```

Your agent receives these fields as information, not as orders, plus one plain sentence per preference, such as *"Interrupt only when you are blocked."* A complete file: [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md).

## Quick start

You need **Node 22.18 or later** (`node --version`). Tested on macOS only.

**1. Write your profile.** Start from the example, then change `id`, `name` and the values:

```sh
mkdir -p ~/.humans
curl -o ~/.humans/HUMANS.md \
  https://raw.githubusercontent.com/cmdai-hq/HUMANS.md/main/examples/HUMANS.md
npx -y @humans-md/cli check   # prints {"ok":true,"issues":[]}
```

Or let your agent write it with you: see [Write your profile](#write-your-profile).

**2. Install for your client.** One command; details and known issues in [Clients](#clients).

| Client | Install |
|---|---|
| Claude Code (CLI, Desktop, VS Code) | `claude plugin install humans-md --marketplace cmdai-hq/humans-md-plugins` |
| Codex | `codex plugin marketplace add cmdai-hq/humans-md-plugins && codex plugin add humans-md@humans-md`, then trust the hook in `/hooks` |
| GitHub Copilot CLI | `copilot plugin marketplace add cmdai-hq/humans-md-plugins && copilot plugin install humans-md@humans-md` |
| Cursor | `agent plugin marketplace add https://github.com/cmdai-hq/humans-md-plugins`, then `/add-plugin humans-md` in a Cursor chat |
| Google Antigravity | `agy plugin install https://github.com/cmdai-hq/humans-md-plugins/tree/main/plugins/antigravity` |
| OpenCode | `opencode plugin add 'github:cmdai-hq/humans-md-plugins#main::path:plugins/opencode'` |
| Devin (Desktop and CLI) | `devin plugins install cmdai-hq/humans-md-plugins#plugins/devin --local` |
| JetBrains Junie | `npx -y @humans-md/cli sync --to junie` |
| Cline, Warp | `npx -y @humans-md/cli sync` |
| Anything else | `npm install -g @humans-md/cli`, then add [one hook](packages/humans-md#hook-configuration) |

**3. Check it works.** Start a new session and ask: *"What does my HUMANS.md say about interruptions?"* Your agent should quote your value. If it does not, see [Troubleshooting](#troubleshooting).

## Clients

Each plugin reads `~/.humans/HUMANS.md` and nothing else. Install one plugin per client: some clients also load another client's plugins, and your profile would then load twice.

<details>
<summary><b>Claude Code</b> (CLI, Desktop, VS Code)</summary>

- **Install:** `claude plugin install humans-md --marketplace cmdai-hq/humans-md-plugins`. In a session: `/plugin install humans-md --marketplace cmdai-hq/humans-md-plugins`, then choose to install it for you.
- **Another file:** set **Your HUMANS.md** in `/config`. The file must be named `HUMANS.md`.
- **Update:** `claude plugin update humans-md@humans-md`, or **Update now** in `/plugin`. Claude Code does not update this marketplace by itself unless you turn on auto-update for it in the Marketplaces tab of `/plugin`.
- **Uninstall:** `claude plugin uninstall humans-md@humans-md`, then `claude plugin marketplace remove humans-md`.
</details>

<details>
<summary><b>Codex</b></summary>

- **Install:** `codex plugin marketplace add cmdai-hq/humans-md-plugins`, then `codex plugin add humans-md@humans-md`.
- **Trust the hook:** Codex runs a plugin's hook only after you trust it. Open `/hooks`, review the HUMANS.md hook and trust it. Codex asks again after each update.
- **Codex IDE extension:** it does not load plugins. Use the [hand-written hook](packages/humans-md#hook-configuration) there.
- **Update:** `codex plugin marketplace upgrade humans-md`, then trust the hook again in `/hooks`.
- **Uninstall:** `codex plugin remove humans-md@humans-md`, then `codex plugin marketplace remove humans-md`.
</details>

<details>
<summary><b>GitHub Copilot CLI</b></summary>

- **Install:** `copilot plugin marketplace add cmdai-hq/humans-md-plugins`, then `copilot plugin install humans-md@humans-md`.
- **Sandbox:** with Copilot CLI's sandbox on (`/sandbox`, off by default), the hook may not be able to read `~/.humans`, and your agent gets no profile.
- **VS Code:** VS Code lists plugins installed with Copilot CLI in its Agent Plugins view (setting `chat.plugins.enabled`). Not tried yet. With the Claude Code extension and its plugin too, VS Code may load both.
- **Update:** `copilot plugin update humans-md`.
- **Uninstall:** `copilot plugin uninstall humans-md`, then `copilot plugin marketplace remove humans-md`.
</details>

<details>
<summary><b>Cursor</b></summary>

- **Install:** with the Cursor CLI, `agent plugin marketplace add https://github.com/cmdai-hq/humans-md-plugins`; then, in a Cursor chat, `/add-plugin humans-md` (a name, not a URL) and install it for you. No Cursor CLI yet: `curl https://cursor.com/install -fsS | bash`, then `agent login`.
- **Right plugin:** its description must say "each agent chat". If it says "Claude", Cursor picked the Claude Code plugin: remove the marketplace, add it again and reinstall.
- **Claude Code too:** Cursor imports Claude Code plugins (Settings → Agents → Third-Party Imports, on by default). Keep one of the two.
- **Agents Window:** it does not load the profile (on 3.25.6, missing from the first and the second message; [Cursor forum](https://forum.cursor.com/t/agents-window-ignores-sessionstart-additional-context-claude-code-project-hooks-no-longer-load-3-24-9/174143)). Use the editor's agent panel or the `agent` CLI.
- **Update:** a marketplace stays on the commit it was added at, and updating it re-reads that commit ([Cursor forum](https://forum.cursor.com/t/cli-added-git-marketplace-never-reindexes-plugin-marketplace-update-reports-0-plugins-indexed-and-cache-stays-pinned-to-the-first-commit/169587)). Run `agent plugin marketplace remove humans-md`, add it again, then uninstall humans-md in **Customize** and install it again with `/add-plugin humans-md`.
- **Uninstall:** uninstall humans-md in **Customize**.
</details>

<details>
<summary><b>Google Antigravity</b></summary>

- **Install:** `agy plugin install https://github.com/cmdai-hq/humans-md-plugins/tree/main/plugins/antigravity`. Use this full address: with the bare repository address, `agy` would install every plugin folder it finds here.
- **Needs** Antigravity 1.4.0 or later, and macOS or Linux. The profile loads once, when a conversation starts.
- **App and IDE:** they read the same plugin folder, but have not been tried.
- **Update:** `agy plugin uninstall humans-md`, then run the install command again.
- **Uninstall:** `agy plugin uninstall humans-md`.
</details>

<details>
<summary><b>OpenCode</b></summary>

- **Install (OpenCode 2):** `opencode plugin add 'github:cmdai-hq/humans-md-plugins#main::path:plugins/opencode'`. It needs `git`.
- **Background service:** if nothing loads, run `opencode service restart` from a terminal where `node --version` works.
- **OpenCode 1** (npm `opencode-ai`, 1.18.29 or later; also works on OpenCode 2):
  ```sh
  git clone --depth 1 https://github.com/cmdai-hq/humans-md-plugins /tmp/humans-md-plugins
  cp -R /tmp/humans-md-plugins/plugins/opencode ~/.config/opencode/humans-md
  mkdir -p ~/.config/opencode/plugins
  echo 'export { default } from "../humans-md/index.js";' > ~/.config/opencode/plugins/humans-md.js
  ```
  One of the two installs is enough; with both, the profile is still added once.
- **Update:** OpenCode 2: `opencode plugin update`. OpenCode 1: `git -C /tmp/humans-md-plugins pull`, then copy the plugin again.
- **Uninstall:** OpenCode 2: `opencode plugin remove 'github:cmdai-hq/humans-md-plugins#main::path:plugins/opencode'` (`opencode plugin list` shows the exact name). OpenCode 1: `rm -r ~/.config/opencode/humans-md ~/.config/opencode/plugins/humans-md.js`.
</details>

<details>
<summary><b>Devin</b> (Desktop and CLI)</summary>

- **Install:** `devin plugins install cmdai-hq/humans-md-plugins#plugins/devin --local`, then start a new conversation with Devin Local. Devin Desktop (formerly Windsurf) and the Devin CLI share their plugins.
- **No `devin` command?** Run **Install Devin CLI** from Devin Desktop, then `devin auth login`. Without a terminal: on [app.devin.ai/customize](https://app.devin.ai/customize), **Add plugin**, **From repository**, `cmdai-hq/humans-md-plugins`, subdirectory `plugins/devin`, scope **Personal**.
- **Keep `#plugins/devin`:** the Claude Code plugin has the same name and loads nothing in Devin. `--local` keeps the plugin out of Devin cloud sessions, where your file does not exist.
- **Not loaded** in the legacy Cascade agent or in Restricted Mode.
- **Update:** `devin plugins update humans-md`.
- **Uninstall:** `devin plugins remove humans-md --local`.
</details>

<details>
<summary><b>JetBrains Junie</b></summary>

- **Install:** `npx -y @humans-md/cli sync --to junie` copies your profile into `~/.junie/AGENTS.md`, which the Junie CLI reads. It is a [copy](#clients-without-a-hook-a-copy): run it again after each change. Junie in your IDE's AI Chat is not documented to read that file.
- **Junie CLI Early Access:** an extension can load your file as it is now, with the first prompt of each session, in the interactive terminal only. In `junie`, run `/extensions marketplace add https://raw.githubusercontent.com/cmdai-hq/humans-md-plugins/main/.junie-extension/marketplace.json`, then `/extensions`, pick `humans-md` and choose the user scope. Use this exact address: adding `cmdai-hq/humans-md-plugins` shows the Claude Code plugin, which does nothing in Junie. Use the copy or the extension, not both.
- **Update:** the copy: run the sync command again. The extension: `/extensions`, **Installed**, `humans-md`, **Update**.
- **Uninstall:** the copy: `npx -y @humans-md/cli sync --to junie --remove`. The extension: `/extensions`, **Installed**, `humans-md`, **Remove**; you can delete `~/.cache/humans-md/junie-sessions/`.
</details>

<details>
<summary><b>Cline and Warp</b></summary>

- **Install:** `npx -y @humans-md/cli sync` copies your profile into `~/.agents/AGENTS.md`, which Cline (VS Code, Desktop, CLI) and the Warp Agent CLI read. It is a [copy](#clients-without-a-hook-a-copy): run it again after each change.
- **Warp app:** paste the output of `npx -y @humans-md/cli show` into a Global Rule (Warp Drive, Personal, Rules).
- **Uninstall:** `npx -y @humans-md/cli sync --remove`.
</details>

### Clients without a hook: a copy

`humans-md sync` writes what your agents would receive into a user-level instruction file, between `<!-- humans-md:begin -->` and `<!-- humans-md:end -->`, and leaves the rest of the file as it is. It is a copy, not a live load: **run it again after each change to your HUMANS.md.** `--dry-run` shows what would change; `--remove` takes the copy out. If your home directory is in a git repository (dotfiles), check what you commit: the copy can include your private notes. More in the [package README](packages/humans-md/README.md#sync-a-copy-for-clients-without-a-hook).

## Write your profile

- **In Claude Code:** run `/humans-md:compile`. Describe how you like to work, or answer about ten short questions, one at a time. Claude tells you which AI provider reads your words, shows you the file, and saves it only after you say yes.
- **In other agents:** install the compile skill with [skills](https://skills.sh/cmdai-hq/humans-md-plugins), then ask your agent to write your HUMANS.md (or type `/humans-md-compile`):
  ```sh
  npx skills add cmdai-hq/humans-md-plugins --skill humans-md-compile -g
  ```
  It installs one skill for your user in the agents it finds (Codex, Cursor, GitHub Copilot, OpenCode, Devin, Junie, Warp and others), works like `/humans-md:compile` and ships its own copy of the command line. It writes the file; the plugin for your client loads it. Not tried yet in Cline and Antigravity.
- **By hand:** start from the [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md), as in the [Quick start](#quick-start).

To keep the file elsewhere, for example in a dotfiles repository, make `~/.humans/HUMANS.md` a symbolic link to a file that is also named `HUMANS.md`.

## Troubleshooting

1. Run `npx -y @humans-md/cli check` and fix what it reports.
2. Check that `node --version` prints 22.18 or later where your client starts. Desktop apps opened from the Dock may not see a `node` installed with nvm or Homebrew: start the app from a terminal once, or install Node from [nodejs.org](https://nodejs.org).
3. Codex: check that the hook is trusted in `/hooks`. Cursor: open the Output panel, choose **Hooks** and look for `sessionStart`.
4. On a work machine, your administrator may block plugins or hooks.
5. Your profile shows up twice: two plugins load it (for example Cursor importing the Claude Code plugin). Remove one.

Restart your client after an install or an update. To update the command line: `npm install -g @humans-md/cli@latest`.

## What your agent receives

The fields it recognizes, labelled as data, then one plain sentence per preference. Comments, unknown fields and the Markdown body are left out. If the file is missing, invalid or too large, the agent receives `{"status":"none"}`: nothing is loaded, and nothing is cut short. To leave the plain sentences out, start your client with `HUMANS_GUIDANCE=off` set (for OpenCode, in the environment of its background service), or pass `--no-guidance` to the command line.

## Privacy and limits

- Your profile can include private notes. They reach your own agent, so your agent's AI provider processes them. Nothing is sent anywhere else: no network request, no telemetry.
- Preferences change how agents present their work to you. They never grant a permission, and your repository and tool rules win.
- Notes that look like commands to agents are left out. This filter is best-effort: do not rely on it for security.

## Compatibility

Format version: 0.3 draft (`0.3-draft.2026-10-18.1`). macOS only. "Tested" means a real session on the version named loaded the profile and the model quoted a value from it; it says nothing about how well a model follows the preferences. "From GitHub" means plugin 0.3.0 installed with the command in this README; "local copy" means the 0.3.0 build tested before it was published. 0.3.1 changes only the plain sentences after the data (a sentence for `languages`; `minimal`, `short` and `max_words` now put failures, risks and decisions first and say how many items were left out) and loads the same way; Claude Code CLI 2.1.302 loaded a local copy of the 0.3.1 build.

| Client | Version | Status (2026-10-17) |
|---|---|---|
| Claude Code CLI, Desktop, VS Code | 2.1.301, 2.42304, 2.1.300 | Tested (VS Code 2.1.89 did not load it) |
| Codex CLI | 0.163.0 | Tested from GitHub, after trusting the hook again in `/hooks` |
| Cursor CLI, editor agent panel | 2026.10.16, 3.25.6 | Tested, CLI also local copy |
| Cursor Agents Window | 3.25.6 | Does not load it (Cursor bug) |
| Google Antigravity CLI | 1.4.0 | Tested from GitHub |
| OpenCode 2 | 2.0.32 | Tested from GitHub, also through the background service |
| Devin CLI | 3000.11.92 | Tested from GitHub |
| Junie CLI, copy with `npx -y @humans-md/cli sync --to junie` | 26.10.12 | Tested with `@humans-md/cli` 0.3.0 from npm |
| Junie CLI EAP, extension | 26.10.20 | Tested, local copy: first prompt of each session |
| GitHub Copilot CLI, VS Code Copilot, OpenCode 1, Devin Desktop window, Cline, Warp | | Not tested |

## Not in these packages

Reading a colleague's profile, merging a group's profiles and organization directories.

The command line is built from [`core/`](core) in this repository. The published file is the complete, unminified program, so you can read all of it. Report problems in [issues](https://github.com/cmdai-hq/humans-md-plugins/issues).

## Development

Node 22.18 or later. `npm ci` once.

- **Layout:** [`core/`](core) is the TypeScript source of the command line, with its tests. [`spec/`](spec) is a pinned copy of [cmdai-hq/HUMANS.md](https://github.com/cmdai-hq/HUMANS.md), recorded in `spec/MIRROR.json`. `plugins/`, `skills/` and `packages/` are what users install, so the built files stay committed.
- **Build:** `npm run build` writes the built files in place: the command line in every plugin, the portable skill and the npm package, the hook runtime copied from `plugins/humans-md/hooks/runtime.mjs`, `skills/humans-md-compile` (made from `plugins/humans-md/skills/compile`), the vocabulary reference, the LICENSE and NOTICE copies and the plugin versions. Edit every other file directly, then build. `npm run build -- --check` fails when a committed built file is out of date; CI runs it.
- **Test:** `npm test` runs the core tests (vitest) and the tests of the shipped files (`node --test 'test/*.test.mjs'`). `npm run typecheck` checks the TypeScript.
- **Update the spec:** a daily workflow opens a pull request when HUMANS.md changes. By hand: `npm run sync:spec -- --source <HUMANS.md checkout> --revision <full commit>`, then `npm run build`.
- **Release:** `npm run release 0.3.2`, then a pull request; after the merge, tag `v0.3.2`. Details in [docs/RELEASING.md](docs/RELEASING.md).

## License

[Apache-2.0](LICENSE), with third-party notices in [NOTICE](NOTICE). The HUMANS.md name and logo are not covered by the license. Using the format never requires a cmdAI product. Maintained by [cmdAI](https://cmdai.fr).
