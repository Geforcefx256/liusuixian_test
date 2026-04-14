## REMOVED Requirements

### Requirement: Runtime SHALL expose a sandboxed `bash` execution contract for the current workspace
**Reason**: Repo-owned governed skill automation has been replaced by approved Node script tools with structured parameters. Arbitrary shell execution is no longer part of the security model.
**Migration**: All canonical skill automation now uses `skill:exec` with `SCRIPTS.yaml` manifests. The `local:bash` tool, sandbox executor, and seatbelt profile have been deleted.

### Requirement: Bash sandbox mounts SHALL enforce read-only inputs and writable outputs
**Reason**: The governed script execution model enforces input/output boundaries at the manifest level (param `pathBase`) and runtime validation level, not through OS filesystem mounts.
**Migration**: Express input and output path roles in governed script manifests (`pathBase: uploadsDir`, `pathBase: outputsDir`, etc.), resolve those paths in runtime before invocation, and keep artifact registration scoped to the current workspace outputs root.

### Requirement: Bash sandbox SHALL isolate host resources and bound execution
**Reason**: The governed script execution model uses fixed Node entrypoints with `shell: false`, timeout enforcement, and structured validation. OS-specific sandboxing (macOS seatbelt) is no longer needed.
**Migration**: Apply timeouts, fixed process settings, structured validation, and least-privilege service deployment to governed script execution. The sandbox code directory has been deleted entirely.
