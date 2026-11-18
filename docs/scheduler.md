# AI Daily Intelligence — Scheduler Configuration

**Version:** 1.0.0
**Status:** PREPARED_AND_VALIDATED (Step 108)
**Schedule:** Daily at 05:00 Europe/Amsterdam
**State:** DISABLED (explicitly disabled for Step 108)

---

## 1. Overview

This document describes the daily execution scheduler configuration for the AI Daily Intelligence pipeline. The scheduler is designed to initiate the deterministic daily workflow orchestrator at 05:00 Europe/Amsterdam every calendar day, with the reporting interval defined as the previous calendar day at 05:00 (inclusive) to the edition date at 05:00 (exclusive).

**Critical:** The scheduler remains **DISABLED** after Step 108. Activation requires explicit operational review (Step 109) and explicit authorization (Step 110).

---

## 2. Scheduling Mechanism Selection

### 2.1 Selected Mechanism: systemd User Timer

**Rationale:**

- ✅ Native Linux scheduling with proper DST handling via IANA timezone database
- ✅ Persistent configuration via unit files (version-controlled in repository)
- ✅ Explicit disabled/enabled state management (`systemctl --user enable/disable`)
- ✅ Execution locking via filesystem locks (integrated with workflow orchestrator)
- ✅ Process supervision with resource limits (MemoryMax, CPUQuota, TimeoutSec)
- ✅ Structured logging via systemd journal
- ✅ No additional infrastructure required (already available on host)
- ✅ Compatible with existing Hermes workflow (no new dependencies)
- ✅ Security hardening (ProtectSystem=strict, NoNewPrivileges=true, PrivateTmp=true)

### 2.2 Alternatives Considered

| Mechanism                             | Evaluation                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| **Hermes cron**                       | Exists but unconfigured; less transparent; no native DST handling in config      |
| **systemd user timer**                | ✅ **Selected** — native, DST-aware, version-controlled, disabled-by-default     |
| **cron**                              | No native DST handling; fixed UTC offsets; less supervision                      |
| **GitHub Actions scheduled workflow** | Requires GitHub-hosted runners; not suitable for local execution with file locks |
| **Custom daemon**                     | Unnecessary complexity; reinvents existing Linux facilities                      |

---

## 3. Schedule Definition

### 3.1 Timer Unit (`scripts/scheduler/ai-intelligence-daily.timer`)

```ini
[Timer]
OnCalendar=*-*-* 05:00:00 Europe/Amsterdam
Persistent=false
WakeSystem=false
AccuracySec=1min
RandomizedDelaySec=0
Unit=ai-intelligence-daily.service
```

### 3.2 Service Unit (`scripts/scheduler/ai-intelligence-daily.service`)

```ini
[Service]
Type=oneshot
ExecStart=/home/sjefsharp/Projects/ai-intelligence-blog/scripts/scheduler/run-daily-edition.sh
WorkingDirectory=/home/sjefsharp/Projects/ai-intelligence-blog
Environment=EDITION_SCHEDULER_ENABLED=false
Environment=EDITION_DEPLOYMENT_AUTHORIZED=false
Environment=EDITION_PUBLICATION_AUTHORIZED=false
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-intelligence-daily
TimeoutSec=7200
MemoryMax=2G
CPUQuota=200%
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/sjefsharp/Projects/ai-intelligence-blog/data /home/sjefsharp/Projects/ai-intelligence-blog/editions /home/sjefsharp/.cache
PrivateTmp=true
NoNewPrivileges=true
CapabilityBoundingSet=
```

### 3.3 Key Schedule Properties

| Property             | Value                                    |
| -------------------- | ---------------------------------------- |
| **Execution Time**   | 05:00 Europe/Amsterdam (local time)      |
| **Frequency**        | Daily (every calendar day)               |
| **Timezone**         | Europe/Amsterdam (IANA, DST-aware)       |
| **Persistence**      | `Persistent=false` (no catch-up on boot) |
| **Randomized Delay** | 0 (exact execution)                      |
| **Accuracy**         | 1 minute                                 |

---

## 4. Reporting Window Semantics

### 4.1 Fixed Window Definition

For edition date `YYYY-MM-DD`:

- **Start (inclusive):** Previous calendar day at 05:00 Europe/Amsterdam
- **End (exclusive):** Edition date at 05:00 Europe/Amsterdam

### 4.2 Examples

