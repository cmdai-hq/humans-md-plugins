# @humans-md/cli

Check your [HUMANS.md](https://humansmd.dev), and print it in the format Codex, Cursor or Copilot CLI expect from a session-start hook. Reads your own profile only.

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

`file` defaults to `~/.humans/HUMANS.md`.

### Options and rules

- `--no-guidance` (`show`, `hook`): leave out the plain sentences.
- `--budget-bytes N`, `--budget-tokens N` (`show`, `hook`): lower the output size limit. They never raise it.
- `--draft` (`check`): check a file that is not named `HUMANS.md`.
- `show` and `hook` read only a file named `HUMANS.md`, given as an absolute path or starting with `~/`.
- A missing, invalid or too large profile prints `{"status":"none"}`, never part of a profile. Comments, unknown fields and the Markdown body are always left out.
- Exit codes: `0` success (including `{"status":"none"}`), `1` invalid or missing profile (`check`), `2` invalid arguments, with the usage on stderr, before any file is read.

## Hook configuration

Add one hook to your existing configuration. These snippets follow each client's documentation as read on 2026-10-16; none has been tested in a real session yet.

Test by hand first: `humans-md hook cursor` should print `"status":"found"`. `{"status":"none"}` means the file is missing, invalid or too large: run `humans-md check` to see why. If your client starts from a desktop app, its `PATH` may not include npm's global `bin`: use the absolute path that `which humans-md` prints.

**Codex**: `~/.codex/hooks.json`, then review and trust the hook in `/hooks`.

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

Codex limits hook output to about 2,500 tokens. A full profile plus the plain sentences can exceed that and would load as nothing, so this snippet uses `--no-guidance`: Codex gets your fields without the sentences.

**Cursor**: `~/.cursor/hooks.json`.

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

**GitHub Copilot CLI**: a file in `~/.copilot/hooks/`, for example `humans-md.json`.

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

Known bug: a `sessionStart` hook placed in a repository's `.github/hooks/` may not run ([github/copilot-cli#1730](https://github.com/github/copilot-cli/issues/1730), open on 2026-10-16).

**Claude Code**: install the plugin instead; it needs no global install. See [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins).

## Uninstall

`npm uninstall -g @humans-md/cli`, then remove the hook from your client's configuration. Your files in `~/.humans/` stay where they are.

## Privacy

The command reads the file you name and nothing else. It makes no network request and collects nothing. What it prints goes into your agent's context, so your agent's AI provider processes it, private notes included: that is the point of loading your own profile.

## License

Apache-2.0, with third-party notices in NOTICE. The HUMANS.md name and logo are not covered by the license. The format is specified at [cmdai-hq/HUMANS.md](https://github.com/cmdai-hq/HUMANS.md) (CC BY 4.0). Using it never requires a cmdAI product.
