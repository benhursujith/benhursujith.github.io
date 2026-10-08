#!/usr/bin/env python3
"""Refuse writes that would put a run of six or more digits (an account, card or ID number) into a
confidential project's summary files.

Claude Code runs this before every Write or Edit (see ../settings.json). The tool call arrives as JSON on
stdin. Exit code 2 blocks the write, and the message on stderr goes back to the agent, so it can abstract the
text and try again. It's a blunt check, and blunt is right for a mistake this costly.

Edit CONFIDENTIAL to list your own confidential project folders. Adding a confidential project means adding
it here too, or this check silently won't apply to it.
"""
import json
import re
import sys

CONFIDENTIAL = ["/finances/", "/clients/"]           # folders whose summaries must stay abstract
SUMMARIES = ("_index.md", "PASTE-ME.md", "LOG.md")   # the files that get pasted, read and shared most
LONG_NUMBER = re.compile(r"\d{6,}")

call = json.load(sys.stdin)
args = call.get("tool_input", {})
path = args.get("file_path", "")
texts = [args.get("content", ""), args.get("new_string", "")]
texts += [edit.get("new_string", "") for edit in args.get("edits", [])]

if any(folder in path for folder in CONFIDENTIAL) and path.endswith(SUMMARIES):
    if any(LONG_NUMBER.search(text or "") for text in texts):
        print(
            f"Refused: this would write a run of six or more digits into {path}. "
            "Confidential summaries carry abstractions only, like 'about 200 leads reassigned'. "
            "Abstract the number and try again.",
            file=sys.stderr,
        )
        sys.exit(2)
