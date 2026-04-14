## Context

The workbench already has a conversation-led file review loop: users can open workspace files, edit supported text content, save the current file in place, and continue Agent processing with the active file as primary context. The remaining weakness is the text editing engine itself. The current textarea is adequate for basic corrections but weak for longer text and MML files, and it leaves the boundary between workspace shell behavior, file adapters, and editor internals underspecified.

This change introduces Monaco as a new frontend dependency, but it is intentionally not a rewrite of the workspace model. The current shell, file-open/save contract, active-file model, and MML header round-trip behavior already establish the product shape. The design task is to make Monaco fit those decisions without turning the workbench into a file-first IDE.

## Goals / Non-Goals

**Goals:**
- Improve the text editing experience for text-class workspace files without changing the product's conversation-first interaction model.
- Limit Monaco usage to plain text files and the text view of MML files.
- Preserve the existing responsibilities of the workspace shell for tabs, toolbar controls, save actions, continue-processing actions, and save-state feedback.
- Keep MML toolbar fields as a structured projection of the leading header comment instead of embedding that logic into Monaco.
- Preserve a store-centered file model so save flows, dirty state, and Agent follow-up context remain authoritative outside the editor engine.

**Non-Goals:**
- Moving CSV editing into Monaco or replacing the current table-oriented CSV view.
- Turning the workspace into a general IDE with diff views, symbol navigation, diagnostics systems, or file-manager behavior.
- Introducing a new runtime contract for file open/save beyond what the current text and MML editing flow already requires.
- Building a separate structured MML document model or replacing the text-first MML representation.

## Decisions

### Decision: Treat Monaco as the text editor engine, not as a new product surface

The editor area will continue to be understood in three layers:
- Workspace shell: tabs, toolbar, save, continue processing, file status.
- View adapter: file-type routing and bridge logic between file state and the concrete view.
- Editor engine: Monaco for text-class files, table rendering for CSV.

Alternative considered:
- Let Monaco drive a broader editor-first workspace redesign.

Why not:
- That would weaken the existing conversation-led product hierarchy and expand this change into a shell redesign rather than an editor-engine upgrade.

### Decision: Limit Monaco to text files and the text view of MML files

Monaco will be used for plain text files and MML text editing. CSV remains on the existing table path.

Alternative considered:
- Normalize all editable file types through Monaco, including CSV.

Why not:
- CSV currently has a distinct table-oriented mental model, and pushing it through Monaco would blur view responsibilities while adding little value for this iteration.

### Decision: Keep MML toolbar controls outside Monaco

`网元类型` and `网元版本` remain workspace toolbar controls owned by the shell rather than Monaco decorations, widgets, or inline form controls. Monaco edits the raw text; the toolbar exposes a structured projection of the leading MML header.

Alternative considered:
- Build MML metadata editing directly into Monaco through inline widgets or custom overlays.

Why not:
- It would entangle business semantics with editor implementation details and make future editor changes harder.

### Decision: Preserve a store-centered authority model for file content and metadata

The authoritative frontend file state remains the workbench store entry for the current file, including content, parsed MML metadata, dirty state, and save status. Monaco models are synchronized with that state but do not become the business source of truth.

Alternative considered:
- Let Monaco model state become the primary source for save and follow-up actions.

Why not:
- That would complicate tab switching, dirty detection, save reads, and follow-up Agent context by making editor-instance state leak into workspace business logic.

### Decision: Use save-time convergence for MML toolbar edits

Toolbar edits update structured MML metadata state but do not need to rewrite text immediately. Text edits may refresh parsed toolbar values when the leading header changes. The save path remains responsible for converging metadata and text into the persisted file.

Alternative considered:
- Real-time two-way rewriting between toolbar fields and Monaco text.

Why not:
- It increases implementation complexity, risks cursor movement and undo-stack pollution, and makes the editor feel like it is rewriting the user's text during normal typing.

### Decision: Keep Monaco configuration intentionally lightweight

The first Monaco integration should focus on core text editing value: line numbers, reliable scrolling, selection, undo/redo, configurable wrapping, and future compatibility with syntax highlighting. Heavy IDE behaviors remain out of scope.

Alternative considered:
- Ship Monaco with a broader set of development-environment affordances from the start.

Why not:
- The product need is reliable document correction, not a broad programming environment.

## Risks / Trade-offs

- [Monaco makes the workspace feel too much like an IDE] → Limit scope to text/MML editing, keep toolbar and workspace actions outside the editor engine, and defer heavy IDE affordances.
- [MML parsing rules can drift between frontend and backend] → Treat the header parse/write contract as a shared behavioral rule and validate frontend behavior against the existing backend round-trip contract.
- [Store/editor synchronization bugs could create dirty-state confusion] → Keep one-directional event flow from editor changes into store state and continue to derive save/follow-up behavior from the store.
- [Toolbar edits and raw text can diverge temporarily before save] → Make save the explicit convergence point and keep post-save payloads authoritative for the next rendered state.

## Migration Plan

- Add Monaco as a frontend dependency and introduce a text-editor adapter that can replace the current textarea path for text-class files.
- Keep the existing workspace shell inputs/outputs stable so tabs, toolbar actions, save, and continue processing do not need a new contract.
- Preserve the existing CSV table path unchanged.
- Reuse the existing backend open/save contract and MML header normalization behavior.
- If rollback is needed, the Monaco-backed adapter can be swapped back to the current textarea-based text adapter without changing workspace file APIs.

## Open Questions

- Whether the first Monaco pass should preserve editor view state such as selection and scroll position across tab switches or defer that to a later refinement.
- Whether MML-specific syntax highlighting should be included in the first Monaco pass or follow after the base engine integration is stable.
