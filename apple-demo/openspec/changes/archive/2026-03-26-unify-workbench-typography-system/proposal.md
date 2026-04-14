## Why

The current workbench typography has drifted into a component-by-component system instead of a governed product rule set. `apps/web/src` currently mixes many nearby sizes such as `10px`, `11px`, `12px`, `13px`, `14px`, `15px`, `16px`, `17px`, and `18px`, plus several narrow `clamp(...)` variants that create little practical responsive benefit but weaken cross-surface consistency.

This is most visible in the authenticated workbench, where similar hierarchy levels use different sizes depending on component ownership. The problem is not only aesthetic. It affects scan speed, readability, density predictability, and the user's ability to understand which text is primary, secondary, or purely assistive.

The risk is higher in workspace editing surfaces because Monaco-backed text editing, MML workbook grids, native table views, and result tables are not ordinary UI copy. Those surfaces need a governed typography model of their own. If the product only normalizes general UI text, editor and table surfaces will continue to diverge or regress whenever global body sizing changes.

## What Changes

- Introduce a governed typography system for the workbench with explicit font-family, font-size, line-height, and role tokens.
- Normalize the shell and high-density dashboard UI around a small set of semantic typography tiers instead of raw per-component sizes.
- Separate typography rules for:
  - general UI and conversation copy
  - dense workbench controls and lists
  - Monaco and text editing surfaces
  - table-oriented data surfaces
  - Markdown document preview
- Remove low-value micro-variants such as `10px`, `15px`, `17px`, and the current small `clamp(...)` size set from the normal workbench chrome.
- Ensure table browsing and table editing states use the same governed typography so cell text does not visually jump when entering edit mode.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-web-workbench`: clarify that the workbench uses a governed typography system across shell, conversation, workspace editor, Monaco, and table views.

## Impact

- Affected frontend code in `apps/web`, especially `styles.css`, workbench shell components, conversation surfaces, workspace editor surfaces, Monaco integration, MML workbook grid styling, and result-table styling.
- Affected workbench UX contract in `openspec/specs/agent-web-workbench/spec.md`.
