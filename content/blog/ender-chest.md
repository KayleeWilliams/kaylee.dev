---
title: "Putting my spare computers to work"
description: "How Ender Chest syncs agent config and skills across three machines while one old laptop holds the agent logins, so my agents keep working when I leave."
publishedAt: 2026-11-08
tags:
  - AI
  - tooling
  - open source
draft: false
---
Like a lot of engineers, I own more computers than I use. There's the MacBook I carry, a desktop I game on a few evenings a week, and an old work laptop that spent most of its life closed.

Coding agents gave the spare machines a job. I didn't want to pay $200 a month for a cloud agent provider to run my work on someone else's computer while mine sat idle.

They also gave me a chore. Every machine needed the same skills, the same MCP servers, the same dev environment, and its own set of logins. So I wrote [Ender Chest](https://github.com/KayleeWilliams/ender-chest), a small CLI called `ec`, and I've used it for months to keep all three machines in step.

[Theo](https://x.com/theo) runs a similar setup and explains it in [If you have a Claude sub, watch this](https://youtu.be/D8PikZ1KhUo). When it came out, I described mine:

[https://x.com/kaylee_dev/status/2106130229379092815](https://x.com/kaylee_dev/status/2106130229379092815)

## Drift

The first problem was drift. I'd write a skill on my laptop, start a worktree on my desktop, and find the agent there had never heard of it. An MCP server I added on one machine was missing on the next.

Ender Chest keeps my config in a Git repo. A file called `ender-chest.toml` lists what each machine gets: dotfiles, Brewfiles, setup steps, and plugins. Skills and agent settings sit next to it in `skills/` and `agents/`, and sync installs one set of instructions for Claude Code, Codex, and Grok. `ec sync` pulls the repo and applies it. `ec push` captures what I changed locally, commits it, and pushes it. Third-party skills come from a manifest, so a new machine pulls them from GitHub instead of me copying folders around.

`ec status` checks every machine over Tailscale and SSH:

```text
m5 (here)  current  ec 0.0.4 (d88beef), config 2d517f1
desktop    current  ec 0.0.4 (d88beef), config 2d517f1
m1         current  ec 0.0.4 (d88beef), config 2d517f1

3 of 3 machines current.
```

If one is behind, `ec sync --all` updates it from my laptop.

## Logins

Auth was the harder half. I pay for several agent subscriptions across more than one account. Signing each agent into each account on each machine, then doing it again whenever a session expired, was not something I wanted to keep doing by hand.

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) runs on the old laptop and holds the provider logins. Every other machine points Claude Code, Codex, and Grok at it with one client key. Ender Chest's `cliproxyapi` plugin writes those settings during sync and leaves the rest of each agent's config alone.

MCP servers had the same problem, with an OAuth flow per server per machine. [Executor](https://github.com/UsefulSoftwareCo/executor) now holds every integration and account on that same laptop, and the agents reach it as a single MCP server. I connect an account once and every machine has it.

The keys for both stay out of the repo. `ec secret set` stores them on each machine with `0600` permissions, and `ec push` refuses to commit known credential files.

## Touching grass

The old laptop stays plugged in and awake. When the desktop is off, `ec wol wake` sends a Wake-on-LAN packet through the laptop, waits for the desktop to answer, then unlocks its keyring over SSH.

That means work I start doesn't depend on the computer in my bag. I can head out for a meeting or an event, or lose signal on the Tube, and the agents keep running on a machine at home.

When I flew to San Francisco, I left the desktop on in London and used it the whole time from over 5,000 miles away.

The same machines run automations. When a new error comes in, an agent investigates it and opens a fix, so the first thing I see is a pull request ready to review and merge.

You can see it in my GitHub contributions. They jump in August, the month I started the config repo, and reach a new high in October:

[https://areyougoingexponential.rhys.dev/KayleeWilliams](https://areyougoingexponential.rhys.dev/KayleeWilliams)

## The next limit

Subscriptions and logins aren't what holds me back anymore. RAM is. My machines run out of memory before I run out of agents to start.

I'm considering a dedicated Linux machine that does nothing but run agents. The desktop already runs Linux, but I dual-boot it for games and can't leave it on all day. A new machine would join the same way the others did: install `ec`, clone the config, save two secrets, and run `ec sync`.

Sorry Ram Altman, I need some of the RAM.

[https://x.com/sama/status/2117845542021808438](https://x.com/sama/status/2117845542021808438)

To try it, copy the [starter config](https://github.com/KayleeWilliams/ender-chest/tree/main/examples/config) and run `ec sync`.

The name, obviously, comes from Minecraft. Every ender chest opens the same inventory, no matter where you place it.
