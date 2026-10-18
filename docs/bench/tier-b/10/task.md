Module name: BenchBank

A tiny bank of 4 accounts, with a result enum for every operation.

- Declare `pub struct Acct` with fields `bal: i32` and `frozen: bool`.
- Declare `pub enum Res` with exactly the cases `Ok`, `NoAccount`, `SameAccount`, `Frozen`, `Insufficient` (written `Res.Ok` and so on in tests).
- module-level state: 4 accounts, numbered 0..3, each with balance 0 and not frozen at the start.
- `fn reset()`: every account back to balance 0, not frozen.
- `fn balance(i: u8) -> i32`: the balance of account `i` (assume `i < 4`).
- `fn freeze(i: u8)` and `fn unfreeze(i: u8)`: set or clear the frozen flag of account `i` (assume `i < 4`).
- `fn deposit(i: u8, n: i32) -> Res`: add `n` (assume `n > 0`) to account `i`. `NoAccount` when `i >= 4`; `Frozen` when the account is frozen; otherwise `Ok`.
- `fn withdraw(i: u8, n: i32) -> Res`: subtract `n` (assume `n > 0`) from account `i`. Checks in this order: `NoAccount` when `i >= 4`, `Frozen` when frozen, `Insufficient` when the balance is below `n` (withdrawing exactly the balance is fine), otherwise `Ok`. A failing call changes nothing.
- `fn transfer(from: u8, to: u8, n: i32) -> Res`: move `n` (assume `n > 0`). Checks in this order: `NoAccount` when `from >= 4` or `to >= 4`, `SameAccount` when `from == to`, `Frozen` when either account is frozen, `Insufficient` when `from` holds less than `n`, otherwise `Ok`. A failing call changes nothing.
- `fn total() -> i32`: the sum of all four balances.
