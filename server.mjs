#!/usr/bin/env node
// t27-mcp — MCP server over the live T27 surfaces: the t27.ai queen/atlas JSON
// feeds, the published spec corpus, and the numeric-format SSOT in gHashTag/t27.
//
// The format count is ALWAYS parsed from the live SSOT, never from memory.
// Protocol: JSON-RPC 2.0 over stdio, MCP 2024-11-05.
//
// v1.1.0 — the spec index moved from the atlas to the manifest. The atlas knows
// a spec's id and where it lives; the manifest knows whether it compiles, what
// it lost, which backends refused it and what it is made of. Reading the poorer
// source meant "which specs are failing?" had no answer here at all, while the
// number 6 sat in t27_status with no way to drill into it.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import * as reel from './wasm/reel.mjs';
import * as deck from './wasm/deck.mjs';
import * as G from './wasm/spec_graph_view.mjs';
import { slide } from './deck-view.mjs';
import { check } from './check.mjs';

const VERSION = '1.1.0';
const SITE = process.env.T27_SITE || 'https://t27.ai';
const RAW = 'https://raw.githubusercontent.com/gHashTag/t27';
const REF = process.env.T27_REF || 'master';
const TTL = Number(process.env.T27_TTL_MS || 5 * 60 * 1000);

// ------------------------------------------------------------------- fetching

const cache = new Map();
const inflight = new Map(); // concurrent calls for the same URL share one request

// A transient network failure must not be reported as a catalog fact, so a
// fetch is retried before it is allowed to become an error.
async function fetchRetry(url, init, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error(`${last.message} (after ${tries} attempts: ${url})`);
}

// `fresh` exists because the publish pipeline is slower than a conversation. A
// merge reaches t27.ai minutes later, and a five-minute cache answering "is it
// live yet?" with a cached "no" is worse than no cache at all.
function get(url, read, init, fresh = false) {
  const hit = cache.get(url);
  const now = process.hrtime.bigint();
  if (!fresh && hit && Number(now - hit.at) / 1e6 < TTL) return Promise.resolve(hit.value);
  if (!fresh && inflight.has(url)) return inflight.get(url);
  const p = fetchRetry(url, init)
    .then((res) => read(res))
    .then((value) => {
      cache.set(url, { at: process.hrtime.bigint(), value });
      inflight.delete(url);
      return value;
    })
    .catch((e) => {
      inflight.delete(url);
      throw e;
    });
  if (!fresh) inflight.set(url, p);
  return p;
}

const getJson = (url, fresh) =>
  get(url, (r) => r.json(), { headers: { Accept: 'application/json' } }, fresh);
const getText = (url, fresh) => get(url, (r) => r.text(), undefined, fresh);

const manifest = (fresh) => getJson(`${SITE}/t27/manifest.json`, fresh);
const atlas = (fresh) => getJson(`${SITE}/t27/universe-atlas.json`, fresh);
const foundation = (fresh) => getJson(`${SITE}/queen/foundation.json`, fresh);
const modules = (fresh) => getJson(`${SITE}/queen/modules.json`, fresh);

// Every spec in the corpus is published as its own source file next to the
// manifest that describes it. This is what makes "show me the spec" and "grep
// the corpus" possible without cloning ten repositories.
const specSource = (path, fresh) => getText(`${SITE}/t27/files/${path}`, fresh);

// ------------------------------------------------------- numeric format SSOT

