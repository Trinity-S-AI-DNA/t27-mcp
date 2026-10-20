# AGENTS.md

## Swarm focus: T27 OS and its self-improvement (owner, 2026-10-20)

Every bee, lane and the Queen puts its capacity into T27 OS and the loop that improves it, until the owner says otherwise.

- **What T27 OS is:** the instrument panel through which the project is worked on and watched, written in `.t27` and built by `t27b`: 27 petals = 27 tools `t27<letter>`, each page 100% widgets, every widget carrying its pinned agents, an own agent chat on every page, GOD MODE evolution, one UI for desktop, site and FPGA. The rules and the plan live in gHashTag/t27: `AGENTS.md` (section "T27 OS") and `.claude/skills/t27os/SKILL.md`.
- **Epics:** gHashTag/t27#11037 (T27 OS), gHashTag/t27#11275 (the panel), gHashTag/t27#11326 (T27 OS on the FPGA, built by t27b), gHashTag/t27#11315 (release and self-update).
- **How to pick work:** take the next gap the Queen board shows (`specs/t27os/evolve.t27` order: red master, blocked domain, stale seal, unowned paths, a letter with no instrument, a spec no widget shows), or an open 4-heading issue under those epics. One lane per letter; never more lanes than the kernel's agent cap for the machine (`specs/t27os/kernel.t27`).
- **Laws do not change:** logic only in `.t27` (generated targets plus thin glue), DRY, tests and seals, `Closes #N`, verify locally and land through our own git (golden chain, one batched GitHub push), no secrets, English only, matte glass everywhere in the UI, numbers only with the command that measured them.
- **Self-improvement:** every change should leave the system better at improving itself: record what was learned (experience log), and turn a fix that recurs into a rule, a test or a spec.
- **In this repository:** the MCP tools become command buttons in the letter consoles of T27 OS; tool schemas stay in gHashTag/t27 `specs/t27mcp`.

