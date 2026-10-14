# AGENTS.md: <your workspace>

Every agent reads this before working here. It is the floor: a project's own `AGENTS.md` can add rules but
never relax one. On everything else, the nearest `AGENTS.md` wins.

## Why this workspace exists

Continuity. Every new chat starts from zero. So every project keeps its own resumable state in plain markdown,
in a fixed place and a fixed shape, and any model in any app catches up by reading one file.

## Principles

Adapted from the Karpathy-inspired guidelines at https://github.com/multica-ai/andrej-karpathy-skills.

- Think before changing anything. Don't assume; say what the trade-offs are.
- Simplicity first: the least that solves the problem.
- Surgical changes: touch only what the request is about.
- Say what "done" looks like first, then work until it's checked.

## The file contract

Active projects keep these files at the top of the project folder:

| File | What it's for |
|---|---|
| `_index.md` | State, Next 3 and Decisions. The one file to resume from. |
| `PASTE-ME.md` | A self-contained briefing under 400 words, for chats that can't read files. |
| `LOG.md` | Append-only history, one dated entry per session. |
| `TASKS.md` | Open work, one line each. |
| `AGENTS.md` | How to work in this project: stack, commands, guardrails. |
| `CLAUDE.md` | One line, `@AGENTS.md`, so Claude Code loads the same rules. |

Ideas, paused projects and small script folders keep less: `_index.md` with short Tasks and Log sections
inside it, `PASTE-ME.md`, `AGENTS.md` and `CLAUDE.md`. When an idea becomes active work, it gets the full set.

## The session ritual

**Start.** Read this file, then the project's `_index.md` and `AGENTS.md`, then the last three entries of its
`LOG.md`. Say in one sentence what you believe the current state is, and wait for a confirmation or a
correction before working.

**End, without being asked:**

1. Append a dated entry to `LOG.md`, in the format below.
2. Rewrite State and Next 3 in `_index.md`.
3. Rewrite `PASTE-ME.md`.
4. Update `updated:` in the `_index.md` frontmatter.
5. Add any newly settled decision to Decisions.
6. If files moved, note old and new paths in the workspace's own log.

A session that skips this has failed, whatever else it produced: the next one starts blind.

### Log entries

Every entry starts with a rule and a dated heading, so "read the last three entries" means the same thing to
every model.

```
---

## YYYY-MM-DD: <short title>

- **Did:**
- **Decided:** <and why; the why is the one thing git history can't give back>
- **Broke / found broken:**
- **Left open:**
```

## Privacy

Classify the data, not the folder. The test: if this text leaked, could someone identify a real person, touch
money, log in, or get an employer's internal data? If yes, it's confidential.

| Tier | Rule |
|---|---|
| `confidential` | Never pasted into a hosted chat or uploaded. Summaries carry abstractions only ("about 200 leads reassigned"), never rows, account numbers or personal details. |
| `private` | Hosted models are fine. Nothing goes public. |
| `public` | Meant to be published. |

Confidential projects in this workspace: <list the folders>. Adding one means also adding it to
`.claude/hooks/no-long-numbers.py`, or the hook silently won't protect it.

## Never

- <the things that must never happen here, each with its reason. For example:>
- Delete files. Move them to an archive and log the move, so nothing is lost by accident.
- Write to `<a production repo>`. It's read-only; changes go through its own review.