| Edition Date | Timezone    | Window Start              | Window End                | Duration |
| ------------ | ----------- | ------------------------- | ------------------------- | -------- |
| 2025-01-15   | CET (UTC+1) | 2025-01-14T05:00:00+01:00 | 2025-01-15T05:00:00+01:00 | 24h      |
| 2025-03-30   | CEST starts | 2025-03-29T05:00:00+01:00 | 2025-03-30T05:00:00+02:00 | 23h      |
| 2025-10-26   | CET resumes | 2025-10-25T05:00:00+02:00 | 2025-10-26T05:00:00+01:00 | 25h      |

### 4.3 Critical Invariants

1. **Edition identity is derived from scheduled date only** — never from actual execution time
2. **Window boundaries never shift** — delayed execution does not extend eligibility
3. **DST transitions handled correctly** — 23h/24h/25h windows via `Temporal.PlainDate` arithmetic
4. **Cutoff alignment** — Scheduled execution (05:00) equals reporting window end (05:00)

---

## 5. Activation Guard

The scheduler implements a **deterministic pre-execution guard** that validates authorization before invoking the workflow.

### 5.1 Required Environment Variables

| Variable                         | Required For          | Default (Disabled) |
| -------------------------------- | --------------------- | ------------------ |
| `EDITION_SCHEDULER_ENABLED`      | Any execution         | `false`            |
| `EDITION_PUBLICATION_AUTHORIZED` | EXECUTE mode          | `false`            |
| `EDITION_DEPLOYMENT_AUTHORIZED`  | Deployment (separate) | `false`            |

### 5.2 Guard Logic

```bash
# All must be explicitly "true" for EXECUTE mode
if [[ "${EDITION_SCHEDULER_ENABLED}" != "true" ]]; then
    # Fall back to VALIDATE mode (safe)
    effective_mode="VALIDATE"
fi

if [[ "${mode}" == "EXECUTE" ]]; then
    if [[ "${EDITION_PUBLICATION_AUTHORIZED}" != "true" ]]; then
        REJECT "Publication not authorized"
    fi
fi
```

### 5.3 Fail-Closed Behavior

- Missing or invalid authorization → execution rejected
- Scheduler disabled → only PLAN/VALIDATE/DRY_RUN permitted
- No model can approve activation
- Manual command invocation ≠ production authorization

---

## 6. Workflow Invocation

### 6.1 Entry Point

**Script:** `scripts/scheduler/run-daily-edition.sh`

- Invokes `pnpm exec tsx scripts/run-workflow.ts`
- Invokes `pnpm exec tsx scripts/run-acceptance.ts` for VALIDATE/EXECUTE modes
- Passes edition date, mode, and correlation ID

### 6.2 Supported Modes

| Mode     | Scheduler Behavior          | Production Effect    |
| -------- | --------------------------- | -------------------- |
| PLAN     | Always permitted            | Inspection only      |
| VALIDATE | Default when disabled       | Read-only validation |
| DRY_RUN  | Explicit opt-in             | Isolated fixtures    |
| RESUME   | Explicit opt-in             | Checkpoint recovery  |
| EXECUTE  | Requires all authorizations | Full real edition    |

### 6.3 Arguments Passed

```bash
pnpm exec tsx scripts/run-workflow.ts \
  --edition 2025-01-15 \
  --mode VALIDATE \
  --output-dir data/scheduler/runs/2025-01-15_sched_<correlation_id>
```

---

## 7. Configuration Files

### 7.1 Version-Controlled Configuration

| File                                              | Purpose                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `scripts/scheduler/ai-intelligence-daily.service` | systemd service unit                     |
| `scripts/scheduler/ai-intelligence-daily.timer`   | systemd timer unit                       |
| `scripts/scheduler/run-daily-edition.sh`          | Wrapper script with activation guard     |
| `data/scheduler/config.json`                      | Machine-readable scheduler configuration |
| `src/lib/scheduler/schema.ts`                     | Zod schema for configuration validation  |

### 7.2 Configuration Validation

```bash
# Validate configuration
pnpm exec tsx scripts/validate-scheduler.ts
```

**Validates:**

- Schema compliance
- Correct timezone (Europe/Amsterdam)
- Correct execution time (05:00)
- Disabled state (EDITION_SCHEDULER_ENABLED=false)
- Free-only inference enforcement
- No auto-backfill
- Concurrency limit = 1

---

## 8. Safety and Correctness

### 8.1 Concurrency Protection

- Filesystem lock at `data/locks/edition_<date>.lock`
- 24-hour TTL with 30-second heartbeat
- Stale lock detection and recovery
- `CONFLICT` state prevents duplicate execution

