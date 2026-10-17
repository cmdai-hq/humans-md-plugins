#!/usr/bin/env node
// The Junie extension's UserPromptSubmit hook: the owner's ~/.humans/HUMANS.md, the location SPEC § 5
// fixes, once per session. Junie drops SessionStart context and adds UserPromptSubmit context to the
// prompt, so the profile goes with the first prompt of a session and stays in its history.
// runtime.mjs and humans.mjs are copied here by the generator from the Claude Code plugin.
// Hook input never selects a file or asserts ownership: only its session id is read, to mark the session.
import { createHash } from 'node:crypto';
import { closeSync, constants, lstatSync, mkdirSync, openSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { selectedFile, readEvent, renderOwner, absent, report } from './runtime.mjs';

// Junie's own rule for session ids (letters, digits, `_` and `-`, at most 200 characters).
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
// One empty file per session, named by the SHA-256 of its id; nothing else in this folder is touched.
// None when HOME is empty or relative: the folder would land in the session's directory.
const MARKERS = isAbsolute(homedir()) ? join(homedir(), '.cache', 'humans-md', 'junie-sessions') : undefined;
const MARKER_NAME = /^[0-9a-f]{64}$/;
const MAX_MARKERS = 256, MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/** Delete markers older than a week, then the oldest beyond MAX_MARKERS. Best effort. */
function prune() {
  const now = Date.now(), recent = [];
  for (const name of readdirSync(MARKERS)) {
    if (!MARKER_NAME.test(name)) continue;
    const path = join(MARKERS, name);
    try {
      const { mtimeMs } = lstatSync(path);
      if (now - mtimeMs > MAX_AGE_MS) unlinkSync(path); else recent.push([mtimeMs, path]);
    } catch { /* gone or not removable: leave it */ }
  }
  recent.sort((a, b) => a[0] - b[0]);
  for (const [, path] of recent.slice(0, Math.max(0, recent.length - MAX_MARKERS))) try { unlinkSync(path); } catch { /* leave it */ }
}

/**
 * Mark the session: true the first time, false if it was already marked, undefined if no marker
 * can be written. Our two folders are created one at a time (mkdir never follows an existing link)
 * and must be real folders; O_CREAT|O_EXCL refuses any existing entry, a planted link included,
 * without following it.
 */
function markSession(id) {
  try {
    if (!MARKERS) throw new Error('no absolute home');
    mkdirSync(dirname(dirname(MARKERS)), { recursive: true });
    for (const dir of [dirname(MARKERS), MARKERS]) {
      try { mkdirSync(dir, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      if (!lstatSync(dir).isDirectory()) throw new Error('not a folder');
    }
    const name = createHash('sha256').update(id).digest('hex');
    // Only the marker itself already existing means "already marked"; an EEXIST from the folders
    // above (a file where ~/.cache should be) means no marker can be written.
    try { closeSync(openSync(join(MARKERS, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)); }
    catch (error) { if (error?.code === 'EEXIST') return false; throw error; }
  } catch {
    report('SESSION_MARKER_UNAVAILABLE');
    return undefined;
  }
  try { prune(); } catch { /* the folder stays usable */ }
  return true;
}

const file = selectedFile(process.argv.slice(2), '~/.humans/HUMANS.md');
const input = await readEvent(e => e.hook_event_name === 'UserPromptSubmit' && typeof e.session_id === 'string' && SESSION_ID.test(e.session_id));
if (input) {
  const first = markSession(input.session_id);
  // Junie reads a top-level `additionalContext`, the envelope `humans-md hook copilot` prints.
  if (first === true && file) renderOwner(file, 'copilot');
  else if (first !== false) absent('copilot');
}
