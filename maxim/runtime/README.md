# Maxim Domain Boundary

Rust enforces candidate fact types/sensitivity and the retained score-to-tier boundary.
It does not evaluate job fit, approve facts, access files, send requests or execute commands.
Input/output is bounded JSON on stdin/stdout; Node services own authorized transactions.

Build/test: cargo build --locked --manifest-path maxim/runtime/Cargo.toml and cargo test --locked --manifest-path maxim/runtime/Cargo.toml.
The installed Rust 1.76 is supported; no global toolchain update is required.
