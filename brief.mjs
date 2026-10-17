// Spec-row glue. wasm/spec_brief.wasm (specs/t27mcp/spec_brief.t27) decides why a spec fails; wasm/spec_brief.mjs
// holds the field lists and the reason templates. This file reads the manifest record and fills the templates.
import { readFileSync } from 'node:fs';
import * as S from './wasm/spec_brief.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/spec_brief.wasm', import.meta.url)), {})).instance.exports;
W._initialize();
const fill = [null, (s) => s.failedBackends.join(', '), (s) => s.tcErrors, (s) => s.loss];

export function failureReasons(s) {
  const m = W.why_mask(+(s.health === 'fail'), Number(s.nodes) || 0, s.failedBackends?.length || 0, Number(s.tcErrors) || 0, Number(s.loss) || 0);
  const why = S.WHY_TEXT.flatMap((t, b) => (m & (1 << b) ? [t.replace('{}', fill[b]?.(s))] : []));
  return why.length ? why : undefined;
}

// A spec row cut to one of the spec's field lists; `fields: true` on the tools returns the whole record instead.
const cut = (s, names) => ({ ...Object.fromEntries(names.filter((k) => !Array.isArray(s[k]) || s[k].length).map((k) => [k, s[k]])), whyFailing: failureReasons(s) });
export const brief = (s) => cut(s, S.BRIEF_FIELDS);
export const one = (s) => cut(s, S.ONE_FIELDS);
