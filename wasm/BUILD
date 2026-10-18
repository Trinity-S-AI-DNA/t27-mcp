wasm/ -- how the t27f_view tool's numbers are built

Every number t27f_view draws comes from two specs in gHashTag/t27:
specs/t27f/reel.t27 (module T27fReel: the map, the camera, the timeline) and
specs/t27f/deck.t27 (module T27fDeck: the default slide look). Every number
t27f_graph draws comes from specs/t27f/spec_graph_view.t27 (the T27F graph
view); t27c gen inlines the spec_graph and ui_plan items it uses. Every node and
edge of t27f_outline, and of t27f_graph {path}, comes from
specs/t27f/spec_graph_export.t27 (the exact-only exporter). Nothing in this
directory is a second home for that math:

  reel.zig    generated: t27c gen specs/t27f/reel.t27          (do not edit)
  deck.zig    generated: t27c gen specs/t27f/deck.t27          (do not edit)
  reel.mjs    generated: t27c gen-js specs/t27f/reel.t27       (do not edit)
  deck.mjs    generated: t27c gen-js specs/t27f/deck.t27       (do not edit)
  spec_graph_view.zig, spec_graph_view.mjs
              generated: t27c gen / gen-js specs/t27f/spec_graph_view.t27
  spec_graph_export.zig, spec_graph_export.mjs
              generated: t27c gen / gen-js specs/t27f/spec_graph_export.t27
  spec_graph_outline.zig, spec_graph_outline.mjs
              generated: t27c gen / gen-js specs/t27f/spec_graph_outline.t27
  export.zig  hand glue, 138 lines. The first 46 lines export every scalar pub fn of
              reel.zig, deck.zig, spec_graph_view.zig and spec_graph_outline.zig (up to five
              parameters) under its
              own name with the C calling convention. deck.zig inlines what it imports from
              reel (half_height), so a name an earlier module already has is
              exported once, from the first. The comptime walk over four
              modules needs a raised eval branch quota. It names no spec function and holds
              no number. The other 92 lines are the exporter glue, described below.
  t27f.wasm   built from export.zig + reel.zig + deck.zig + spec_graph_view.zig
              + spec_graph_export.zig + spec_graph_outline.zig
  ../graph.mjs  hand host I/O, 57 lines: writes the source bytes into wasm memory, reads
              values back through the gx_ exports and fills the `{}` marks of the
              templates in spec_graph_outline.mjs (OUTLINE_TEXT, REFUSAL_TEXT), left to
              right. Which template, which facts print, how a span prints and which tests
              call a fn are answers of t27 functions (refusal_index, shows_in_outline,
              span_is_range, gx_o_tested_by_count / gx_o_tested_by_of); the host loops over
              nodes and edges and chooses nothing.

The bodies run as t27f.wasm, because gen-js emits constants only. reel.mjs and
deck.mjs supply the constants (presets, regions, type sizes, palette, scene
names, demo reel tables, style codes). ../deck-view.mjs draws the slide and
../server.mjs the plain map; both only write SVG.

