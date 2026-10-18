# Changelog

## 0.3-draft.2026-10-18.1 — 2026-10-18

Unpublished draft; no stable release or tag is introduced. Merged in [#9](https://github.com/cmdai-hq/HUMANS.md/pull/9). Changing three sentences and adding one is a contract change (§ 6.4); the frame and projection bytes are unchanged.

- `languages` gets an instruction sentence, rendered first: write to the recipient in the first listed language, even when they write in another; task content such as documents, code or site copy keeps the language its task or repository sets. SPEC § 3.2 now says what the field is for, as the compiler interview already asked ("In which language do you read agents' replies most easily? It can differ from the one you write in.").
- `minimal`, `short` and `max_words` keep what changes a result (§ 3.3): within the bound, a compressed message puts first any failure, skipped or unverified step, risk to data or security, change beyond the request or decision the recipient must make and, if it left items out, says how many. The bound still holds. The count is content, not an offer, so it fits `close_with: nothing`. § 4 replaces "Offer details on request" with the count.
- § 4 says who reads a message: preferences govern messages the recipient reads, whoever writes them, and not a message only another agent or program reads (a delegation prompt, a subagent's report, a handoff, tool arguments). An agent started by another agent writes for it unless its task says the recipient reads its output; an agent relaying content applies the preferences when it relays. Relabelling a message or moving it to a file, thread or handoff never lifts the cap, and the projection is never passed on to another agent as instructions. This clarifies "messages addressed to that recipient"; it gives the format no authority over messages between agents.
- The static frame (§ 6.3) is unchanged. A version that also told an agent started by another agent to write for it was trialled and dropped: forks already kept their reports complete without it (below).
- `behavior.json` adds nine native cases: language of the reply (one listed language, then two in an order the task's language does not match) and of task content, compression that keeps a failing test and a security finding, no boilerplate on a trivial answer, an agent's report, longer than the cap, that the recipient's cap does not shorten, a relay and a handoff the recipient reads that stay capped.
- Evidence, model trial and not a native adapter trial: Claude Code CLI 2.1.302, `claude -p --setting-sources local`, the rendering passed with `--append-system-prompt` instead of the plugin hook, synthetic tasks from the new `behavior.json` cases, current text against the proposed text. Haiku 5.5 (3 runs per case and variant) and Sonnet 5.5 (2 runs):
  - Reply in English to a French message: Sonnet 0/2 with the current text, 2/2 with the proposed sentence, too few runs to prove the sentence works; Haiku replied in French in all 9 runs, whatever the wording. Known limitation: on Haiku-class models `languages` is not followed when the recipient writes in another language.
  - 50-word cap held with both critical findings kept: Haiku 1/3 current, 6/6 proposed.
  - Frame trial, same harness: a first wording that added the scope rule to the frame ("A message only another agent or program reads keeps the form its task sets…") made Haiku write a handoff the recipient reads past the cap (1/3, current frame 3/3); a second wording held it (6/6). Native fork trial, Claude Code CLI 2.1.302 with the plugin's own `SessionStart` hook (built from the workshop, `--plugin-dir`, `CLAUDE_CODE_FORK_SUBAGENT=1`), `max_words: 20`, a forked subagent asked to report eight facts that need about 80 words: every report was complete with the published frame and with the second wording (Sonnet 4/4 and 4/4, Haiku 4/4 and 4/4), and no delegation prompt carried the cap. With no measured gain, the frame stays as it was; the rule lives in § 4.
  - "Nothing left out" filler after a review: 5 of 90 proposed runs, 0 on the trivial task; an earlier "then say how many items you left out" wording produced it in 5 of 24.

## Integrations 0.3.0 — 2026-10-17

Not a change to the format or its contract id.

- Release 0.3.0 of [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins) ([#5](https://github.com/cmdai-hq/humans-md-plugins/pull/5)) adds plugins for Google Antigravity, OpenCode, Devin and JetBrains Junie (Early Access extension), `humans-md sync` for clients that run no hook, and a portable compile skill installable with `npx skills add`. Same scope: the owner's own `~/.humans/HUMANS.md` only.
- `humans-md sync` writes a marked copy of the projection into a user instruction file read by Cline and the Warp Agent CLI (`~/.agents/AGENTS.md`) or the Junie CLI (`~/.junie/AGENTS.md`). It is a copy, not an adapter that reads the file at each load (§ 5): it goes stale until the owner runs it again.
- Evidence, each a new session asked without tools to quote `profile.notes` from an invented profile, on macOS, with the 0.3.0 build before publication (a local copy of the generated repository, not installed from GitHub):
  - Google Antigravity CLI 1.4.0 (`agy -p`, then `-c`): quoted once. A first build that also injected on `PreInvocation` delivered it twice; the published plugin uses `SessionStart` only.
  - OpenCode 2.0.32, model `anthropic/claude-haiku-5-5`, standalone and through the background service: quoted once, and on the next turn.
  - Devin CLI 3000.11.92 (`devin -p`, then `-c`): quoted once. The Claude Code plugin alone, installed in Devin, delivered nothing.
  - Junie CLI 26.10.12, copy written by `humans-md sync --to junie`, batch run: quoted. Junie CLI Early Access 26.10.20 with the extension, interactive: quoted on the first prompt of a session and again after `/new`, not added to the second prompt.
  - Codex CLI 0.163.0 and Cursor CLI 2026.10.16 with the 0.3.0 hook command: quoted.
  - Not tested: GitHub Copilot CLI, Cline, Warp, the Devin Desktop window, OpenCode 1. None of this establishes how closely a model follows the preferences.
- Evidence after publication, the same day, invented profile, macOS: plugin 0.3.0 installed from GitHub with the commands in its README, while `main` of humans-md-plugins was `e00a968` (tag `cli-v0.3.0`), was quoted once in Google Antigravity CLI 1.4.0 (`agy plugin install …/tree/main/plugins/antigravity`), OpenCode 2.0.32 (`opencode plugin add 'github:…#main::path:plugins/opencode'`), Devin CLI 3000.11.92 (`devin plugins install …#plugins/devin --local`) and Codex CLI 0.163.0 (after `codex plugin marketplace upgrade`: nothing until the changed hook was trusted again, then quoted). `@humans-md/cli` 0.3.0 from npm wrote the Junie copy (`npx -y @humans-md/cli sync --to junie`), quoted in Junie CLI 26.10.12. The Junie extension and Cursor were not tested again after publication.

## Integrations — 2026-10-17

Not a change to the format or its contract id.

- Release 0.2.0 of [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins) (`de2dd33`) adds plugins for Codex, GitHub Copilot CLI and Cursor beside the Claude Code plugin, each with its own marketplace file, and a guided interview in `/humans-md:compile`. Same scope: the owner's own `~/.humans/HUMANS.md` only.
- Evidence, each a new session asked without tools to quote `profile.notes` from an invented profile, on macOS, plugin 0.2.0 installed from GitHub:
  - Codex CLI 0.163.0: `codex plugin marketplace add cmdai-hq/humans-md-plugins`, `codex plugin add humans-md@humans-md`, hook trusted in `/hooks`, interactive session. Quoted.
  - Cursor CLI 2026.10.16-e3cb207: marketplace added with `agent plugin marketplace add`, plugin installed in Cursor; session `agent -p`. Quoted; a control session without the plugin answered NONE.
  - Cursor 3.25.6, editor agent panel, model Grok 4.7 High: quoted. The Agents Window did not receive the profile on the first or the second message.
  - GitHub Copilot CLI 1.0.98 installs the plugin; no session has run. None of this establishes how closely a model follows the preferences.

## Integrations — 2026-10-16

Not a change to the format or its contract id.

- The humans-md Claude Code plugin 0.1.0 and the command line `@humans-md/cli` 0.1.0 (npm) are published from [cmdai-hq/humans-md-plugins](https://github.com/cmdai-hq/humans-md-plugins), for contract `0.3-draft.2026-10-15.1`. They load the owner's own `~/.humans/HUMANS.md` only: no colleague's profile, no group merge, no MCP server.
- Evidence, each a new session asked without tools to quote `profile.notes` from an invented profile, on macOS, 16 October 2026:
  - Claude Code CLI 2.1.301, model `claude-haiku-5-5`: plugin installed from GitHub at `cmdai-hq/humans-md-plugins@4ea95dc` (`claude plugin marketplace add cmdai-hq/humans-md-plugins --scope local`, `claude plugin install humans-md@humans-md --scope local --config profile=<file>`), session `claude -p --no-session-persistence --model haiku`. Quoted.
  - Claude Code CLI 2.1.302, Claude Desktop 2.42304 and the VS Code extension 2.1.300: the same published build, `cmdai-hq/humans-md-plugins@4ea95dc`, installed from GitHub at local scope in a test project; new interactive sessions. Quoted in all three. Earlier the same day, Desktop and VS Code had also quoted it with a pre-release build (workshop `fc1cb5c`); extension 2.1.89 did not load it.
  - Codex, Cursor and Copilot CLI hooks are documented, not tested. None of this establishes how closely a model follows the preferences.

## 0.3-draft.2026-10-15.1 — 2026-10-15

Unpublished draft; no stable release or tag is introduced.

- The personal profile is `~/.humans/HUMANS.md`, replacing `~/.humans/me.md`: the file carries the format's name, in its own directory like `~/.codex/AGENTS.md`. Adapters load it from that fixed path and never search repositories for it. Free text moves from `~/.humans/me.source.md` to `~/.humans/source.md`; `~/.humans/people/<id>.md` and repository `humans/<id>.md` are unchanged. The `id` filename exception applies to a file named exactly `HUMANS.md`. Fields are unchanged: migrate with `mv ~/.humans/me.md ~/.humans/HUMANS.md` and `mv ~/.humans/me.source.md ~/.humans/source.md`. A repository-root `HUMANS.md` is still not a profile location.
- New declared version `humans: "0.3"`. It adds fields and values and renames one value (next item): a valid 0.2 profile becomes a valid 0.3 profile by changing its `humans` string and, if present, `visibility: public`. Readers read `"0.2"` as `"0.3"`; writers write `"0.3"`. Schema identifiers move to `/schema/0.3/` and group output declares `humans_group: "0.3"`.
- `visibility: public` is renamed `anyone_with_file`, with the same meaning: any reader who has the file, with no check by the consumer, so where the file is stored controls access. There is no `public` alias: in `"0.3"` it is an unknown visibility and the profile is absent. A reader still maps `public` in a `"0.2"` profile. The compiler preview states plainly who can read the profile.
- `reading.close_with: next_action | one_question | nothing` says what the last line holds. An agent never invents an action or a question to fill it.
- `reading.lead_with: next_action` opens with the recipient's next action. `reading.structure: numbered` numbers steps and questions.
- `deciding.question_style: open | multiple_choice | yes_confirms_recommendation` sets the shape of each question, and so the effort to answer it. Without a recommendation, `yes_confirms_recommendation` falls back to `multiple_choice`.
- `interrupting.progress_updates: every_message | phase_changes | end_only` sets how a long task reports where it stands in its own conversation. It never justifies a message elsewhere.
- `avoid` accepts `recap` and `idioms`.
- `interrupting.quiet_hours` gives a daily range and whole weekdays, in a time zone from a pinned list (IANA tz database 2026e `zone.tab` names plus `UTC`), when no agent interrupts the owner. It holds interruptions, never work, and states times, never a reason. A reader omits it when its time zone is unknown; groups and stored variants omit it. Like every optional list, `all_day: []` is valid, means no whole quiet day and is omitted from projections.
- Group merging uses a majority for the new fields, with fallbacks `nothing`, `multiple_choice` and `phase_changes`. `lead_with: next_action` joins the majority vote after the `tldr` and `decision_needed` rules. Stored variants accept the new fields and stay inactive.
- `schema/instructions.json` fixes one English sentence per projected preference value, and one each for `max_words` and `quiet_hours`. An adapter may append them, in a fixed order, after the JSON line of a text rendering; no profile value is interpolated and the 16 KiB bound covers them. Translations use the same keys. Sentences carry the cross-field rules of § 3 that apply to their value, such as a closing question counting toward `asks_per_message` or `format: options_only` taking precedence over `default_answer`.
- A compiler writes a fixed three-line YAML comment header at the top of `HUMANS.md` (SPEC § 10) for agents that read the raw file. Readers ignore it, never project it, and validators never require it. Its 288 bytes count toward the frontmatter limit; a compiler that cannot fit the fields with the header reports the overflow.
- `out_of_scope_steps` keeps its name; its meaning now says explicitly that it decides whether to list follow-ups outside the task in closing lines, never whether to do them.
- SPEC § 1 lists files that share the name or the idea but are not profiles: contributor lists, guidance for humans, output-style skills, working-hours guards, per-repository collaboration rules and files kept from agents.
- The frontmatter limit rises from 6,144 to 20,480 bytes (20 KiB), and the bounded read from 10,253 to 24,589 bytes. The 4 KiB body limit and the 16 KiB rendering limit are unchanged. A profile with every field at its maximum length, all four stored variants and the header now fits (7,482 bytes in ASCII).
- The projection and group schemas are self-contained: they no longer reference `humans.schema.json`, and their local `$defs` are copies that the structural check keeps identical.
- `CONTRACT.json` no longer names a baseline commit; consumers pin the canonical commit that contains the listed files.

## 0.2-draft.2026-10-13.1 — 2026-10-13

Revision of the unpublished, untagged 0.2 draft; no stable release or tag is introduced.

- Replace the medical blacklist with owner choice. Voluntary medical statements are valid notes. No inferred diagnosis, mandatory diagnosis or silent sanitization.
- Define a shared, bounded projection for structured consumers and adapters, retaining scoped notes and excluding comments, body, identity/directory prose and unknown fields. Separate validity from withholding warnings and model behavior.
- Describe hosted compilation/provider processing and normal owner approval accurately. Recommend explicit private sharing for new profiles and preserve existing sharing on update.
- Fix byte limits, fatal UTF-8, BOM, CRLF accounting, scalar values and calendar dates. Distinguish strict writes, permissive reads of known 0.2 and absence for unsupported future versions.
- Deactivate stored variants and reject caller state selectors everywhere. Keep group merging experimental; clarify empty-list abstention, conservative common knowledge, numeric conflicts and per-field contributor counts without anonymity claims.
- Apply max_words to the entire message, appendices included. Preserve all 21 preference fields while separating core and extension conformance.
- Add a complete personal example, expected projection/byte/group vectors, contribution policy, source integrity manifest and successors for all 17 historical MUST occurrences.

The delivered reference tools cover bounded byte reading, strict validation and supported-version parsing, withholding, experimental group merging, and presence-based selector rejection, with executable vectors and CLI regressions. Native-adapter and model trials remain separate pending evidence; this entry makes no claim of deployment or measured productivity improvement.
