// Hand glue: export every pub fn of the t27c-generated Zig modules whose parameters and result are
// integers or bools, under its own name, so a wasm host can call the spec's bodies. It knows no
// spec: it decides nothing and computes nothing. Build: see wasm/BUILD in gHashTag/t27-mcp.
const mods = .{ @import("reel.zig"), @import("deck.zig") };

fn scalar(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .int, .bool => true,
        else => false,
    };
}

fn C(comptime f: anytype) type {
    const I = @typeInfo(@TypeOf(f)).@"fn";
    const P = I.params;
    const R = I.return_type.?;
    return switch (P.len) {
        0 => struct { fn c() callconv(.c) R { return f(); } },
        1 => struct { fn c(a: P[0].type.?) callconv(.c) R { return f(a); } },
        2 => struct { fn c(a: P[0].type.?, b: P[1].type.?) callconv(.c) R { return f(a, b); } },
        3 => struct { fn c(a: P[0].type.?, b: P[1].type.?, d: P[2].type.?) callconv(.c) R { return f(a, b, d); } },
        4 => struct { fn c(a: P[0].type.?, b: P[1].type.?, d: P[2].type.?, e: P[3].type.?) callconv(.c) R { return f(a, b, d, e); } },
        5 => struct { fn c(a: P[0].type.?, b: P[1].type.?, d: P[2].type.?, e: P[3].type.?, g: P[4].type.?) callconv(.c) R { return f(a, b, d, e, g); } },
        else => @compileError("arity"),
    };
}

comptime {
    for (mods, 0..) |m, i| for (@typeInfo(m).@"struct".decls) |d| {
        if (i > 0 and @hasDecl(mods[0], d.name)) continue;
        const v = @field(m, d.name);
        const T = @TypeOf(v);
        if (@typeInfo(T) != .@"fn") continue;
        const I = @typeInfo(T).@"fn";
        if (I.params.len > 5 or !scalar(I.return_type.?)) continue;
        var ok = true;
        for (I.params) |p| ok = ok and scalar(p.type.?);
        if (ok) @export(&C(v).c, .{ .name = d.name });
    };
}
