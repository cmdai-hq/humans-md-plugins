# @humans-md/cli

Check your [HUMANS.md](https://humansmd.dev), and print it in the format Codex, Cursor or Copilot CLI expect from a session-start hook. Reads your own profile only.

On Claude Code, Codex, Cursor or GitHub Copilot CLI, the [plugins](https://github.com/cmdai-hq/humans-md-plugins) set up the hook for you. Use this command line to check your file, to add the hook by hand elsewhere, or to [copy your profile](#sync-a-copy-for-clients-without-a-hook) for clients without a hook.

```sh
npm install -g @humans-md/cli   # Node 22.18 or later
humans-md check                 # validate ~/.humans/HUMANS.md
humans-md show                  # what your agents receive
```

No profile yet? Copy the [example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md) into `~/.humans/HUMANS.md`, edit it, then run `humans-md check`. Success prints `{"ok":true,"issues":[]}`.

## Commands

| Command | What it does |
|---|---|
| `humans-md check [file]` | Checks a profile. Prints `{ ok, issues }`. |
| `humans-md show [file]` | Prints what your agents receive: your fields, labelled as data, then one plain sentence per preference. `--json` prints the fields only. |
| `humans-md hook <client> [file]` | The same output, wrapped in the JSON that `codex`, `cursor`, `copilot` or `claude` expects from a session-start hook. |
| `humans-md sync [file]` | Copies what `show` prints into a user-level instruction file, for clients without a hook; `--check` tells whether that copy still matches your profile. See [Sync](#sync-a-copy-for-clients-without-a-hook). |

`file` defaults to `~/.humans/HUMANS.md`.

### Options and rules

- `--no-guidance` (`show`, `hook`): leave out the plain sentences.
- `--budget-bytes N`, `--budget-tokens N` (`show`, `hook`): lower the output size limit. They never raise it.
- `--draft` (`check`): check a file that is not named `HUMANS.md`.
- `show`, `hook` and `sync` read only a file named `HUMANS.md`, given as an absolute path or starting with `~/`.
- A missing, invalid or too large profile prints `{"status":"none"}`, never part of a profile. Comments, unknown fields and the Markdown body are always left out.
- Exit codes: `0` success (including `{"status":"none"}`), `1` invalid or missing profile (`check`, `sync`) or a target `sync` refuses, `2` invalid arguments, with the usage on stderr, before any file is read.

### What `check` reports

One line, at most 512 bytes: `{"ok":false,"issues":[{"path":"$.reading.max_words","message":"OUT_OF_RANGE","severity":"error"}]}`. `path` is the field at fault (`$` is the whole file) and `message` a code from this table. `check` never prints a value, or a key it does not know: an unknown key is reported at the block that holds it. A `warning` does not make the profile invalid.

| Code | What to fix |
|---|---|
| `MISSING` | Add this required field. |
| `UNKNOWN_FIELD` | The block at `path` holds a key the format does not have: look for a typo or wrong indentation. |
| `NOT_AN_ALLOWED_VALUE` | Use a value from the field's list ([example](https://github.com/cmdai-hq/HUMANS.md/blob/main/examples/HUMANS.md)). |
| `WRONG_TYPE` | For example a list where one value is expected, or `humans: 0.3` without quotes. |
| `OUT_OF_RANGE` | A number too small or too large, a text too long, or too many items. |
| `WRONG_FORMAT` | A date that is not `"YYYY-MM-DD"`, an `id` with other characters than `a-z`, `0-9` and `-`, a time that is not on the hour or half hour. |
| `NOT_PLAIN_TEXT` | The text holds a link, an email address, markup or a control character. |
| `DUPLICATE_VALUE` | The list holds the same value twice. |
| `EMPTY_RANGE` | `quiet_hours` starts and ends at the same time. |
| `BODY_NOT_ALLOWED` | Remove everything after the closing `---`, blank lines included. |
| `FRONTMATTER_DELIMITERS` | The file must start with a `---` line and close with another. |
| `YAML_INVALID` | The YAML does not parse, or a key appears twice. |
| `YAML_FEATURE_NOT_ALLOWED` | Remove anchors (`&`), aliases (`*`), tags (`!`), directives and document markers. |
| `TOO_LARGE` | Over 24,589 bytes in all, or 20 KiB between the `---` lines. |
| `NOT_UTF8` | Save the file as UTF-8. |
| `FILENAME_MISMATCH` | At `$`: the file, or the file its link points to, is not named exactly `HUMANS.md`, capitals included (`humans.md` opens on macOS but is not loaded). At `$.id`: a shared `<id>.md` whose `id` differs from its file name. |
| `UNSUPPORTED_VERSION` | `humans` must be `"0.3"`. |
| `PROFILE_UNAVAILABLE` | The file is missing or cannot be read. |
| `PROFILE_INVALID` | Invalid, and `check` found no place to point at. |
| `NOTE_WITHHELD_AGENT_DIRECTED` (warning) | Your notes read like instructions to an agent: your agent gets your profile without them. |
| `DRAFT_FILENAME_UNCHECKED` (warning) | `--draft` skipped the file name rule. |

## Hook configuration

Add one hook to your existing configuration. These snippets follow each client's documentation as read on 2026-10-16; none has been tested in a real session yet.

Test by hand first: `humans-md hook cursor` should print `"status":"found"`. `{"status":"none"}` means the file is missing, invalid or too large: run `humans-md check` to see why. If your client starts from a desktop app, its `PATH` may not include npm's global `bin`: use the absolute path that `which humans-md` prints.

**Codex**: install the [plugin](https://github.com/cmdai-hq/humans-md-plugins#codex) instead; it needs no global install and loads the plain sentences too. Use this hook where plugins do not load, such as the Codex IDE extension: `~/.codex/hooks.json`, then review and trust the hook in `/hooks`.

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume|clear|compact|fork",
      "hooks": [{
        "type": "command",
        "command": "humans-md hook codex --no-guidance"
      }]
    }]
  }
}
```

Without an `additionalContextLimit`, Codex limits hook output to about 2,500 tokens, so `hook codex` caps its context at 2,500 bytes. A full profile plus the plain sentences can exceed that and would load as nothing, so this snippet uses `--no-guidance`: Codex gets your fields without the sentences.

**Cursor**: the plugin needs no global install. See [Cursor](https://github.com/cmdai-hq/humans-md-plugins#cursor). Without it, add this to `~/.cursor/hooks.json`.

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{
      "command": "humans-md hook cursor"
    }]
  }
}
```

