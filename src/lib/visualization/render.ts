/**
 * Visualization — Rendering Components
 *
 * Accessible Astro components for rendering evidence-based visual explanations.
 * Each component implements WCAG 2.2 AA requirements with semantic HTML,
 * accessible SVG, textual fallbacks, and screenreader-compatible structure.
 */

import type {
	VisualizationSpecification,
	VisualizationLanguageVariant,
	VisualizationRendering,
	VisualizationLanguage,
	ProcessDiagramData,
	ArchitectureDiagramData,
	TimelineData,
	ComparisonTableData,
	QuantitativeChartData,
	ConceptMapData,
	VisualizationData,
} from "./schema.js";

// ============================================================================
// Process Diagram Component
// ============================================================================

/**
 * Renders a process diagram as accessible SVG with textual fallback.
 * Process diagrams show sequential steps, decision points, and branching flows.
 */
export function renderProcessDiagram(
	data: ProcessDiagramData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const { steps, orientation, showDecisions } = data;
	const sortedSteps = steps.toSorted((a, b) => a.order - b.order);

	// Build SVG
	const nodeWidth = 200;
	const nodeHeight = 60;
	const spacing = 40;
	const decisionSize = 80;

	const totalWidth =
		orientation === "left-to-right"
			? sortedSteps.length * (nodeWidth + spacing) + spacing
			: nodeWidth + 2 * spacing;
	const totalHeight =
		orientation === "top-to-bottom"
			? sortedSteps.length * (nodeHeight + spacing) + spacing
			: nodeHeight + 2 * spacing;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-labelledby="viz-title viz-desc" class="process-diagram-svg">`;
	svg += `<title id="viz-title">${variant.title}</title>`;
	svg += `<desc id="viz-desc">${variant.longDescription}</desc>`;

	// Definitions for markers
	svg += `<defs>`;
	svg += `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="var(--ink)" /></marker>`;
	svg += `<style><![CDATA[
    .process-node { fill: var(--sheet); stroke: var(--ink); stroke-width: 2; }
    .process-node.decision { fill: var(--valley-light); stroke: var(--valley); }
    .process-node.start-end { fill: var(--gold); stroke: var(--gold-dim); }
    .process-label { font-family: var(--font-reading); font-size: 14px; fill: var(--ink); text-anchor: middle; dominant-baseline: middle; }
    .process-edge { stroke: var(--ink); stroke-width: 2; fill: none; marker-end: url(#arrowhead); }
    .process-edge.conditional { stroke-dasharray: 5,5; }
  ]]></style>`;
	svg += `</defs>`;

	// Calculate positions
	const positions = sortedSteps.map((step, index) => {
		if (orientation === "top-to-bottom") {
			return {
				x: totalWidth / 2,
				y: spacing + index * (nodeHeight + spacing) + nodeHeight / 2,
			};
		} else {
			return {
				x: spacing + index * (nodeWidth + spacing) + nodeWidth / 2,
				y: totalHeight / 2,
			};
		}
	});

	// Draw edges first (behind nodes)
	sortedSteps.forEach((step, index) => {
		const pos = positions[index];
		step.nextStepIds?.forEach((nextId, nextIndex) => {
			const nextStep = sortedSteps.find((s) => s.id === nextId);
			if (!nextStep) return;
			const nextIndex2 = sortedSteps.findIndex((s) => s.id === nextId);
			const nextPos = positions[nextIndex2];

			const isConditional = step.type === "decision" && step.condition;

			let path = "";
			if (orientation === "top-to-bottom") {
				path = `M ${pos.x} ${pos.y + nodeHeight / 2} L ${nextPos.x} ${nextPos.y - nodeHeight / 2}`;
			} else {
				path = `M ${pos.x + nodeWidth / 2} ${pos.y} L ${nextPos.x - nodeWidth / 2} ${nextPos.y}`;
			}

			svg += `<path class="process-edge${isConditional ? " conditional" : ""}" d="${path}" />`;

			// Add condition label for decision branches
			if (isConditional && step.condition) {
				const midX = (pos.x + nextPos.x) / 2;
				const midY = (pos.y + nextPos.y) / 2;
				svg += `<text x="${midX}" y="${midY - 10}" class="process-label" font-size="12px">${escapeXml(step.condition)}</text>`;
			}
		});
	});

	// Draw nodes
	sortedSteps.forEach((step, index) => {
		const pos = positions[index];
		const isDecision = step.type === "decision";
		const isStartEnd = step.type === "start" || step.type === "end";

		if (isDecision) {
			// Diamond shape for decisions
			const halfSize = decisionSize / 2;
			const points = [
				`${pos.x} ${pos.y - halfSize}`, // top
				`${pos.x + halfSize} ${pos.y}`, // right
				`${pos.x} ${pos.y + halfSize}`, // bottom
				`${pos.x - halfSize} ${pos.y}`, // left
			].join(" ");
			svg += `<polygon class="process-node decision" points="${points}" />`;
			svg += `<text x="${pos.x}" y="${pos.y}" class="process-label">${escapeXml(step.label)}</text>`;
		} else if (isStartEnd) {
			// Rounded rectangle for start/end
			const rx = nodeWidth / 2;
			const ry = nodeHeight / 2;
			svg += `<ellipse class="process-node start-end" cx="${pos.x}" cy="${pos.y}" rx="${rx}" ry="${ry}" />`;
			svg += `<text x="${pos.x}" y="${pos.y}" class="process-label">${escapeXml(step.label)}</text>`;
		} else {
			// Rectangle for actions
			svg += `<rect class="process-node" x="${pos.x - nodeWidth / 2}" y="${pos.y - nodeHeight / 2}" width="${nodeWidth}" height="${nodeHeight}" rx="8" ry="8" />`;
			svg += `<text x="${pos.x}" y="${pos.y}" class="process-label">${escapeXml(step.label)}</text>`;
		}
	});

	svg += `</svg>`;

	// Build accessible table fallback
	const table = buildProcessTableFallback(sortedSteps, variant);

	// Wrap in figure with caption and accessible table
	return `
<figure class="visualization-figure process-diagram" data-viz-id="${spec.visualizationId}" data-type="process-diagram">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-primary" role="img" aria-labelledby="viz-title viz-desc">
    ${svg}
  </div>
  <details class="visualization-fallback" open>
    <summary>${variant.language === "nl" ? "Tekstuele weergave" : "Textual representation"}</summary>
    ${table}
  </details>
</figure>
  `.trim();
}

/**
 * Builds an accessible HTML table representation of the process diagram.
 */
function buildProcessTableFallback(
	steps: ProcessDiagramData["steps"],
	variant: VisualizationLanguageVariant,
): string {
	const headers =
		variant.language === "nl"
			? ["Stap", "Type", "Beschrijving", "Volgende stappen", "Voorwaarde"]
			: ["Step", "Type", "Description", "Next Steps", "Condition"];

	let html = `<table class="visualization-table">`;
	html += `<caption class="sr-only">${variant.longDescription}</caption>`;
	html += `<thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
	html += `<tbody>`;

	steps.forEach((step) => {
		const typeLabels =
			variant.language === "nl"
				? {
						action: "Actie",
						decision: "Besluit",
						start: "Start",
						end: "Einde",
						"parallel-start": "Parallel start",
						"parallel-end": "Parallel einde",
						subprocess: "Subproces",
					}
				: {
						action: "Action",
						decision: "Decision",
						start: "Start",
						end: "End",
						"parallel-start": "Parallel Start",
						"parallel-end": "Parallel End",
						subprocess: "Subprocess",
					};

		const nextSteps =
			step.nextStepIds?.join(", ") || (step.type === "end" ? "—" : "");
		const condition = step.condition || "—";

		html += `<tr>`;
		html += `<td>${escapeXml(step.label)}</td>`;
		html += `<td>${typeLabels[step.type as keyof typeof typeLabels] || step.type}</td>`;
		html += `<td>${escapeXml(step.description || "—")}</td>`;
		html += `<td>${escapeXml(nextSteps)}</td>`;
		html += `<td>${escapeXml(condition)}</td>`;
		html += `</tr>`;
	});

	html += `</tbody></table>`;
	return html;
}

// ============================================================================
// Architecture Diagram Component
// ============================================================================

/**
 * Renders an architecture diagram as accessible SVG with textual fallback.
 * Shows components, trust boundaries, and connections with sync/async distinction.
 */
export function renderArchitectureDiagram(
	data: ArchitectureDiagramData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const { components, connections = [], trustBoundaries = [], layout } = data;

	// Simple force-directed layout positions (simplified)
	const componentPositions = new Map<string, { x: number; y: number }>();
	const width = 800;
	const height = 600;
	const centerX = width / 2;
	const centerY = height / 2;

	// Place components in a circle around center
	components.forEach((comp, index) => {
		const angle = (index / components.length) * 2 * Math.PI;
		const radius = Math.min(width, height) * 0.35;
		componentPositions.set(comp.id, {
			x: centerX + radius * Math.cos(angle),
			y: centerY + radius * Math.sin(angle),
		});
	});

	// Adjust for trust boundaries (group components)
	trustBoundaries.forEach((boundary) => {
		const boundaryComps = components.filter((c) =>
			boundary.componentIds.includes(c.id),
		);
		if (boundaryComps.length > 1) {
			// Calculate center of group
			let cx = 0,
				cy = 0;
			boundaryComps.forEach((c) => {
				const pos = componentPositions.get(c.id);
				if (pos) {
					cx += pos.x;
					cy += pos.y;
				}
			});
			cx /= boundaryComps.length;
			cy /= boundaryComps.length;
			// Move boundary components closer to group center
			boundaryComps.forEach((c) => {
				const pos = componentPositions.get(c.id);
				if (pos) {
					pos.x = cx + (pos.x - cx) * 0.5;
					pos.y = cy + (pos.y - cy) * 0.5;
				}
			});
		}
	});

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="viz-title viz-desc" class="architecture-diagram-svg">`;
	svg += `<title id="viz-title">${variant.title}</title>`;
	svg += `<desc id="viz-desc">${variant.longDescription}</desc>`;
	svg += `<defs>`;
	svg += `<marker id="arrowhead-arch" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="var(--ink)" /></marker>`;
	svg += `<style><![CDATA[
    .arch-component { stroke-width: 2; }
    .arch-component.agent { fill: var(--valley-light); stroke: var(--valley); }
    .arch-component.tool { fill: var(--mountain-light); stroke: var(--mountain); }
    .arch-component.model { fill: var(--gold); stroke: var(--gold-dim); color: var(--ink); }
    .arch-component.database { fill: var(--sheet); stroke: var(--ink); stroke-dasharray: 5,5; }
    .arch-component.api { fill: var(--sheet); stroke: var(--ink); }
    .arch-component.gateway { fill: var(--valley-light); stroke: var(--valley); stroke-width: 3; }
    .arch-component.user { fill: var(--ink); stroke: var(--ink); color: var(--sheet); }
    .arch-component.external-system { fill: none; stroke: var(--ink-muted); stroke-width: 2; stroke-dasharray: 10,5; }
    .arch-component.memory { fill: var(--sheet-darker); stroke: var(--ink-muted); }
    .arch-component.orchestrator { fill: var(--gold); stroke: var(--gold-dim); stroke-width: 3; }
    .arch-label { font-family: var(--font-reading); font-size: 12px; fill: var(--ink); text-anchor: middle; }
    .arch-trust-boundary { fill: none; stroke: var(--gold); stroke-width: 2; stroke-dasharray: 8,4; opacity: 0.6; }
    .arch-trust-label { font-family: var(--font-structural); font-size: 11px; fill: var(--gold); text-anchor: middle; }
    .arch-connection { stroke: var(--ink); stroke-width: 1.5; fill: none; marker-end: url(#arrowhead-arch); }
    .arch-connection.async { stroke-dasharray: 5,5; }
    .arch-connection.auth { stroke: var(--gold); stroke-width: 2; }
    .arch-connection.feedback { stroke: var(--valley); stroke-width: 1.5; opacity: 0.7; }
  ]]></style>`;
	svg += `</defs>`;

	// Draw trust boundaries first (behind components)
	trustBoundaries.forEach((boundary) => {
		const boundaryComps = components.filter((c) =>
			boundary.componentIds.includes(c.id),
		);
		if (boundaryComps.length === 0) return;

		const positions = boundaryComps
			.map((c) => componentPositions.get(c.id))
			.filter(Boolean) as { x: number; y: number }[];
		if (positions.length === 0) return;

		// Calculate bounding box
		const minX = Math.min(...positions.map((p) => p.x)) - 60;
		const maxX = Math.max(...positions.map((p) => p.x)) + 60;
		const minY = Math.min(...positions.map((p) => p.y)) - 60;
		const maxY = Math.max(...positions.map((p) => p.y)) + 60;

		svg += `<rect class="arch-trust-boundary" x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="15" ry="15" />`;
		svg += `<text class="arch-trust-label" x="${(minX + maxX) / 2}" y="${minY - 10}">${escapeXml(boundary.label)}</text>`;
	});

	// Draw connections
	connections.forEach((conn) => {
		const fromPos = componentPositions.get(conn.from);
		const toPos = componentPositions.get(conn.to);
		if (!fromPos || !toPos) return;

		let strokeClass = "arch-connection";
		if (conn.synchronicity === "asynchronous") strokeClass += " async";
		if (conn.type === "authorization") strokeClass += " auth";
		if (conn.type === "feedback") strokeClass += " feedback";

		svg += `<line class="${strokeClass}" x1="${fromPos.x}" y1="${fromPos.y}" x2="${toPos.x}" y2="${toPos.y}" />`;

		// Add label if present
		if (conn.label) {
			const midX = (fromPos.x + toPos.x) / 2;
			const midY = (fromPos.y + toPos.y) / 2;
			svg += `<text x="${midX}" y="${midY - 5}" class="arch-label" font-size="10px">${escapeXml(conn.label)}</text>`;
		}
	});

	// Draw components
	components.forEach((comp) => {
		const pos = componentPositions.get(comp.id);
		if (!pos) return;

		const size = 80;
		const typeClass = comp.type;

		svg += `<g class="arch-component ${typeClass}">`;
		if (comp.type === "database") {
			// Cylinder for database
			svg += `<ellipse cx="${pos.x}" cy="${pos.y - size / 2 + 10}" rx="${size / 2}" ry="15" />`;
			svg += `<rect x="${pos.x - size / 2}" y="${pos.y - size / 2 + 10}" width="${size}" height="${size - 20}" />`;
			svg += `<ellipse cx="${pos.x}" cy="${pos.y + size / 2}" rx="${size / 2}" ry="15" />`;
		} else if (comp.type === "user") {
			// Person icon
			svg += `<circle cx="${pos.x}" cy="${pos.y - 15}" r="15" />`;
			svg += `<ellipse cx="${pos.x}" cy="${pos.y + 25}" rx="25" ry="15" />`;
		} else {
			// Rounded rect for others
			svg += `<rect x="${pos.x - size / 2}" y="${pos.y - size / 2}" width="${size}" height="${size}" rx="10" ry="10" />`;
		}
		svg += `<text x="${pos.x}" y="${pos.y + 5}" class="arch-label">${escapeXml(comp.label)}</text>`;
		svg += `</g>`;
	});

	svg += `</svg>`;

	// Build accessible table fallback
	const table = buildArchitectureTableFallback(
		components,
		connections,
		trustBoundaries,
		variant,
	);

	return `
<figure class="visualization-figure architecture-diagram" data-viz-id="${spec.visualizationId}" data-type="architecture-diagram">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-primary" role="img" aria-labelledby="viz-title viz-desc">
    ${svg}
  </div>
  <details class="visualization-fallback" open>
    <summary>${variant.language === "nl" ? "Tekstuele weergave" : "Textual representation"}</summary>
    ${table}
  </details>
</figure>
  `.trim();
}

/**
 * Builds an accessible HTML table representation of the architecture diagram.
 */
function buildArchitectureTableFallback(
	components: ArchitectureDiagramData["components"],
	connections: ArchitectureDiagramData["connections"] = [],
	trustBoundaries: ArchitectureDiagramData["trustBoundaries"] = [],
	variant: VisualizationLanguageVariant,
): string {
	const compHeaders =
		variant.language === "nl"
			? ["Component", "Type", "Vertrouwensgrens", "Verantwoordelijkheid"]
			: ["Component", "Type", "Trust Boundary", "Responsibility"];

	let html = `<section class="arch-table-section">`;
	html += `<h3>${variant.language === "nl" ? "Componenten" : "Components"}</h3>`;
	html += `<table class="visualization-table">`;
	html += `<thead><tr>${compHeaders.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
	html += `<tbody>`;

	components.forEach((comp) => {
		const boundary =
			trustBoundaries.find((b) => b.componentIds.includes(comp.id))
				?.label || "—";
		const typeLabels =
			variant.language === "nl"
				? {
						agent: "Agent",
						tool: "Tool",
						model: "Model",
						database: "Database",
						api: "API",
						gateway: "Gateway",
						user: "Gebruiker",
						"external-system": "Extern systeem",
						memory: "Geheugen",
						orchestrator: "Orchestrator",
					}
				: {
						agent: "Agent",
						tool: "Tool",
						model: "Model",
						database: "Database",
						api: "API",
						gateway: "Gateway",
						user: "User",
						"external-system": "External System",
						memory: "Memory",
						orchestrator: "Orchestrator",
					};

		html += `<tr>`;
		html += `<td>${escapeXml(comp.label)}</td>`;
		html += `<td>${typeLabels[comp.type as keyof typeof typeLabels] || comp.type}</td>`;
		html += `<td>${escapeXml(boundary)}</td>`;
		html += `<td>${escapeXml(comp.responsibility || "—")}</td>`;
		html += `</tr>`;
	});

	html += `</tbody></table>`;
	html += `</section>`;

	if (connections.length > 0) {
		const connHeaders =
			variant.language === "nl"
				? ["Van", "Naar", "Type", "Synchroniciteit", "Label"]
				: ["From", "To", "Type", "Synchronicity", "Label"];

		html += `<section class="arch-table-section">`;
		html += `<h3>${variant.language === "nl" ? "Verbindingen" : "Connections"}</h3>`;
		html += `<table class="visualization-table">`;
		html += `<thead><tr>${connHeaders.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
		html += `<tbody>`;

		connections.forEach((conn) => {
			const fromComp = components.find((c) => c.id === conn.from);
			const toComp = components.find((c) => c.id === conn.to);
			const typeLabels =
				variant.language === "nl"
					? {
							"data-flow": "Dataflow",
							"control-flow": "Control flow",
							authorization: "Autorisatie",
							invocation: "Aanroep",
							observation: "Observatie",
							feedback: "Feedback",
						}
					: {
							"data-flow": "Data Flow",
							"control-flow": "Control Flow",
							authorization: "Authorization",
							invocation: "Invocation",
							observation: "Observation",
							feedback: "Feedback",
						};
			const syncLabels =
				variant.language === "nl"
					? { synchronous: "Synchroon", asynchronous: "Asynchroon" }
					: {
							synchronous: "Synchronous",
							asynchronous: "Asynchronous",
						};

			html += `<tr>`;
			html += `<td>${escapeXml(fromComp?.label || conn.from)}</td>`;
			html += `<td>${escapeXml(toComp?.label || conn.to)}</td>`;
			html += `<td>${typeLabels[conn.type as keyof typeof typeLabels] || conn.type}</td>`;
			html += `<td>${conn.synchronicity ? syncLabels[conn.synchronicity as keyof typeof syncLabels] : "—"}</td>`;
			html += `<td>${escapeXml(conn.label || "—")}</td>`;
			html += `</tr>`;
		});

		html += `</tbody></table>`;
		html += `</section>`;
	}

	if (trustBoundaries.length > 0) {
		const tbHeaders =
			variant.language === "nl"
				? ["Vertrouwensgrens", "Niveau", "Componenten"]
				: ["Trust Boundary", "Level", "Components"];

		html += `<section class="arch-table-section">`;
		html += `<h3>${variant.language === "nl" ? "Vertrouwensgrenzen" : "Trust Boundaries"}</h3>`;
		html += `<table class="visualization-table">`;
		html += `<thead><tr>${tbHeaders.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
		html += `<tbody>`;

		trustBoundaries.forEach((boundary) => {
			const levelLabels =
				variant.language === "nl"
					? {
							trusted: "Vertrouwd",
							"semi-trusted": "Deels vertrouwd",
							untrusted: "Niet vertrouwd",
							external: "Extern",
						}
					: {
							trusted: "Trusted",
							"semi-trusted": "Semi-Trusted",
							untrusted: "Untrusted",
							external: "External",
						};

			html += `<tr>`;
			html += `<td>${escapeXml(boundary.label)}</td>`;
			html += `<td>${levelLabels[boundary.level as keyof typeof levelLabels] || boundary.level}</td>`;
			html += `<td>${boundary.componentIds.map((id) => components.find((c) => c.id === id)?.label || id).join(", ")}</td>`;
			html += `</tr>`;
		});

		html += `</tbody></table>`;
		html += `</section>`;
	}

	return html;
}

// ============================================================================
// Timeline Component
// ============================================================================

/**
 * Renders a timeline as accessible SVG with semantic HTML fallback.
 * Distinguishes original events from later disclosures.
 */
export function renderTimeline(
	data: TimelineData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const { events, orientation, showGaps, granularity } = data;
	const sortedEvents = events.toSorted(
		(a, b) =>
			new Date(a.displayDate).getTime() -
			new Date(b.displayDate).getTime(),
	);

	// Build SVG timeline
	const padding = 60;
	const lineWidth = 4;
	const eventRadius = 12;
	const labelOffset = 30;

	const dates = sortedEvents.map((e) => new Date(e.displayDate).getTime());
	const minDate = Math.min(...dates);
	const maxDate = Math.max(...dates);
	const dateRange = maxDate - minDate || 1;

	const width = orientation === "horizontal" ? 900 : 200;
	const height =
		orientation === "horizontal"
			? 400
			: sortedEvents.length * 100 + 2 * padding;

	const availableLength =
		orientation === "horizontal"
			? width - 2 * padding
			: height - 2 * padding;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="viz-title viz-desc" class="timeline-svg">`;
	svg += `<title id="viz-title">${variant.title}</title>`;
	svg += `<desc id="viz-desc">${variant.longDescription}</desc>`;
	svg += `<defs>`;
	svg += `<style><![CDATA[
    .timeline-axis { stroke: var(--ink); stroke-width: ${lineWidth}; fill: none; }
    .timeline-event { fill: var(--gold); stroke: var(--gold-dim); stroke-width: 2; cursor: pointer; }
    .timeline-event.disclosure { fill: var(--valley); stroke: var(--valley-dark); }
    .timeline-event.update { fill: var(--mountain); stroke: var(--mountain-dark); }
    .timeline-event.previously-covered { opacity: 0.5; }
    .timeline-label { font-family: var(--font-reading); font-size: 13px; fill: var(--ink); }
    .timeline-date { font-family: var(--font-structural); font-size: 11px; fill: var(--ink-muted); }
    .timeline-gap { stroke: var(--ink-muted); stroke-width: 1; stroke-dasharray: 4,4; }
  ]]></style>`;
	svg += `</defs>`;

	// Draw axis
	if (orientation === "horizontal") {
		svg += `<line class="timeline-axis" x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" />`;
	} else {
		svg += `<line class="timeline-axis" x1="${width / 2}" y1="${padding}" x2="${width / 2}" y2="${height - padding}" />`;
	}

	// Draw events
	sortedEvents.forEach((event, index) => {
		const date = new Date(event.displayDate).getTime();
		const progress = (date - minDate) / dateRange;
		const position = padding + progress * availableLength;

		let cx: number, cy: number;
		let labelX: number, labelY: number;
		let dateX: number, dateY: number;
		let textAnchor: "start" | "middle" | "end" = "middle";

		if (orientation === "horizontal") {
			cx = position;
			cy = height / 2;
			labelX = position;
			labelY = height / 2 - labelOffset;
			dateX = position;
			dateY = height / 2 + labelOffset + 20;
			textAnchor = "middle";
		} else {
			cx = width / 2;
			cy = position;
			labelX = width / 2 + labelOffset;
			labelY = position + 5;
			dateX = width / 2 - labelOffset - 5;
			dateY = position + 5;
			textAnchor = "end";
		}

		// Event marker
		const eventClass = `timeline-event${event.timestampType === "first-disclosure" ? " disclosure" : ""}${event.timestampType === "substantive-update" ? " update" : ""}${event.previouslyCovered ? " previously-covered" : ""}`;
		svg += `<circle class="${eventClass}" cx="${cx}" cy="${cy}" r="${eventRadius}" data-event-id="${event.id}" />`;

		// Event label
		svg += `<text x="${labelX}" y="${labelY}" class="timeline-label" text-anchor="${textAnchor}">${escapeXml(event.label)}</text>`;

		// Event date
		const formattedDate = new Date(event.displayDate).toLocaleDateString(
			variant.language === "nl" ? "nl-NL" : "en-US",
			{ year: "numeric", month: "short", day: "numeric" },
		);
		svg += `<text x="${dateX}" y="${dateY}" class="timeline-date" text-anchor="${textAnchor}">${formattedDate}</text>`;

		// Show gap marker if enabled and not first event
		if (showGaps && index > 0) {
			const prevDate = new Date(
				sortedEvents[index - 1].displayDate,
			).getTime();
			const gapProgress = (date + prevDate) / 2;
			const gapPos =
				padding +
				((gapProgress - minDate) / dateRange) * availableLength;

			if (orientation === "horizontal") {
				svg += `<line class="timeline-gap" x1="${gapPos}" y1="${height / 2 - 10}" x2="${gapPos}" y2="${height / 2 + 10}" />`;
			} else {
				svg += `<line class="timeline-gap" x1="${width / 2 - 10}" y1="${gapPos}" x2="${width / 2 + 10}" y2="${gapPos}" />`;
			}
		}
	});

	svg += `</svg>`;

	// Build accessible table fallback
	const table = buildTimelineTableFallback(sortedEvents, variant);

	return `
<figure class="visualization-figure timeline" data-viz-id="${spec.visualizationId}" data-type="timeline">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-primary" role="img" aria-labelledby="viz-title viz-desc">
    ${svg}
  </div>
  <details class="visualization-fallback" open>
    <summary>${variant.language === "nl" ? "Tekstuele weergave" : "Textual representation"}</summary>
    ${table}
  </details>
</figure>
  `.trim();
}

/**
 * Builds an accessible HTML table representation of the timeline.
 */
function buildTimelineTableFallback(
	events: TimelineData["events"],
	variant: VisualizationLanguageVariant,
): string {
	const headers =
		variant.language === "nl"
			? [
					"Datum",
					"Type",
					"Gebeurtenis",
					"Beschrijving",
					"Tijdstempeltype",
					"Eerder gedekt",
				]
			: [
					"Date",
					"Type",
					"Event",
					"Description",
					"Timestamp Type",
					"Previously Covered",
				];

	let html = `<table class="visualization-table">`;
	html += `<caption class="sr-only">${variant.longDescription}</caption>`;
	html += `<thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
	html += `<tbody>`;

	const typeLabels =
		variant.language === "nl"
			? {
					release: "Release",
					disclosure: "Openbaarmaking",
					"research-publication": "Onderzoekspublicatie",
					"security-advisory": "Beveiligingsadvies",
					deprecation: "Afschaffing",
					update: "Update",
					milestone: "Mijlpaal",
				}
			: {
					release: "Release",
					disclosure: "Disclosure",
					"research-publication": "Research Publication",
					"security-advisory": "Security Advisory",
					deprecation: "Deprecation",
					update: "Update",
					milestone: "Milestone",
				};

	const tsLabels =
		variant.language === "nl"
			? {
					"original-event": "Originele gebeurtenis",
					"first-disclosure": "Eerste openbaarmaking",
					publication: "Publicatie",
					"substantive-update": "Substantiële update",
				}
			: {
					"original-event": "Original Event",
					"first-disclosure": "First Disclosure",
					publication: "Publication",
					"substantive-update": "Substantive Update",
				};

	events.forEach((event) => {
		const formattedDate = new Date(event.displayDate).toLocaleDateString(
			variant.language === "nl" ? "nl-NL" : "en-US",
			{ year: "numeric", month: "long", day: "numeric" },
		);

		html += `<tr${event.previouslyCovered ? ' class="previously-covered"' : ""}>`;
		html += `<td>${formattedDate}</td>`;
		html += `<td>${typeLabels[event.type as keyof typeof typeLabels] || event.type}</td>`;
		html += `<td>${escapeXml(event.label)}</td>`;
		html += `<td>${escapeXml(event.description || "—")}</td>`;
		html += `<td>${tsLabels[event.timestampType as keyof typeof tsLabels] || event.timestampType}</td>`;
		html += `<td>${event.previouslyCovered ? (variant.language === "nl" ? "Ja" : "Yes") : variant.language === "nl" ? "Nee" : "No"}</td>`;
		html += `</tr>`;
	});

	html += `</tbody></table>`;
	return html;
}

// ============================================================================
// Comparison Table Component
// ============================================================================

/**
 * Renders a comparison table as semantic HTML with full accessibility.
 * This is the primary output format for comparison tables.
 */
export function renderComparisonTable(
	data: ComparisonTableData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const { columns, rows, caption, defaultSort } = data;

	// Sort rows if defaultSort specified
	let sortedRows = [...rows];
	if (defaultSort) {
		const { columnId, direction } = defaultSort;
		sortedRows.sort((a, b) => {
			const aVal = a.cells[columnId];
			const bVal = b.cells[columnId];
			if (aVal === null && bVal === null) return 0;
			if (aVal === null) return 1;
			if (bVal === null) return -1;
			const comparison = String(aVal).localeCompare(
				String(bVal),
				variant.language === "nl" ? "nl" : "en",
				{ numeric: true },
			);
			return direction === "asc" ? comparison : -comparison;
		});
	}

	// Build HTML table
	let html = `<figure class="visualization-figure comparison-table" data-viz-id="${spec.visualizationId}" data-type="comparison-table">`;
	html += `<figcaption class="visualization-caption">`;
	html += `<strong>${variant.title}</strong>`;
	html += `<p>${variant.caption}</p>`;
	html += `</figcaption>`;

	html += `<div class="visualization-primary" role="region" aria-label="${escapeXml(variant.title)}">`;
	html += `<table class="visualization-table comparison-table">`;
	html += `<caption class="sr-only">${escapeXml(variant.longDescription)}</caption>`;

	// Header
	html += `<thead><tr>`;
	columns.forEach((col) => {
		const sortAttr =
			defaultSort?.columnId === col.id
				? `aria-sort="${defaultSort.direction === "asc" ? "ascending" : "descending"}"`
				: "";
		html += `<th scope="col" ${sortAttr}>${escapeXml(col.header)}</th>`;
	});
	html += `</tr></thead>`;

	// Body
	html += `<tbody>`;
	sortedRows.forEach((row, rowIndex) => {
		const rowClass = row.isGroupHeader
			? "group-header"
			: rowIndex % 2 === 0
				? "even"
				: "odd";
		html += `<tr class="${rowClass}">`;

		columns.forEach((col, colIndex) => {
			const cellValue = row.cells[col.id];
			let displayValue: string;

			if (cellValue === null || cellValue === undefined) {
				displayValue = "—";
			} else if (typeof cellValue === "boolean") {
				displayValue = cellValue
					? variant.language === "nl"
						? "✓ Ja"
						: "✓ Yes"
					: variant.language === "nl"
						? "✗ Nee"
						: "✗ No";
			} else if (typeof cellValue === "number") {
				displayValue = cellValue.toLocaleString(
					variant.language === "nl" ? "nl-NL" : "en-US",
				);
				if (col.unit) displayValue += ` ${col.unit}`;
			} else {
				displayValue = escapeXml(String(cellValue));
			}

			const scope = colIndex === 0 ? 'scope="row"' : "";
			const classAttr = row.isGroupHeader
				? 'class="group-header-cell"'
				: "";
			html += `<td ${scope} ${classAttr}>${displayValue}</td>`;
		});

		html += `</tr>`;
	});
	html += `</tbody>`;

	html += `</table>`;
	html += `</div>`;

	// Source attribution
	if (rows.some((r) => r.sourceAttribution)) {
		html += `<details class="visualization-sources">`;
		html += `<summary>${variant.language === "nl" ? "Bronnen" : "Sources"}</summary>`;
		html += `<ul>`;
		rows.filter((r) => r.sourceAttribution).forEach((row) => {
			html += `<li>${escapeXml(row.label)}: ${escapeXml(row.sourceAttribution!)}</li>`;
		});
		html += `</ul>`;
		html += `</details>`;
	}

	html += `</figure>`;

	return html;
}

// ============================================================================
// Quantitative Chart Component
// ============================================================================

/**
 * Renders a quantitative chart as accessible SVG with required data table fallback.
 * Preserves original measured values, units, baselines, uncertainty.
 */
export function renderQuantitativeChart(
	data: QuantitativeChartData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const {
		chartType,
		series,
		xAxis,
		yAxis,
		accessibleTable,
		showUncertainty,
		legend,
	} = data;

	// Build SVG chart (simplified bar/line chart)
	const padding = { top: 40, right: 40, bottom: 60, left: 80 };
	const width = 800;
	const height = 500;
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;

	// Determine data ranges
	const allX = series.flatMap((s) => s.data.map((d) => d.x));
	const allY = series.flatMap((s) => s.data.map((d) => d.y));

	const isTimeX = xAxis.type === "time";
	const isCategoryX = xAxis.type === "category";

	// For category axis, collect unique categories
	const categories = isCategoryX ? [...new Set(allX.map(String))].sort() : [];

	let xMin: number, xMax: number;
	let xScale: (x: unknown) => number;

	if (isCategoryX) {
		xMin = 0;
		xMax = Math.max(1, categories.length - 1);
		xScale = (x: unknown) => {
			const idx = categories.indexOf(String(x));
			return (
				padding.left +
				(idx / Math.max(1, categories.length - 1)) * chartWidth
			);
		};
	} else if (isTimeX) {
		const dates = allX.map((d) => new Date(String(d)).getTime());
		xMin = Math.min(...dates);
		xMax = Math.max(...dates);
		xScale = (x: unknown) => {
			const date = new Date(String(x)).getTime();
			return (
				padding.left + ((date - xMin) / (xMax - xMin || 1)) * chartWidth
			);
		};
	} else {
		const nums = allX.map(Number);
		xMin = Math.min(...nums);
		xMax = Math.max(...nums);
		xScale = (x: unknown) => {
			return (
				padding.left +
				((Number(x) - xMin) / (xMax - xMin || 1)) * chartWidth
			);
		};
	}

	const yMin = yAxis.includeZero
		? Math.min(0, Math.min(...allY))
		: Math.min(...allY);
	const yMax = Math.max(...allY);
	const yScale = (y: number) => {
		const normalized = (y - yMin) / (yMax - yMin || 1);
		return padding.top + chartHeight * (1 - normalized);
	};

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="viz-title viz-desc" class="chart-svg">`;
	svg += `<title id="viz-title">${variant.title}</title>`;
	svg += `<desc id="viz-desc">${variant.longDescription}</desc>`;
	svg += `<defs>`;
	svg += `<style><![CDATA[
    .chart-axis { stroke: var(--ink); stroke-width: 1; fill: none; }
    .chart-grid { stroke: var(--mountain-light); stroke-width: 0.5; fill: none; }
    .chart-axis-label { font-family: var(--font-reading); font-size: 13px; fill: var(--ink); text-anchor: middle; }
    .chart-tick-label { font-family: var(--font-structural); font-size: 11px; fill: var(--ink-muted); }
    .chart-series-bar { opacity: 0.8; }
    .chart-series-line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .chart-series-point { stroke: var(--sheet); stroke-width: 2; }
    .chart-legend { font-family: var(--font-reading); font-size: 12px; fill: var(--ink); }
    .chart-title { font-family: var(--font-display); font-size: 16px; fill: var(--ink); text-anchor: middle; font-weight: 700; }
  ]]></style>`;
	svg += `</defs>`;

	// Title
	svg += `<text x="${width / 2}" y="25" class="chart-title">${escapeXml(variant.title)}</text>`;

	// Y-axis
	svg += `<line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" />`;

	// Y-axis ticks and grid lines
	const yTicks = 5;
	for (let i = 0; i <= yTicks; i++) {
		const yVal = yMin + (i / yTicks) * (yMax - yMin);
		const yPos = padding.top + (i / yTicks) * chartHeight;
		svg += `<line class="chart-grid" x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" />`;
		svg += `<line class="chart-axis" x1="${padding.left - 5}" y1="${yPos}" x2="${padding.left}" y2="${yPos}" />`;
		const label =
			yAxis.scale === "log"
				? Math.round(Math.pow(10, yVal))
				: Math.round(yVal).toLocaleString(
						variant.language === "nl" ? "nl-NL" : "en-US",
					);
		svg += `<text x="${padding.left - 10}" y="${yPos + 4}" class="chart-tick-label" text-anchor="end">${label}${yAxis.unit ? ` ${yAxis.unit}` : ""}</text>`;
	}

	// X-axis
	svg += `<line class="chart-axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" />`;

	// X-axis ticks
	if (isCategoryX) {
		const categories = [...new Set(allX.map(String))].sort();
		categories.forEach((cat, i) => {
			const xPos =
				padding.left +
				(i / Math.max(1, categories.length - 1)) * chartWidth;
			svg += `<line class="chart-axis" x1="${xPos}" y1="${height - padding.bottom}" x2="${xPos}" y2="${height - padding.bottom + 5}" />`;
			svg += `<text x="${xPos}" y="${height - padding.bottom + 20}" class="chart-tick-label" text-anchor="middle">${escapeXml(cat)}</text>`;
		});
	} else {
		// Numeric/time axis - show 5 ticks
		for (let i = 0; i <= 5; i++) {
			const xVal = xMin + (i / 5) * (xMax - xMin);
			const xPos = xScale(isTimeX ? new Date(xVal) : xVal);
			svg += `<line class="chart-axis" x1="${xPos}" y1="${height - padding.bottom}" x2="${xPos}" y2="${height - padding.bottom + 5}" />`;
			const label = isTimeX
				? new Date(xVal).toLocaleDateString(
						variant.language === "nl" ? "nl-NL" : "en-US",
						{ month: "short", year: "2-digit" },
					)
				: Math.round(xVal).toLocaleString(
						variant.language === "nl" ? "nl-NL" : "en-US",
					);
			svg += `<text x="${xPos}" y="${height - padding.bottom + 20}" class="chart-tick-label" text-anchor="middle">${label}</text>`;
		}
	}

	// Axis labels
	svg += `<text x="${padding.left - 50}" y="${height / 2}" class="chart-axis-label" transform="rotate(-90, ${padding.left - 50}, ${height / 2})">${escapeXml(yAxis.label)}${yAxis.unit ? ` (${yAxis.unit})` : ""}</text>`;
	svg += `<text x="${width / 2}" y="${height - 10}" class="chart-axis-label">${escapeXml(xAxis.label)}${xAxis.unit ? ` (${xAxis.unit})` : ""}</text>`;

	// Colors for series
	const seriesColors = [
		"var(--valley)",
		"var(--gold)",
		"var(--mountain)",
		"var(--ink)",
		"var(--valley-dark)",
		"var(--gold-dim)",
	];

	// Draw series
	series.forEach((s, seriesIndex) => {
		const color = seriesColors[seriesIndex % seriesColors.length];
		const points = s.data.map((d) => ({ x: xScale(d.x), y: yScale(d.y) }));

		if (
			chartType === "bar" ||
			chartType === "grouped-bar" ||
			chartType === "stacked-bar"
		) {
			// Bar chart
			const barWidth =
				chartType === "grouped-bar"
					? (chartWidth /
							(series.length *
								(categories?.length || s.data.length))) *
						0.8
					: (chartWidth / (categories?.length || s.data.length)) *
						0.8;

			points.forEach((p, i) => {
				const barX =
					chartType === "grouped-bar"
						? p.x -
							((series.length - 1) * barWidth) / 2 +
							seriesIndex * barWidth
						: p.x - barWidth / 2;

				svg += `<rect class="chart-series-bar" x="${barX}" y="${p.y}" width="${barWidth}" height="${height - padding.bottom - p.y}" fill="${color}" />`;

				// Error bars for uncertainty
				if (
					showUncertainty &&
					s.data[i].measurement?.confidenceInterval
				) {
					const [ciLow, ciHigh] =
						s.data[i].measurement.confidenceInterval;
					const ciLowY = yScale(ciLow);
					const ciHighY = yScale(ciHigh);
					const centerX = barX + barWidth / 2;
					svg += `<line stroke="${color}" stroke-width="1.5" x1="${centerX}" y1="${ciHighY}" x2="${centerX}" y2="${ciLowY}" />`;
					svg += `<line stroke="${color}" stroke-width="1.5" x1="${centerX - 3}" y1="${ciHighY}" x2="${centerX + 3}" y2="${ciHighY}" />`;
					svg += `<line stroke="${color}" stroke-width="1.5" x1="${centerX - 3}" y1="${ciLowY}" x2="${centerX + 3}" y2="${ciLowY}" />`;
				}
			});
		} else if (chartType === "line" || chartType === "area") {
			// Line/area chart
			const pathData = points
				.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
				.join(" ");
			if (chartType === "area") {
				const areaPath =
					pathData +
					` L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
				svg += `<path d="${areaPath}" fill="${color}" fill-opacity="0.15" />`;
			}
			svg += `<path class="chart-series-line" d="${pathData}" stroke="${color}" />`;

			// Points
			points.forEach((p, i) => {
				svg += `<circle class="chart-series-point" cx="${p.x}" cy="${p.y}" r="4" fill="${color}" />`;
			});
		} else if (chartType === "scatter") {
			// Scatter plot
			points.forEach((p) => {
				svg += `<circle class="chart-series-point" cx="${p.x}" cy="${p.y}" r="5" fill="${color}" />`;
			});
		}
	});

	// Legend
	if (legend?.show !== false) {
		const legendX =
			legend?.position === "left"
				? padding.left
				: width - padding.right - 150;
		const legendY =
			legend?.position === "top"
				? padding.top
				: height - padding.bottom + 20;
		series.forEach((s, i) => {
			const color = seriesColors[i % seriesColors.length];
			const y = legendY + i * 20;
			svg += `<rect x="${legendX}" y="${y}" width="12" height="12" fill="${color}" />`;
			svg += `<text x="${legendX + 18}" y="${y + 9}" class="chart-legend">${escapeXml(s.label)}${s.isBaseline ? ` (${variant.language === "nl" ? "Baseline" : "Baseline"})` : ""}</text>`;
		});
	}

	svg += `</svg>`;

	// Accessible data table (required for charts)
	const tableHtml = renderComparisonTable(
		accessibleTable,
		variant,
		rendering,
		spec,
	);

	return `
<figure class="visualization-figure quantitative-chart" data-viz-id="${spec.visualizationId}" data-type="quantitative-chart">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-primary" role="img" aria-labelledby="viz-title viz-desc">
    ${svg}
  </div>
  <details class="visualization-fallback" open>
    <summary>${variant.language === "nl" ? "Datatabel (toegankelijke weergave)" : "Data table (accessible representation)"}</summary>
    ${tableHtml}
  </details>
</figure>
  `.trim();
}

// ============================================================================
// Concept Map Component
// ============================================================================

/**
 * Renders a concept map as accessible SVG with textual relationship representation.
 */
export function renderConceptMap(
	data: ConceptMapData,
	variant: VisualizationLanguageVariant,
	rendering: VisualizationRendering,
	spec: VisualizationSpecification,
): string {
	const { nodes, edges = [], layout, clusterByCategory } = data;

	// Simple force-directed layout positions
	const width = 800;
	const height = 600;
	const centerX = width / 2;
	const centerY = height / 2;

	const nodePositions = new Map<string, { x: number; y: number }>();

	// Group by category if clustering
	const categories = clusterByCategory
		? [...new Set(nodes.map((n) => n.category))]
		: ["all"];

	categories.forEach((cat, catIndex) => {
		const catNodes = nodes.filter(
			(n) => !clusterByCategory || n.category === cat,
		);
		const angleOffset = (catIndex / categories.length) * 2 * Math.PI;
		const radius = Math.min(width, height) * 0.3;

		catNodes.forEach((node, index) => {
			const angle = angleOffset + (index / catNodes.length) * 2 * Math.PI;
			nodePositions.set(node.id, {
				x: centerX + radius * Math.cos(angle),
				y: centerY + radius * Math.sin(angle),
			});
		});
	});

	// Use provided positions if available
	nodes.forEach((node) => {
		if (node.position) {
			nodePositions.set(node.id, {
				x: node.position[0],
				y: node.position[1],
			});
		}
	});

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="viz-title viz-desc" class="concept-map-svg">`;
	svg += `<title id="viz-title">${variant.title}</title>`;
	svg += `<desc id="viz-desc">${variant.longDescription}</desc>`;
	svg += `<defs>`;
	svg += `<marker id="arrowhead-concept" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--ink)" /></marker>`;
	svg += `<style><![CDATA[
    .concept-node { stroke-width: 2; cursor: pointer; }
    .concept-node.term { fill: var(--valley-light); stroke: var(--valley); }
    .concept-node.technology { fill: var(--gold); stroke: var(--gold-dim); color: var(--ink); }
    .concept-node.principle { fill: var(--mountain-light); stroke: var(--mountain); }
    .concept-node.pattern { fill: var(--ink); stroke: var(--ink); color: var(--sheet); }
    .concept-node.organization { fill: var(--sheet); stroke: var(--ink); stroke-dasharray: 5,5; }
    .concept-node.standard { fill: var(--valley-light); stroke: var(--valley); stroke-width: 3; }
    .concept-node.method { fill: var(--sheet-darker); stroke: var(--ink-muted); }
    .concept-label { font-family: var(--font-reading); font-size: 12px; fill: var(--ink); text-anchor: middle; }
    .concept-edge { stroke: var(--ink-muted); stroke-width: 1.5; fill: none; marker-end: url(#arrowhead-concept); opacity: 0.7; }
    .concept-edge-label { font-family: var(--font-structural); font-size: 10px; fill: var(--ink); text-anchor: middle; }
  ]]></style>`;
	svg += `</defs>`;

	// Draw edges
	edges.forEach((edge) => {
		const fromPos = nodePositions.get(edge.from);
		const toPos = nodePositions.get(edge.to);
		if (!fromPos || !toPos) return;

		// Curved line for better readability
		const midX = (fromPos.x + toPos.x) / 2;
		const midY = (fromPos.y + toPos.y) / 2;
		const dx = toPos.x - fromPos.x;
		const dy = toPos.y - fromPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const offset = Math.min(50, dist * 0.2);
		const perpX = (-dy / dist) * offset;
		const perpY = (dx / dist) * offset;
		const ctrlX = midX + perpX;
		const ctrlY = midY + perpY;

		svg += `<path class="concept-edge" d="M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}" />`;

		if (edge.label) {
			svg += `<text x="${ctrlX}" y="${ctrlY - 5}" class="concept-edge-label">${escapeXml(edge.label)}</text>`;
		}
	});

	// Draw nodes
	nodes.forEach((node) => {
		const pos = nodePositions.get(node.id);
		if (!pos) return;

		const radius = 50;
		svg += `<circle class="concept-node ${node.category}" cx="${pos.x}" cy="${pos.y}" r="${radius}" />`;
		svg += `<text x="${pos.x}" y="${pos.y + 4}" class="concept-label">${escapeXml(node.label)}</text>`;
	});

	svg += `</svg>`;

	// Build accessible textual representation
	const textRepresentation = buildConceptMapTextFallback(
		nodes,
		edges,
		variant,
	);

	return `
<figure class="visualization-figure concept-map" data-viz-id="${spec.visualizationId}" data-type="concept-map">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-primary" role="img" aria-labelledby="viz-title viz-desc">
    ${svg}
  </div>
  <details class="visualization-fallback" open>
    <summary>${variant.language === "nl" ? "Tekstuele weergave" : "Textual representation"}</summary>
    ${textRepresentation}
  </details>
</figure>
  `.trim();
}

/**
 * Builds an accessible textual representation of the concept map.
 */
function buildConceptMapTextFallback(
	nodes: ConceptMapData["nodes"],
	edges: ConceptMapData["edges"] = [],
	variant: VisualizationLanguageVariant,
): string {
	const categoryLabels =
		variant.language === "nl"
			? {
					term: "Term",
					technology: "Technologie",
					principle: "Principe",
					pattern: "Patroon",
					organization: "Organisatie",
					standard: "Standaard",
					method: "Methode",
				}
			: {
					term: "Term",
					technology: "Technology",
					principle: "Principle",
					pattern: "Pattern",
					organization: "Organization",
					standard: "Standard",
					method: "Method",
				};

	const edgeLabels =
		variant.language === "nl"
			? {
					requires: "vereist",
					enables: "maakt mogelijk",
					extends: "breidt uit",
					implements: "implementeert",
					contrasts: "contrastert met",
					"related-to": "gerelateerd aan",
					"part-of": "deel van",
					governs: "regelt",
				}
			: {
					requires: "requires",
					enables: "enables",
					extends: "extends",
					implements: "implements",
					contrasts: "contrasts with",
					"related-to": "related to",
					"part-of": "part of",
					governs: "governs",
				};

	let html = `<div class="concept-map-text">`;

	// Nodes with definitions
	html += `<section>`;
	html += `<h3>${variant.language === "nl" ? "Concepten" : "Concepts"}</h3>`;
	html += `<dl>`;

	nodes.forEach((node) => {
		html += `<dt><strong>${escapeXml(node.label)}</strong> <span class="concept-category">(${categoryLabels[node.category as keyof typeof categoryLabels] || node.category})</span></dt>`;
		if (node.definition) {
			html += `<dd>${escapeXml(node.definition)}</dd>`;
		}
	});

	html += `</dl>`;
	html += `</section>`;

	// Relationships
	if (edges.length > 0) {
		html += `<section>`;
		html += `<h3>${variant.language === "nl" ? "Relaties" : "Relationships"}</h3>`;
		html += `<ul>`;

		edges.forEach((edge) => {
			const fromNode = nodes.find((n) => n.id === edge.from);
			const toNode = nodes.find((n) => n.id === edge.to);
			const label =
				edge.label ||
				edgeLabels[edge.type as keyof typeof edgeLabels] ||
				edge.type;
			html += `<li>${escapeXml(fromNode?.label || edge.from)} <strong>${label}</strong> ${escapeXml(toNode?.label || edge.to)}</li>`;
		});

		html += `</ul>`;
		html += `</section>`;
	}

	html += `</div>`;
	return html;
}

// ============================================================================
// Main Render Function
// ============================================================================

/**
 * Main render function that dispatches to the appropriate visualization renderer.
 */
export function renderVisualization(
	spec: VisualizationSpecification,
	language: "nl" | "en" = "en",
): string {
	const variant =
		spec.languageVariants.find((v) => v.language === language) ||
		spec.languageVariants[0];
	const { type, data } = spec;

	// Handle FAILED and UNAVAILABLE render statuses with fallback
	if (spec.status.renderStatus === "FAILED") {
		return renderFailedVisualization(spec, variant);
	}
	if (spec.status.renderStatus === "UNAVAILABLE") {
		return renderUnavailableVisualization(spec, variant);
	}

	let visualizationHtml: string;

	switch (type) {
		case "process-diagram":
			visualizationHtml = renderProcessDiagram(
				data.data as ProcessDiagramData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		case "architecture-diagram":
			visualizationHtml = renderArchitectureDiagram(
				data.data as ArchitectureDiagramData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		case "timeline":
			visualizationHtml = renderTimeline(
				data.data as TimelineData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		case "comparison-table":
			visualizationHtml = renderComparisonTable(
				data.data as ComparisonTableData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		case "quantitative-chart":
			visualizationHtml = renderQuantitativeChart(
				data.data as QuantitativeChartData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		case "concept-map":
			visualizationHtml = renderConceptMap(
				data.data as ConceptMapData,
				variant,
				spec.rendering,
				spec,
			);
			break;
		default:
			throw new Error(`Unknown visualization type: ${type}`);
	}

	// Wrap with uncertainty disclosure for all visualization types
	const uncertaintyHtml = renderUncertaintyDisclosure(spec, variant);
	if (uncertaintyHtml) {
		// Insert uncertainty disclosure before the closing </figure> tag
		visualizationHtml = visualizationHtml.replace(
			"</figure>",
			`${uncertaintyHtml}</figure>`,
		);
	}

	return visualizationHtml;
}

/**
 * Render a failed visualization with fallback.
 */
function renderFailedVisualization(
	spec: VisualizationSpecification,
	variant: VisualizationLanguageVariant,
): string {
	const locale = variant.language;
	const unavailableText =
		locale === "nl"
			? "Deze visualisatie kon niet worden gerenderd."
			: "This visualization could not be rendered.";
	const fallbackText =
		locale === "nl" ? "Tekstuele weergave" : "Textual representation";

	return `
<figure class="visualization-figure" data-viz-id="${spec.visualizationId}" data-type="${spec.type}" data-viz-status="FAILED">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-failed">
    <p>${unavailableText}</p>
    <details class="visualization-fallback" open>
      <summary>${fallbackText}</summary>
      <div class="visualization-long-description">
        ${variant.longDescription}
      </div>
    </details>
  </div>
  ${renderUncertaintyDisclosure(spec, variant)}
</figure>
  `.trim();
}

/**
 * Render an unavailable visualization with fallback.
 */
function renderUnavailableVisualization(
	spec: VisualizationSpecification,
	variant: VisualizationLanguageVariant,
): string {
	const locale = variant.language;
	const unavailableText =
		locale === "nl"
			? "Deze visualisatie is niet beschikbaar."
			: "This visualization is unavailable.";
	const fallbackText =
		locale === "nl" ? "Tekstuele weergave" : "Textual representation";

	return `
<figure class="visualization-figure" data-viz-id="${spec.visualizationId}" data-type="${spec.type}" data-viz-status="UNAVAILABLE">
  <figcaption class="visualization-caption">
    <strong>${variant.title}</strong>
    <p>${variant.caption}</p>
  </figcaption>
  <div class="visualization-unavailable">
    <p>${unavailableText}</p>
    <details class="visualization-fallback" open>
      <summary>${fallbackText}</summary>
      <div class="visualization-long-description">
        ${variant.longDescription}
      </div>
    </details>
  </div>
  ${renderUncertaintyDisclosure(spec, variant)}
</figure>
  `.trim();
}

/**
 * Render uncertainty and limitations disclosure.
 */
function renderUncertaintyDisclosure(
	spec: VisualizationSpecification,
	variant: VisualizationLanguageVariant,
): string {
	const { uncertainty } = spec;
	const locale = variant.language;

	const hasContent =
		uncertainty.assumptions.length > 0 ||
		uncertainty.limitations.length > 0 ||
		uncertainty.unsupportedInferences.length > 0 ||
		uncertainty.evidenceGaps.length > 0 ||
		uncertainty.causalityRisk ||
		uncertainty.colorOnlyRisk ||
		uncertainty.boundarySimplificationRisk;

	if (!hasContent) return "";

	const title =
		locale === "nl"
			? "Onzekerheden en beperkingen"
			: "Uncertainties and limitations";
	const assumptionLabel = locale === "nl" ? "Aanname: " : "Assumption: ";
	const limitationLabel = locale === "nl" ? "Beperking: " : "Limitation: ";
	const inferenceLabel =
		locale === "nl"
			? "Niet-ondersteunde inferentie: "
			: "Unsupported inference: ";
	const gapLabel = locale === "nl" ? "Bewijsgat: " : "Evidence gap: ";

	let html = `<details class="visualization-uncertainty"><summary>${title}</summary><ul>`;

	uncertainty.assumptions.forEach((a) => {
		html += `<li><strong>${assumptionLabel}</strong>${escapeXml(a)}</li>`;
	});
	uncertainty.limitations.forEach((l) => {
		html += `<li><strong>${limitationLabel}</strong>${escapeXml(l)}</li>`;
	});
	uncertainty.unsupportedInferences.forEach((i) => {
		html += `<li><strong>${inferenceLabel}</strong>${escapeXml(i)}</li>`;
	});
	uncertainty.evidenceGaps.forEach((g) => {
		html += `<li><strong>${gapLabel}</strong>${escapeXml(g)}</li>`;
	});

	if (uncertainty.causalityRisk) {
		const msg =
			locale === "nl"
				? "Deze visualisatie kan causaliteit impliceren die niet door bewijs wordt ondersteund."
				: "This visualization may imply causality not supported by evidence.";
		html += `<li class="uncertainty-warning">⚠ ${msg}</li>`;
	}
	if (uncertainty.colorOnlyRisk) {
		const msg =
			locale === "nl"
				? "Deze visualisatie gebruikt kleur als enig informatiekanaal."
				: "This visualization uses color as the sole information channel.";
		html += `<li class="uncertainty-warning">⚠ ${msg}</li>`;
	}
	if (uncertainty.boundarySimplificationRisk) {
		const msg =
			locale === "nl"
				? "Kritieke vertrouwensgrenzen kunnen in deze visualisatie oversimpel zijn weergegeven."
				: "Critical trust boundaries may be oversimplified in this visualization.";
		html += `<li class="uncertainty-warning">⚠ ${msg}</li>`;
	}

	html += `</ul></details>`;
	return html;
}

/**
 * Escape XML special characters for safe embedding in SVG/HTML.
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&" + "amp;")
		.replace(/</g, "&" + "lt;")
		.replace(/>/g, "&" + "gt;")
		.replace(/"/g, "&" + "quot;")
		.replace(/'/g, "&" + "apos;");
}
