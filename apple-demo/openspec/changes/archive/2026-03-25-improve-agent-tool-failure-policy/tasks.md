## 1. Configuration And Policy Model

- [x] 1.1 Extend `apps/agent-backend/config.json` and `ConfigLoader` to load tool recovery, runtime retry, and loop detection policy from `runtime.agentLoop` / `runtime.tools`
- [x] 1.2 Rename model recovery budget semantics to correction-call-based configuration and validate invalid values with explicit startup errors
- [x] 1.3 Introduce shared runtime policy types for retry budgets, loop detection thresholds, and tool eligibility metadata

## 2. Tool Failure Classification And Retry Execution

- [x] 2.1 Add a local-first failure classifier that derives normalized error codes and policy categories from `tool + error.type + message pattern`
- [x] 2.2 Add runtime tool policy metadata for `idempotent`, `supportsRuntimeRetry`, and `supportsModelRecovery`, starting with explicit defaults for local tools
- [x] 2.3 Implement invocation-scoped runtime retry for eligible idempotent tools with separate retry budgeting from model recovery
- [x] 2.4 Replace the current global one-shot recovery flag in build/agent loop with continuous same-tool chain tracking and correction-call-scoped model recovery accounting

## 3. No-Progress Stops And Error Surfaces

- [x] 3.1 Add tool-call-chain tracking that closes on tool switches and compares normalized failure signatures and normalized failure outcomes across correction calls
- [x] 3.2 Implement no-progress stop rules that count only correction calls, not the initial failure, and terminate the affected tool-call chain with explicit stop reasons
- [x] 3.3 Separate machine-facing tool error payloads from frontend-facing runtime error summaries while adding `stopReason`, normalized failure code, and chain metadata
- [x] 3.4 Emit observability signals for runtime retries, model recovery attempts, no-progress stops, terminal deny reasons, and tool-level failure distribution

## 4. Verification

- [x] 4.1 Add unit tests for policy config parsing, invalid configuration handling, and compatible default behavior
- [x] 4.2 Add build/agent loop tests covering invocation-scoped runtime retry, same-tool chain continuity, and correction-call-scoped model recovery budgets
- [x] 4.3 Add tests for no-progress detection, explicit stop behavior, terminal deny logging, and enriched runtime failure metadata
- [x] 4.4 Add classifier and provider or registry tests verifying that local parameter/path errors stay model-recoverable while non-idempotent or ineligible tools are not auto-retried