// One `// CATALOG: k=v k="v"` line per format in specs/numeric/formats_catalog.t27.
function parseCatalog(src) {
  const out = [];
  for (const line of src.split('\n')) {
    const i = line.indexOf('// CATALOG:');
    if (i === -1) continue;
    const rest = line.slice(i + '// CATALOG:'.length).trim();
    const row = {};
    for (const m of rest.matchAll(/(\w+)=("([^"]*)"|\S+)/g)) row[m[1]] = m[3] ?? m[2];
    if (row.bits) row.bits = Number(row.bits);
    for (const k of ['s', 'e', 'm', 'bias']) if (row[k] !== undefined) row[k] = Number(row[k]);
    out.push(row);
  }
  return out;
}

async function catalog(ref = REF, fresh) {
  const src = await getText(`${RAW}/${ref}/specs/numeric/formats_catalog.t27`, fresh);
  return parseCatalog(src);
}

const tally = (rows, key) =>
  Object.fromEntries(
    Object.entries(
      rows.reduce((a, r) => ((a[r[key] ?? 'unknown'] = (a[r[key] ?? 'unknown'] || 0) + 1), a), {}),
    ).sort((a, b) => b[1] - a[1]),
  );

const topN = (obj, n) => Object.fromEntries(Object.entries(obj).slice(0, n));

// `health: "fail"` covers two unrelated events, and the difference is invisible
// unless you read the AST counters. A spec that never parsed reports loss 0,
// tcErrors 0 and no failed backend — not because it is clean, but because
// nothing downstream of the parser ever ran. Two of the six failing specs are
// that case, and they had been read as unexplained.
//
// Derived from observable manifest fields only; it adds no claim of its own.
function failureReasons(s) {
  if (s.health !== 'fail') return undefined;
  const why = [];
  if (!Number(s.nodes)) why.push('not-parsed: the manifest records no AST, so no backend ran');
  if (s.failedBackends?.length) why.push(`backend: ${s.failedBackends.join(', ')} returned nothing`);
  if (Number(s.tcErrors)) why.push(`typecheck: ${s.tcErrors} error(s)`);
  if (Number(s.loss)) why.push(`round-trip loss: ${s.loss}`);
  if (!why.length) why.push('unknown: marked fail with no counter to explain it');
  return why;
}

// A spec row trimmed to what a reader almost always wants. `fields: true` on
// the search tools returns the whole record instead.
const brief = (s) => ({
  path: s.path,
  repo: s.repo,
  name: s.name,
  health: s.health,
  lines: s.lines,
  loss: s.loss,
  tcErrors: s.tcErrors,
  failedBackends: s.failedBackends?.length ? s.failedBackends : undefined,
  whyFailing: failureReasons(s),
});

// Run `fn` over `items` with a bounded number in flight. The corpus is 1407
// specs; an unbounded Promise.all over even a filtered slice of it opens enough
// sockets to be indistinguishable from an attack on our own site.
async function pooled(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// Shared by every spec-search tool, so a filter means the same thing everywhere.
function filterSpecs(all, f) {
  let rows = all;
  if (f.repo) rows = rows.filter((s) => String(s.repo || '').toLowerCase().includes(f.repo.toLowerCase()));
  if (f.category) rows = rows.filter((s) => String(s.category || '').toLowerCase().includes(f.category.toLowerCase()));
  if (f.health) rows = rows.filter((s) => String(s.health) === f.health);
  if (f.tag) rows = rows.filter((s) => (s.tags || []).includes(f.tag));
  if (f.failedBackend) rows = rows.filter((s) => (s.failedBackends || []).includes(f.failedBackend));
  if (f.hasLoss === true) rows = rows.filter((s) => Number(s.loss) > 0);
  if (f.hasLoss === false) rows = rows.filter((s) => !Number(s.loss));
  if (f.hasTcErrors === true) rows = rows.filter((s) => Number(s.tcErrors) > 0);
  if (f.hasTcErrors === false) rows = rows.filter((s) => !Number(s.tcErrors));
  if (f.minLines != null) rows = rows.filter((s) => Number(s.lines) >= f.minLines);
  if (f.maxLines != null) rows = rows.filter((s) => Number(s.lines) <= f.maxLines);
  if (f.query) {
    const q = f.query.toLowerCase();
    rows = rows.filter((s) =>
      `${s.path} ${s.name} ${s.module} ${s.description} ${s.summary}`.toLowerCase().includes(q),
    );
  }
  return rows;
}

const SPEC_FILTERS = {
  query: { type: 'string', description: 'Substring of path, name, module, description or summary' },
  repo: { type: 'string', description: 't27 | trinity-fpga | tri-net | trios | tt-trinity-euler | …' },
  category: { type: 'string', description: 'e.g. specs/numeric, specs/ml, specs/fpga' },
  health: { type: 'string', description: 'ok | warn | fail' },
  tag: { type: 'string', description: 'Exact tag, e.g. has/invariants, domain/numeric, size/large' },
  failedBackend: { type: 'string', description: 'Specs a named backend refused, e.g. verilog_hir' },
  hasLoss: { type: 'boolean', description: 'Specs with round-trip loss > 0' },
  hasTcErrors: { type: 'boolean', description: 'Specs with type-check errors > 0' },
  minLines: { type: 'number' },
  maxLines: { type: 'number' },
};

// ------------------------------------------------------------------- tooling
// t27f_view: every position, size and style index comes from specs/t27f/reel.t27 and, for the default
// deck look, specs/t27f/deck.t27 (gHashTag/t27); their bodies run as wasm/t27f.wasm and their constants
// are wasm/reel.mjs and wasm/deck.mjs. This glue writes SVG only; the deck look is deck-view.mjs.
// t27f_graph draws specs/t27f/spec_graph_view.t27 the same way; its constants are wasm/spec_graph_view.mjs.
const R = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(new URL('./wasm/t27f.wasm', import.meta.url)))).exports;
const PAINT = ['none', '#3a3f4b', '#3b82f6', '#8a7a3a', '#ffd45a', '#22c55e', '#1f2229']; // host palette by STYLE_*
const esc = (v) => String(v).replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

