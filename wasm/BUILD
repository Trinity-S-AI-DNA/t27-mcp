wasm/ -- how the t27f_view tool's numbers are built

Every number t27f_view draws comes from two specs in gHashTag/t27:
specs/t27f/reel.t27 (module T27fReel: the map, the camera, the timeline) and
specs/t27f/deck.t27 (module T27fDeck: the default slide look). Every number
t27f_graph draws comes from specs/t27f/spec_graph_view.t27 (the T27F graph
view); t27c gen inlines the spec_graph and ui_plan items it uses. Nothing in this
directory is a second home for that math:

  reel.zig    generated: t27c gen specs/t27f/reel.t27          (do not edit)
  deck.zig    generated: t27c gen specs/t27f/deck.t27          (do not edit)
  reel.mjs    generated: t27c gen-js specs/t27f/reel.t27       (do not edit)
  deck.mjs    generated: t27c gen-js specs/t27f/deck.t27       (do not edit)
  spec_graph_view.zig, spec_graph_view.mjs
              generated: t27c gen / gen-js specs/t27f/spec_graph_view.t27
  export.zig  hand glue, 46 lines: exports every scalar pub fn of reel.zig,
              deck.zig and spec_graph_view.zig (up to five parameters) under its own name with
              the C calling convention. deck.zig inlines what it imports from
              reel (half_height), so a name an earlier module already has is
              exported once, from the first. The comptime walk over three
              modules needs a raised eval branch quota. It names no spec function and holds no number.
  t27f.wasm   built from export.zig + reel.zig + deck.zig + spec_graph_view.zig

The bodies run as t27f.wasm, because gen-js emits constants only. reel.mjs and
deck.mjs supply the constants (presets, regions, type sizes, palette, scene
names, demo reel tables, style codes). ../deck-view.mjs draws the slide and
../server.mjs the plain map; both only write SVG.

Rebuild (on the Railway lab, never on the owner's Mac), from specs/t27f/:

  t27c gen    reel.t27 > reel.zig
  t27c gen    deck.t27 > deck.zig
  t27c gen-js reel.t27 > reel.mjs
  t27c gen-js deck.t27 > deck.mjs
  t27c gen    spec_graph_view.t27 > spec_graph_view.zig
  t27c gen-js spec_graph_view.t27 > spec_graph_view.mjs
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

sha256
  c47b21cea1d7169da6528e321cf2d2c513d3f552c0cd04fe9d37bbd5314ccacf  reel.t27 (source)
  bd8ef9fc155365c805ba716d97155bed1e4017c378dbc335e252bcb244512147  deck.t27 (source)
  997f3fc1d04e78ef3c8681c7b0b726d75341cc96928710771bca279cbd1184ba  reel.zig
  b7e1efaba309134633cd13cafe5515c0eab1ae403c229d0fca6ae3ea1dafe00c  deck.zig
  4dc1a0db9968c7a74495b499c480c2093425f653d49265d2f21c83f24e1835ac  reel.mjs
  5a060aa5777ae6f7ff0317da0c86551410a1ab87e179ad2f8bc75ba08c2c2f7c  deck.mjs
  54ad20408cb50a1f4fbe18981019f7ba4f13b87fa7f6940449e38b4479bf35e6  spec_graph_view.t27 (source)
  92c1f60e44c3acb90a42481990d3f95400b7283549fc95d4bac4ac917edac0b1  spec_graph_view.zig
  18756722b37160ffa7dd021b4bcf02485dccf1506e9b085e6a36d017d9d6911b  spec_graph_view.mjs
  e9757024442a6723ab9b97fe32b958b8d6b755b1d3d08337d8e3fb04cfe2a140  export.zig
  950948f93497c97dc5d3da16155a2af00946717308aaedf001fa3755b95a783f  t27f.wasm

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
