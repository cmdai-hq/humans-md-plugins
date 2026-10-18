---
humans: "0.3"
id: tristan
name: Tristan
aliases: [TB]
identities:
  email: tristan@example.com
languages: [fr, en]
updated: "2026-10-13"
visibility: org

reading:
  lead_with: tldr
  length: short
  structure: bullets
  visual: [table, diagram, example]
  technical_depth: expert
  jargon: ok
  tone: direct
  evidence: numbers_and_sources
  uncertainty: flag_explicitly

deciding:
  reversible: decide_and_report
  batch_questions: end_of_task
  default_answer: always
  asks_per_message: one
  format: recommendation_first
  challenge: welcome_early
  out_of_scope_steps: omit_unless_blocking

interrupting:
  interrupt_for: blocking_only
  group_by: project
  when_focused: summary_later
  channel_hint: async_written

context:
  role: cto
  knows_well: [cloud-costs, php, symfony, cloudflare]
  knows_little: [kubernetes]
  decides: [infra-budget, vendor-choice]
  context_updated: "2026-10-13"

avoid: [walls_of_text, filler_intro, filler_outro, hedging, multiple_asks, long_preamble, nested_bullets]

states: # Stored variants only; inactive in this draft.
  low_bandwidth: { length: minimal, technical_depth: balanced, visual: [table, text] }
  incident: { lead_with: decision_needed, length: minimal, asks_per_message: one }
  mobile: { length: short, visual: [table] }

notes: "I often read on my phone, between meetings."
---
