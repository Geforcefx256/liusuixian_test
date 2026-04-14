## ADDED Requirements

### Requirement: Runtime SHALL separate tool runtime retry from model recovery
The runtime SHALL process build/agent loop tool failures through two distinct policies: runtime retry for transient invocation failures and model recovery for recoverable semantic failures surfaced back to the model.

#### Scenario: Transient invocation failure uses runtime retry
- **WHEN** a tool invocation fails with a transient failure type that is eligible for automatic retry
- **THEN** the runtime MUST retry that same invocation without requiring the model to emit a new tool call
- **AND** the retry count MUST be tracked against that invocation rather than the whole run

#### Scenario: Recoverable semantic failure uses model recovery
- **WHEN** a tool invocation fails with a recoverable semantic or validation-style failure
- **THEN** the runtime MUST emit a structured tool error payload back into the active conversation
- **AND** the model MUST be allowed to issue a corrected follow-up tool call within the configured recovery budget for that tool-call chain

#### Scenario: Local parameter and path failures stay recoverable even when surfaced as execution errors
- **WHEN** a local tool failure can be normalized to a parameter, path, payload, or command-syntax problem using tool-specific classification rules
- **THEN** the runtime MUST classify that failure as model-recoverable even if the provider returned a coarse execution failure type
- **AND** the runtime MUST avoid terminating the run before the model receives a structured opportunity to correct the input

### Requirement: Runtime SHALL scope model recovery budgets per tool-call chain
The runtime SHALL count model recovery attempts per tool-call chain instead of sharing a single recovery budget across the entire run.

#### Scenario: One failed tool chain does not consume another chain's recovery budget
- **WHEN** tool chain A exhausts its model recovery budget
- **THEN** a later independent tool chain B MUST still receive its own configured model recovery budget

#### Scenario: Repeated failures within one tool chain consume only that chain's budget
- **WHEN** the model repeatedly corrects and reissues the same tool intent within one tool-call chain
- **THEN** the runtime MUST decrement only that chain's model recovery counter
- **AND** the runtime MUST stop granting additional recovery once that chain reaches the configured limit

#### Scenario: Initial recoverable failure does not consume correction-call budget
- **WHEN** a tool-call chain is first opened by a recoverable failure
- **THEN** the runtime MUST NOT decrement that chain's model recovery budget for the initial failure itself
- **AND** the runtime MUST only decrement the budget when the model issues a subsequent correction call within the same chain

#### Scenario: Switching to another tool closes the current chain
- **WHEN** the model receives a recoverable failure for tool A and then invokes tool B instead of immediately re-invoking tool A
- **THEN** the runtime MUST treat the tool A chain as closed
- **AND** any later invocation of tool A MUST start a new chain with a fresh model recovery budget

### Requirement: Runtime SHALL expose tool failure policy in config.json
The runtime SHALL load tool failure policy configuration from `apps/agent-backend/config.json` so operators can control recovery counts, retry counts, and loop-detection thresholds without code changes.

#### Scenario: Configured recovery and retry limits are loaded at startup
- **WHEN** `config.json` defines tool recovery, runtime retry, or loop detection values
- **THEN** the runtime MUST apply those configured values to build/agent loop execution

#### Scenario: Invalid tool failure policy configuration fails fast
- **WHEN** `config.json` provides invalid numeric or boolean values for tool failure policy
- **THEN** runtime startup MUST fail with an explicit configuration error
- **AND** the runtime MUST NOT silently fall back to hidden defaults for those invalid fields

#### Scenario: Model recovery configuration counts correction calls
- **WHEN** `config.json` defines the model recovery budget
- **THEN** the configured value MUST represent the number of correction calls the model may issue after an initial recoverable failure
- **AND** the runtime MUST NOT interpret that value as a total-failures counter

### Requirement: Runtime SHALL restrict automatic retry to eligible idempotent tools
The runtime SHALL only perform automatic runtime retry for tool invocations that are explicitly marked as eligible for runtime retry and safe to repeat.

