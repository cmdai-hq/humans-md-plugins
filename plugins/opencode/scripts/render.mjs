#!/usr/bin/env node
// Render the owner's ~/.humans/HUMANS.md for the OpenCode plugin (../index.js), in a process of its
// own. It takes no input and ignores its arguments: the file is the location SPEC § 5 fixes. To keep
// it elsewhere, make ~/.humans/HUMANS.md a symbolic link to a file also named HUMANS.md.
// runtime.mjs and humans.mjs are copied here from the Claude Code plugin by `npm run build`, so this
// plugin selects, renders, checks and fails exactly like the others.
import { selectedFile, renderOwner, absent } from './runtime.mjs';
const file = selectedFile([], '~/.humans/HUMANS.md');
if (file) renderOwner(file); else absent();
