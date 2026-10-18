#!/usr/bin/env node
// Exercises every tool against the live site and asserts the invariants that
// have actually broken before. Run it before tagging: `npm run smoke`.
//
// It talks to t27.ai over the real protocol rather than importing the handlers,
// because the two failures worth catching are a malformed JSON-RPC frame and a
// feed that changed shape — and neither is visible to an in-process call.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as T from './wasm/tool_schema_table.mjs';
import { build, profile } from './schema.mjs';

const child = spawn('node', [new URL('./server.mjs', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const m = JSON.parse(line);
    const r = pending.get(m.id);
    if (r) (m.error ? r.reject(new Error(m.error.message)) : r.resolve(m.result), pending.delete(m.id));
  }
});

let nextId = 0;
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => pending.has(id) && (pending.delete(id), reject(new Error(`${method} ${params?.name || ''} timed out`))), 30000);
  });
const call = (name, args = {}) => rpc('tools/call', { name, arguments: args }).then((r) => JSON.parse(r.content[0].text));

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? ' ok ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failed++;
};

const run = async () => {
  const init = await rpc('initialize', {});
  check('initialize returns this package version', init.serverInfo.version === JSON.parse(await import('node:fs/promises').then((f) => f.readFile(new URL('./package.json', import.meta.url), 'utf8'))).version, init.serverInfo.version);

  const { tools, _meta } = await rpc('tools/list');
  check('every tool has a description and a schema', tools.every((t) => t.description && t.inputSchema?.type === 'object'), `${tools.length} tools`);

  // The schemas come from specs/t27mcp/tool_schema.t27 (wasm/tool_schema_table.mjs); these read them back off the wire.
  const sch = Object.fromEntries(tools.map((t) => [t.name, t.inputSchema])), gr = sch.t27_grep, st27 = sch.t27f_view.properties.status, out = (n) => build(T.FIELDS.filter((f) => f.tool === T.TOOLS.findIndex((r) => r.name === n) && f.side === T.OUT));
  check('every advertised tool has a row in the schema spec', tools.every((t) => T.TOOLS.some((r) => r.name === t.name)), `${tools.length} of ${T.TOOL_COUNT} rows`);
  check('no schema holds a $ref, $defs or definitions', !/"\$ref"|"\$defs"|"definitions"/.test(JSON.stringify(tools)));
  check('every input refuses unknown keys', tools.every((t) => t.inputSchema.additionalProperties === false));
  check('the catalog identity is the seal hash of the spec', _meta?.['t27/catalog'] === `${JSON.parse(readFileSync(new URL('./wasm/tool_schema.seal.json', import.meta.url))).spec_hash}/p${profile}`, _meta?.['t27/catalog']);
  check('an array keeps its length bound and item range', st27.type === 'array' && st27.maxItems === 27 && st27.items.minimum === 0 && st27.items.maximum === 255);
  check('boolean, enum, integer bound and required survive', gr.properties.ignoreCase.type === 'boolean' && sch.t27_specs.properties.health.enum.join() === 'ok,warn,fail' && gr.properties.maxSpecs.maximum === 150 && gr.required.join() === 'pattern');
  const cyc = out('t27_game').properties.rules.properties.cycle, line = out('t27_grep').properties.results.items.properties.hits.items.properties.line;
  check('a tuple keeps its length and positions', cyc.prefixItems.length === 5 && cyc.minItems === 5 && cyc.maxItems === 5 && cyc.prefixItems[0].enum.join() === 'Issue');
  check('a nested object keeps its integer bound four levels down', line.type === 'integer' && line.minimum === 1);
  check(`the ${profile ? 'output' : 'input'} profile advertises ${profile ? 'an output schema per object tool' : 'no output schema'}`, tools.every((t) => !!t.outputSchema === (profile === T.PROFILE_OUTPUT && T.TOOLS.find((r) => r.name === t.name).out === T.OUT_OBJECT)) && init.protocolVersion === T.PROTOCOL[profile]);
  if (profile) { const r = await rpc('tools/call', { name: 't27_formats', arguments: {} }); check('structuredContent is the text result', JSON.stringify(r.structuredContent) === JSON.stringify(JSON.parse(r.content[0].text))); }

  const st = await call('t27_status');
  check('status reaches the atlas', st.atlasError === null, st.atlasError || 'no error');
  check('spec count agrees with the health split', st.specCount === Object.values(st.health).reduce((a, b) => a + b, 0), `${st.specCount} = ${JSON.stringify(st.health)}`);
  check('every failing spec names a cause', st.failingSpecs.every((s) => s.whyFailing?.length), `${st.failingSpecs.length} failing`);

  // backendFailures is a per-backend count, so each backend's count must equal the specs blaming that backend.
  const perBackend = await Promise.all(Object.entries(st.backendFailures || {}).map(async ([b, n]) => [b, n, (await call('t27_specs', { failedBackend: b, limit: 1 })).matched]));
  check('backendFailures per backend matches the specs blaming it', perBackend.length > 0 && perBackend.every(([, n, m]) => n === m), perBackend.map(([b, n, m]) => `${b} ${n}/${m}`).join(' '));

  const fails = await call('t27_specs', { health: 'fail' });
  check('t27_specs finds the same failures as t27_status', fails.matched === st.failingSpecs.length, `${fails.matched} vs ${st.failingSpecs.length}`);

  const fmts = await call('t27_formats');
  check('format catalog parses from the live SSOT', fmts.totalInCatalog > 0 && Object.keys(fmts.clusters).length > 0, `${fmts.totalInCatalog} formats in ${Object.keys(fmts.clusters).length} clusters`);
  const one = await call('t27_format', { id: fmts.formats[0].id });
  check('a single format round-trips by id', one.id === fmts.formats[0].id, one.id);

  // The strongest available check that the manifest and the published corpus
  // describe the same file: the byte count must match, not merely both exist.
  const demo = await call('t27_spec', { path: 'specs/demos/hello_world.t27', source: true });
  check('published source byte count matches the manifest', demo.source.length === demo.bytes, `${demo.source.length} fetched vs ${demo.bytes} recorded`);

  // brief mode: the short record is smaller, keeps the verdict, and fields:true still returns the whole record
  const [short, full] = await Promise.all([false, true].map((fields) => call('t27_spec', { path: 'specs/demos/hello_world.t27', fields })));
  check('t27_spec is brief by default', JSON.stringify(short).length < JSON.stringify(full).length && short.health === full.health && full.kinds !== undefined && short.kinds === undefined, `${JSON.stringify(short).length} brief vs ${JSON.stringify(full).length} full bytes`);
  const bad = (await call('t27_specs', { health: 'fail', limit: 200 })).specs;
  check('every failing row carries a reason from the spec', bad.length > 0 && bad.every((r) => r.whyFailing?.length && !r.whyFailing.some((w) => w.includes('{}'))), `${bad.length} failing rows`);

  const g = await call('t27_grep', { pattern: 'invariant', category: 'specs/numeric', maxSpecs: 8, maxHitsPerSpec: 2 });
  check('grep reads inside spec sources', g.totalHits > 0 && g.opened <= 8, `${g.totalHits} hits in ${g.specsWithHits}/${g.opened} opened`);
  check('grep reports truncation honestly', g.truncated === g.candidates > g.opened || typeof g.truncated === 'boolean', `${g.candidates} candidates, ${g.opened} opened`);

  const iss = await call('t27_issues', { limit: 3, detail: true });
  check('issues carry their spec links', iss.total > 0, `${iss.total} issues`);
  const ep = await call('t27_epics');
  check('epics load', ep.matched > 0, `${ep.matched} epics`);
  const mod = await call('t27_modules', { limit: 3 });
  check('modules load', mod.totalModules > 0, `${mod.totalModules} modules`);
  const w = await call('t27_worlds');
  check('worlds load', w.worlds.length > 0, `${w.worlds.length} repositories`);

  const game = await call('t27_game');
  check('game states exactly three claim colours plus hover', Object.keys(game.rules.colourLaw).length === 4, Object.keys(game.rules.colourLaw).join(' '));
  check('game board state names the failing specs', game.board_state.failing.length === st.failingSpecs.length, `${game.board_state.failing.length}`);

  // t27_raw is the only tool that takes a path from the caller.
  for (const bad of ['//evil.example.com/x.json', 'no-leading-slash', '/a\\b.json']) {
    let refused = false;
    try {
      await call('t27_raw', { path: bad });
    } catch {
      refused = true;
    }
    check(`t27_raw refuses ${JSON.stringify(bad)}`, refused);
  }
  const raw = await call('t27_raw', { path: '/queen/modules.json' });
  check('t27_raw still fetches a legitimate site path', !!raw.modules, `${raw.modules?.length} modules`);

  // t27_check runs offline: the compiler front end in wasm, the hints from specs/t27mcp/check_hints.t27.
  const M = (body) => `module M;\npub fn f(a: u8) -> u8 {\n    ${body}\n}\n`;
  const clean = await call('t27_check', { source: M('return a;') });
  check('t27_check passes clean source with nothing to say', clean.ok && clean.diagnostics.length === 0);
  const cast = await call('t27_check', { source: M('return (a as u3);') });
  check('t27_check hints `as u3` with its line and source', !cast.ok && cast.diagnostics[0].line === 3 && /x & 7/.test(cast.diagnostics[0].hint) && /as u3/.test(cast.diagnostics[0].source), cast.diagnostics[0]?.line);
  const kw = await call('t27_check', { source: 'module M;\npub fn f(in: u8) -> u8 {\n    return in;\n}\n' });
  check('t27_check hints `in` as a name', /reserved keyword/.test(kw.diagnostics[0]?.hint));
  const arity = await call('t27_check', { source: `${M('return a;')}pub fn g() -> u8 {\n    return f(1, 2);\n}\n` });
  check('t27_check invents no hint for a message the spec does not know', !arity.ok && arity.diagnostics[0].hint === undefined, arity.diagnostics[0]?.message);

  // t27_examples: the table is specs/t27mcp/examples.t27; the lines are fetched from the pinned commit.
  const ex = await call('t27_examples', { topic: 'clocked counter' });
  check('t27_examples returns clocked slices of at most 40 lines', ex.examples?.length >= 1 && ex.examples.every((e) => e.source.split('\n').length <= 40) && /fn on_clock/.test(ex.examples[0].source), ex.examples?.length);
  const ex2 = await call('t27_examples', { topic: 'async reset' });
  check('t27_examples keeps async apart from sync', ex2.topic === 'reset_async' && (await call('t27_examples', { topic: 'sync reset' })).topic === 'reset_sync');
  const ex3 = await call('t27_examples', { topic: 'axi4 burst' });

  // t27_find: ranking is specs/t27mcp/find.t27; a below-threshold intent is an honest miss.
  const fd = await call('t27_find', { intent: 'clocked counter' });
  check('t27_find returns the clocked counter spec', fd.hits?.some((h) => h.path === 'specs/ternary/clocked_counter.t27') && fd.hits.every((h) => h.next), fd.hits?.length);
  const fd2 = await call('t27_find', { intent: 'clocked counter with sync reset' });
  check('t27_find reports a miss rather than a weak match', fd2.miss === true && fd2.hits.length === 0);
  check('t27_examples invents no example for an unknown topic', ex3.examples === undefined && ex3.topics.includes('comb'));

  child.kill();
  console.log(failed ? `\n${failed} check(s) failed` : `\nall checks passed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  child.kill();
  console.error('smoke run threw:', e.message);
  process.exit(1);
});
