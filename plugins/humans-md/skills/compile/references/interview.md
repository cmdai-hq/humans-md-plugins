# Guided interview

For a person creating a first HUMANS.md with no text to start from. Their answers become the source statements of step 2. Validation, preview and approval stay the same.

## Before the first question

Write a short opening in the language of the request, then ask the first question in the same reply. If `~/.humans/source.md` exists (checking opens nothing), that first question is: compile that file, or answer questions? Otherwise it is question 1. The opening comes before any question and says:

- which assistant and provider will process the answers (the step 1 disclosure);
- about nine short questions follow, one at a time, and any can be skipped;
- nothing is saved until they approve a preview;
- they can paste their own text instead at any time.

## How to ask

- One question per message. Wait for the answer before asking the next.
- With a multiple-choice tool (in Claude Code, `AskUserQuestion`), ask each question through it: one question per call, at most four choices, its free-text field for the person's own words. Without one, write the choices as a numbered list and accept a number, their own words or "skip".
- Use plain words and short sentences in the person's language. Translate the choice labels below.
- Ask only about working preferences: how replies look, how choices and interruptions are handled, who may read the file. Never ask about health, diagnosis, personality, feelings, stress or triggers. A statement the person volunteers is kept exactly as written (step 2).
- A skipped question leaves its fields absent. An unpicked choice leaves its field absent; it never sets the opposite value.
- A free answer goes through the step 2 mapping: a closed value when one fits, otherwise a proposed note or a listed loss.
- In the preview, picked choices are explicit. Show as interpretations: the order of `reading.visual`, the proposed `id`, and every mapped free answer.

## Questions

1. **Which language should agents write to you in?** English → `languages: [en]` · French → `languages: [fr]` · Skip. Other languages, in order, as a free answer → ISO 639-1 codes in that order.
2. **How long should replies be?** At most five lines → `reading.length: minimal` · About one screen → `short` · Full detail → `thorough` · Skip.
3. **What should come first in a reply?** The short answer → `reading.lead_with: tldr` · What you need from me → `decision_needed` · My next step → `next_action` · Skip.
4. **What helps you read? Pick any.** Tables → `table` · Examples → `example` · Diagrams → `diagram` · Plain text is enough → `text`. Picks form `reading.visual` in this order. No pick → absent.
5. **How should agents handle choices and questions? Pick any.** Decide alone when it can be undone, then tell me → `deciding.reversible: decide_and_report` · Save questions for the end of the task → `deciding.batch_questions: end_of_task` · Always suggest an answer → `deciding.default_answer: always`. No pick → absent.
6. **When may agents interrupt you?** Only when blocked → `interrupting.interrupt_for: blocking_only` · When blocked or something is risky → `blocking_or_risky` · Any time → `anything` · Skip.
7. **Are there hours when agents should hold interruptions?** No → absent · Yes → in one follow-up, ask for the hours, days and time zone, then map them with the `quiet_hours` rules in [fields](fields.md). Use only a pinned time zone. Ask for times only, never a reason.
8. **Who may read this file?** Only my own agents (recommended) → `visibility: private` · People in my organization → `org` · Anyone who has the file → `anyone_with_file`. Skip → `private`. Say plainly who can read it with the chosen value.
9. **Last one: what name should agents use for you? Add anything else they should know, in a sentence or two, if you like.** Ask in plain text. The name → `name`, and propose an `id` slug of it for approval. Anything else → `notes`, word for word, under the `notes` rules in [fields](fields.md). No name → a labelled placeholder (step 1).

Done when: every question was asked once or skipped, and each answer has a destination field, note or listed loss.
