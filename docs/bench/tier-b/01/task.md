Module name: BenchStack

A fixed-capacity stack of signed 16-bit values.

- module-level state: storage for 8 `i16` values and the number of values held (the depth), initially 0.
- `fn reset()`: empty the stack.
- `fn push(v: i16) -> bool`: put `v` on top and return true; when the stack already holds 8 values, change nothing and return false.
- `fn pop() -> i16`: remove and return the top value; when the stack is empty return 0 and change nothing.
- `fn peek() -> i16`: the top value without removing it; 0 when the stack is empty.
- `fn depth() -> u8`: how many values the stack holds.
- `fn is_full() -> bool`: true exactly when the stack holds 8 values.
