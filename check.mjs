// t27_check glue. wasm/explorer.wasm (the bootstrap parser and typechecker) judges the source;
// wasm/check_hints.wasm (specs/t27mcp/check_hints.t27) turns each compiler message into a hint code and a
// line number, and wasm/check_hints.mjs holds the hint texts. No rule lives in this file.
import { readFileSync } from 'node:fs';
import { HINTS } from './wasm/check_hints.mjs';

const load = (f) => WebAssembly.instantiate(readFileSync(new URL(`./wasm/${f}`, import.meta.url)), {}).then((r) => r.instance.exports);
const [X, H] = await Promise.all([load('explorer.wasm'), load('check_hints.wasm')]);
H._initialize();
const base = H.memory.buffer.byteLength;
H.memory.grow(1);
const ask = (fn, msg) => (new Uint8Array(H.memory.buffer, base, 65536).set(new TextEncoder().encode(`${msg.slice(0, 4000)}\0`)), H[fn](base));

export function check(src) {
  const b = new TextEncoder().encode(src), p = X.t27_alloc(b.length);
  new Uint8Array(X.memory.buffer, p, b.length).set(b);
  const r = X.t27_analyze(p, b.length), n = new DataView(X.memory.buffer).getUint32(r, true);
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(X.memory.buffer, r + 4, n)));
  X.t27_free(r, n + 4);
  const msgs = j.astError ? [j.astError] : j.typecheck.errors ?? [], lines = src.split('\n');
  const diagnostics = msgs.map((message) => {
    const line = ask('line_of', message), hint = HINTS[ask('hint_code', message)];
    return { severity: message.startsWith('warning:') ? 'warning' : 'error', line: line || undefined, message, hint: hint || undefined, source: lines[line - 1] };
  });
  return { ok: !j.astError && j.typecheck.ok !== false, errors: diagnostics.filter((d) => d.severity === 'error').length, warnings: diagnostics.length - diagnostics.filter((d) => d.severity === 'error').length, diagnostics };
}