### 8.2 Missed Run Policy

| Policy                | Setting                              |
| --------------------- | ------------------------------------ |
| Auto-backfill         | **Disabled** (`autoBackfill: false`) |
| Max backfill editions | 0                                    |
| Record missed         | Enabled                              |
| Alert on missed       | Disabled                             |

**No uncontrolled catch-up** — missed editions require manual historical recovery.

### 8.3 Free-Only Inference Enforcement

- `resourcePolicy.freeOnlyInference: true`
- `resourcePolicy.maxCostUsd: 0`
- `failurePolicy.noPaidFallback: true`
- Bounded retries (max 3 per stage, exponential backoff)
- Graceful degradation on quota exhaustion

### 8.4 Resource Limits

| Limit                   | Value           |
| ----------------------- | --------------- |
| Total workflow duration | 2 hours (7200s) |
| Max model requests      | 1000            |
| Max tokens              | 500,000         |
| Memory                  | 2 GB            |
| CPU                     | 200% (2 cores)  |

### 8.5 Publication/Deployment Separation

- Scheduler **only** initiates workflow
- Publication acceptance authority **separately** evaluates
- Deployment authority **separately** authorizes GitHub Pages deploy
- Scheduler cannot mark content PUBLISHED
- Scheduler cannot push to Git

---

## 9. Logging and Observability

### 9.1 Log Locations

| Source              | Location                                                          |
| ------------------- | ----------------------------------------------------------------- |
| systemd journal     | `journalctl -u ai-intelligence-daily`                             |
| Wrapper script logs | `data/scheduler/logs/scheduler_YYYYMMDD.log`                      |
| Workflow reports    | `data/scheduler/runs/<edition>_<correlation>/workflow-reports/`   |
| Acceptance reports  | `data/scheduler/runs/<edition>_<correlation>/acceptance-reports/` |

### 9.2 Correlation ID Format

`sched_YYYYMMDD_HHMMSS_PID` — tracks scheduler invocation end-to-end

### 9.3 Key Log Events

- Scheduler invocation start/end
- Activation guard decision
- Edition date resolution
- Reporting window calculation
- Workflow orchestrator invocation
- Acceptance authority invocation
- Final status (SUCCESS/FAILED/BLOCKED)

---

## 10. Installation and Verification

### 10.1 Install (Run Once, After Step 110 Authorization)

```bash
# Link units to systemd user directory
ln -sf /home/sjefsharp/Projects/ai-intelligence-blog/scripts/scheduler/ai-intelligence-daily.service ~/.config/systemd/user/
ln -sf /home/sjefsharp/Projects/ai-intelligence-blog/scripts/scheduler/ai-intelligence-daily.timer ~/.config/systemd/user/

# Reload daemon
systemctl --user daemon-reload

# Enable timer (NOT service directly)
systemctl --user enable ai-intelligence-daily.timer

# Verify
systemctl --user list-timers ai-intelligence-daily.timer
```

### 10.2 Verify Disabled State (Current Step 108)

```bash
# Timer should NOT be active
systemctl --user list-timers --all | grep ai-intelligence
# Should return nothing

# Service should NOT be enabled
systemctl --user is-enabled ai-intelligence-daily.service
# Should return "disabled"

# Configuration validation
pnpm exec tsx scripts/validate-scheduler.ts
# Should return ✅ VALID
```

### 10.3 Test Safe Invocation

```bash
# PLAN mode (always safe)
EDITION_SCHEDULER_ENABLED=false ./scripts/scheduler/run-daily-edition.sh --edition 2025-01-15 --mode PLAN

# VALIDATE mode (read-only)
EDITION_SCHEDULER_ENABLED=false ./scripts/scheduler/run-daily-edition.sh --edition 2025-01-15 --mode VALIDATE
```

---

## 11. Testing

### 11.1 Test Suite

```bash
# Run scheduler-specific tests
pnpm test src/lib/scheduler/scheduler.test.ts

# Run all tests
pnpm test
```

### 11.2 Test Coverage (70 tests)

- Configuration schema validation (9 tests)
- Activation guard behavior (6 tests)
- Systemd unit configuration (8 tests)
- Wrapper script content (5 tests)
- Editorial window DST transitions (12 tests)
- Safety and correctness (24 tests)
- Integration with workflow orchestrator (4 tests)
- Regression scenarios (7 tests)

### 11.3 DST Transition Tests Verified

- Winter (CET, 24h window) ✅
- Spring forward (CEST, 23h window) ✅
- Autumn fallback (CET, 25h window) ✅
- Execution delay invariance ✅
- Cutoff alignment ✅