Rebuild (on the Railway lab, never on the owner's Mac): the rule is specs/t27f/build.t27 in gHashTag/t27
(#10229): build again only when the closure of the exporter specs, the zig version, the t27c binary or
export.zig changed, else reuse. Its `tri t27f build` glue is parked (the foreign-budget gate refuses new
hand-written Rust), so until it lands run the commands below from specs/t27f/ and write t27f.build:

  t27c gen    reel.t27 > reel.zig
  t27c gen    deck.t27 > deck.zig
  t27c gen-js reel.t27 > reel.mjs
  t27c gen-js deck.t27 > deck.mjs
  t27c gen    spec_graph_view.t27 > spec_graph_view.zig
  t27c gen-js spec_graph_view.t27 > spec_graph_view.mjs
  t27c gen    spec_graph_export.t27 > spec_graph_export.zig
  t27c gen-js spec_graph_export.t27 > spec_graph_export.mjs
  t27c gen    spec_graph_outline.t27 > spec_graph_outline.zig
  t27c gen-js spec_graph_outline.t27 > spec_graph_outline.mjs
  zig build-exe export.zig -target wasm32-freestanding -fno-entry -rdynamic \
      -O ReleaseSmall -femit-bin=t27f.wasm

-rdynamic is required: without it a -fno-entry wasm exports nothing.

Built with t27c 0.5.2 at gHashTag/t27 57474a4f1 and zig 0.16.0, from
reel.t27 as of gHashTag/t27 master (PR #9984) and deck.t27 as of PR #10036
(the backdrop is brand black: BACKDROP 0x000000, aurora at zero strength;
before it, #9992 STILL_CARD_ALPHA). deck.t27 at #10036: 16/16 tests pass,
0 vacuous, on the lab; t27b 16 passed. spec_graph_view.t27 as of
gHashTag/t27 950631580 (landed by #10059): 8/8 tests, 0 vacuous; t27b 8
passed, 4 invariants held.

The exporter (t27f_outline, t27f_graph {path}) was added later. spec_graph.t27,
spec_graph_view.t27 and spec_graph_export.t27 were regenerated from gHashTag/t27 master
290ff17df, after #10173 (exporter) and #10181 (SpecGraph holds up to 192 nodes and 254
edges), with t27c 0.5.2 and zig 0.16.0 on the Railway lab. The sha256 of the sources below
were checked against that master. t27c test-report: spec_graph_export 20 of 20 pass, 0
vacuous; spec_graph_view 9 of 9, 0 vacuous; spec_graph 14 of 14, 0 vacuous.

spec_graph_export.t27 is a deterministic byte scanner: export_graph(path, src) returns a
SpecGraph and validate_graph returns the verdict. It emits only EXACT nodes (module, const,
fn, test, invariant, bench, use) and EXACT edges (calls, uses, constrains), never derived,
suggested or unknown ones.

The outline wording and decisions come from specs/t27f/spec_graph_outline.t27 (gHashTag/t27#10200,
PR #10202): OUTLINE_TEXT and REFUSAL_TEXT (templates with `{}` marks, the order of the marks is in
the spec's comments), shows_in_outline, span_is_range, refusal_index, and the tested_by view of
exact calls edges (tested_by_count, tested_by_of). t27c check 0 errors; t27c test-report 8 of 8
pass, 0 vacuous, on the Railway lab. The source was generated from the branch t27f/outline-spec of
gHashTag/t27 (head d1d8d74fa, on master 2d358a708). The outline spec carries its own small copy
of the tested_by rule until the derive spec (gHashTag/t27#10198) lands.

spec_graph_export.zig, spec_graph_view.zig and spec_graph_outline.zig each carry their own
SpecGraph type, because t27c gen inlines the items a module uses. The glue copies the graph from
the exporter's type into the other two field by field with `inline for`.

Glue in export.zig (the 92 added lines; no spec logic):
  - an input buffer: gx_src_ptr and gx_src_cap (2 MiB; the biggest spec in specs/ is
    1,364,985 bytes) and gx_path_ptr (512 bytes), with the setters gx_set_len and
    gx_set_path_len. The host writes the UTF-8 bytes there.
  - gx_load(): runs export_graph on the buffers, copies the graph, returns the verdict.
  - scalar getters, one per SpecGraph field (gx_<field>; an out-of-range index reads 0),
    a gx_view_<fn> wrapper for each scalar view_* fn of spec_graph_view.zig and a gx_o_<fn>
    wrapper for each scalar fn of spec_graph_outline.zig that takes a graph, each bound to the
    loaded graph.
  - how names (strings) come back: gx_node_name_ptr(i) and gx_node_name_len(i) return a
    pointer and a length into the source buffer. The host decodes those bytes from wasm
    memory; a name is a slice of the source, never a copy.
Host side, ../graph.mjs: byte input and output only, see the list above. It still loops over
nodes and edges and names a node kind, edge kind, label or verdict from the generated constants
of spec_graph_view.mjs (those name tables are not emitted by gen-js).

The build record is t27f.build, written by the build rule above: the `#` lines hold the inputs (closure digest,
zig version, t27c sha256) and every other line is `<sha256>  <file>` for export.zig and each generated file.
It is the only list of checksums for the T27F wasm; check it with `npm run check:t27f`. The hand-pasted list
that stood here drifted from the trinity copy (the wasm there was 7b2a0f0c, this one deedd9c1), so there is
none now. The spec_graph_view.t27 colours changed on master since the old build (a dark theme); this build
has them, as the trinity copy already did.

t27_check (gHashTag/t27#10073, epic #10066)

  explorer.wasm      the bootstrap parser and typechecker as wasm: gHashTag/t27
                     bindings/wasm-explorer built for wasm32-unknown-unknown at
                     gHashTag/t27 063da049b and copied unchanged. It holds no verdict of
                     its own; ../check.mjs reads its JSON.
  check_hints.wasm   generated from specs/t27mcp/check_hints.t27 (module T27mcpCheckHints)
                     by the C route, which needs no hand glue: a `string` parameter
                     arrives as a NUL-terminated `const char*`.
  check_hints.mjs    generated: t27c gen-js specs/t27mcp/check_hints.t27 (HINTS, codes)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/check_hints.t27 > check_hints.c
  t27c gen-js specs/t27mcp/check_hints.t27 > check_hints.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry \
      -Wl,--gc-sections -Wl,--export=hint_code -Wl,--export=line_of \
      -o check_hints.wasm check_hints.c

A caller runs `_initialize()` once, then passes a message as a NUL-terminated string in
the instance's memory. t27c 0.5.2, zig 0.16.0. check_hints.t27: 13 of 13 tests pass, 0
vacuous; with the cast rule's key mutated the cast test fails (negative control).

sha256
  a7cf4d3a1641f1eac295c20f8880b592b5fce62e8774aae46e466e50fffb77df  check_hints.t27 (source)
  7d6e4269a1683b46628b5f78bc15493874f516423f7a0a4c66cf56a9de47a7c2  check_hints.mjs
  0c91244b6cb73d47237eab89302ef4ce0160f4efe093cc4021280137ca722697  check_hints.wasm
  c277e0a9b736c0cbab72ae6e3193dadc656885ba8e500484a78dcd645218022a  explorer.wasm

t27_examples (gHashTag/t27#10081, epic #10066)

  examples.wasm        generated from specs/t27mcp/examples.t27 (module T27mcpExamples)
                       by the C route: topic_code(string) -> u32 and pick(u32, u32) -> u32.
                       find and has come from specs/t27mcp/check_hints.t27 by `use`; gen-c
                       inlines their bodies, so examples.c alone is enough.
  examples_table.mjs   generated: t27c gen-js specs/t27mcp/examples.t27 (PIN, TOPICS, and the
                       row tables EX_PATH, EX_FROM, EX_TO, EX_MODULE, EX_USE, EX_FOOTER, EX_WHY)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/examples.t27 > examples.c
  t27c gen-js specs/t27mcp/examples.t27 > examples_table.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry \
      -Wl,--gc-sections -Wl,--export=topic_code -Wl,--export=pick \
      -o examples.wasm examples.c

../examples.mjs fetches a row's file at PIN (gHashTag/t27 a18d7ee14a99), cuts the lines and
prints them. t27c 0.5.2, zig 0.16.0. examples.t27: 8 of 8 tests pass, 0 vacuous; with one row
widened past 40 lines the row test fails (negative control). Every row's slice was run with
`t27c test-report` at PIN: parse and typecheck clean and, where it has tests, all passing; the
reset_sync slice has none.

sha256
  cf6d4d628614b3995575d46a8e4cc54d3d2c4ada731212f29bcba2117c5b750c  examples.t27 (source)
  26462aa3ec863a43b1fd2f82cf9484c9d664e28d8e3fb0a023e05217f627319b  examples_table.mjs
  1f6364dcd0cc182fdd3e3e892e86fdf64b7d35e3300e1297862b52ced64f6b48  examples.wasm

t27_spec brief mode and whyFailing (gHashTag/t27 issue, epic #10066)

  spec_brief.wasm   generated from specs/t27mcp/spec_brief.t27 (module T27mcpSpecBrief)
                    by the C route: why_mask(u32 x5) -> u32, a bit set of failure reasons.
  spec_brief.mjs    generated: t27c gen-js specs/t27mcp/spec_brief.t27 (BRIEF_FIELDS, ONE_FIELDS,
                    W_* bits, WHY_TEXT templates)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/spec_brief.t27 > spec_brief.c
  t27c gen-js specs/t27mcp/spec_brief.t27 > spec_brief.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry -Wl,--gc-sections \
      -Wl,--export=why_mask -o spec_brief.wasm spec_brief.c

../brief.mjs copies the spec's field lists out of a manifest row and fills the `{}` of the
reason templates. t27c 0.5.2, zig 0.16.0. spec_brief.t27: 5 of 5 tests pass, 0 vacuous; with
the not-parsed test inverted three tests fail (negative control). The reasons agree with the
JavaScript they replaced on all 2402 manifest specs (113 failing, 0 differences).

sha256
  21a9c9775f85f185f71dbf36fed8b1bf1b9903fc14f7eba2c57a45457d1f09bd  spec_brief.t27 (source)
  66bb16ab09ed795ce0f588b183fba9002384af6eca1df45cc842ed9ccae52c32  spec_brief.mjs
  316e8b14123da9e80eaf9861cc14ab3c7d3595a65978dd2a9645aa02a6732833  spec_brief.wasm

t27_find (gHashTag/t27 issue, epic #10066)

  find.wasm         generated from specs/t27mcp/find.t27 (module T27mcpFind, uses t27mcp::check_hints)
                    by the C route: verdict(intent, name, path, tags) -> u32 and
                    rank_key(intent, name, path, tags, lines) -> u32 (0 unless a hit)
  find_table.mjs    generated: t27c gen-js specs/t27mcp/find.t27 (verdict codes, HIT_NOTE,
                    MISS_NOTE, EMPTY_NOTE, LIMIT, STOPS, ALT_FROM, ALT_TO)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/find.t27 > find.c
  t27c gen-js specs/t27mcp/find.t27 > find_table.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry -Wl,--gc-sections \
      -Wl,--export=verdict -Wl,--export=rank_key -o find.wasm find.c

../find.mjs writes one manifest row into the instance memory per call and sorts by the returned
key. t27c 0.5.2, zig 0.16.0, gHashTag/t27 0d6c3d3a8415 (find.t27 not yet on master at build time).
find.t27: 13 of 13 tests pass, 0 vacuous. Negative controls: removing the covers() check fails 7
tests; loosening the coverage ratio fails 2; dropping the name-half rule fails 1; matching inside a
word instead of at a token start fails 1; treating numbers as noise again fails 2. dupe_scan --like: nothing in find.t27 is written
elsewhere (the whole-repo run fails on master's own byte_sum duplicate, identical with and
without find.t27).

sha256
  bc104b21cd349cc1d0674cca55d778eed3fafabc8d1a9a27f9b81c82a26c947f  find.t27 (source)
  51043849996d40633099f1f2b6d9960f6eccea2b7e8f21031265965c5656ff1d  find_table.mjs
  82b64bde50ec3ec42729b1d88b7b41525372c5fbcf39f02876bdb98a7e063e3a  find.wasm

T27F hot reload (gHashTag/t27#10232, gHashTag/t27-mcp#15)

  hot.wasm   generated from specs/t27f/hot.t27 (module T27fHot) by the C route: hot_decision(bool x4),
             hot_wait_ms(u32, u32), hot_ready(u32, u32), hot_take(u32), hot_emits(u8, bool), hot_cache(u8),
             hot_from_reuse(u8), digest_ok(u32), hot_key_len(). 490 bytes. gen-c inlines what hot.t27
             uses from verified::reuse, verified::seal_identity and verified::watch.
  hot.mjs    generated: t27c gen-js specs/t27f/hot.t27 (KEY_SEP, HOT_* codes, HOT_EVENT, HOT_FIELDS,
             HOT_DECISION_NAMES, HOT_CACHE_NAMES, and the constants it imports)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27f/hot.t27 > hot.c
  t27c gen-js specs/t27f/hot.t27 > hot.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry -Wl,--gc-sections \
      -Wl,--export=hot_decision -Wl,--export=hot_wait_ms -Wl,--export=hot_ready -Wl,--export=hot_take \
      -Wl,--export=hot_emits -Wl,--export=hot_cache -Wl,--export=hot_from_reuse -Wl,--export=digest_ok \
      -Wl,--export=hot_key_len -o hot.wasm hot.c

A caller runs `_initialize()` once. ../graph.mjs hashes the spec bytes and wasm/t27f.wasm (sha256, hex),
asks hot_decision whether the last export of a path is reusable, and keeps results while it says so; it holds
no time limit and no rule. t27c 0.5.2, zig 0.16.0, gHashTag/t27 fdb6b28dd plus PR #10235 (hot.t27 not on
master at build time). hot.t27: 11 of 11 tests pass, 3 invariants, 0 vacuous; negative controls: inverting
the replay branch of hot_emits fails a test, raising the transport allowance to 90 ms stops the budget
invariant from compiling.

sha256
  a2ea398b37bd4d85e279b69a7e3d12d7944a2f849a2d231db24973f5731d557b  hot.t27 (source)
  3e03cf2d4e9bd5c7ec5452b9434e26c9ff7b9aaeada9ea0979f77f727c0474b8  hot.mjs
  e271aa16b9b7afd9f79dac114bd043be957658f108f4a0a6438f6c074033b32a  hot.wasm

t27_dashboard (epic gHashTag/t27#10066)
  dashboard.wasm        generated from specs/t27mcp/dashboard.t27 (module T27mcpDashboard) by the C
                        route: worst, health_tone, calls_tone, reply_tone, next_step -> u32
  dashboard_table.mjs   generated: t27c gen-js specs/t27mcp/dashboard.t27 (grades, thresholds,
                        NEXT_TEXT, UNKNOWN_TEXT and the page templates)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/dashboard.t27 > dashboard.c
  t27c gen-js specs/t27mcp/dashboard.t27 > dashboard_table.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry -Wl,--gc-sections \
      -Wl,--export=worst -Wl,--export=health_tone -Wl,--export=calls_tone \
      -Wl,--export=reply_tone -Wl,--export=next_step -o dashboard.wasm dashboard.c

../dashboard.mjs counts calls per tool and fills the templates; the grades and the next step come
from the wasm. t27c 0.5.2, zig 0.16.0, gHashTag/t27 5d45445e0 (dashboard.t27 not on master at build
time). dashboard.t27: 8 of 8 tests pass, 0 vacuous. Negative controls, each caught: worst() returning
the milder grade fails 2 tests; the 5-in-100 boundary made exclusive fails 1; an empty manifest read
as ok fails 1; a failed call left ungraded fails 1; inclusive reply thresholds fail 1; next_step()
putting size before a failed call fails 1.

sha256
  f271acdb3ece4eddef3dae5251350780f3ce4e470f57a919775e742a78906eef  dashboard.t27 (source)
  450af040b0c32dbd596498089cfd50ff75e8eb613efe63a440070fbf58c10798  dashboard.wasm
  5db0db9569d38a704674f0950fd66e7b63c5029fb900b555f1c86cb741e9944e  dashboard_table.mjs

One service: which home owns a tool name, what the one registry admits, who sees the mounted t27 tools
(gHashTag/t27#10483, spec in #10484)
  service.wasm          generated from specs/t27mcp/service.t27 (module T27mcpService) by the C route:
                        admit, home_of, local_serves, t27_visible, name_ok
  service_table.mjs     generated: t27c gen-js specs/t27mcp/service.t27 (homes, T27_PREFIXES, NAME_MAX,
                        admit answers and ADMIT_TEXT, caller scopes, CODER_TOOLS)

Rebuild on the Railway lab, never on the owner's Mac:

  t27c gen-c  specs/t27mcp/service.t27 > service.c
  t27c gen-js specs/t27mcp/service.t27 > service_table.mjs
  zig cc -target wasm32-wasi -Os -s -mexec-model=reactor -Wl,--no-entry -Wl,--gc-sections \
      -Wl,--export=admit -Wl,--export=local_serves -Wl,--export=t27_visible \
      -Wl,--export=home_of -Wl,--export=name_ok -o service.wasm service.c

../service.mjs writes a name into the instance's memory and calls the wasm; server.mjs keeps the tools
local_serves() accepts (the t27 names), so the seven tg_* forwarders are gone from this server and answer at
TRI CLAW's /mcp, the one endpoint. TRI CLAW imports service.mjs and server.mjs (`tools`, `call`) to mount the
t27 tools through admit(). t27c 0.5.2 (built from gHashTag/t27 master), zig 0.16.0. service.t27: 9 of 9 tests
pass, 0 vacuous; negative controls: t27ai, t2_ and a bare t27/t27f are not t27 names; a TRI CLAW tool under a
t27 name is refused; an empty, upper-case, spaced, dashed or 65-character name is refused on either side.

sha256
  3d7957837be8ac3de14b18ce1c0ecdde805f3f71d4d801b62d476b2e82f4a1ae  service.t27 (source, t27 #10484 @ 34acfcb1c)
  e1807a3b6568e974f7af59ca7b9e0a7dc4b2431e215709bbfd37f2bbf49e08e4  service.wasm
  e371cfea58e4317947bcb1655253e6840ead69042425ac598f07cba16caa4fd5  service_table.mjs
