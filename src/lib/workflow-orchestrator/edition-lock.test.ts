import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireLock } from "../editorial-window.js";
import {
	claimEditionLock,
	editionLockPath,
	transitionOwnedEditionLock,
} from "./edition-lock.js";

const editionDate = "2026-11-20";
const editionId = `edition_${editionDate}`;
const originalCwd = process.cwd();
let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "edition-lock-"));
	process.chdir(root);
});
afterEach(() => {
	process.chdir(originalCwd);
	rmSync(root, { recursive: true, force: true });
});

describe("edition lock ownership", () => {
	it("acquires after a legacy stage H05 release", async () => {
		const owner = await claimEditionLock(editionId, false);
		writeFileSync(
			editionLockPath(editionId),
			JSON.stringify({
				...owner,
				state: "FREE",
				releasedAt: owner.acquiredAt,
				releasedBy: "lock-releaser",
			}),
		);
		await expect(claimEditionLock(editionId, false)).resolves.toMatchObject(
			{ state: "HELD" },
		);
	});

	it("recovers an expired legacy lock that has no heartbeat", async () => {
		const owner = await claimEditionLock(editionId, false);
		writeFileSync(
			editionLockPath(editionId),
			JSON.stringify({
				...owner,
				acquiredAt: "2000-01-01T00:00:00Z",
				lastHeartbeat: undefined,
			}),
		);
		const replacement = await claimEditionLock(editionId, false);
		expect(replacement.lockId).not.toBe(owner.lockId);
	});

	it("leaves an abandoned mutation guard in place for operator recovery", async () => {
		const owner = await claimEditionLock(editionId, false);
		const path = editionLockPath(editionId);
		const guard = `${path}.update`;
		mkdirSync(guard);
		writeFileSync(join(guard, "state.json"), "interrupted update");
		await expect(claimEditionLock(editionId, true)).rejects.toThrow(
			"Edition lock update is busy",
		);
		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(owner);
		expect(readFileSync(join(guard, "state.json"), "utf8")).toBe(
			"interrupted update",
		);
	});
	it("fails closed on an unreadable lock without overwriting it", async () => {
		await claimEditionLock(editionId, false);
		const path = editionLockPath(editionId);
		writeFileSync(path, "incomplete lock record");
		await expect(claimEditionLock(editionId, true)).rejects.toThrow(
			"Cannot read edition lock",
		);
		expect(readFileSync(path, "utf8")).toBe("incomplete lock record");
	});

	it("requires the engine's ownership token in stage A05, not just a matching PID", async () => {
		const lock = await claimEditionLock(editionId, false);
		await expect(acquireLock({ editionDate })).rejects.toThrow(
			"does not own",
		);
		await expect(
			acquireLock({ editionDate, ownedLockId: lock.lockId }),
		).resolves.toMatchObject({ "workflow-lock": lock });
	});

	it("permits only one caller to claim an edition at a time", async () => {
		const results = await Promise.allSettled([
			claimEditionLock(editionId, false),
			claimEditionLock(editionId, false),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		for (const result of results) {
			if (result.status === "rejected")
				expect(result.reason.message).toContain("CONCURRENT_EXECUTION");
		}
	});

	it("does not let a previous owner heartbeat or release a replacement lock", async () => {
		const owner = await claimEditionLock(editionId, false);
		const replacement = await claimEditionLock(editionId, true);
		await expect(
			transitionOwnedEditionLock(owner, "HELD"),
		).resolves.toBeNull();
		await expect(
			transitionOwnedEditionLock(owner, "FREE"),
		).resolves.toBeNull();
		expect(
			JSON.parse(readFileSync(editionLockPath(editionId), "utf8")),
		).toEqual(replacement);
	});

	it("allows a new run to acquire a released edition", async () => {
		const owner = await claimEditionLock(editionId, false);
		await expect(
			transitionOwnedEditionLock(owner, "FREE"),
		).resolves.toMatchObject({ state: "FREE" });
		const next = await claimEditionLock(editionId, false);
		expect(next.lockId).not.toBe(owner.lockId);
	});
});
