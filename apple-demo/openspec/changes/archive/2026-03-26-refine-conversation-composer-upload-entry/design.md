## Context

The current conversation composer tries to carry too many responsibilities in the same bottom-row action cluster. Upload, blank-file creation, supported-format copy, and send all compete for the same constrained horizontal space. That creates three concrete product problems at once: the left action is framed as `新增文件` even when the surface is primarily used for upload, the visible format copy is both noisy and out of sync with the intended contract, and the send action collapses into a distorted narrow control on common laptop-width workbench layouts.

The composer also sits at the bottom edge of the viewport. Any help UI that expands downward is likely to clip, and any always-visible explanatory copy permanently taxes the most constrained part of the shell. At the same time, blank-file creation already fits better as workspace management behavior in the right-side work area instead of as a mixed conversation-composer action.

This change crosses `apps/web`, `apps/agent-backend`, and the `agent-web-workbench` / `agent-backend-runtime` specs because the visible upload contract needs to match the runtime allowlist.

## Goals / Non-Goals

**Goals:**
- Make the composer's primary file-entry action explicitly upload-first and label it `上传文件`.
- Remove blank-file creation actions from the composer and keep file-creation entry points in the workspace area.
- Replace the always-visible supported-format copy with a compact adjacent help affordance.
- Ensure the help affordance opens upward and remains usable through hover, focus, and click interactions.
- Align the visible composer upload contract and runtime allowlist to `TXT / MD / CSV`.
- Preserve a width-stable send action on supported laptop-width desktop layouts.

**Non-Goals:**
- Redesign the right workspace sidebar or template library in this change.
- Introduce a large mixed-action dropdown in the composer.
- Expand the workbench upload contract beyond `TXT / MD / CSV`.
- Replace the current conversation-first shell with a route-driven editor experience.

## Decisions

### Decision: The composer becomes an upload-first surface, not a mixed create/upload surface

The left-side primary composer action will be labeled `上传文件` and will represent upload only. Blank-file creation actions will be removed from the composer and remain available from the right workspace area, where they match workspace management intent better.

Rationale:
- `上传文件` accurately describes the primary purpose of the composer-side file action.
- File creation is a workspace management task, not a conversation-send task.
- Removing mixed create/upload framing reduces ambiguity in the most space-constrained row of the shell.

Alternatives considered:
- Keep `新增文件` and only change the underlying menu contents: rejected because the label would still over-promise mixed creation behavior from the composer.
- Keep blank-file creation in the composer overflow: rejected because it preserves the same mental-model mixing in a more hidden form.

### Decision: Supported-format guidance moves into a compact upward disclosure

The composer will replace the always-visible support copy with a small adjacent help affordance. The help surface will open upward from the composer and support hover, focus, and click so it remains usable near the viewport bottom and accessible from both pointer and keyboard interaction.

Rationale:
- The composer row does not have enough permanent width budget for explanatory copy.
- Upward expansion avoids the most obvious bottom-edge clipping failure mode.
- Supporting hover, focus, and click makes the disclosure usable across mouse and keyboard flows without forcing a heavier modal or dropdown.

Alternatives considered:
- Keep the current inline help copy: rejected because it permanently consumes scarce width and still presents stale contract text.
- Use a larger downward dropdown: rejected because the composer sits at the viewport bottom and the larger surface would be more likely to clip.

### Decision: The composer upload contract is explicitly limited to TXT / MD / CSV

The authenticated workbench composer will visibly advertise only `TXT / MD / CSV`, and the runtime upload allowlist for this surface will enforce that same contract. Accepted files still enter the existing `user + agent` workspace model and later open through the current file-mode detection rules.

Rationale:
- User-facing copy and backend acceptance need to agree.
- Narrowing the surface contract removes ambiguity about what the composer is meant to accept.
- `txt` files can still participate in later MML-oriented flows after upload without exposing `MML` as a separate upload format in the composer.

Alternatives considered:
- Continue showing a broader or vague format list: rejected because the current mismatch is one of the explicit problems this change exists to fix.
- Expose `MML` as a separate supported format in the composer: rejected because MML remains a parsing mode for supported text files rather than an independent upload class.

### Decision: The composer action row prioritizes send-button stability over passive explanatory content

The action row will treat the text input and send action as the highest-priority controls on supported desktop widths. The upload button and help affordance may use a compact cluster, but the row must keep the send button in a stable horizontal form and must not rely on a long inline hint that forces the send action into a narrow vertical pill.

Rationale:
- Sending remains the primary action of the composer.
- Width collapse of the send control is a clear usability regression on laptop-sized workbench layouts.
- Moving passive copy into a secondary disclosure creates the space budget needed to keep the primary controls stable.

Alternatives considered:
- Preserve the current layout and only tweak spacing tokens: rejected because the observed failure mode is structural, not cosmetic.
- Solve the issue with responsive wrapping: rejected because wrapping the primary action row would make the composer feel unstable and harder to scan.

## Risks / Trade-offs

- [Narrowing the upload allowlist may reject files some users previously tried to upload] -> Mitigation: keep the visible contract explicit in the help affordance and return clear runtime validation errors for unsupported extensions.
- [Hover-triggered help can become brittle if it is pointer-only] -> Mitigation: require focus and click support in addition to hover.
- [Composer and workspace entry surfaces can drift conceptually] -> Mitigation: keep composer scoped to upload and keep file creation clearly owned by the workspace area.
- [Low-width layout tuning can become CSS-fragile] -> Mitigation: codify the send-button stability requirement and add constrained-width frontend coverage.

## Migration Plan

1. Update the `agent-web-workbench` spec to describe the upload-first composer entry, upward help disclosure, workspace-entry boundary, and width-stable action row.
2. Update the `agent-backend-runtime` spec to define the governed composer upload allowlist contract.
3. Implement the backend upload validation and the frontend composer layout/help changes.
4. Add frontend and backend tests covering upload contract alignment, help disclosure behavior, and constrained-width layout stability.

Rollback strategy:
- If the help disclosure proves unstable, fall back to a click-only upward popover while keeping the upload-first label and narrowed format contract.
- If the allowlist narrowing causes unexpected integration issues, revert the backend restriction together with the visible format copy so the frontend and runtime remain aligned.

## Open Questions

- Should the upward help disclosure close immediately on pointer leave, or should it tolerate a short hover/focus grace period to reduce accidental dismissal?
- Should unsupported-upload validation be surfaced as inline composer feedback only, or also as a toast/global error?
