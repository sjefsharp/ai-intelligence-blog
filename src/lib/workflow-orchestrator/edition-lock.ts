import { Temporal } from "@js-temporal/polyfill";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import {
	WorkflowLockSchema,
	type WorkflowLock,
	type WorkflowLockState,
	WORKFLOW_ID_PATTERNS,
} from "./schema.js";

const LOCK_TTL_HOURS = 24;
const LOCK_DIR = join("data", "locks");

// H05 in older versions wrote these fields alongside the WorkflowLock record.
const PersistedEditionLockSchema = WorkflowLockSchema.extend({
	releasedAt: WorkflowLockSchema.shape.acquiredAt.optional(),
	releasedBy: WorkflowLockSchema.shape.acquiredBy.shape.user.optional(),
});

export function editionLockPath(editionId: string): string {
	if (!WORKFLOW_ID_PATTERNS.edition.test(editionId))
		throw new Error("Invalid edition lock ID");
	return join(LOCK_DIR, `${editionId}.lock`);
}

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

export async function readEditionLock(
	path: string,
): Promise<WorkflowLock | null> {
	try {
		return PersistedEditionLockSchema.parse(
			JSON.parse(await fs.readFile(path, "utf8")),
		);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return null;
		throw new Error(`Cannot read edition lock ${path}`, { cause: error });
	}
}

/** Serialize cooperating writers and publish only a complete JSON record. */
async function updateEditionLock(
	path: string,
	update: (current: WorkflowLock | null) => WorkflowLock | null,
): Promise<WorkflowLock | null> {
	const guard = `${path}.update`;
	for (let attempt = 0; ; attempt++) {
		try {
			await fs.mkdir(guard);
			break;
		} catch (error) {
			if (!hasCode(error, "EEXIST")) throw error;
			if (attempt === 20) {
				// A crash can leave the guard behind. Never steal it automatically.
				throw new Error(
					`CONCURRENT_EXECUTION: Edition lock update is busy at ${guard}`,
				);
			}
			await setTimeout(25);
		}
	}

	const temporary = join(guard, "state.json");
	try {
		const next = update(await readEditionLock(path));
		if (next) {
			await fs.writeFile(temporary, JSON.stringify(next, null, 2), {
				encoding: "utf8",
				flag: "wx",
			});
			await fs.rename(temporary, path);
		}
		return next;
	} finally {
		await fs.rm(temporary, { force: true });
		await fs.rmdir(guard);
	}
}

export async function claimEditionLock(
	editionId: string,
	forceResume: boolean,
): Promise<WorkflowLock> {
	const lockPath = editionLockPath(editionId);
	const acquiredAt = Temporal.Now.instant();
	const proposed: WorkflowLock = {
		lockId: `lock_${randomBytes(8).toString("hex")}`,
		editionId,
		workflowRunId: `wfr_${randomBytes(8).toString("hex")}`,
		state: "HELD",
		acquiredAt: acquiredAt.toString(),
		acquiredBy: {
			processId: process.pid,
			hostname: hostname(),
			user: process.env.USER || "unknown",
		},
		expiresAt: acquiredAt.add({ hours: LOCK_TTL_HOURS }).toString(),
		lastHeartbeat: acquiredAt.toString(),
		forceReleased: false,
	};
	await fs.mkdir(LOCK_DIR, { recursive: true });
	await updateEditionLock(lockPath, (current) => {
		if (current?.state !== "HELD") return proposed;
		const heartbeat = Temporal.Instant.from(
			current.lastHeartbeat ?? current.acquiredAt,
		);
		const hoursSinceHeartbeat = acquiredAt
			.since(heartbeat)
			.total({ unit: "hour" });
		if (hoursSinceHeartbeat < LOCK_TTL_HOURS && !forceResume) {
			throw new Error(
				`CONCURRENT_EXECUTION: Edition ${editionId} already locked by run ${current.workflowRunId}. Use --force-resume to override.`,
			);
		}
		return proposed;
	});
	return proposed;
}

export async function transitionOwnedEditionLock(
	owner: WorkflowLock,
	state: WorkflowLockState,
): Promise<WorkflowLock | null> {
	return updateEditionLock(editionLockPath(owner.editionId), (current) =>
		current?.lockId === owner.lockId &&
		current.editionId === owner.editionId &&
		current.state === "HELD"
			? {
					...current,
					state,
					lastHeartbeat: Temporal.Now.instant().toString(),
				}
			: null,
	);
}
