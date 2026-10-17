// t27_examples glue. wasm/examples.wasm (specs/t27mcp/examples.t27) maps a question to a topic and a topic to
// table rows; wasm/examples_table.mjs holds the rows (path, lines, reason) and the pinned commit. This file
// fetches a row's file at that commit and cuts the lines. The tables and the rules live in the spec.
import { readFileSync } from 'node:fs';
import * as S from './wasm/examples_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/examples.wasm', import.meta.url)), {})).instance.exports;
W._initialize();
const base = W.memory.buffer.byteLength;
W.memory.grow(1);
const topicOf = (q) => (new Uint8Array(W.memory.buffer, base, 65536).set(new TextEncoder().encode(`${q.toLowerCase().slice(0, 200)}\0`)), W.topic_code(base));

// fetchText(pin, path) -> the file at that commit
export async function examples(question, fetchText) {
  const code = topicOf(question), rows = [];
  for (let k = 0, i; (i = W.pick(code, k) >>> 0) !== S.NO_ROW; k++) rows.push(i);
  if (!rows.length) return { topics: S.TOPICS.slice(1), note: `no topic matches "${question}"; ask for one of these` };
  const examples = await Promise.all(rows.map(async (i) => {
    const l = (await fetchText(S.PIN, S.EX_PATH[i])).split('\n'), at = (n) => (n ? [l[n - 1]] : []);
    return { path: S.EX_PATH[i], lines: `${S.EX_FROM[i]}-${S.EX_TO[i]}`, why: S.EX_WHY[i],
      source: [...at(S.EX_MODULE[i]), ...at(S.EX_USE[i]), ...l.slice(S.EX_FROM[i] - 1, S.EX_TO[i]), ...at(S.EX_FOOTER[i])].join('\n') };
  }));
  return { topic: S.TOPICS[code], pin: S.PIN, examples };
}