---

## 12. Current State (Step 108 Complete)

### 12.1 ✅ Prepared and Validated

| Component            | Status                                         |
| -------------------- | ---------------------------------------------- |
| systemd service unit | ✅ Created, validated                          |
| systemd timer unit   | ✅ Created, validated (05:00 Europe/Amsterdam) |
| Wrapper script       | ✅ Created, executable, tested                 |
| Configuration schema | ✅ Created, validated                          |
| Configuration file   | ✅ Created (DISABLED state)                    |
| Validation script    | ✅ Created, passes                             |
| Test suite           | ✅ 70 tests passing                            |
| Type checking        | ✅ `pnpm astro check` passes (0 errors)        |
| Build                | ✅ `pnpm run build` passes (59 pages)          |
| Full test suite      | ✅ 1172 tests passing                          |

### 12.2 🔒 Explicitly Disabled

- `EDITION_SCHEDULER_ENABLED=false` in service unit
- `EDITION_PUBLICATION_AUTHORIZED=false` in service unit
- `EDITION_DEPLOYMENT_AUTHORIZED=false` in service unit
- Timer NOT installed/enabled in systemd
- No background scheduled process running

### 12.3 📋 Handoff for Step 109

| Item                              | Status                                      |
| --------------------------------- | ------------------------------------------- |
| Scheduler mechanism selected      | systemd user timer                          |
| Schedule expression validated     | `*-*-* 05:00:00 Europe/Amsterdam`           |
| DST handling verified             | Spring/autumn transitions tested            |
| Activation guard implemented      | Fail-closed, three-factor auth              |
| Free-only enforcement             | Schema + runtime                            |
| Concurrency protection            | Filesystem lock + heartbeat                 |
| Missed run policy                 | No auto-backfill                            |
| Publication/deployment separation | Preserved                                   |
| Existing automations              | Unchanged (no ai-intelligence timers exist) |

---

## 13. Activation Procedure (Step 110 — Future)

**Prerequisites:**

1. Step 109 operational review complete
2. Explicit authorization from repository owner
3. API keys configured (OPENROUTER_API_KEY, GROQ_API_KEY)
4. GitHub Pages deployment configured

**Activation Steps:**

```bash
# 1. Install units
ln -sf /home/sjefsharp/Projects/ai-intelligence-blog/scripts/scheduler/ai-intelligence-daily.service ~/.config/systemd/user/
ln -sf /home/sjefsharp/Projects/ai-intelligence-blog/scripts/scheduler/ai-intelligence-daily.timer ~/.config/systemd/user/
systemctl --user daemon-reload

# 2. Update service unit with enabled=true
# Edit ~/.config/systemd/user/ai-intelligence-daily.service:
#   Environment=EDITION_SCHEDULER_ENABLED=true
#   Environment=EDITION_PUBLICATION_AUTHORIZED=true
#   Environment=EDITION_DEPLOYMENT_AUTHORIZED=true

# 3. Enable and start timer
systemctl --user enable --now ai-intelligence-daily.timer

# 4. Verify
systemctl --user status ai-intelligence-daily.timer
journalctl -u ai-intelligence-daily -f
```

**Deactivation:**

```bash
systemctl --user disable --now ai-intelligence-daily.timer
# Revert service unit environment variables to false
```

---

## 14. Files Created/Modified in Step 108

| File                                              | Type     | Description                                  |
| ------------------------------------------------- | -------- | -------------------------------------------- |
| `scripts/scheduler/ai-intelligence-daily.service` | New      | systemd service unit                         |
| `scripts/scheduler/ai-intelligence-daily.timer`   | New      | systemd timer unit (05:00 Europe/Amsterdam)  |
| `scripts/scheduler/run-daily-edition.sh`          | New      | Wrapper script with activation guard         |
| `scripts/validate-scheduler.ts`                   | New      | Configuration validation script              |
| `data/scheduler/config.json`                      | New      | Machine-readable scheduler config (DISABLED) |
| `src/lib/scheduler/schema.ts`                     | New      | Zod schema for scheduler config              |
| `src/lib/scheduler/scheduler.test.ts`             | New      | 70 comprehensive tests                       |
| `src/lib/editorial-window.ts`                     | Modified | Fixed `getEditionForTimestamp` DST parsing   |

---

**End of Scheduler Configuration Document**
**Classification:** PREPARED_AND_VALIDATED — Ready for Step 109 Operational Review
