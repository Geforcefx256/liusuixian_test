## 1. Model Transport Diagnostics

- [x] 1.1 Extend model-request failure logging in `apps/agent-backend/src/agent/providerClient.ts` to capture pre-response request stage, nested cause-chain fields, and stable transport diagnostics without exposing secrets
- [x] 1.2 Add post-response diagnostic context for stream, protocol, and watchdog failures so logs distinguish response-started failures from pre-response transport failures
- [x] 1.3 Thread the expanded diagnostic detail through runtime error logging so the same run can be correlated across `[LLM TIMING]` and `[AgentService] runtime_error`

## 2. Failed Model Timing Attribution

- [x] 2.1 Preserve failed model metrics through the error path in `apps/agent-backend/src/agent/service/RunExecution.ts` instead of dropping model aggregate timing on terminal failures
- [x] 2.2 Update run timing summary generation so failed model latency contributes to model timing rather than only `otherCostTime`

## 3. Verification

- [x] 3.1 Add or update unit tests for provider-client failure logging and cause extraction, covering both pre-response transport failures and post-response stream-stage failures
- [x] 3.2 Add or update runtime/service tests that verify failed model requests still surface structured runtime errors and that run timing summaries retain failed model latency
- [x] 3.3 Verify the implementation diff stays limited to the diagnostic/timing modules named in the proposal and does not modify unrelated business code paths
