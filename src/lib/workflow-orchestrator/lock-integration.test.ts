import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEditorialWindow } from "../editorial-window.js";
import {
	claimEditionLock,
	editionLockPath,
	readEditionLock,
} from "./edition-lock.js";
import { WorkflowOrchestrator } from "./engine.js";
import { aggregateEvidence, releaseLock } from "./phases/phase-h.js";
import { CliOptionsSchema, type EditionContext } from "./schema.js";

const editionDate = "2026-11-20";
const editionId = `edition_${editionDate}`;
const originalCwd = process.cwd();
let root: string;
let engine: WorkflowOrchestrator;

function editionContext(): EditionContext {
	const window = getEditorialWindow(editionDate);
	return {
		editionId,
		editionDate,
		timezone: "Europe/Amsterdam",
		reportingWindow: {
			start: window.start,
			end: window.end,
			startZoned: window.startZoned.toString(),
			endZoned: window.endZoned.toString(),
			durationHours: window.durationHours,
		},
		windowResolvedAt: window.end,
	};
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "workflow-lock-integration-"));
	process.chdir(root);
	engine = new WorkflowOrchestrator(
		CliOptionsSchema.parse({ outputDir: join(root, "manifests") }),
	);
});

afterEach(async () => {
	try {
		await engine.releaseLock();
	} finally {
		process.chdir(originalCwd);
		await rm(root, { recursive: true, force: true });
	}
});

describe("Workflow lock hand-off", () => {
	it("lets H05 release the engine's actual on-disk lock", async () => {
		const owner = await engine.acquireLock(editionContext());
		const result = await releaseLock({
			releaseEditionLock: () => engine.releaseLock(),
		});

		expect(result.lock).toMatchObject({
			lockId: owner.lockId,
			state: "FREE",
		});
		expect(result.outputArtifacts).toMatchObject([
			{ artifactId: "released-lock", required: true },
		]);
		const [artifact] = result.outputArtifacts;
		expect(JSON.parse(await readFile(artifact.path, "utf8"))).toEqual(
			result.lock,
		);
		await expect(engine.releaseLock()).resolves.toBeNull();
	});

	it("rejects H05 cleanup after another run takes ownership", async () => {
		await engine.acquireLock(editionContext());
		const replacement = await claimEditionLock(editionId, true);

		await expect(
			releaseLock({ releaseEditionLock: () => engine.releaseLock() }),
		).rejects.toThrow("This run cannot release the edition lock");
		await expect(
			readEditionLock(join(root, editionLockPath(editionId))),
		).resolves.toEqual(replacement);
	});

	it("marks the lock stale when the requested resume manifest is missing", async () => {
		engine = new WorkflowOrchestrator(
			CliOptionsSchema.parse({
				mode: "RESUME",
				resumeFrom: "wfr_0001000000000000",
				outputDir: join(root, "manifests"),
			}),
		);
		await expect(engine.run(editionDate)).rejects.toThrow(
			"No manifest found to resume",
		);
		await expect(
			readEditionLock(join(root, editionLockPath(editionId))),
		).resolves.toMatchObject({ editionId, state: "STALE" });
	});
});

it("persists a bounded plan and report without acquiring an execution lock", async () => {
	const outputDir = join(root, "manifests");
	engine = new WorkflowOrchestrator(
		CliOptionsSchema.parse({
			mode: "PLAN",
			edition: editionDate,
			outputDir,
			onlyStages: ["wfs_a01_resolve_edition", "wfs_a02_load_registries"],
		}),
	);
	await engine.initialize();
	const report = await engine.run();

	expect(report).toMatchObject({
		editionId,
		executionMode: "PLAN",
		stagesSucceeded: 2,
		stagesFailed: 0,
	});
	const reportDir = join(outputDir, "workflow-reports");
	const [filename] = await readdir(reportDir);
	expect(
		JSON.parse(await readFile(join(reportDir, filename), "utf8")),
	).toMatchObject({
		reportId: report.reportId,
		manifestId: report.manifestId,
	});
	await expect(
		readEditionLock(join(root, editionLockPath(editionId))),
	).resolves.toBeNull();
});

describe("Workflow filename selection", () => {
	it("selects the greatest matching manifest filename for the same edition", async () => {
		const outputDir = join(root, "manifests");
		await mkdir(outputDir);
		const manifest = await engine.createManifest(editionContext());
		await Promise.all([
			writeFile(
				join(outputDir, `${editionId}_wfr_0001.json`),
				JSON.stringify({
					...manifest,
					manifestId: "wfr_0001000000000000",
				}),
			),
			writeFile(
				join(outputDir, `${editionId}_wfr_ffff.json`),
				JSON.stringify({
					...manifest,
					manifestId: "wfr_ffff000000000000",
				}),
			),
			writeFile(
				join(outputDir, "edition_2026-11-21_wfr_ffff.json"),
				"not this edition",
			),
		]);

		await expect(engine.loadManifest(editionId)).resolves.toMatchObject({
			manifestId: "wfr_ffff000000000000",
		});
	});

	it("selects the greatest matching evidence filename and ignores other editions", async () => {
		const directory = join("data", "discovery-ledger");
		await mkdir(directory, { recursive: true });
		const expected = join(directory, `${editionDate}_b.json`);
		await Promise.all([
			writeFile(join(directory, `${editionDate}_a.json`), "{}"),
			writeFile(expected, "{}"),
			writeFile(join(directory, "2026-11-21_z.json"), "{}"),
		]);

		const result = await aggregateEvidence({ editionDate });
		expect(result.evidencePackage.sourceEvidence.discoveryLedgerPath).toBe(
			expected,
		);
	});
});
