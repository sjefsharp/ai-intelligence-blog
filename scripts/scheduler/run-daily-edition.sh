#!/usr/bin/env bash
# AI Daily Intelligence — Daily Edition Execution Wrapper
# This script is invoked by the systemd service unit. It implements the
# activation guard and invokes the workflow orchestrator.
#
# Schedule: Daily at 05:00 Europe/Amsterdam
# Reporting interval: previous day 05:00 inclusive → edition day 05:00 exclusive
# Edition identity: derived from scheduled date (YYYY-MM-DD)
#
# Activation guard checks:
#   EDITION_SCHEDULER_ENABLED=true          — scheduler explicitly enabled
#   EDITION_DEPLOYMENT_AUTHORIZED=true      — deployment authorized (separate)
#   EDITION_PUBLICATION_AUTHORIZED=true     — publication authorized (separate)
#
# All three must be explicitly set to true for EXECUTE mode.
# Without them, the script runs in VALIDATE mode only.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_SCRIPT="${PROJECT_ROOT}/scripts/run-workflow.ts"
ACCEPTANCE_SCRIPT="${PROJECT_ROOT}/scripts/run-acceptance.ts"
LOG_DIR="${PROJECT_ROOT}/data/scheduler/logs"
LOCK_DIR="${PROJECT_ROOT}/data/locks"
EDITION_DATE="${EDITION_DATE:-}"
EXECUTION_MODE="${EXECUTION_MODE:-VALIDATE}"
CORRELATION_ID="${CORRELATION_ID:-sched_$(date -u +%Y%m%d_%H%M%S)_$$}"

# Use pnpm exec for tsx to ensure correct PATH
TXS_CMD="pnpm exec tsx"

# ============================================================================
# Logging
# ============================================================================

mkdir -p "${LOG_DIR}"

