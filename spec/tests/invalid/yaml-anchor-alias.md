---
humans: "0.3"
id: yaml-anchor-alias
name: Test
updated: "2026-10-13"
reading: &r
  lead_with: tldr
states:
  focus: *r
---
Must fail: YAML anchors and aliases.
