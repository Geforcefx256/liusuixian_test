# Skill Retention Log Search

```bash
pnpm logs:skill-retention
pnpm logs:skill-retention -- --session <session-id>
pnpm logs:skill-retention -- --session <session-id> --skill openspec-apply-change
```

The script scans `apps/agent-backend/data/logs/<date>/runtime.jsonl` and focuses on:

- `skill.retention.extracted`
- `skill.retention.injected`
- `skill.retention.skipped`
- `context.compaction`
- `post_context_manager`
