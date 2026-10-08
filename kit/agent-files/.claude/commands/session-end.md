---
description: End-of-session ritual. Append the log; rewrite State, Next 3 and the briefing; update the date.
---

For the current project (the nearest folder above the working directory that contains an `_index.md`), do
every step. If a step doesn't apply, say so and carry on.

1. Append a dated entry to `LOG.md` (or the Log section of `_index.md` for a small project):

   ```
   ---

   ## YYYY-MM-DD: <short title of what happened>

   - **Did:**
   - **Decided:** <and why>
   - **Broke / found broken:**
   - **Left open:**
   ```

2. Rewrite `## State (as of YYYY-MM-DD)` in `_index.md` so it says what is true now.
3. Rewrite `## Next 3`: the three smallest actions that resume the work from a cold start.
4. Rewrite `PASTE-ME.md`. Under 400 words, and nothing confidential.
5. Update `updated:` in the `_index.md` frontmatter to today.
6. Add any newly settled decision to `## Decisions`, with its reason.
7. If files moved, note old and new paths in the workspace's own log.

Then confirm each step with a tick, or "skipped because …".
