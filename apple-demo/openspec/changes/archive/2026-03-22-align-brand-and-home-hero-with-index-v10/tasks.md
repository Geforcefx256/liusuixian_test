## 1. Shared icon and visual tokens

- [x] 1.1 Update `apps/web/src/styles.css` so the shared brand and Agent icon treatments use the `index-v10.html` `logo-icon` / `icon-svg` language and align with the lighter header spacing
- [x] 1.2 Confirm the shared style changes stay scoped to the workbench brand and home hero surfaces without regressing unrelated conversation or workspace elements

## 2. Align the header and home hero

- [x] 2.1 Update `apps/web/src/components/workbench/WorkbenchShell.vue` so the top-left brand block renders as a lightweight inline header identity with the `index-v10.html` `logo-icon`, and remove the `核心网智能配置工作台` subtitle
- [x] 2.2 Update `apps/web/src/components/workbench/HomeStage.vue` so the no-session Agent hero uses the `index-v10.html` `icon-svg` treatment and removes the `在线` status text

## 3. Verify the first-screen experience

- [x] 3.1 Verify the unauthenticated-free home workbench state still renders correctly on desktop and narrower breakpoints after the visual alignment
- [x] 3.2 Validate that the displayed Agent title and subtitle on the home hero still come from backend-provided metadata after the layout changes
