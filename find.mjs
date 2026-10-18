// t27_find glue. wasm/find.wasm (specs/t27mcp/find.t27) decides, row by row, whether a manifest spec answers an
// intent and how it ranks; wasm/find_table.mjs holds the limit and the notes. This file writes each row's
// name, path and tags into the instance's memory, calls the spec and sorts by the key it returns.
import { readFileSync } from 'node:fs';
import * as S from './wasm/find_table.mjs';
import { brief } from './brief.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/find.wasm', import.meta.url)), {})).instance.exports;
W._initialize();
const base = W.memory.buffer.byteLength;
W.memory.grow(1);
const put = (s, slot) => (new Uint8Array(W.memory.buffer, base + slot * 8192, 8192).set(new TextEncoder().encode(`${String(s).slice(0, 2000)}\0`)), base + slot * 8192);

export function find(rows, intent, limit = S.LIMIT) {
  const q = put(intent, 0), skipped = { unhealthy: 0, untested: 0 }, hits = [];
  for (const s of rows) {
    const a = [q, put(s.name, 1), put(s.path, 2), put((s.tags || []).join(' '), 3)], v = W.verdict(...a);
    if (v === S.V_EMPTY) return { intent, hits: [], miss: true, note: S.EMPTY_NOTE };
    if (v === S.V_UNHEALTHY) skipped.unhealthy++;
    if (v === S.V_UNTESTED) skipped.untested++;
    if (v === S.V_HIT) hits.push({ key: W.rank_key(...a, Number(s.lines) || 0), s });
  }
  hits.sort((x, y) => y.key - x.key);
  const top = hits.slice(0, Math.min(Math.max(Math.trunc(limit) || S.LIMIT, 1), 20));
  return { intent, miss: !hits.length, matched: hits.length, skipped, note: hits.length ? S.HIT_NOTE : S.MISS_NOTE, hits: top.map(({ s }) => ({ ...brief(s), next: `t27_spec path:"${s.path}" source:true` })) };
}
