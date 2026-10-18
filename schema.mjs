// The JSON Schema of every tool, built from the rows of wasm/tool_schema_table.mjs (generated from specs/t27mcp/tool_schema.t27).
// This file decides nothing about a field: a row says its kind, bounds, enum and pattern, and this turns the rows into schema.
import { readFileSync } from 'node:fs';
import * as T from './wasm/tool_schema_table.mjs';

const BOUND = { [T.K_STRING]: ['minLength', 'maxLength'], [T.K_INTEGER]: ['minimum', 'maximum'], [T.K_NUMBER]: ['minimum', 'maximum'], [T.K_ARRAY]: ['minItems', 'maxItems'], [T.K_TUPLE]: ['minItems', 'maxItems'] };
export const profile = process.env[T.PROFILE_ENV] === '1' ? T.PROFILE_OUTPUT : T.DEFAULT_PROFILE;
export const protocol = T.PROTOCOL[profile];
// The identity of the catalog is the seal of the spec plus the profile: a change to either changes what a client cached.
export const meta = { [T.CATALOG_META_KEY]: `${JSON.parse(readFileSync(new URL(`./wasm/${T.SEAL_FILE}`, import.meta.url))).spec_hash}/p${profile}` };

// Depth-first rows to one object schema; stack[d] is the schema that a row of depth d hangs from.
export function build(rows) {
  const root = { type: 'object', properties: {} }, stack = [root];
  for (const f of rows) {
    const p = stack[f.depth], t = T.KIND_JSON[f.kind], b = BOUND[f.kind], s = {};
    if (t) s.type = f.nullable ? [t, 'null'] : t;
    if (f.desc) s.description = f.desc;
    if (f.choices) s.enum = f.choices.split('|');
    if (f.pattern) s.pattern = f.pattern;
    if (b) b.forEach((k, i) => { const v = i ? f.hi : f.lo; if (v !== T.NB) s[k] = v; });
    if (f.kind === T.K_TUPLE) s.prefixItems = [];
    stack.length = f.depth + 1;
    stack.push(s);
    if (f.name) { p.properties = p.properties || {}; p.properties[f.name] = s; if (f.req) (p.required = p.required || []).push(f.name); }
    else if (p.prefixItems) p.prefixItems.push(s);
    else p.items = s;
  }
  return root;
}

// A tool with no row is a startup error, not a schema nobody wrote.
export function schemas(name) {
  const t = T.TOOLS.findIndex((x) => x.name === name);
  if (t < 0) throw new Error(`tool ${name} has no row in ${T.SPEC_PATH}`);
  const rows = (side) => T.FIELDS.filter((f) => f.side === side && (f.tool === t || (T.TOOLS[t].filters && f.tool === T.G_SPEC_FILTERS)));
  const out = profile === T.PROFILE_OUTPUT && T.TOOLS[t].out === T.OUT_OBJECT;
  return { inputSchema: { ...build(rows(T.IN)), additionalProperties: false }, ...(out && { outputSchema: build(rows(T.OUT)) }) };
}
