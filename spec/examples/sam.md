---
humans: "0.3"
id: sam
name: Sam Rivera
identities:
  email: sam@example.com
languages: [en]
updated: "2026-10-13"
visibility: org

reading:
  lead_with: decision_needed
  length: short
  structure: mixed
  visual: [example, table]
  technical_depth: non_technical
  jargon: avoid
  tone: warm
  evidence: key_numbers
  uncertainty: inline
  close_with: next_action

deciding:
  reversible: ask
  batch_questions: end_of_task
  default_answer: always
  asks_per_message: few
  format: options_then_recommendation
  question_style: yes_confirms_recommendation
  challenge: after_draft

interrupting:
  interrupt_for: blocking_or_risky
  group_by: project
  when_focused: urgent_only
  channel_hint: either
  quiet_hours:
    time_zone: America/New_York
    from: "18:00"
    to: "08:30"
    all_day: [saturday, sunday]

context:
  role: product-manager
  knows_well: [ux-research, pricing, roadmap]
  knows_little: [kubernetes, ci-cd, databases]
  decides: [roadmap-priority, release-scope]
  context_updated: "2026-10-13"

avoid: [unexplained_acronyms, walls_of_text, passive_voice, idioms]
---
