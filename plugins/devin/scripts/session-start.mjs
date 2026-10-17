#!/usr/bin/env node
// The Devin plugin's SessionStart hook: the owner's ~/.humans/HUMANS.md, the location SPEC § 5
// fixes, and nothing else. Hook input can never select a file or assert ownership.
// runtime.mjs and humans.mjs are copied here by the generator from the Claude Code plugin.
// Devin sends `hook_event_name` and reads the same envelope as Claude Code,
// `hookSpecificOutput.additionalContext` (https://docs.devin.ai/cli/extensibility/hooks/overview).
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
const file = selectedFile(process.argv.slice(2), '~/.humans/HUMANS.md');
const input = await readEvent('SessionStart');
if (input) { if (file) renderOwner(file); else absent(); }
