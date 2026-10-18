// Synthetic regressions beyond the normative corpus; no external or owner data.
const head = '---\nhumans: "0.3"\nid: sample\nname: Example\nupdated: "2026-10-13"\n';
const state = `    lead_with: tldr
    length: minimal
    max_words: 20
    structure: bullets
    visual:
      - table
    technical_depth: non_technical
    jargon: avoid
    tone: direct
    evidence: numbers_and_sources
    uncertainty: flag_explicitly
    close_with: next_action
    reversible: decide_and_report
    batch_questions: end_of_task
    default_answer: always
    asks_per_message: one
    format: recommendation_first
    question_style: yes_confirms_recommendation
    challenge: welcome_early
    out_of_scope_steps: omit_unless_blocking
    interrupt_for: blocking_only
    group_by: project
    when_focused: summary_later
    channel_hint: async_written
    progress_updates: phase_changes
`;
export const regressions = [
  ...[
    ['missing', '', 'PROFILE_INVALID'],
    ['null', 'humans: null\n', 'PROFILE_INVALID'],
    ['implicit-null', 'humans:\n', 'PROFILE_INVALID'],
    ['tilde-null', 'humans: ~\n', 'PROFILE_INVALID'],
    ['number', 'humans: 0.3\n', 'PROFILE_INVALID'],
    ['integer', 'humans: 3\n', 'PROFILE_INVALID'],
    ['true', 'humans: true\n', 'PROFILE_INVALID'],
    ['false', 'humans: false\n', 'PROFILE_INVALID'],
    ['map', 'humans: {version: "0.3"}\n', 'PROFILE_INVALID'],
    ['list', 'humans: ["0.3"]\n', 'PROFILE_INVALID'],
    ['supported', 'humans: "0.3"\n', null],
    ['previous', 'humans: "0.2"\n', null, 'UNSUPPORTED_VERSION'],
    ['future', 'humans: "0.4"\n', 'UNSUPPORTED_VERSION'],
    ['old', 'humans: "0.1"\n', 'UNSUPPORTED_VERSION'],
    ['empty-string', 'humans: ""\n', 'UNSUPPORTED_VERSION'],
    ['whitespace-string', 'humans: "0.3 "\n', 'UNSUPPORTED_VERSION'],
    ['other-string', 'humans: VERSION_PAYLOAD\n', 'UNSUPPORTED_VERSION'],
  ].map(([name, version, readDiagnostic, writeDiagnostic = readDiagnostic]) => ({
    id: `version-${name}`, source: `${head.replace('humans: "0.3"\n', version)}notes: "I have ADHD."\n---\n`,
    writer_valid: writeDiagnostic === null, reader_valid: readDiagnostic === null,
    read_diagnostics: readDiagnostic === null ? [] : [readDiagnostic],
    write_diagnostics: writeDiagnostic === null ? [] : [writeDiagnostic],
  })),
  ...[`  child: ${'x'.repeat(1100)}\n`, `  - ${'x'.repeat(1100)}\n`, `  ${'- '.repeat(1000)}0\n`].map((child,i) => ({
    id:`offset-block-${i}`, source:`${head}unknown:\n${child}reading: {length: short}\n---\n`, writer_valid:false, reader_valid:true,
  })),
  { id:'offset-known-fields', source:`${head}states:\n${['incident','focus','mobile'].map(name => `  ${name}:\n${state}`).join('')}reading:\n  length: short\n---\n`, writer_valid:true, reader_valid:true },
  ...[1024,1025].map(length => ({
    id:`offset-key-${length}`, source:`${head}unknown:\n  child: ${'x'.repeat(1100)}\n${'k'.repeat(length)}: value\n---\n`, writer_valid:false, reader_valid:length === 1024,
  })),
  ...[1000, 3000].map(depth => ({ id:`deep-sequence-${depth}`, source:`${head}unknown: ${'['.repeat(depth)}0${']'.repeat(depth)}\n---\n`, writer_valid:false, reader_valid:true })),
  { id:'deep-map-1200', source:`${head}unknown: ${'{a: '.repeat(1200)}0${'}'.repeat(1200)}\n---\n`, writer_valid:false, reader_valid:true },
  { id:'deep-block-sequence-3000', source:`${head}unknown:\n  ${'- '.repeat(3000)}0\n---\n`, writer_valid:false, reader_valid:true },
  { id:'deep-recognized-object-unknown', source:`${head}reading: {length: short, unknown: ${'['.repeat(2900)}0${']'.repeat(2900)}}\n---\n`, writer_valid:false, reader_valid:true },
  ...['{1: value}', '{true: value}', '{null: value}', '{[a]: value}', '{a: one, "\\u0061": two}', '"\\uD800"', '{"\\uDFFF": value}', '.nan', '.inf', '[0,]', '{__proto__: {constructor: ok}, "😀": null}'].map((leaf,i) => ({
    id:`deep-subtree-${i}`, source:`${head}unknown: ${'['.repeat(2900)}${leaf}${']'.repeat(2900)}\n---\n`, writer_valid:false, reader_valid:i >= 9,
  })),
  ...['[0,,1]', '[0 1', '{a: 1 b: 2}', '{a: 1,', '[? [a]: b]', '"\\uZZZZ"', '{a: &x 1}', '*x', '!!str x'].map((leaf,i) => ({
    id:`deep-syntax-${i}`, source:`${head}unknown: ${'['.repeat(2900)}${leaf}${']'.repeat(2900)}\n---\n`, writer_valid:false, reader_valid:false,
  })),
  ...['diagnosis', 'favorite_color'].map(k => ({ id:`generic-unknown-${k}`, source:`${head}${k}: ignored\n---\n`, writer_valid:false, reader_valid:true })),
  ...['name: Again', '"na\\u006de": Again', 'unknown: {a: one, "\\u0061": two}', 'unknown: {1: value}', 'unknown: {true: value}', 'unknown: {[a]: value}', 'unknown: .nan', 'unknown: .inf', 'unknown: "\\uD800"', 'unknown: {"\\uDFFF": value}'].map((s,i) => ({ id:`yaml-reject-${i}`, source:`${head}${s}\n---\n`, writer_valid:false, reader_valid:false })),
  { id:'raw-js-surrogate-unknown',source:`${head}unknown: "\ud800"\n---\n`,writer_valid:false,reader_valid:false,stringOnly:true },
  { id:'astral-scalar-unknown',source:`${head}unknown: "😀"\n---\n`,writer_valid:false,reader_valid:true },
  { id:'finite-unknown',source:`${head}unknown: 42\n---\n`,writer_valid:false,reader_valid:true },
  { id:'null-not-absence',source:`${head}languages: null\n---\n`,writer_valid:false,reader_valid:false },
  { id:'unknown-enum-wrong-type',source:`${head}reading: {length: 42}\n---\n`,writer_valid:false,reader_valid:false },
  { id:'unknown-enum-duplicate',source:`${head}languages: [xx, xx]\n---\n`,writer_valid:false,reader_valid:false },
  { id:'private-health-choice',source:`${head}visibility: private\nnotes: "I have ADHD."\n---\n`,writer_valid:true,reader_valid:true },
  { id:'anyone-with-file-health-choice',source:`${head}visibility: anyone_with_file\nnotes: "I have ADHD."\n---\n`,writer_valid:true,reader_valid:true },
  { id:'public-unknown-in-0.3',source:`${head}visibility: public\nnotes: "I have ADHD."\n---\n`,writer_valid:false,reader_valid:false },
  { id:'public-read-from-0.2',source:`${head.replace('humans: "0.3"', 'humans: "0.2"')}visibility: public\nnotes: "I have ADHD."\n---\n`,writer_valid:false,reader_valid:true,read_diagnostics:[],write_diagnostics:['UNSUPPORTED_VERSION'] },
  { id:'explicit-ufffd',source:`${head}notes: "Replacement � chosen."\n---\n`,writer_valid:true,reader_valid:true },
].map(c => ({filename:'sample.md',...c}));
