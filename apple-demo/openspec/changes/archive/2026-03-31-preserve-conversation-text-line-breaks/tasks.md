## 1. Renderer Update

- [x] 1.1 Update the controlled workbench markdown renderer so multiline paragraph content preserves visible line breaks instead of flattening source newlines into one visual line.
- [x] 1.2 Confirm the newline-preservation change stays scoped to reading-mode text rendering and does not alter the existing raw-bubble, list, blockquote, or code-fence paths unintentionally.

## 2. Conversation Surface Verification

- [x] 2.1 Add renderer-level tests that cover multiline assistant text paragraphs, including line-break preservation alongside inline formatting.
- [x] 2.2 Add workbench conversation tests that verify eligible assistant reading-mode messages preserve visible line breaks while short raw-bubble replies keep their current presentation behavior.

## 3. Validation

- [x] 3.1 Run the relevant frontend test targets for the markdown renderer and conversation presentation components.
- [x] 3.2 Review the affected workbench text surfaces for regressions in newline handling and confirm no backend contract or dependency changes were introduced.
