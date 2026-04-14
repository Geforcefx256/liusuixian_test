## 1. Backend Agent Naming

- [x] 1.1 Update `apps/agent-backend/assets/agents/workspace-agent/AGENT.md` so the canonical Agent name is `小曼智能体`
- [x] 1.2 Verify the existing agent detail/bootstrap data path still exposes the renamed Agent without adding frontend hardcoded overrides

## 2. Shared Agent Identity Presentation

- [x] 2.1 Add or refine shared Agent identity styles in `apps/web/src/styles.css` for the badge or icon, title, subtitle, status, and Agent bar surface
- [x] 2.2 Update `apps/web/src/components/workbench/HomeStage.vue` to use the shared Agent identity treatment aligned with `index-v10.html`
- [x] 2.3 Update `apps/web/src/components/workbench/ConversationPane.vue` to strengthen the existing Agent bar instead of introducing a second stacked session title bar

## 3. Surface Consistency

- [x] 3.1 Update `apps/web/src/components/workbench/WorkspaceContextPane.vue` to use the same backend-driven Agent title priority as the home stage and active session surfaces
- [x] 3.2 Adjust `apps/web/src/components/workbench/WorkbenchShell.vue` only as needed to keep the workbench shell visually consistent with the aligned Agent identity language
- [x] 3.3 Verify the home stage, active session, and workspace context panel all display `小曼智能体` consistently and that no session, upload, or prompt flow behavior changed
