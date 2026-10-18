Module name: BenchTraffic

A traffic light as an enum state machine, one call per clock tick.

- Declare `pub enum Light` with exactly the cases `Red`, `Green`, `Yellow` (written `Light.Red` and so on in tests).
- `fn duration(l: Light) -> u8`: how many ticks the light stays in that state: Red 3, Green 2, Yellow 1.
- `fn next(l: Light) -> Light`: the light that follows: Red -> Green -> Yellow -> Red.
- module-level state: the current light, initially Red, and how many ticks it has already spent in it, initially 0.
- `fn reset()`: back to Red with 0 ticks spent.
- `fn current() -> Light`: the current light.
- `fn tick()`: one clock tick. The tick count in the current state increases by 1; when it reaches `duration(current)` the light changes to `next(current)` and the tick count restarts at 0. So after `reset()`, `current()` is Red before the first tick, still Red after ticks 1 and 2, and Green after tick 3.
- `fn ticks_in_state() -> u8`: how many ticks the current light has already spent in its state.
