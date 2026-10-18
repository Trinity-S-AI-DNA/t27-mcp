// One-service glue. wasm/service.wasm (specs/t27mcp/service.t27) decides which home owns a tool name, what the one
// registry does with a tool a side offers (admit), who sees the mounted t27 tools and what this keyless server still
// serves; wasm/service_table.mjs holds the homes, answers, scopes and the coder persona's tools. TRI CLAW imports this
// file to mount the t27 tools, so the rule has one home. This file only writes a name into the instance's memory.
import { readFileSync } from 'node:fs';
export * from './wasm/service_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/service.wasm', import.meta.url)), {})).instance.exports;
W._initialize();
const base = W.memory.buffer.byteLength;
W.memory.grow(1);
// A NUL inside a name would end it early in C and let "t27_x\0..." pass as t27_x, so it is written as a space,
// a byte name_ok refuses. Past 255 bytes a name is cut; it is already over NAME_MAX, so it is refused either way.
const put = (s) => {
  const b = new TextEncoder().encode(String(s)).subarray(0, 255).map((c) => c || 32), m = new Uint8Array(W.memory.buffer, base, 256);
  m.set(b);
  m[b.length] = 0;
  return base;
};

export const admit = (name, offeredBy) => W.admit(put(name), offeredBy);
export const homeOf = (name) => W.home_of(put(name));
export const localServes = (name) => !!W.local_serves(put(name));
export const t27Visible = (scope) => !!W.t27_visible(scope);
