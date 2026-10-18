#!/usr/bin/env node
// Codex SessionStart hook: the owner's own profile only. runtime.mjs is the Claude Code plugin's
// copy (`npm run build` writes it here), so both plugins validate and fail the same way.
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
// Codex plugins have no user settings: the file is the location SPEC § 5 fixes. To keep it
// elsewhere, make ~/.humans/HUMANS.md a symbolic link. Hook input never selects a file.
const file = selectedFile(process.argv.slice(2), '~/.humans/HUMANS.md');
const input = await readEvent('SessionStart');
// Codex reads the same SessionStart envelope as Claude Code. renderOwner forwards at most
// 16 KiB, and hooks.json sets additionalContextLimit to 16384, so Codex never spills or cuts the
// profile and the plain sentences fit. (`humans-md hook codex` keeps 2,500 bytes for hand-written
// hooks that rely on Codex's default limit.)
if (input) { if (file) renderOwner(file); else absent(); }
