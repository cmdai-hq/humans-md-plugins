# HUMANS.md

> AGENTS.md is for your codebase. **HUMANS.md is for you.**

**Website: [humansmd.dev](https://humansmd.dev)** · Specification: [SPEC.md](SPEC.md)

A file for your agents, and your colleagues' agents, to read before they spend your attention: how to write to you, when to ask you to decide, and when to interrupt you. You approve every preference, and it can include personal information you choose to share. An integration is required to load it: the [Claude Code plugin and command line](https://github.com/cmdai-hq/humans-md-plugins) load your own profile.

This is a complete, copyable `~/.humans/HUMANS.md` example (also [available as a file](examples/HUMANS.md)). Replace the example identity and approval date with your own:

```yaml
---
# HUMANS.md 0.3: how to work with me. Form only, never a permission: repo rules and your harness win.
# Stored states are inactive: never apply one, and never infer one from content.
# out_of_scope_steps: whether to LIST next steps outside the task (merge, deploy) in your closing lines.
humans: "0.3"
id: tristan
name: Tristan
updated: "2026-10-13"
visibility: private
reading:
  lead_with: tldr
  max_words: 149
  visual: [table, example]
deciding:
  reversible: decide_and_report
  batch_questions: end_of_task
  default_answer: always
  question_style: yes_confirms_recommendation
interrupting:
  interrupt_for: blocking_only
notes: "I often read on my phone."
---
```

- [Specification](SPEC.md): **0.3 draft**, contract `0.3-draft.2026-10-18.1`; [vocabulary](VOCABULARY.md), [schemas](schema/), [vectors and test instructions](tests/README.md).
- [Conformance and successor rules](CONFORMANCE.md), [changes](CHANGELOG.md), [contribution and version policy](CONTRIBUTING.md), [source manifest](CONTRACT.json).
- Canonical source: [cmdai-hq/HUMANS.md](https://github.com/cmdai-hq/HUMANS.md). Mirrors must identify and verify their source revision. Website: [humansmd.dev](https://humansmd.dev).

Write freely in `~/.humans/source.md`, then request compilation, review the proposed fields and sharing scope, and approve the canonical `HUMANS.md`. Your source is not shared with recipients. **If you compile with a hosted assistant, that provider processes it.** Approved notes may be shared with authorized consumers and processed by their providers.

**Share what you choose. No diagnosis is required or inferred.** `notes: "I have ADHD."` is valid. New profiles should start with explicit `visibility: private`; updates preserve the existing scope unless you approve a change. With `visibility: anyone_with_file`, no consumer checks who reads: anyone who has the file reads it, so a file in a public repository is readable by anyone on the Internet. Preferences and notes are data: they grant no permission and do not override the task, repository or harness.

Adapters must parse, enforce visibility and render the common projection defined in SPEC § 6. Printing or importing the raw file is not a conformant installation recipe, even after validation. This draft defines adapter requirements; native integration status must be established separately by version and surface. Stored states are inactive; group merging is experimental with no anonymity or orchestration guarantee.

The delivered [reference tools](tools/README.md) implement bounded parsing, strict validation, supported-version reading and experimental group merging for this draft. Run `cd tools && npm ci && npm test`; then `node validate.mjs path/to/HUMANS.md` checks a file. The ordinary suite runs on Node 22, 24 and 26; `npm run test:unicode` separately verifies the generated Unicode tables on a Unicode 17.0 runtime. [Structural artifact checks](tests/README.md) validate schemas and expected vectors separately and do not prove adapter safety.

The specification, schemas, vocabulary, prose fixtures and examples retain [CC BY 4.0](LICENSE). Reference tools and executable checks use [Apache-2.0](tools/LICENSE). The HUMANS.md name and logo are not covered by those licenses. Using the format never requires a cmdAI product. Maintained by [cmdAI](https://cmdai.fr).
