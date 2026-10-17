// Hand glue: export every pub fn of a t27c-generated Zig module whose parameters and result are
// integers or bools, under its own name, so a wasm host can call the spec's bodies. It knows no
// spec: it decides nothing and computes nothing. Build: see wasm/BUILD in gHashTag/t27-mcp.
const m = @import("reel.zig");

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
        else => @compileError("arity"),
    };
}

comptime {
    for (@typeInfo(m).@"struct".decls) |d| {
        const v = @field(m, d.name);
        const T = @TypeOf(v);
        if (@typeInfo(T) != .@"fn") continue;
        const I = @typeInfo(T).@"fn";
        if (I.params.len > 4 or !scalar(I.return_type.?)) continue;
        var ok = true;
        for (I.params) |p| ok = ok and scalar(p.type.?);
        if (ok) @export(&C(v).c, .{ .name = d.name });
    }
}
