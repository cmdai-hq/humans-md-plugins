#!/usr/bin/env node
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
// The owner's file: the plugin setting (userConfig `profile`, exported by Claude Code as
// CLAUDE_PLUGIN_OPTION_PROFILE), or the location SPEC § 5 fixes. Claude Code does not export a
// default the owner never saved. Hook input can never select a file or assert ownership.
const file = selectedFile(process.argv.slice(2), process.env.CLAUDE_PLUGIN_OPTION_PROFILE || '~/.humans/HUMANS.md');
const input = await readEvent('SessionStart');
if (input) { if (file) renderOwner(file); else absent(); }
