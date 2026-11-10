#!/usr/bin/env node
// The Gemini CLI extension's SessionStart hook: the owner's ~/.humans/HUMANS.md, the location SPEC § 5
// fixes, and nothing else. Hook input can never select a file or assert ownership.
// runtime.mjs and ../scripts/humans.mjs are copied here from the Claude Code plugin by `npm run build`.
// Written from Gemini CLI's documentation as read on 2026-11-10 (latest release then: 0.67.0); it
// has not been run in Gemini CLI. From its hooks reference (geminicli.com/docs/hooks/reference):
// - every hook receives `hook_event_name` on stdin; SessionStart fires with `source` startup,
//   resume or clear;
// - SessionStart reads `hookSpecificOutput.additionalContext`, the envelope `humans-md hook claude`
//   prints: "Interactive: Injected as the first turn in history. Non-interactive: Prepended to the
//   user's prompt.";
// - stdout must be the final JSON and nothing else; stderr is for logs (the static codes here).
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
const file = selectedFile(process.argv.slice(2), '~/.humans/HUMANS.md');
const input = await readEvent('SessionStart');
// A top-level `systemMessage` is "Displayed immediately to the user in the terminal" ("Common
// output fields"), and for SessionStart "Shown at the start of the session"; the reference lists it
// apart from `additionalContext`, the only field it says enters the history.
if (input) { if (file) renderOwner(file, 'claude', 'systemMessage'); else absent('claude', 'systemMessage'); }
