// t27_dashboard glue. wasm/dashboard.wasm (specs/t27mcp/dashboard.t27) grades the corpus, the session's calls and
// its largest reply, and picks the next step; wasm/dashboard_table.mjs holds the page templates and the texts.
// This file only counts calls per tool and fills the templates, left to right.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as S from './wasm/dashboard_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/dashboard.wasm', import.meta.url)), {})).instance.exports;
W._initialize?.();
const fill = (t, ...v) => v.reduce((s, x) => s.replace('{}', () => String(x)), t);
const ledger = new Map();

/** Count one tools/call: its reply size in bytes and whether it threw. */
export function note(name, bytes, failed) {
  const r = ledger.get(name) || { calls: 0, errors: 0, max: 0 };
  ledger.set(name, { calls: r.calls + 1, errors: r.errors + (failed ? 1 : 0), max: Math.max(r.max, bytes) });
}

/** The page and the one-line reply, from the manifest `m` (null when unreachable) and the server's own facts. */
export function dashboard(m, server) {
  const h = m?.health || {}, rows = [...ledger].sort((a, b) => b[1].calls - a[1].calls);
  const sum = (k) => rows.reduce((n, [, r]) => (k === 'max' ? Math.max(n, r.max) : n + r[k]), 0);
  const ht = W.health_tone(m?.specCount || 0, h.fail || 0, h.warn || 0), ct = W.calls_tone(sum('calls'), sum('errors'));
  const rt = W.reply_tone(sum('max')), all = W.worst(W.worst(ht, ct), rt), next = S.NEXT_TEXT[W.next_step(ht, ct, rt)];
  const kv = (pairs) => pairs.map(([k, v]) => fill(S.KV_TEXT, k, v)).join('');
  const commit = m?.generatedFrom?.shortCommit || 'unknown';
  const panels = [
    [ht, kv([['commit', commit], ['specs', m?.specCount ?? 'unknown'], ['ok', h.ok ?? '-'], ['warn', h.warn ?? '-'], ['fail', h.fail ?? '-']])],
    [W.worst(ct, rt), S.TABLE_HEAD + rows.map(([n, r]) => fill(S.ROW_TEXT, W.worst(W.calls_tone(r.calls, r.errors), W.reply_tone(r.max)), n, r.calls, r.errors, r.max)).join('') + S.TABLE_TAIL],
    [all, fill(S.LINE_TEXT, next)],
    [S.T_OK, kv([['version', server.version], ['tools', server.tools], ['site', server.site]])],
    [S.T_UNKNOWN, S.UNKNOWN_TEXT.map((t) => fill(S.LINE_TEXT, t)).join('')],
  ].map(([t, body], i) => fill(S.PANEL_TEXT, t, S.PANEL_TITLES[i], body));
  const file = join(tmpdir(), 't27-mcp-dashboard.html');
  const html = fill(S.PAGE_TEXT, all, S.TONE_NAME[all], `corpus ${commit}, ${sum('calls')} calls`, panels.join(''));
  writeFileSync(file, html);
  const text = fill(S.AGENT_TEXT, S.TONE_NAME[all], commit, m?.specCount ?? 0, h.ok ?? 0, h.warn ?? 0, h.fail ?? 0, S.TONE_NAME[ht], sum('calls'), sum('errors'), sum('max'), S.TONE_NAME[rt], next, file);
  return { text, html, file, tone: S.TONE_NAME[all] };
}
