# Operator Guide

Use the [workspace guide](workspace.md) for start/stop/sign-in, private storage,
model configuration and backup/restore.

Daily workflow:

1. Review knowledge in [Candidate](reviewed-onboarding.md).
2. Keep reusable answers in [Answers](answer-memory.md).
3. Add real roles manually or use [Discovery](discovery.md).
4. Create intent, evaluate and prepare/review exact packets in
   [Applications](application-lifecycle.md).
5. Open the posting, complete/submit manually and record actual progress/outcome.

`npm run maxim:workspace` starts the owned web, worker and database.
The launcher normally prints http://127.0.0.1:3010/maxim.
`npm run maxim:workspace:key` reveals the sign-in key locally;
`npm run maxim:workspace:stop` stops the owned stack without deleting data.

The old planner/browser runner and ports 3000/8000 are not this workflow.
Archived pre-S5 guidance is historical, not a fallback.
