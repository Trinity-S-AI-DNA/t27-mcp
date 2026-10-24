// Hand glue: export every pub fn of the t27c-generated Zig modules whose parameters and result are
// integers or bools, under its own name, so a wasm host can call the spec's bodies. It knows no
// spec: it decides nothing and computes nothing. Build: see wasm/BUILD in gHashTag/t27-mcp.
const std = @import("std");

// The wasm has no stderr and no host IO: an assert that fails must trap, not print. These two root
// overrides keep std.debug.print's threaded-IO plumbing out of the freestanding build (reaching it
// once pulls std.posix in and the link fails). The failing Io is never called at runtime -- it only
// gives the fail path something well typed to compile.
pub const std_options_debug_threaded_io: ?*std.Io.Threaded = null;
pub const std_options_debug_io: std.Io = std.Io.failing;

const mods = .{ @import("reel.zig"), @import("deck.zig"), @import("spec_graph_view.zig"), @import("spec_graph_outline.zig") };

fn seen(comptime i: usize, comptime name: []const u8) bool {
    inline for (mods, 0..) |m, k| if (k < i and @hasDecl(m, name)) return true;
    return false;
}

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
    @setEvalBranchQuota(100000);
    for (mods, 0..) |m, i| for (@typeInfo(m).@"struct".decls) |d| {
        if (seen(i, d.name)) continue;
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

// ---- t27f_outline and t27f_graph {path}: the input and output of specs/t27f/spec_graph_export.t27.
// Still glue, still no spec knowledge. The host writes a spec's bytes into gx_src_ptr()..+gx_set_len(n)
// and its path into gx_path_ptr()..+gx_set_path_len(n), then gx_load() runs export_graph and keeps the
// graph in two copies: eg (the exporter's SpecGraph) and vg (the view's own SpecGraph, a distinct Zig
// type with the same fields, since t27c gen inlines the IR into each module). Everything else is a
// getter named after a field of the IR or a layout function of the view; name bytes stay in the source
// buffer, so gx_node_name_ptr/len return the exporter's own slice.
const X = @import("spec_graph_export.zig");
const V = @import("spec_graph_view.zig");
const O = @import("spec_graph_outline.zig");

var src_buf: [2 << 20]u8 = undefined;
var path_buf: [512]u8 = undefined;
var src_len: usize = 0;
var path_len: usize = 0;
var eg: X.SpecGraph = undefined;
var vg: V.SpecGraph = undefined;
var og: O.SpecGraph = undefined;

export fn gx_src_ptr() usize { return @intFromPtr(&src_buf); }
export fn gx_src_cap() u32 { return src_buf.len; }
export fn gx_path_ptr() usize { return @intFromPtr(&path_buf); }
export fn gx_set_len(n: u32) bool { if (n > src_buf.len) return false; src_len = n; return true; }
export fn gx_set_path_len(n: u32) bool { if (n > path_buf.len) return false; path_len = n; return true; }
export fn gx_load() u8 {
    eg = X.export_graph(path_buf[0..path_len], src_buf[0..src_len]);
    inline for (@typeInfo(V.SpecGraph).@"struct".fields) |f| @field(vg, f.name) = @field(eg, f.name);
    inline for (@typeInfo(O.SpecGraph).@"struct".fields) |f| @field(og, f.name) = @field(eg, f.name);
    return X.validate_graph(eg);
}

fn Field(comptime name: []const u8) type {
    const F = @TypeOf(@field(eg, name));
    return switch (@typeInfo(F)) {
        .int => struct { fn get() callconv(.c) F { return @field(eg, name); } },
        .array => |a| struct {
            fn get(i: u32) callconv(.c) a.child { return if (i < a.len) @field(eg, name)[i] else 0; }
            fn ptr(i: u32) callconv(.c) usize { return if (i < a.len) @intFromPtr(@field(eg, name)[i].ptr) else 0; }
            fn len(i: u32) callconv(.c) usize { return if (i < a.len) @field(eg, name)[i].len else 0; }
        },
        else => struct {},
    };
}

fn Layout(comptime f: anytype, comptime outline: bool) type {
    const I = @typeInfo(@TypeOf(f)).@"fn";
    const P = I.params;
    const R = I.return_type.?;
    return switch (P.len) {
        1 => struct { fn c() callconv(.c) R { return f(if (outline) og else vg); } },
        2 => struct { fn c(a: P[1].type.?) callconv(.c) R { return f(if (outline) og else vg, a); } },
        3 => struct { fn c(a: P[1].type.?, b: P[2].type.?) callconv(.c) R { return f(if (outline) og else vg, a, b); } },
        4 => struct { fn c(a: P[1].type.?, b: P[2].type.?, d: P[3].type.?) callconv(.c) R { return f(if (outline) og else vg, a, b, d); } },
        else => @compileError("arity"),
    };
}

comptime {
    for (@typeInfo(X.SpecGraph).@"struct".fields) |f| {
        const F = Field(f.name);
        switch (@typeInfo(f.type)) {
            .int => @export(&F.get, .{ .name = "gx_" ++ f.name }),
            .array => |a| if (scalar(a.child)) {
                @export(&F.get, .{ .name = "gx_" ++ f.name });
            } else {
                @export(&F.ptr, .{ .name = "gx_" ++ f.name ++ "_ptr" });
                @export(&F.len, .{ .name = "gx_" ++ f.name ++ "_len" });
            },
            else => {},
        }
    }
    @setEvalBranchQuota(100000);
    for (@typeInfo(V).@"struct".decls) |d| {
        const v = @field(V, d.name);
        if (@typeInfo(@TypeOf(v)) != .@"fn") continue;
        const I = @typeInfo(@TypeOf(v)).@"fn";
        if (I.params.len < 1 or I.params.len > 4 or I.params[0].type.? != V.SpecGraph or !scalar(I.return_type.?)) continue;
        var ok = true;
        for (I.params[1..]) |p| ok = ok and scalar(p.type.?);
        if (ok) @export(&Layout(v, false).c, .{ .name = "gx_" ++ d.name });
    }
    for (@typeInfo(O).@"struct".decls) |d| {
        const v = @field(O, d.name);
        if (@typeInfo(@TypeOf(v)) != .@"fn") continue;
        const I = @typeInfo(@TypeOf(v)).@"fn";
        if (I.params.len < 1 or I.params.len > 4 or I.params[0].type.? != O.SpecGraph or !scalar(I.return_type.?)) continue;
        var ok = true;
        for (I.params[1..]) |p| ok = ok and scalar(p.type.?);
        if (ok) @export(&Layout(v, true).c, .{ .name = "gx_o_" ++ d.name });
    }
}

// ---- T27F Live: the work graph and the HUD scene of specs/t27f/work_graph.t27 and hud.t27
// (gHashTag/t27#10260, #10262). Still glue, still no spec knowledge. wg_reset starts a graph,
// wg_apply feeds one bus record, hud_build runs hud_scene_of and keeps the scene, and the wg_/hs_
// getters read fields back. The graph lives in work_graph.zig's type; hud.zig carries its own
// splice of the same spec, so hud_build copies the fields across, as gx_load does for the
// exporter and the view.
const WG = @import("work_graph.zig");
const HU = @import("hud.zig");

var wg: WG.WorkGraph = undefined;
var hg: HU.WorkGraph = undefined;
var hs: HU.HudScene = undefined;

export fn wg_reset() void {
    wg = WG.new_graph();
}
export fn wg_apply(kind: u8, from_pid: u64, to_pid: u64, task_no: u32, deliver: u8, reason: u8, seq: u32, spec_id: u32) u8 {
    return WG.apply_event(&wg, .{ .kind = kind, .from_pid = from_pid, .to_pid = to_pid, .task_no = task_no, .deliver = deliver, .reason = reason, .seq = seq, .spec_id = spec_id });
}
export fn wg_nodes() u32 {
    return WG.nodes(&wg);
}
export fn wg_edges() u32 {
    return WG.edges(&wg);
}
export fn wg_node_kind(n: u32) u8 {
    return WG.node_kind_at_pub(&wg, n);
}
export fn wg_node_label(n: u32) u8 {
    return WG.node_label_at(&wg, n);
}
export fn wg_node_id(n: u32) u64 {
    return if (n < wg.node_id.len) wg.node_id[n] else 0;
}
export fn wg_edge_kind(e: u32) u8 {
    return WG.edge_kind_at(&wg, e);
}
export fn wg_edge_label(e: u32) u8 {
    return WG.edge_label_at(&wg, e);
}
export fn wg_edge_from(e: u32) u32 {
    return WG.edge_from_at(&wg, e);
}
export fn wg_edge_to(e: u32) u32 {
    return WG.edge_to_at(&wg, e);
}
export fn hud_build(frame: u64) void {
    inline for (@typeInfo(HU.WorkGraph).@"struct".fields) |f| @field(hg, f.name) = @field(wg, f.name);
    hs = HU.hud_scene_of(&hg, frame);
}
export fn hs_element_count() u32 {
    return hs.element_count;
}
export fn hs_status_bar() u8 {
    return hs.status_bar;
}
export fn hs_status_node_count() u32 {
    return hs.status_node_count;
}
export fn hs_status_frame() u64 {
    return hs.status_frame;
}
export fn hs_card_count() u32 {
    return hs.card_count;
}
export fn hs_card_kind(i: u32) u8 {
    return if (i < hs.card_kind.len) hs.card_kind[i] else 0;
}
export fn hs_card_label(i: u32) u8 {
    return if (i < hs.card_label.len) hs.card_label[i] else 0;
}
