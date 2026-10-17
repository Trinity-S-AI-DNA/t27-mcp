wasm/ -- how the t27f_view tool's numbers are built

Every number t27f_view draws comes from specs/t27f/reel.t27 in gHashTag/t27
(module T27fReel). Nothing in this directory is a second home for that math:

  reel.zig    generated: t27c gen specs/t27f/reel.t27          (do not edit)
  reel.mjs    generated: t27c gen-js specs/t27f/reel.t27       (do not edit)
  export.zig  hand glue, 38 lines: exports every scalar pub fn of reel.zig
              under its own name with the C calling convention. It names no
              spec function and holds no number.
  reel.wasm   built from export.zig + reel.zig

The bodies run as reel.wasm, because gen-js emits constants only. reel.mjs
supplies the constants (presets, scene names, demo reel tables, style codes).

Rebuild (on the Railway lab, never on the owner's Mac):

  t27c gen    specs/t27f/reel.t27 > reel.zig
  t27c gen-js specs/t27f/reel.t27 > reel.mjs
  zig build-exe export.zig -target wasm32-freestanding -fno-entry -rdynamic \
      -O ReleaseSmall -femit-bin=reel.wasm

-rdynamic is required: without it a -fno-entry wasm exports nothing.

Built with t27c 0.5.2 at gHashTag/t27 57474a4f1 and zig 0.16.0, from
specs/t27f/reel.t27 as of gHashTag/t27 PR #9982.

sha256
  1ec53e9f89801946c7c265049e20b775dbf4d71822bd4c00b262c827a3e76f87  reel.t27 (source)
  1539cc3afa006a04db3735e9f1ec31e47a8af940fb93bcb248c5ac86a489d65f  reel.zig
  82b15801da63a1878cafe4fe8252e552484ca0371b99e5854c580cf45545be10  reel.mjs
  d6f8228954ebcb88f594542f6e405f1bf06e77813c304f98800d67dac9023ae1  export.zig
  30ef7dd30873f4c66fbcabb8548b1d8bf4dc998154e023c7500eafa1c2afd18b  reel.wasm