#### Scenario: Eligible idempotent tool is retried automatically
- **WHEN** an idempotent tool that supports runtime retry fails with a transient failure
- **THEN** the runtime MUST retry that invocation up to the configured invocation retry limit

#### Scenario: Non-idempotent or ineligible tool is not retried automatically
- **WHEN** a tool is not marked as eligible for runtime retry
- **THEN** the runtime MUST NOT automatically replay that invocation
- **AND** the runtime MUST either surface the failure for model recovery or fail the run according to the failure policy

#### Scenario: Non-idempotent command execution is not retried automatically
- **WHEN** `local:run_command` fails due to timeout, non-zero exit, or other non-idempotent execution outcomes
- **THEN** the runtime MUST NOT perform automatic runtime retry for that invocation
- **AND** the runtime MUST classify the failure for either terminal stop or model recovery according to the configured failure policy

### Requirement: Runtime SHALL stop tool-call chains that show no progress
The runtime SHALL detect repeated failure patterns within a tool-call chain and stop execution once configured no-progress thresholds are met.

#### Scenario: Same failure pattern triggers explicit stop
- **WHEN** the same tool-call chain repeats the same normalized tool failure pattern up to the configured same-failure threshold
- **THEN** the runtime MUST terminate that chain
- **AND** the resulting runtime failure metadata MUST indicate that execution stopped because no progress was detected

#### Scenario: Same outcome with varied parameters also triggers stop
- **WHEN** the same tool-call chain keeps producing the same normalized failure outcome while varying arguments
- **THEN** the runtime MUST terminate that chain once the configured same-outcome threshold is reached
- **AND** the runtime MUST avoid continuing to spend additional loop steps on that repeated no-progress sequence

#### Scenario: No-progress thresholds count only correction calls
- **WHEN** a recoverable failure first opens a tool-call chain
- **THEN** that initial failure MUST NOT count toward same-failure or same-outcome thresholds
- **AND** only subsequent correction calls within that chain MUST advance the no-progress counters

### Requirement: Runtime SHALL preserve separate machine-facing and user-facing tool failure payloads
The runtime SHALL provide structured failure data suitable for model recovery while continuing to expose readable runtime failure metadata to frontend consumers.

#### Scenario: Tool error payload preserves structured recovery hints for the model
- **WHEN** a recoverable tool failure is written back into the conversation
- **THEN** the payload MUST include a stable error code, recoverable flag, and retry-oriented metadata sufficient for the model to attempt correction

#### Scenario: Terminal runtime failure preserves user-facing summary
- **WHEN** execution terminates because tool retry, model recovery, or no-progress limits are reached
- **THEN** the runtime MUST return structured runtime failure metadata with a frontend-consumable summary
- **AND** the returned metadata MUST remain distinguishable from the machine-facing tool error payload used inside the conversation loop

#### Scenario: Terminal runtime failure exposes explicit stop reason
- **WHEN** execution terminates because the runtime reached a terminal tool failure, recovery exhaustion, or no-progress stop
- **THEN** the runtime MUST return a structured stop reason in terminal runtime failure metadata
- **AND** that metadata MUST identify the tool name and normalized failure code that caused the stop

#### Scenario: Tool denial stays terminal and visible in logs
- **WHEN** a tool invocation fails with a deny-style outcome such as `TOOL_DENIED`
- **THEN** the runtime MUST terminate that tool invocation as a terminal failure instead of offering model recovery
- **AND** the runtime MUST record log fields sufficient to identify that the stop was caused by a deny decision and where that deny originated

### Requirement: Runtime SHALL emit observability data for tool retry and recovery behavior
The runtime SHALL record observability signals for automatic retries, model recovery attempts, no-progress stops, and tool-level failure distribution.

#### Scenario: Successful or failed retries emit retry observability
- **WHEN** runtime retry is attempted for a tool invocation
- **THEN** the runtime MUST record the retry attempt count and final outcome in its logs or metrics

#### Scenario: No-progress stop emits diagnostic context
- **WHEN** a tool-call chain is terminated due to no-progress detection
- **THEN** the runtime MUST record the tool identity, normalized failure outcome, and threshold that triggered the stop
