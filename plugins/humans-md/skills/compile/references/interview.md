# Guided interview

For a person creating a first HUMANS.md with no text to start from. Their answers become the source statements of step 2. Validation, preview and approval stay the same.

## Before the first question

Write a short opening in the language of the request, then ask the first question in the same reply. If `~/.humans/source.md` exists (checking opens nothing), that first question is: compile that file, or answer questions? Otherwise it is question 1. The opening comes before any question and says:

- which assistant and provider will process the answers (the step 1 disclosure);
- about ten short questions follow, one at a time, and any can be skipped;
- nothing is saved until they approve a preview;
- they can paste their own text instead at any time.

## How to ask

- One question per message. Wait for the answer before asking the next.
- With a multiple-choice tool (in Claude Code, `AskUserQuestion`), ask each choice question through it: one question per call, two to four choices with labels of five words or fewer, its free-text field for the person's own words. Questions 9 to 11 have no choices: ask them in plain text. Without such a tool, write the choices as a numbered list and accept a number, their own words or "skip".
- Use plain words and short sentences in the person's language. Translate the choice labels below.
- Ask only about working preferences: how replies look, how choices and interruptions are handled, their work, who may read the file. Never ask about health, diagnosis, personality, feelings, stress or triggers, and never use them as examples. A statement the person volunteers is kept exactly as written (step 2).
- A skipped question leaves its fields absent, except question 8: skipping it proposes `visibility: private`, because an absent visibility is read as `org`. An unpicked choice leaves its field absent; it never sets the opposite value.
- A free answer goes through the step 2 mapping: a closed value when one fits, otherwise a proposed note or a listed loss.

## Questions

1. **In which language do you read agents' replies most easily? It can differ from the one you write in.** English → `languages: [en]` · French → `languages: [fr]` · Skip. Other languages, in order, as a free answer → ISO 639-1 codes in that order. Do not assume the language of the conversation.
2. **How long should replies be?** At most five lines → `reading.length: minimal` · About one screen → `short` · Full detail → `thorough` · Skip.
3. **What should come first in a reply?** The short answer → `reading.lead_with: tldr` · What you need from me → `decision_needed` · My next step → `next_action` · Skip.
4. **What helps you read? Pick any.** Tables → `table` · Examples → `example` · Diagrams → `diagram` · Plain text only → `text`. Picks form `reading.visual` in this order. "Plain text only" goes alone: picked with another choice, ask once which they mean. No pick → absent.
5. **How should agents handle choices and questions? Pick any.** Decide alone when it can be undone, then tell me → `deciding.reversible: decide_and_report` · Save questions for the end of the task → `deciding.batch_questions: end_of_task` · Always suggest an answer → `deciding.default_answer: always`. No pick → absent.
6. **When may agents interrupt you?** Only when blocked → `interrupting.interrupt_for: blocking_only` · When blocked or something is risky → `blocking_or_risky` · Any time → `anything` · Skip.
7. **Are there hours when agents should hold interruptions?** No → absent · Yes → in one follow-up, ask for the hours, days and time zone, then map them with the `quiet_hours` rules in [fields](fields.md). Use only a pinned time zone. Ask for times only, never a reason.
8. **Who may read this file?** Only my own agents (recommended) → `visibility: private` · People in my organization → `org` · Anyone who has the file → `anyone_with_file`. Skip → `private`. Say plainly who can read it with the chosen value.
9. **What name should agents use for you?** The name → `name`; propose an `id` slug of it for approval. No name → a labelled placeholder (step 1).
10. **If you like: your job, and the topics you know well or less well, in your own words.** Map the job to the closest `context.role` and the topics to `context.knows_well` and `context.knows_little` from [vocabulary](vocabulary.md), at most 15 each. Each mapping is an interpretation shown in the preview ("directeur technique" → `cto`). No close value → leave the field absent and propose the person's own words as part of the note, in the preview, for them to keep or drop.
11. **Anything else agents should know, in a sentence or two? For example: "I read on my phone", "I work on several projects at once", "Spell out acronyms the first time".** Optional. Map it like any source statement (step 2) first: a closed field when one fits ("Spell out acronyms the first time" → `reading.jargon: define`), and only the rest → `notes`, word for word, under the `notes` rules in [fields](fields.md).

Done when: every question was asked once or skipped, and each answer has a destination field, note or listed loss.

## Before the preview

Compare the free answers (questions 10 and 11) with the choices already made:

- A statement that repeats a choice ("I'm visual" after picking tables and diagrams): say it is already covered, and ask whether to keep it in the note as well.
- A statement that conflicts with a choice ("I have little time" after "about one screen"): ask one question to settle it ("at most five lines, or keep about one screen?").
- Never change a choice without asking.

## Preview and save

- Show the complete frontmatter exactly as it will be saved, file header included, and the note word for word. Say who can read the note with the chosen visibility. A one-line summary is not a preview.
- In the preview, picked choices are explicit. Show as interpretations: the order of `reading.visual`, the proposed `id`, and every mapped free answer.
- Ask to save only after that.

## After saving

- Tell the person how to check it: in a new session of each tool where a HUMANS.md integration is installed, ask about one preference they saved, for example "What does my HUMANS.md say about interruptions?" when `interrupting.interrupt_for` is set. The agent should quote their value. Sessions already open keep the old one.
- If the integration is set to load another file, say which file, and say that it is changed with the **Your HUMANS.md** row in `/config`, or with `claude plugin configure humans-md@humans-md --values-stdin` reading `{"profile": "<absolute path>"}` from a file, then a restart. Changing it needs the person's approval. Never edit a settings file by hand.
