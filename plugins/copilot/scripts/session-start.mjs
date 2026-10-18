#!/usr/bin/env node
// The Copilot plugin's sessionStart hook: the owner's ~/.humans/HUMANS.md, the location SPEC § 5
// fixes, and nothing else. Hook input can never select a file or assert ownership.
// runtime.mjs and humans.mjs are copied here from the Claude Code plugin by `npm run build`.
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
const file = selectedFile(process.argv.slice(2), '~/.humans/HUMANS.md');
// Copilot CLI sends its camelCase payload (sessionId, source) and reads a top-level
// `additionalContext`. VS Code's Local harness maps the same hook to `SessionStart`, sends
// `hook_event_name` and reads `hookSpecificOutput`, which is the Claude envelope.
const copilot = e => e.hook_event_name === undefined && typeof e.sessionId === 'string' && ['startup', 'resume', 'new'].includes(e.source);
const input = await readEvent(e => e.hook_event_name === 'SessionStart' || copilot(e));
if (input) {
  const client = copilot(input) ? 'copilot' : 'claude';
  if (file) renderOwner(file, client); else absent(client);
}
