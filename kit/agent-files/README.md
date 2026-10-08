# Agent files: a starter kit

The files behind three notes on working with AI agents, ready to copy:
[instruction files](https://benhursujith.github.io/writing/instruction-files.html),
[one file to resume any project](https://benhursujith.github.io/writing/context.html) and
[memory that outlives the chat](https://benhursujith.github.io/writing/memory.html).

They're plain markdown. Any agent that reads `AGENTS.md` can use them. The `.claude/` folder adds two slash
commands and two hooks for Claude Code.

## What's here

```
AGENTS.md                  root rules: the floor every project inherits
CLAUDE.md                  one line, @AGENTS.md, so Claude Code loads the same rules
.claude/
  settings.json            permission rules and two hooks
  commands/session-start.md   /session-start: read, then say the state in one sentence
  commands/session-end.md     /session-end: log, state, next 3, briefing
  hooks/no-long-numbers.py    refuses long digit runs in confidential summaries
project-template/
  AGENTS.md                stack, commands, guardrails, what to read first
  CLAUDE.md                @AGENTS.md
  _index.md                state, next 3, decisions: the one file to resume from
  PASTE-ME.md              a briefing under 400 words, for chats that can't read files
  LOG.md                   append-only history, one fixed shape per entry
  TASKS.md                 open work, one line each
```

## Use it

1. Put `AGENTS.md`, `CLAUDE.md` and `.claude/` at the top of your workspace. Fill in the parts in angle brackets.
2. For each project, copy `project-template/` into the project folder and fill it in. Small projects and ideas
   can skip `LOG.md` and `TASKS.md` and keep short Tasks and Log sections inside `_index.md` instead.
3. If a project holds confidential data, list its folder in `.claude/hooks/no-long-numbers.py` and in the
   privacy section of `AGENTS.md`. Adding a confidential project means editing both.
4. Start sessions with `/session-start` and end them with `/session-end`.

The hook needs `python3`. Everything else is markdown.
