// Visual-output glue. wasm/visual_output.wasm (specs/t27mcp/visual_output.t27) decides whether an answer carries a
// visual, where it goes by host, and whether a tool SVG is embedded inline as it is or redrawn from t27f_outline rows;
// wasm/visual_output_table.mjs holds the hosts, channels, verdicts and the rule text. server.mjs sends RULE_CLAUDE_CODE
// as its `instructions`; TRI CLAW imports this file for RULE_TRI_CLAW, so the rule has one home. This file only
// measures an SVG: its viewBox width, its smallest font-size and its bytes.
import { readFileSync } from 'node:fs';
import * as T from './wasm/visual_output_table.mjs';
export * from './wasm/visual_output_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/visual_output.wasm', import.meta.url)), {})).instance.exports;
W._initialize();

export const ruleClaudeCode = T.RULE_CLAUDE_CODE.join('\n');
export const ruleTriClaw = T.RULE_TRI_CLAW.join('\n');
export const needsVisual = (kind) => !!W.needs_visual(kind);
export const answerChannel = (host, inlineTool, svg) => W.answer_channel(host, +!!inlineTool, +!!svg);

// The line a t27f tool prints under its path. No font-size in the SVG reads as 0 px: never embedded.
export const inlineNote = (svg) => {
  const w = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0), b = Buffer.byteLength(svg);
  const fs = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1])), f = fs.length ? Math.floor(Math.min(...fs)) : 0;
  const how = W.inline_source(w, f, b) === T.SRC_EMBED ? 'embed this SVG as it is' : `redraw it ${T.INLINE_W} wide from t27f_outline rows`;
  return `inline: ${how} (${w} wide, smallest text ${f} px, ${b} bytes; specs/t27mcp/visual_output.t27 inline_source).`;
};
