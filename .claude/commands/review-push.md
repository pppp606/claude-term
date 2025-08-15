---
description: Review unpushed commits and approve/reject for push [/review-push]
---

## Your task

Please execute the `/review-push` command in the connected claude-term IDE server to:

1. Review all unpushed commits with beautiful diff display using `less` pager
2. Show commit list and file changes with Delta syntax highlighting  
3. Allow user to approve (y) or reject (n) the commits for push

The command will:
- Display unpushed commits in a scrollable `less` interface
- Show detailed file diffs with syntax highlighting
- Wait for user approval (y/n) after review
- If approved: safely push to remote repository
- If rejected: undo all unpushed commits while preserving working directory changes

Simply type `/review-push` or `/rp` in the IDE server terminal.