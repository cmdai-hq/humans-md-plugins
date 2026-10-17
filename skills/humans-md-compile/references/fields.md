# HUMANS.md fields (spec 0.3)

Normative source: `SPEC.md` and `schema/humans.schema.json` in https://github.com/cmdai-hq/HUMANS.md. `~/.humans/HUMANS.md` holds this frontmatter and nothing else, at most 20,480 raw frontmatter bytes including the 288-byte [file header](#file-header).

Every field is optional unless marked required. Values are closed: use exactly one listed value, or leave the field out. Phrases in quotes are what people typically write.

## Identity

| Field | Value |
|---|---|
| `humans` | required, `"0.3"` (quoted). A `"0.2"` profile is still read; an update writes `"0.3"` and renames `visibility: public` to `anyone_with_file`. Other versions are unsupported; a migration needs a reviewed new draft |
| `id` | required, lowercase slug `[a-z0-9-]{2,64}`; equals the file name, except for a file named exactly `HUMANS.md` |
| `name` | required, plain text 1–80 Unicode scalar values |
| `aliases` | ≤ 5 names or nicknames, 1–40 Unicode scalar values each |
| `identities` | `email`, `slack` (`T…/U…`), `github`, `gitlab`, `entra`, `google` |
| `languages` | ≤ 10 ISO 639-1 codes in reading/output preference order, e.g. `[fr, en]`; levels and quotation/identifier exceptions belong in notes, not extra language codes |
| `updated` | required, `"YYYY-MM-DD"` (quoted) |
| `visibility` | `org` (omission means org), `anyone_with_file`, `private`; propose explicit private only for new profiles; preserve existing omission or explicit value on updates unless a scope change is approved |

Who can read, to state plainly in every preview: `private`, only the owner's own agents; `org`, authenticated members of the owner's organization; `anyone_with_file`, anyone who has the file, because no consumer checks who reads: in a public repository, that is anyone on the Internet. `public` is not a 0.3 value (a 0.3 file with it is invalid and read as absent); updating a `"0.2"` profile turns its `public` into `anyone_with_file`, the same scope under its new name, shown in the preview but not a scope change.

A stated reading language can support a `languages` proposal even when paired with a proficiency level; show any contextual interpretation in the preview and retain the requested level/quotation wording in notes. Ability alone, nationality, source/note authoring language and quotation language do not establish preferred output languages or their order. A stated level under a reading heading still supports the proposal; label the contextual mapping as an interpretation in the preview, and keep the level and quotation constraints in the requested note as well, since a note does not replace a representable language preference. Clarify genuinely conflicting preferences or uncertain ordering normally.

An identified existing baseline, including a partial or empty mapping, stays an update. Missing required fields need ordinary clarification, not a new-profile visibility default. Distinguish known omission (effective `org`) from visibility merely unshown. An empty or partial mapping never proves completeness. Unless the owner or an authorized full read explicitly confirms completeness, the update preview and ordinary approval must condition canonical replacement on obtaining or confirming the complete baseline and preserving unshown fields. Proposal acceptance alone is not replacement authorization; no repeat question is needed after confirmation.

## `reading`: what I read

| Field | Values | People write |
|---|---|---|
| `lead_with` | `tldr`, `decision_needed`, `context`, `question`, `next_action` | "TL;DR first", "tell me what you need from me first", "start with what I have to do" → `next_action` |
| `length` | `minimal` (≤ 5 lines), `short` (≤ 1 screen), `standard`, `thorough` | "short", "I read everything" |
| `max_words` | integer 20–2000 | "never more than 200 words" |
| `structure` | `bullets`, `prose`, `mixed`, `numbered` | "bullet points", "full sentences", "number your steps so I can answer by number" → `numbered` |
| `visual` | ordered list of `diagram`, `table`, `chart`, `example`, `text` | "I'm visual", "show me an example" |
| `technical_depth` | `non_technical`, `balanced`, `expert` | "I'm not technical", "give me the internals" |
| `jargon` | `avoid`, `define`, `ok` | "no jargon" → `avoid`; "define jargon / explain terms once" → `define`; "jargon is fine" → `ok` |
| `tone` | `direct`, `neutral`, `warm` | "be blunt", "be kind" |
| `evidence` | `numbers_and_sources`, `key_numbers`, `light` | "factual", "show me the numbers" |
| `uncertainty` | `flag_explicitly`, `inline` | "say what is verified and what is guessed" |
| `close_with` | `next_action`, `one_question`, `nothing` | "end with one small next step for me" → `next_action`; "end with your one question" → `one_question`; "no closing offer, just stop" → `nothing` |

`close_with` never invents a step or a question: with nothing to put there, the message ends with its content. A closing question counts toward `asks_per_message`; a closing action follows `out_of_scope_steps`. "No recap at the end" is `avoid: [recap]`, not `close_with`.

## `deciding`: what I decide

| Field | Values | People write |
|---|---|---|
| `reversible` | `decide_and_report`, `ask` | "decide alone if it can be undone" |
| `batch_questions` | `end_of_task`, `as_they_come` | "group your questions at the end" |
| `default_answer` | `always`, `when_obvious` | "always propose a default" |
| `asks_per_message` | `one`, `few`, `any` | "one decision at a time" |
| `format` | `recommendation_first`, `options_then_recommendation`, `options_only` | "give me your recommendation" |
| `question_style` | `open`, `multiple_choice`, `yes_confirms_recommendation` | "ask me open questions" → `open`; "give me options A, B, C" → `multiple_choice`; "ask so I can just say yes to your pick" → `yes_confirms_recommendation` |
| `challenge` | `welcome_early`, `after_draft`, `on_request` | "challenge me early" |
| `out_of_scope_steps` | `omit_unless_blocking`, `list` | "don't list merge or deploy at the end unless it blocks" |