**GitHub Copilot CLI**: the plugin needs no global install and no hook file. See [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins#github-copilot-cli). To add the hook by hand instead, put a file in `~/.copilot/hooks/`, for example `humans-md.json`.

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{
      "type": "command",
      "command": "humans-md hook copilot"
    }]
  }
}
```

Keep it in `~/.copilot/hooks/`. A `sessionStart` hook placed in a repository's `.github/hooks/` may not run ([github/copilot-cli#1730](https://github.com/github/copilot-cli/issues/1730), open on 2026-10-16). In that issue, the same hook ran from the user directory on Copilot CLI 1.0.78 for macOS.

**Claude Code**: install the plugin instead; it needs no global install. See [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins).

## Sync: a copy for clients without a hook

Some clients run no hook and load no plugin, but read a user-level instruction file. `humans-md sync` writes what `humans-md show` prints into that file, between two markers:

```text
<!-- humans-md:begin -->
<!-- Generated copy of your HUMANS.md, written by humans-md 0.3.2 on 2026-11-10 from the profile with SHA-256 3f2a…. Do not edit it here: edit your HUMANS.md, then run `humans-md sync` again. -->
...what humans-md show prints...
<!-- humans-md:end -->
```

| Client | Command | File |
|---|---|---|
| Cline (VS Code, Desktop, CLI) | `humans-md sync` | `~/.agents/AGENTS.md` |
| Junie CLI | `humans-md sync --to junie` | `~/.junie/AGENTS.md` |
| Any other file | `humans-md sync --target PATH` | `PATH`, absolute or starting with `~/` |

These locations follow each client's documentation as read on 2026-10-17. The Junie CLI copy was tested in a real session (Junie 26.10.12); the Cline and Warp locations have not been tested yet. Junie inside a JetBrains IDE's AI Chat runs the Junie CLI, but its documentation does not say whether it reads `~/.junie/AGENTS.md`. Warp keeps its Global Rules inside the app, not in a file: paste the output of `humans-md show` into a Global Rule instead (Warp Drive, Personal, Rules).

**This is a copy, not a live load.** A hook or plugin reads your HUMANS.md at each session start, as the format asks. A copy does not: run `humans-md sync` again after each change to your profile, or your agents keep the old one.

The first line of the block says what the copy was made from: the version of `humans-md`, the day, and the SHA-256 of your HUMANS.md file. `humans-md sync --check` (with the same `--to`, `--target` and `--no-guidance` as the copy) compares the copy with what `sync` would write now, writes nothing, and exits with `1` and one code when they differ:

| Code | Meaning |
|---|---|
| `COPY_MISSING` | The file holds no copy. |
| `BINDING_MISSING` | The copy does not say what it was made from: `humans-md` 0.3.2 or earlier wrote it, or its first line was edited. |
| `BINDING_MISMATCH` | Your HUMANS.md, the version of `humans-md`, the options or the copy itself changed since. |
| `BINDING_STALE` | Same profile and version, but the copy was made on another day. |

In each case, `humans-md sync` writes it again. Your client does not run this check: it reads the file as it is.

- The rest of the file is kept byte for byte. One exception: after `--remove`, a file that had no final newline keeps the one sync added before its block. A new block goes at the end, after a blank line. A new file is readable by you only (mode 600).
- Running it again on the same day without a change rewrites nothing. On another day, or with another version of `humans-md`, it writes the block again with its new first line.
- `--remove` takes the block out, without reading your profile. `--dry-run` shows what would change and prints the block, without writing.
- `--no-guidance` leaves out the plain sentences, as with `show`.
- `--check` cannot be combined with `--remove` or `--dry-run`.
- It refuses, writes nothing and exits with `1` when: the profile is missing or invalid; `HOME` is not an absolute path (`HOME_UNAVAILABLE`); the target is a symbolic link, a hard link or not a regular file (`TARGET_NOT_REGULAR`); the target is in a git work tree or a common dotfiles setup, since your profile can hold private notes (`TARGET_IN_REPOSITORY`, see below); the markers are duplicated, unpaired or edited (`TARGET_MARKERS_INVALID`, fix them by hand); the target is over 1 MiB (`TARGET_TOO_LARGE`) or named `HUMANS.md` (`TARGET_IS_PROFILE`).
- Git work trees and dotfiles: sync refuses a target in a folder with a `.git` entry above it, a home directory tracked by a bare repository in `~/.dotfiles` or `~/.cfg` or by yadm, and any target while `GIT_DIR` or `GIT_WORK_TREE` is set. It reads those files without running git, and other setups are not detected: check before committing your home directory.
- The write goes to a temporary file in the same folder, then replaces the target in one step. It keeps the target's permissions for you and removes any access for group and others.

## Uninstall

`humans-md sync --remove` (add `--to junie` or `--target PATH` if you used them), `npm uninstall -g @humans-md/cli`, then remove the hook from your client's configuration. Your files in `~/.humans/` stay where they are.

## Privacy

`check`, `show` and `hook` read the file you name and nothing else. `sync` also reads and writes the one instruction file it targets. No command makes a network request or collects anything. What `show`, `hook` and `sync` produce goes into your agent's context, so your agent's AI provider processes it, private notes included: that is the point of loading your own profile.

## License

Apache-2.0, with third-party notices in NOTICE. The HUMANS.md name and logo are not covered by the license. The format is specified at [cmdai-hq/HUMANS.md](https://github.com/cmdai-hq/HUMANS.md) (CC BY 4.0). Using it never requires a cmdAI product.