log() {
    local level="$1"
    shift
    local msg="$*"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[${timestamp}] [${level}] [${CORRELATION_ID}] ${msg}" | tee -a "${LOG_DIR}/scheduler_$(date -u +%Y%m%d).log"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# ============================================================================
# Activation Guard
# ============================================================================

check_activation_guard() {
    local mode="$1"

    log_info "Activation guard check for mode: ${mode}"

    # Check scheduler enabled
    if [[ "${EDITION_SCHEDULER_ENABLED:-false}" != "true" ]]; then
        log_warn "EDITION_SCHEDULER_ENABLED is not 'true' (value: '${EDITION_SCHEDULER_ENABLED:-unset}')"
        log_warn "Scheduler is DISABLED. Only PLAN/VALIDATE/DRY_RUN modes permitted."
        return 1
    fi

    # For EXECUTE mode, require explicit publication authorization
    if [[ "${mode}" == "EXECUTE" ]]; then
        if [[ "${EDITION_PUBLICATION_AUTHORIZED:-false}" != "true" ]]; then
            log_error "EDITION_PUBLICATION_AUTHORIZED is not 'true' — EXECUTE mode requires publication authorization"
            return 1
        fi
        if [[ "${EDITION_DEPLOYMENT_AUTHORIZED:-false}" != "true" ]]; then
            log_warn "EDITION_DEPLOYMENT_AUTHORIZED is not 'true' — deployment not authorized (expected for EXECUTE)"
        fi
        log_info "All authorization checks passed for EXECUTE mode"
    fi

    return 0
}

# ============================================================================
# Edition Date Resolution
# ============================================================================

resolve_edition_date() {
    if [[ -n "${EDITION_DATE}" ]]; then
        # Validate format
        if [[ ! "${EDITION_DATE}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
            log_error "Invalid EDITION_DATE format: ${EDITION_DATE} (expected YYYY-MM-DD)"
            return 1
        fi
        # Validate date exists
        if ! date -d "${EDITION_DATE}" >/dev/null 2>&1; then
            log_error "Invalid EDITION_DATE: ${EDITION_DATE}"
            return 1
        fi
        echo "${EDITION_DATE}"
        return 0
    fi

    # Default: derive from current time in Europe/Amsterdam
    # Edition date is the date whose 05:00 window we are entering
    local amsterdam_now
    amsterdam_now=$(TZ=Europe/Amsterdam date +"%Y-%m-%d %H:%M")
    local amsterdam_date
    amsterdam_date=$(TZ=Europe/Amsterdam date +"%Y-%m-%d")
    local amsterdam_hour
    amsterdam_hour=$(TZ=Europe/Amsterdam date +"%H")

    if [[ ${amsterdam_hour} -ge 5 ]]; then
        # At or after 05:00 → today's edition
        echo "${amsterdam_date}"
    else
        # Before 05:00 → yesterday's edition
        date -d "${amsterdam_date} -1 day" +"%Y-%m-%d"
    fi
}

# ============================================================================
# Reporting Interval Calculation
# ============================================================================

calculate_reporting_interval() {
    local edition_date="$1"
    # Start: previous calendar day at 05:00 Europe/Amsterdam (inclusive)
    # End: edition date at 05:00 Europe/Amsterdam (exclusive)
    local start_ts
    local end_ts
    start_ts=$(TZ=Europe/Amsterdam date -d "${edition_date} -1 day 05:00" +"%Y-%m-%dT%H:%M:%S%z")
    end_ts=$(TZ=Europe/Amsterdam date -d "${edition_date} 05:00" +"%Y-%m-%dT%H:%M:%S%z")
    echo "${start_ts}|${end_ts}"
}

# ============================================================================
# Concurrency Lock Check
# ============================================================================

check_concurrency_lock() {
    local edition_id="edition_${1}"
    local lock_file="${LOCK_DIR}/${edition_id}.lock"

    if [[ -f "${lock_file}" ]]; then
        local lock_state
        lock_state=$(jq -r '.state // "UNKNOWN"' "${lock_file}" 2>/dev/null || echo "UNKNOWN")
        local lock_pid
        lock_pid=$(jq -r '.acquiredBy.processId // "unknown"' "${lock_file}" 2>/dev/null || echo "unknown")
        local lock_host
        lock_host=$(jq -r '.acquiredBy.hostname // "unknown"' "${lock_file}" 2>/dev/null || echo "unknown")
        local lock_run
        lock_run=$(jq -r '.workflowRunId // "unknown"' "${lock_file}" 2>/dev/null || echo "unknown")

        if [[ "${lock_state}" == "HELD" ]]; then
            log_warn "Active lock detected for ${edition_id}: run=${lock_run}, pid=${lock_pid}, host=${lock_host}"
            return 1
        fi
    fi
    return 0
}

# ============================================================================
# Environment Validation
# ============================================================================

validate_environment() {
    log_info "Validating execution environment..."

    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js not found in PATH"
        return 1
    fi
    local node_version
    node_version=$(node --version)
    log_info "Node.js version: ${node_version}"

    # Check pnpm
    if ! command -v pnpm >/dev/null 2>&1; then
        log_error "pnpm not found in PATH"
        return 1
    fi
    local pnpm_version
    pnpm_version=$(pnpm --version)
    log_info "pnpm version: ${pnpm_version}"

    # Check workflow script exists
    if [[ ! -f "${WORKFLOW_SCRIPT}" ]]; then
        log_error "Workflow script not found: ${WORKFLOW_SCRIPT}"
        return 1
    fi

    # Check acceptance script exists
    if [[ ! -f "${ACCEPTANCE_SCRIPT}" ]]; then
        log_error "Acceptance script not found: ${ACCEPTANCE_SCRIPT}"
        return 1
    fi

    # Check project root
    if [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
        log_error "Project root not found: ${PROJECT_ROOT}"
        return 1
    fi

    # Check free inference configuration
    if [[ -z "${OPENROUTER_API_KEY:-}" && -z "${GROQ_API_KEY:-}" && -z "${NOUS_API_KEY:-}" ]]; then
        log_warn "No inference API keys configured (OPENROUTER_API_KEY, GROQ_API_KEY, NOUS_API_KEY)"
        log_warn "Workflow will run in validation-only mode if credentials required"
    fi

    log_info "Environment validation passed"
    return 0
}

# ============================================================================
# Workflow Invocation
# ============================================================================

invoke_workflow() {
    local edition_date="$1"
    local mode="$2"
    local extra_args="${3:-}"

    log_info "Invoking workflow orchestrator for edition ${edition_date} in ${mode} mode"

    local cmd="${TXS_CMD} ${WORKFLOW_SCRIPT} --edition ${edition_date} --mode ${mode}"

    if [[ -n "${extra_args}" ]]; then
        cmd="${cmd} ${extra_args}"
    fi

    # Add correlation ID to output directory for traceability
    local output_dir="${PROJECT_ROOT}/data/scheduler/runs/${edition_date}_${CORRELATION_ID}"
    cmd="${cmd} --output-dir ${output_dir}"

    log_info "Command: ${cmd}"
    log_info "Working directory: ${PROJECT_ROOT}"

    cd "${PROJECT_ROOT}"

    local start_time
    start_time=$(date +%s)

    if eval "${cmd}"; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_info "Workflow completed successfully in ${duration}s"
        return 0
    else
        local exit_code=$?
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_error "Workflow failed with exit code ${exit_code} after ${duration}s"
        return ${exit_code}
    fi
}

invoke_acceptance() {
    local edition_date="$1"
    local mode="$2"

    log_info "Invoking publication acceptance for edition ${edition_date} in ${mode} mode"

    local cmd="${TXS_CMD} ${ACCEPTANCE_SCRIPT} --edition ${edition_date} --mode ${mode}"
    local output_dir="${PROJECT_ROOT}/data/scheduler/runs/${edition_date}_${CORRELATION_ID}"
    cmd="${cmd} --output-dir ${output_dir}"

    log_info "Command: ${cmd}"

    cd "${PROJECT_ROOT}"

    if eval "${cmd}"; then
        log_info "Acceptance evaluation completed"
        return 0
    else
        local exit_code=$?
        log_error "Acceptance evaluation failed with exit code ${exit_code}"
        return ${exit_code}
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    log_info "=== AI Daily Intelligence Scheduler Invocation ==="
    log_info "Correlation ID: ${CORRELATION_ID}"
    log_info "Scheduled execution time (Europe/Amsterdam): $(TZ=Europe/Amsterdam date +"%Y-%m-%d %H:%M:%S %Z")"
    log_info "Requested mode: ${EXECUTION_MODE}"

    # Resolve edition date
    local resolved_edition
    resolved_edition=$(resolve_edition_date) || exit 1
    log_info "Resolved edition date: ${resolved_edition}"

    # Calculate reporting interval
    local interval
    interval=$(calculate_reporting_interval "${resolved_edition}")
    local interval_start
    local interval_end
    interval_start=$(echo "${interval}" | cut -d'|' -f1)
    interval_end=$(echo "${interval}" | cut -d'|' -f2)
    log_info "Reporting interval: ${interval_start} → ${interval_end} (exclusive)"

    # Validate environment
    validate_environment || exit 1

    # Check concurrency
    if ! check_concurrency_lock "${resolved_edition}"; then
        log_error "Concurrency lock conflict — another run may be active for this edition"
        exit 1
    fi

    # Activation guard
    local effective_mode="${EXECUTION_MODE}"
    if ! check_activation_guard "${EXECUTION_MODE}"; then
        if [[ "${EXECUTION_MODE}" == "EXECUTE" ]]; then
            log_warn "Activation guard denied EXECUTE mode — falling back to VALIDATE"
            effective_mode="VALIDATE"
        else
            log_info "Running in ${EXECUTION_MODE} mode (scheduler disabled, safe mode)"
        fi
    fi

    log_info "Effective execution mode: ${effective_mode}"

    # Execute workflow
    local workflow_exit=0
    invoke_workflow "${resolved_edition}" "${effective_mode}" || workflow_exit=$?

    # For EXECUTE/VALIDATE modes, also run acceptance
    local acceptance_exit=0
    if [[ "${effective_mode}" == "EXECUTE" || "${effective_mode}" == "VALIDATE" ]]; then
        invoke_acceptance "${resolved_edition}" "${effective_mode}" || acceptance_exit=$?
    fi

    # Determine overall exit code
    local overall_exit=0
    if [[ ${workflow_exit} -ne 0 ]]; then
        overall_exit=${workflow_exit}
    elif [[ ${acceptance_exit} -ne 0 ]]; then
        overall_exit=${acceptance_exit}
    fi

    if [[ ${overall_exit} -eq 0 ]]; then
        log_info "=== Scheduler invocation completed successfully ==="
    else
        log_error "=== Scheduler invocation failed with exit code ${overall_exit} ==="
    fi

    exit ${overall_exit}
}

main "$@"