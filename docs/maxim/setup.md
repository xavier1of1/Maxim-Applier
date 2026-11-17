# Setup

The complete current instructions are in [Workspace](workspace.md).

~~~powershell
cd "D:\VSC Programs\maxim-apply"
npm run maxim:workspace:install
npm run maxim:workspace:build
npm run maxim:workspace:setup
npm run maxim:workspace
~~~

Prerequisites: Windows, npm, Docker Desktop Linux engine, Rust 1.76+/MSVC;
the app pins Node 24 locally. The launcher prints its actual loopback URL.
Get the sign-in key with `npm run maxim:workspace:key`. Keep it out of chat/Git.

Next: [review candidate intake](reviewed-onboarding.md), configure a model in
Settings if needed, then [evaluate and track applications](application-lifecycle.md).
No external accounts are needed for manual local records. Search uses supported
public company feeds; evaluation/chat needs your own OpenAI model/key.
Review [stage-specific operational inputs](../../roadmap/operational-setup.md)
before authorizing future Gmail/Discord/browser integrations.