const tools = [
  {
    name: 't27_status',
    description:
      'Live provenance of the published T27 surface: source commit, spec count, health split with the failing specs named, backend failures, and the biggest tags. Everything else is read at this commit.',
    inputSchema: {
      type: 'object',
      properties: { fresh: { type: 'boolean', description: 'Bypass the 5-minute cache' } },
    },
    handler: async ({ fresh }) => {
      const m = await manifest(fresh);
      let a = null;
      let atlasError = null;
      try {
        a = await atlas(fresh);
      } catch (e) {
        atlasError = e.message; // a silent null here once read as "there is no atlas"
      }
      const failing = (m.specs || []).filter((s) => s.health === 'fail');
      return {
        site: SITE,
        serverVersion: VERSION,
        generatedFrom: m.generatedFrom,
        specCount: m.specCount,
        totalLines: m.totalLines,
        wasmBytes: m.wasmBytes,
        health: m.health,
        failingSpecs: failing.map(brief),
        backendFailures: m.backendFailures,
        categoryCount: Object.keys(m.categories || {}).length,
        topTags: topN(m.tags || {}, 12),
        totals: m.totals,
        repos: m.repos,
        atlas: a
          ? { version: a.version, at: a.at, issues: a.issues?.length, specs: a.specs?.length, worlds: a.worlds?.length, opportunities: a.opportunities?.length }
          : null,
        atlasError,
      };
    },
  },
  {
    name: 't27_formats',
    description:
      'The numeric-format catalog parsed live from the SSOT (specs/numeric/formats_catalog.t27). Returns the true count with cluster and status tallies, and filters. Never quote a count from memory — this is the source.',
    inputSchema: {
      type: 'object',
      properties: {
        cluster: { type: 'string', description: 'e.g. GoldenFloat, Ieee754Binary, Microscaling' },
        status: { type: 'string', description: 'Verified | Historical | Experimental | Open_conjecture | Retracted' },
        bits: { type: 'number' },
        name: { type: 'string', description: 'Substring match on id or name' },
        fields: { type: 'boolean', description: 'Return full rows instead of a summary (default false)' },
        ref: { type: 'string', description: 'Git ref to read; default master' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ cluster, status, bits, name, fields = false, ref, fresh }) => {
      const all = await catalog(ref, fresh);
      let rows = all;
      if (cluster) rows = rows.filter((r) => String(r.cluster).toLowerCase() === cluster.toLowerCase());
      if (status) rows = rows.filter((r) => String(r.status).toLowerCase() === status.toLowerCase());
      if (bits) rows = rows.filter((r) => r.bits === bits);
      if (name) {
        const n = name.toLowerCase();
        rows = rows.filter((r) => `${r.id} ${r.name}`.toLowerCase().includes(n));
      }
      return {
        ref: ref || REF,
        source: `${RAW}/${ref || REF}/specs/numeric/formats_catalog.t27`,
        totalInCatalog: all.length,
        matched: rows.length,
        clusters: tally(all, 'cluster'),
        statuses: tally(all, 'status'),
        formats: fields ? rows : rows.map((r) => ({ id: r.id, name: r.name, bits: r.bits, cluster: r.cluster, status: r.status })),
      };
    },
  },
  {
    name: 't27_format',
    description: 'One numeric format: every field on its SSOT row.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Catalog id, e.g. gf16, tnf8, binary16' },
        ref: { type: 'string' },
        fresh: { type: 'boolean' },
      },
      required: ['id'],
    },
    handler: async ({ id, ref, fresh }) => {
      const rows = await catalog(ref, fresh);
      const hit = rows.find((r) => r.id === id) || rows.find((r) => String(r.id).toLowerCase() === id.toLowerCase());
      if (!hit) {
        const near = rows.filter((r) => `${r.id}`.includes(id.toLowerCase().slice(0, 3))).map((r) => r.id).slice(0, 10);
        throw new Error(`No format "${id}". Nearby ids: ${near.join(', ') || 'none'}`);
      }
      return hit;
    },
  },
  {
    name: 't27_specs',
    description:
      'Search the .t27 corpus on the published manifest: filter by path, repo, category, tag, compile health, failing backend, round-trip loss, type-check errors or size. Returns tallies over the matched set, so "which specs fail and why" is one call.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SPEC_FILTERS,
        sort: { type: 'string', description: 'lines | tokens | nodes | loss | tcErrors | path (default path)' },
        desc: { type: 'boolean', description: 'Sort descending (default true for numeric sorts)' },
        limit: { type: 'number', description: 'Default 50' },
        fields: { type: 'boolean', description: 'Return the full manifest record per spec' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ sort = 'path', desc, limit = 50, fields = false, fresh, ...f }) => {
      const m = await manifest(fresh);
      const all = m.specs || [];
      const rows = filterSpecs(all, f);
      const numeric = ['lines', 'tokens', 'nodes', 'loss', 'tcErrors', 'depth', 'bytes'].includes(sort);
      // Sorting by lines almost always means "the biggest ones"; sorting by path
      // almost always means A to Z. Defaulting per kind saves a flag every call.
      const dir = (desc === undefined ? numeric : desc) ? -1 : 1;
      const sorted = [...rows].sort((a, b) =>
        numeric
          ? (Number(a[sort] || 0) - Number(b[sort] || 0)) * dir
          : String(a.path).localeCompare(String(b.path)) * dir,
      );
      return {
        commit: m.generatedFrom?.shortCommit,
        totalInCorpus: all.length,
        matched: rows.length,
        health: tally(rows, 'health'),
        repos: tally(rows, 'repo'),
        categories: topN(tally(rows, 'category'), 12),
        specs: sorted.slice(0, limit).map((s) => (fields ? s : brief(s))),
      };
    },
  },
  {
    name: 't27_spec',
    description:
      'One spec: its whole manifest record (health, loss, type-check errors, failing backends, AST node kinds, emitted bytes per backend, tags) and, on request, its actual .t27 source text.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Exact corpus path, e.g. specs/demos/hello_world.t27' },
        source: { type: 'boolean', description: 'Include the .t27 source text (default false)' },
        fresh: { type: 'boolean' },
      },
      required: ['path'],
    },
    handler: async ({ path, source = false, fresh }) => {
      const m = await manifest(fresh);
      const all = m.specs || [];
      const hit =
        all.find((s) => s.path === path) ||
        all.find((s) => String(s.path).toLowerCase() === path.toLowerCase()) ||
        all.find((s) => String(s.path).endsWith(path));
      if (!hit) {
        const near = all
          .filter((s) => String(s.path).toLowerCase().includes(path.toLowerCase().split('/').pop().slice(0, 6)))
          .map((s) => s.path)
          .slice(0, 10);
        throw new Error(`No spec "${path}". Nearby paths: ${near.join(', ') || 'none'}`);
      }
      const out = { ...hit, whyFailing: failureReasons(hit), sourceUrl: `${SITE}/t27/files/${hit.path}` };
      if (source) out.source = await specSource(hit.path, fresh);
      return out;
    },
  },
  {
    name: 't27_grep',
    description:
      'Search inside .t27 source text across the corpus. Narrow with the same filters as t27_specs first — the search fetches one file per candidate spec, so it is capped. Returns matching lines with line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'JavaScript regular expression, e.g. "fn\\\\s+requant" ' },
        ignoreCase: { type: 'boolean', description: 'Default true' },
        ...SPEC_FILTERS,
        maxSpecs: { type: 'number', description: 'Candidate specs to open, default 40, hard cap 150' },
        maxHitsPerSpec: { type: 'number', description: 'Default 5' },
        fresh: { type: 'boolean' },
      },
      required: ['pattern'],
    },
    handler: async ({ pattern, ignoreCase = true, maxSpecs = 40, maxHitsPerSpec = 5, fresh, ...f }) => {
      let re;
      try {
        re = new RegExp(pattern, ignoreCase ? 'i' : '');
      } catch (e) {
        throw new Error(`Bad pattern: ${e.message}`);
      }
      const m = await manifest(fresh);
      const all = m.specs || [];
      const candidates = filterSpecs(all, f);
      const cap = Math.min(Math.max(1, maxSpecs), 150);
      const opened = candidates.slice(0, cap);
      const results = await pooled(opened, 8, async (s) => {
        let text;
        try {
          text = await specSource(s.path, fresh);
        } catch (e) {
          return { path: s.path, error: e.message };
        }
        const hits = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length && hits.length < maxHitsPerSpec; i++) {
          if (re.test(lines[i])) hits.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
        }
        return hits.length ? { path: s.path, repo: s.repo, health: s.health, hits } : null;
      });
      const matched = results.filter((r) => r && !r.error);
      const errors = results.filter((r) => r && r.error);
      return {
        pattern,
        candidates: candidates.length,
        opened: opened.length,
        truncated: candidates.length > opened.length,
        specsWithHits: matched.length,
        totalHits: matched.reduce((a, r) => a + r.hits.length, 0),
        errors: errors.length ? errors : undefined,
        results: matched,
      };
    },
  },
  {
    name: 't27_issues',
    description:
      'Search the cross-repo issue index that the atlas links to specs. With `detail`, returns each issue\'s spec links: relation, coverage and why the link was made.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring of the issue title' },
        repo: { type: 'string' },
        spec: { type: 'string', description: 'Only issues linked to a spec whose id starts with, or path contains, this' },
        detail: { type: 'boolean', description: 'Include the spec links behind each issue' },
        limit: { type: 'number' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ query, repo, spec, detail = false, limit = 40, fresh }) => {
      const a = await atlas(fresh);
      let rows = a.issues || [];
      if (repo) rows = rows.filter((i) => i.repo.toLowerCase().includes(repo.toLowerCase()));
      if (query) rows = rows.filter((i) => String(i.title).toLowerCase().includes(query.toLowerCase()));
      if (spec) {
        // The atlas links issues to spec ids; a path is the thing a human has.
        const ids = new Set(
          (a.specs || [])
            .filter((s) => s.id.startsWith(spec) || (s.sources || []).some((src) => src.path.includes(spec)))
            .map((s) => s.id),
        );
        if (!ids.size) throw new Error(`No spec id or path matching "${spec}" in the atlas`);
        rows = rows.filter((i) => (i.hits || []).some((h) => ids.has(h.specId)));
      }
      return {
        at: a.at,
        total: (a.issues || []).length,
        matched: rows.length,
        issues: rows.slice(0, limit).map((i) => ({
          key: i.key,
          repo: i.repo,
          number: i.number,
          title: i.title,
          specHits: (i.hits || []).length,
          links: detail
            ? (i.hits || []).slice(0, 5).map((h) => ({
                specId: h.specId.slice(0, 12),
                relation: h.relation,
                coverage: h.coverage,
                score: h.score,
                reasons: (h.reasons || []).slice(0, 3),
              }))
            : undefined,
        })),
      };
    },
  },
  {
    name: 't27_epics',
    description: 'Epics and rings from the queen foundation feed, with their closed-issue children.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'open | closed' },
        limit: { type: 'number' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ state, limit = 30, fresh }) => {
      const f = await foundation(fresh);
      let eps = f.epics || [];
      if (state) eps = eps.filter((e) => String(e.state).toLowerCase() === state.toLowerCase());
      return {
        repo: f.repo,
        generatedAt: f.generatedAt,
        rule: f.rule,
        closedIssues: (f.closedIssues || []).length,
        releases: f.releases,
        matched: eps.length,
        epics: eps.slice(0, limit).map((e) => ({
          number: e.number,
          title: e.title,
          state: e.state,
          ring: e.ring,
          children: (e.children || []).length,
          closedAt: e.closedAt,
        })),
      };
    },
  },
  {
    name: 't27_modules',
    description: 'Module map from the queen modules feed: language mix, size, last touched, open issues.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring of the module path' },
        limit: { type: 'number' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ query, limit = 40, fresh }) => {
      const q = await modules(fresh);
      let rows = q.modules || [];
      if (query) rows = rows.filter((m) => String(m.path).toLowerCase().includes(query.toLowerCase()));
      return {
        repo: q.repo,
        commit: q.commit,
        generatedAt: q.generatedAt,
        totalModules: q.totalModules,
        matched: rows.length,
        modules: rows.slice(0, limit),
      };
    },
  },
  {
    name: 't27_worlds',
    description: 'The repositories the atlas covers, with descriptions, owners and the open opportunities it has found.',
    inputSchema: {
      type: 'object',
      properties: {
        opportunities: { type: 'boolean', description: 'Include the opportunity list' },
        limit: { type: 'number' },
        fresh: { type: 'boolean' },
      },
    },
    handler: async ({ opportunities = false, limit = 25, fresh }) => {
      const a = await atlas(fresh);
      return {
        at: a.at,
        owners: a.owners,
        worlds: (a.worlds || []).map((w) => ({ repo: w.repo, owner: w.owner, archived: w.archived, description: w.description })),
        opportunityCount: (a.opportunities || []).length,
        opportunities: opportunities ? (a.opportunities || []).slice(0, limit) : undefined,
      };
    },
  },
  {
    name: 't27_raw',
    description: 'Fetch any JSON published under t27.ai (read-only escape hatch), e.g. /queen/modules.json.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, fresh: { type: 'boolean' } },
      required: ['path'],
    },
    handler: async ({ path, fresh }) => {
      if (!path.startsWith('/')) throw new Error('path must start with /');
      // `//host/x` is a protocol-relative URL: appended to SITE it would still
      // parse as t27.ai, but a reader cannot tell that at a glance, and the
      // next edit to this line is where it stops being true.
      if (path.startsWith('//') || path.includes('\\')) throw new Error('path must be a single-slash site path');
      const url = new URL(SITE + path);
      if (url.origin !== new URL(SITE).origin) throw new Error(`refusing to leave ${SITE}`);
      return getJson(url.toString(), fresh);
    },
  },
  {
    name: 't27_game',
    description:
      'The rules of Queen Hive, the operational game this corpus is the board of, plus the live board state. Read this before claiming anything about progress: the honesty rule here overrides every other signal.',
    inputSchema: {
      type: 'object',
      properties: { fresh: { type: 'boolean' } },
    },
    handler: async ({ fresh }) => {
      const m = await manifest(fresh);
      let f = null;
      let foundationError = null;
      try {
        f = await foundation(fresh);
      } catch (e) {
        foundationError = e.message;
      }
      const specs = m.specs || [];
      return {
        board: `${SITE}/#/queen`,
        rules: {
          winCondition:
            'Replace hand-written code with T27 specifications while fixing real bugs in parallel. A module is won when its behaviour has a .t27 spec, a generated implementation, passing tests, Queen acceptance, and no orphaned hand-written implementation left behind.',
          cycle: ['Issue', 'Spec', 'Bee', 'Review', 'Evidence'],
          firstCampaign: 'trios — other repositories may join only after trios has an auditable spec-to-evidence trail.',
          colourLaw: {
            '#FFD45A yellow': 'functionality is covered by a T27 specification',
            '#64DCFF neon blue': 'nothing is claimed yet; the cell awaits its T27 boundary',
            '#FF4D5E red': 'hand-written code that T27 does not yet generate',
            '#FFC24D honey': 'pointer hover only — never a progress state',
          },
          honestyRule:
            'If a number, colour, cap or bee cannot be traced to a source, it must be removed or shown as unknown. That rule overrides every visual choice, and it overrides anything you would rather report.',
        },
        board_state: {
          commit: m.generatedFrom?.shortCommit,
          specs: specs.length,
          health: m.health,
          failing: specs.filter((s) => s.health === 'fail').map((s) => ({ path: s.path, why: failureReasons(s) })),
          lossAffected: m.totals?.lossAffected,
          tcAffected: m.totals?.tcAffected,
          repos: (m.repos || []).map((r) => ({ repo: r.repo, specs: r.specs })),
          epics: f ? (f.epics || []).length : null,
          openEpics: f ? (f.epics || []).filter((e) => String(e.state).toLowerCase() === 'open').length : null,
          foundationError,
        },
        howToPlay: {
          '1_read': 't27_status, then t27_specs to see what is claimed and what is failing',
          '2_pick': 't27_specs with health:"fail" or hasLoss:true is the shortest list of real, open work',
          '3_inspect': 't27_spec with source:true reads the actual .t27 text; t27_grep searches inside the corpus',
          '4_link': 't27_issues with spec:"<path>" shows which filed issues already point at it',
          '5_contribute': 'Open an issue or a pull request on the owning repository. Evidence, not motion, closes a cell.',
        },
      };
    },
  },
  {
    name: 't27_check',
    description:
      'Check .t27 source before you commit to it: parse and typecheck with the real compiler front end, and get each error with its line, the source line and a short "write this instead" hint for foreign syntax (`in` as a name, `as u3`, `x++`, `a ? b : c`, `match`). ok:true means it parses and typechecks, not that its tests pass.',
    inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'The .t27 source text' } }, required: ['source'] },
    handler: ({ source }) => {
      if (typeof source !== 'string' || !source.trim()) throw new Error('source must be non-empty .t27 text');
      return check(source);
    },
  },
  {
    name: 't27f_view',
    description:
      'Draw a still of the T27F demo reel (specs/t27f/reel.t27) as an SVG file and return its path. By default it is a presentation slide (specs/t27f/deck.t27); look 0 is the plain map. The Claude Code desktop app opens the path in its Browser pane; in a terminal, open the file yourself.',
    inputSchema: { type: 'object', properties: {
      scene: { type: 'integer', description: 'Demo scene 0..4; its still frame is drawn (default 2, the focus still)' }, frame: { type: 'integer', description: 'Exact frame instead of a scene still' },
      preset: { type: 'integer', description: '0 wide 1280x720 (default), 1 square 1080x1080, 2 tall 1080x1920' }, out: { type: 'string', description: 'Output file (default: the temp directory)' },
      status: { type: 'array', items: { type: 'integer' }, description: 'Lesson status code per cell (27); a missing one is a gap' }, labels: { type: 'array', items: { type: 'string' }, description: 'Label per cell (default: the cell number)' },
      host: { type: 'integer', description: 'Host code for the channel line (default 1, Claude Code desktop)' }, look: { type: 'integer', description: '1 deck slide (default), 0 plain map' },
      title: { type: 'string', description: 'Slide headline, at most 2 lines (default: the scene name)' }, subtitle: { type: 'string', description: 'Cover subtitle' }, rows: { type: 'array', items: { type: 'string' }, description: 'Card rows on a split slide, at most 4' } } },
    handler: async ({ scene = 2, frame, preset = deck.DEFAULT_PRESET, status = [], labels = [], host = reel.HOST_CLAUDE_CODE_DESKTOP, out, look = deck.DEFAULT_LOOK, title, subtitle, rows }) => {
      const f = frame ?? R.demo_still(scene), s = Number.isInteger(f) ? R.demo_scene_at(f) : reel.END_OF_REEL;
      if (s === reel.END_OF_REEL) throw new Error(`no such frame or scene: the demo reel has frames 0..${R.demo_frames() - 1}`);
      if (!(preset >= 0 && preset < reel.PRESET_COUNT)) throw new Error(`preset must be 0..${reel.PRESET_COUNT - 1}`);
      if (!status.every((v) => Number.isInteger(v) && v >= 0 && v < 256)) throw new Error('status codes are integers 0..255');
      if (look !== deck.LOOK_MAP && look !== deck.LOOK_DECK) throw new Error(`look must be ${deck.LOOK_MAP} (map) or ${deck.LOOK_DECK} (deck)`);
      const W = reel.PRESET_W[preset], H = reel.PRESET_H[preset], r = R.demo_r(f, preset), focus = reel.DEMO_CELL[s], bg = `#${deck.BACKDROP.toString(16).padStart(6, '0')}`;
      const name = reel.SCENE_NAMES.split(',')[reel.DEMO_KIND[s]], n = R.demo_frames(), cap = `T27F demo reel - scene ${s} (${name}) - frame ${f} of ${n}`;
      const svg = [`<rect width="${W}" height="${H}" fill="${bg}"/>`];
      if (look === deck.LOOK_DECK) svg.splice(0, 1, slide(R, { f, s, still: frame === undefined, preset, status, labels, kicker: cap, title: title ?? name, subtitle, rows }));
      else for (let k = 0; R.valid_cell(k); k++) {
        const st = R.cell_style(status[k] ?? 0), on = k === focus;
        const pts = [0, 1, 2, 3, 4, 5].map((i) => `${R.demo_corner_sx(f, preset, k, i)},${R.demo_corner_sy(f, preset, k, i)}`);
        svg.push(`<polygon points="${pts.join(' ')}" fill="${PAINT[st]}" stroke="${on ? '#fff' : st === reel.STYLE_GAP ? '#5ad1ff' : bg}" stroke-width="${on ? 4 : 2}"/>`,
          `<text x="${R.demo_sx(f, preset, R.cell_x(k))}" y="${R.demo_sy(f, preset, R.cell_y(k))}" font-size="${Math.max(10, r / 3)}" fill="#e6e8ee" text-anchor="middle" dominant-baseline="middle">${esc(labels[k] ?? k)}</text>`);
      }
      const ch = Object.keys(reel).find((c) => c.startsWith('CHANNEL_') && reel[c] === R.channel_for(host)) || 'none';
      if (look === deck.LOOK_MAP) svg.push(`<text x="24" y="${H - 24}" font-size="20" fill="#9aa0ac">${cap}</text>`);
      const path = out || join(tmpdir(), `t27f-demo-f${f}-p${preset}-${look === deck.LOOK_DECK ? 'deck' : 'map'}.svg`);
      writeFileSync(path, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif"><svg width="${W}" height="${H}">${svg.join('')}</svg></svg>\n`);
      return `${path}\nT27F demo reel, ${look === deck.LOOK_DECK ? `${['cover', 'stage', 'split'][R.layout_for(R.demo_kind(s))]} slide` : 'map'}, scene ${s} (${name}), frame ${f} of ${n}, ${W}x${H}, focus cell ${focus}; channel for host ${host}: ${ch}.`;
    },
  },
  {
    name: 't27f_graph',
    description:
      'Draw the T27F graph view (specs/t27f/spec_graph_view.t27) of a spec graph as an SVG file and return its path: a box per node, a line per edge, placed and styled by the spec, labelled by kind, inference label and source lines. Only the spec_graph fixtures exist until t27c exports graphs: 0 tutorial 08, 1 tutorial 08 with a suggestion.',
    inputSchema: { type: 'object', properties: { fixture: { type: 'integer', description: '0 tutorial 08 (default), 1 with a suggestion' }, out: { type: 'string', description: 'Output file (default: the temp directory)' } } },
    handler: async ({ fixture = 0, out }) => {
      if (fixture !== 0 && fixture !== 1) throw new Error('fixture must be 0 or 1');
      const v = R.fx_verdict(fixture), hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
      if (v !== G.VIEW_OK) throw new Error(`the view refuses fixture ${fixture}: verdict ${v}`);
      const nm = (p, k) => Object.keys(G).find((c) => c.startsWith(p) && !c.endsWith('KINDS') && G[c] === k)?.slice(p.length).toLowerCase() ?? k;
      const W = R.fx_width(fixture), H = R.fx_height(fixture), svg = [`<rect width="${W}" height="${H}" fill="${hex(G.VIEW_BACKDROP)}"/>`];
      for (let j = 0; j < R.fx_edge_count(fixture); j++) {
        const d = R.fx_edge_dash(fixture, j);
        svg.push(`<line x1="${R.fx_edge_x1(fixture, j)}" y1="${R.fx_edge_y1(fixture, j)}" x2="${R.fx_edge_x2(fixture, j)}" y2="${R.fx_edge_y2(fixture, j)}" stroke="${hex(R.fx_edge_stroke(fixture, j))}" stroke-width="1.5"${d ? ` stroke-dasharray="${d}"` : ''}><title>${nm('EDGE_', R.fx_edge_kind(fixture, j))}, line ${R.fx_edge_line(fixture, j)}</title></line>`);
      }
      for (let i = 0; i < R.fx_node_count(fixture); i++) {
        const x = R.fx_node_x(fixture, i), y = R.fx_node_y(fixture, i), d = R.fx_node_dash(fixture, i), a = R.fx_node_line_start(fixture, i), b = R.fx_node_line_end(fixture, i);
        svg.push(`<rect x="${x}" y="${y}" width="${R.fx_node_w(fixture, i)}" height="${R.fx_node_h(fixture, i)}" rx="6" fill="${hex(R.fx_node_fill(fixture, i))}" stroke="${hex(R.fx_node_stroke(fixture, i))}" stroke-width="1.5"${d ? ` stroke-dasharray="${d}"` : ''}/>`,
          `<text x="${x + 8}" y="${y + G.VIEW_FONT_PX + 6}" font-size="${G.VIEW_FONT_PX}" fill="${hex(G.VIEW_TEXT)}">${nm('NODE_', R.fx_node_kind(fixture, i))} ${i} - ${nm('LABEL_', R.fx_node_label(fixture, i))} - L${a}${b > a ? `-${b}` : ''}</text>`);
      }
      const path = out || join(tmpdir(), `t27f-graph-fx${fixture}.svg`);
      writeFileSync(path, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif">${svg.join('')}</svg>\n`);
      return `${path}\nT27F graph view, fixture ${fixture}: ${R.fx_node_count(fixture)} nodes, ${R.fx_edge_count(fixture)} edges, ${W}x${H}.`;
    },
  },
];

const byName = new Map(tools.map((t) => [t.name, t]));

// ------------------------------------------------------------ jsonrpc / mcp

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');

async function handle(req) {
  const { method, params } = req;
  if (method === 'initialize')
    return { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 't27-mcp', version: VERSION } };
  if (method === 'ping') return {};
  if (method === 'tools/list')
    return { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
  if (method === 'tools/call') {
    const tool = byName.get(params?.name);
    if (!tool) throw new Error(`Unknown tool: ${params?.name}`);
    const result = await tool.handler(params.arguments || {});
    return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 1) }] };
  }
  if (typeof req.id === 'undefined') return null;
  throw new Error(`Unknown method: ${method}`);
}

// The health endpoint is optional scaffolding shared with habr-mcp. A static
// import made a missing sibling directory fatal to a server that does not
// otherwise need it.
if (process.env.T27_HEALTH_PORT) {
  import('../habr-mcp/health.mjs')
    .then(({ serveHealth }) =>
      serveHealth({ name: 't27-mcp', version: VERSION, port: Number(process.env.T27_HEALTH_PORT), tools, extra: { site: SITE } }),
    )
    .catch((e) => process.stderr.write(`t27-mcp: health port requested but unavailable: ${e.message}\n`));
}

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  try {
    const result = await handle(req);
    if (result === null || typeof req.id === 'undefined') return;
    send({ jsonrpc: '2.0', id: req.id, result });
  } catch (e) {
    if (typeof req.id === 'undefined') return;
    send({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: e.message } });
  }
});
