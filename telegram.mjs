// tg_* glue. wasm/telegram.wasm (specs/t27mcp/telegram.t27) checks the arguments and names the outcome of each call;
// wasm/telegram_table.mjs holds the tool names, descriptions, the app address and the texts. The owner's account is read
// through the owner's TRI CLAW (service vibee-render), which holds the logged-in session; this file forwards the call to its /mcp.
import { readFileSync } from 'node:fs';
import * as S from './wasm/telegram_table.mjs';

const W = (await WebAssembly.instantiate(readFileSync(new URL('./wasm/telegram.wasm', import.meta.url)), {})).instance.exports;
W._initialize?.();
const count = (s, re) => (s.match(re) || []).length;

async function call(i, a) {
  const args = {}, kind = S.TG_ARG[i], key = process.env[S.KEY_ENV] || '';
  if (kind === S.A_CHAT) {
    const c = String(a.chat ?? '');
    if (!W.chat_ok(c.length, count(c, /[0-9]/g), c[0] === '-', c[0] === '@', count(c, /[A-Za-z0-9_]/g))) throw new Error(S.CHAT_BAD_TEXT);
    args.chat = c;
  }
  if (kind === S.A_QUERY) {
    const q = String(a.query ?? '');
    if (!W.query_ok(q.length)) throw new Error(S.QUERY_BAD_TEXT);
    args.query = q;
  }
  if (S.TG_LIMITED[i]) args.limit = W.limit_for(Math.min(1e6, Math.max(0, Math.floor(Number(a.limit) || 0))));
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: S.TG_TOOLS[i], arguments: args } });
  const r = key ? await fetch(process.env[S.URL_ENV] || S.APP_MCP_URL, { method: 'POST', body, signal: AbortSignal.timeout(S.TG_TIMEOUT_MS),
    headers: { 'content-type': 'application/json', 'x-agent-key': key } }).then(async (h) => ({ status: h.status, j: await h.json().catch(() => ({})) }), () => ({ status: 0, j: {} })) : { status: 0, j: {} };
  const text = r.j.error?.message ?? (r.j.result?.content || []).map((c) => c.text ?? '').join('\n');
  const o = W.outcome(!!key, r.status, !!(r.j.error || r.j.result?.isError || !r.j.result));
  if (o !== S.O_OK) throw new Error(`${S.OUTCOME_TEXT[o]}\n${text.slice(0, 600)}`);
  const out = Buffer.byteLength(text) > S.REPLY_MAX_BYTES ? Buffer.from(text).subarray(0, S.REPLY_MAX_BYTES).toString() + S.CLIPPED_TEXT : text;
  return S.FOREIGN_TEXT + out + (i === S.TOOL_UNANSWERED ? S.SEND_TEXT : '');
}

// The input schema of each tg_* tool is its rows in specs/t27mcp/tool_schema.t27 (schema.mjs adds it).
export const tgTools = S.TG_TOOLS.map((name, i) => ({ name, description: S.TG_DESC[i], handler: (a) => call(i, a || {}) }));
