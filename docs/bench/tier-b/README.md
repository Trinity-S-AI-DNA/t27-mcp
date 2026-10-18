# Tier B task set (gHashTag/t27#10066 follow-up)

Ten small `.t27` tasks, harder than tier A: arrays, structs, enums, signed
arithmetic, several functions per module. This directory holds the task set
only. The arms have NOT been run: see "Harness status".

## Layout

Each `NN/` holds:

| File | Role | Visible to the model? |
|---|---|---|
| `task.md` | the statement the model gets (module name, state, function contracts) | yes |
| `ref.t27` | reference solution, 2 own tests | no |
| `oracle.t27` | hidden oracle, 3-4 `test oracle_*` blocks, each starts with `reset()` | no |
| `neg.t27` | negative control: `ref.t27` with exactly one line wrong, 2 own tests that still pass | no |

| NN | Module | Feature mix |
|---|---|---|
| 01 | BenchStack | `[8]i16` array, depth counter, bool results |
| 02 | BenchWindow | 4-sample ring window, sum / max / min |
| 03 | BenchSort6 | `[6]i16`, in-place sort, non-destructive median |
| 04 | BenchVec2 | `struct` with `i16` fields, dot / cross / norm1 |
| 05 | BenchTraffic | `enum` state machine, durations, tick counter |
| 06 | BenchSat8 | `i8` saturating arithmetic via `i16` widening |
| 07 | BenchFold | `enum Op` plus `[6]i16`, fold and argmax |
| 08 | BenchMat2 | `struct Mat2`, multiply, power by repeated multiplication |
| 09 | BenchHist | 8 saturating `u8` buckets |
| 10 | BenchBank | `struct` + `enum` result codes over `[4]Acct` |

## Gate (same as tier A)

A model file passes when, on the lab, with the oracle appended:

1. `t27c test-report` exits 0 on the model file alone;
2. the model file has at least 2 own tests, 0 FAIL, 0 vacuous passes;
3. the combined file (model + oracle) has 0 FAIL, 0 vacuous passes, and
   its test count equals own tests + the oracle's test count;
4. at most 3 attempts per task and arm; a 4th is refused.

Combine rule: drop every `endmodule` line from the model file, then append
the oracle (`cat model.t27 oracle.t27`). The oracle declares no state of its
own; it calls the model's functions.

Arms (as tier A): `mcp` (t27 MCP tools plus corpus read access) versus `plain`
(corpus read access only). Models: Sonnet 5.5 through Agent subagents, and
GLM-4.7-flash through `claude -p` on z.ai at concurrency 1.

Report pass count, tokens, tool calls and cost per passing task, and state the
per-Mtok prices used. Tier A assumed Sonnet at $3 input, $15 output, $0.30
cache read, $3.75 cache write; GLM-4.7-flash is free (notional cost only).

## Validation done (lab, plain `t27c test-report`, 2026-10-18)

- 10 of 10 references pass their own tests and the oracle, 0 vacuous.
- 10 of 10 negative controls pass their own tests (2 of 2, 0 vacuous) and are
  caught by the oracle as a `FAIL`, never a `BLOCKED`:

| NN | One-line fault in `neg.t27` | Oracle tests failing |
|---|---|---|
| 01 | `is_full` is `sp >= 7` | `oracle_stack_refill_after_overflow` |
| 02 | `max4` starts at 0, not the first sample | `oracle_window_all_negative_full` |
| 03 | `median_low` reads `copy[3]` | `oracle_sort6_median_keeps_order` |
| 04 | `norm1` is `a.x + a.y` (no absolute values) | `oracle_vec2_norm1` |
| 05 | Green lasts 3 ticks, not 2 | 4 of 4 traffic oracle tests |
| 06 | `avg_floor` uses `/ 2` (truncates toward zero) | `oracle_sat8_avg_floor` |
| 07 | `argmax` uses `>=` (last tie wins) | `oracle_fold_argmax_ties_and_prefix` |
| 08 | `pow` multiplies once too often (`i < n + 1`) | `oracle_mat2_pow_fibonacci`, `oracle_mat2_pow_zero_and_asymmetric` |
| 09 | `nonempty` counts buckets above 1, not above 0 | `oracle_hist_bucket_edges` |
| 10 | `withdraw` refuses when `bal <= n` (an exact withdrawal fails) | `oracle_bank_deposit_withdraw_rules` |

## Compiler wart found while writing (not filed)

A module-level `var` named `a` makes the generated Zig fail with "function
parameter shadows declaration of 'a'", so any function with a parameter
named `a` is BLOCKED. Task 03's reference names its array `arr` for that
reason. Task statements must not tell the model to call its state `a`.

## Harness status

The tier-A harness was shell and Python scratch written before the
only-t27 rule, so it is not reused. A gate that ships a model file to the
lab, appends the hidden oracle, counts attempts and tallies usage has no
t27 or plain-command route today. What would unblock it is described in the
hand-over note `tier-b-blocked-harness.md` (a `t27c bench-gate` service, a
lab drop point that is not base64-on-argv, a jsonl usage reader). The arms and
the results comment on #10066 wait on that decision.
