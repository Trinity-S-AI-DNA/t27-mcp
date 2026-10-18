// t27_spec seal receipt glue. wasm/seal_verdict.wasm (specs/t27mcp/seal_verdict.t27) decides what a spec's seal says
// about the source; wasm/seal_verdict.mjs holds the verdict names and notes. This file reads the seal file, hashes
// the source and passes both in: bytes in, a verdict code out.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as S from './wasm/seal_verdict.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/seal_verdict.wasm', import.meta.url)), {})).instance.exports;
W._initialize();
const base = W.memory.buffer.byteLength;
W.memory.grow(1);
const put = (s, slot) => (new Uint8Array(W.memory.buffer, base + slot * 4096, 4096).set(new TextEncoder().encode(`${String(s).slice(0, 2000)}\0`)), base + slot * 4096);

// `at(path)` returns the bytes of a file of gHashTag/t27 at the server's ref, or null. The seal of a spec is
// .trinity/seals/<parent dir>_<module>.json (seal_file_path, bootstrap/src/main.rs).
export async function receipt(spec, at) {
  if (spec.repo !== 't27') return undefined;
  const dir = spec.path.split('/').slice(-2, -1)[0];
  const [src, raw] = await Promise.all([at(spec.path), at(`.trinity/seals/${encodeURIComponent(dir ? `${dir}_${spec.module}` : spec.module)}.json`)]);
  const j = raw ? JSON.parse(raw.toString()) : null, t = j?.tests || {}, n = (k) => Number(t[k]) || 0;
  const cur = src ? `sha256:${createHash('sha256').update(src).digest('hex')}` : '', rec = j?.spec_hash ?? '';
  const v = W.seal_verdict(+!!j, put(j?.spec_path ?? '', 0), put(spec.path, 1), put(rec, 2), put(cur, 3), n('total'), n('passed'), n('failed'), (t.failing || []).length, n('vacuous'), +!!t.forced);
  return { verdict: S.VERDICT_NAME[v], fresh: !!W.is_fresh(put(rec, 2), put(cur, 3)), note: S.VERDICT_NOTE[v],
    ...(j && { tests: { passed: t.passed, total: t.total, vacuous: t.vacuous, failing: t.failing, forced: t.forced }, sealed_at: j.sealed_at, seal_schema: j.seal_schema, built_by: j.built_by }) };
}
