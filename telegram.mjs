// tg_* glue. wasm/telegram.wasm (specs/t27mcp/telegram.t27) checks the arguments and names the outcome of each run;
// wasm/telegram_table.mjs holds the tool names, commands, descriptions and texts. The owner's account is read through
// the `tg` CLI (gHashTag/agent-telegram), which holds the session in the Keychain and cannot send; this file spawns it.
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import * as S from './wasm/telegram_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/telegram.wasm', import.meta.url)), {})).instance.exports;
W._initialize?.();
const count = (s, re) => (s.match(re) || []).length;
const run = (argv) => new Promise((done) => execFile(process.env.T27_TG || 'tg', argv, { timeout: S.TG_TIMEOUT_MS, maxBuffer: 16 << 20 },
  (e, out, err) => done({ missing: e?.code === 'ENOENT', code: e ? (Number.isInteger(e.code) ? e.code : 1) : 0, out: String(out ?? ''), err: String(err ?? '') })));

async function call(i, a) {
  const argv = [S.TG_CMD[i]], kind = S.TG_ARG[i];
  if (kind === S.A_CHAT) {
    const c = String(a.chat ?? '');
    if (!W.chat_ok(c.length, count(c, /[0-9]/g), c[0] === '-', c[0] === '@', count(c, /[A-Za-z0-9_]/g))) throw new Error(S.CHAT_BAD_TEXT);
    argv.push(c);
  }
  if (kind === S.A_QUERY) {
    const q = String(a.query ?? '');
    if (!W.query_ok(q.length)) throw new Error(S.QUERY_BAD_TEXT);
    argv.push(q);
  }
  if (i !== S.TOOL_WHOAMI) argv.push('-n', String(W.limit_for(Math.min(1e6, Math.max(0, Math.floor(Number(a.limit) || 0))))));
  const r = await run(argv), o = W.outcome(r.missing, r.code, /MISSING|tg login/.test(i === S.TOOL_WHOAMI ? r.out : r.err));
  if (o !== S.O_OK) throw new Error(`${S.OUTCOME_TEXT[o]}\n${(r.err || r.out).trim().slice(0, 600)}`);
  const body = Buffer.byteLength(r.out) > S.REPLY_MAX_BYTES ? Buffer.from(r.out).subarray(0, S.REPLY_MAX_BYTES).toString() + S.CLIPPED_TEXT : r.out;
  return i === S.TOOL_WHOAMI ? `${body}\n${S.SEND_TEXT}` : S.FOREIGN_TEXT + body;
}

const prop = { [S.A_CHAT]: ['chat', S.CHAT_DESC], [S.A_QUERY]: ['query', S.QUERY_DESC] };
export const tgTools = S.TG_TOOLS.map((name, i) => {
  const p = prop[S.TG_ARG[i]], properties = i === S.TOOL_WHOAMI ? {} : { limit: { type: 'number', description: S.LIMIT_DESC } };
  if (p) properties[p[0]] = { type: 'string', description: p[1] };
  return { name, description: S.TG_DESC[i], inputSchema: { type: 'object', properties, required: p ? [p[0]] : [] }, handler: (a) => call(i, a || {}) };
});