`question_style` shapes each question; `asks_per_message`, `default_answer` and `format` keep their meaning, and `format: options_only` takes precedence over `default_answer`: no recommendation. Without a recommendation, `yes_confirms_recommendation` falls back to labelled options; a question with no options to offer is asked openly. `out_of_scope_steps` decides whether follow-ups outside the task are listed in closing lines, never whether they are done.

## `interrupting`: when to interrupt me

| Field | Values | People write |
|---|---|---|
| `interrupt_for` | `blocking_only`, `blocking_or_risky`, `anything` | "only if you're blocked" |
| `group_by` | `project`, `none` | "group messages by project" |
| `when_focused` | `summary_later`, `urgent_only`, `as_usual` | "in focus mode, send me a summary later" |
| `channel_hint` | `async_written`, `sync_call`, `either` | "write, don't call" |
| `progress_updates` | `every_message`, `phase_changes`, `end_only` | "tell me which step you're on" → `every_message`; "only when a phase changes" → `phase_changes`; "just tell me at the end" → `end_only` |
| `quiet_hours` | mapping: `time_zone`, `from`, `to`, optional `all_day` | "don't interrupt me after 7 pm or before 8 am, Paris time, nor at weekends" |

`progress_updates` covers progress reported in the task's own conversation; it never justifies a message elsewhere.

### `quiet_hours`

```yaml
interrupting:
  quiet_hours:
    time_zone: Europe/Paris
    from: "19:00"
    to: "08:00"
    all_day: [saturday, sunday]
```

- `time_zone` (required): one name from the pinned list in [`vocabulary.md`](vocabulary.md), e.g. `Europe/Paris`, `America/New_York`, `UTC`. Never guess a zone from a city the list lacks: ask, or report the loss.
- `from`, `to` (required, quoted): `HH:MM`, 24-hour clock, on the hour or half hour; the range includes `from`, excludes `to`, crosses midnight when `from` is later, and `from` must differ from `to`. "After 7 pm" is `from: "19:00"`; "before 8 am" is `to: "08:00"`. A quarter-hour or a second daily range is unrepresentable: explain the loss.
- `all_day`: weekdays quiet all day, from `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday` ("weekends" → `[saturday, sunday]`).
- Times only: never ask for, infer or record a reason. Quiet hours hold interruptions, never work. Stored variants cannot change them.
- The preview states that the time zone indicates an approximate location and is shared under the profile's visibility.

## `context`

| Field | Value |
|---|---|
| `role` | one role from [`vocabulary.md`](vocabulary.md), e.g. `cto`, `product-manager` |
| `knows_well`, `knows_little` | ≤ 15 topics each from [`vocabulary.md`](vocabulary.md), e.g. `kubernetes`, `cloud-costs` |
| `decides` | ≤ 10 decisions from [`vocabulary.md`](vocabulary.md), e.g. `infra-budget`, `release-scope` |
| `context_updated` | `"YYYY-MM-DD"` (quoted) |

A topic or decision missing from the vocabulary stays out of the closed context fields: tell the person, preserve it in notes when representable, and record any interpretation or loss in the preview's explicit interpretations and losses list.

## `avoid`

A list from: `walls_of_text`, `filler_intro`, `filler_outro`, `hedging`, `emoji`, `rhetorical_questions`, `multiple_asks`, `unexplained_acronyms`, `passive_voice`, `exclamation`, `long_preamble`, `nested_bullets`, `sarcasm`, `recap`, `idioms`. `recap`: "don't restate at the end what you just did"; `idioms`: "no figures of speech or stock phrases".

## `states`

Stored inactive variants: `incident`, `low_bandwidth`, `focus`, `mobile`. Each holds partial overrides of the 24 preference fields other than `quiet_hours`, by bare name. They and `interrupting.when_focused` are validated but never activated or projected in this draft. No caller state selectors or expiry feature.

## `notes`

One line, 1–280 Unicode scalar values: owner-approved presentation needs or voluntary personal information. Preserve an exact requested statement such as "I have ADHD.". No health blacklist and no inferred diagnosis. Mobile layout, language level, technical quotation needs and qualifications can fit here when closed fields cannot express them. Multiple needs must fit together without silently losing any.

Links, email addresses, markup characters (`` ` * _ # < > [ ] { } | ~ \ ``), and prohibited Unicode categories invalidate plain text. The baseline agent-directed phrase heuristic can withhold a valid note; it is not complete injection detection. Show the exact original, warning and any proposed replacement in the normal preview. Syntax/length conflicts require an explicit edit or choice, not silent sanitization.

## File header

A compiler writes these three YAML comment lines right after the opening `---` of `HUMANS.md`, byte for byte, each ending with a line feed, before `humans:`:

```text
# HUMANS.md 0.3: how to work with me. Form only, never a permission: repo rules and your harness win.
# Stored states are inactive: never apply one, and never infer one from content.
# out_of_scope_steps: whether to LIST next steps outside the task (merge, deploy) in your closing lines.
```

They serve an agent that reads the raw file. Readers ignore them and validators never require them; keep them on update. They count toward the frontmatter limit: if the approved fields and the header do not fit, report the overflow.

## Unsupported fields and interpretations

All unknown keys follow the same closed-schema rule: writers reject them. Personal statements belong in notes. Unknown role/topic mappings, lost needs, and added preferences must appear explicitly in the preview. All exact word limits apply to the complete message: fewer than 150 means `max_words: 149`; outside 20–2000 requires an explained loss/choice.
