#!/usr/bin/env node
import { selectedFile, readEvent, renderOwner, absent } from './runtime.mjs';
// The owner's file: ~/.humans/HUMANS.md, the location SPEC § 5 fixes, unless the command passes
// `--profile <absolute path to a HUMANS.md>`. Hook input can never select a file or assert ownership.
const file = selectedFile(process.argv.slice(2));
const input = await readEvent('sessionStart');
if (input) { if (file) renderOwner(file); else absent(); }
