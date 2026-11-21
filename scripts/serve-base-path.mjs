#!/usr/bin/env node
/**
 * Serve the built site under its configured base path.
 *
 * `astro preview` serves `dist` at the domain root, so a base-prefixed build
 * (asset URLs such as `/ai-intelligence-blog/_astro/...`) returns 404. CI uses
 * this server to verify the exact production artifact.
 *
 * Usage:
 *   SITE_BASE=/ai-intelligence-blog/ PORT=4321 node scripts/serve-base-path.mjs
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const base = process.env.SITE_BASE ?? "/ai-intelligence-blog/";
const port = Number(process.env.PORT ?? 4321);

const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".xml": "application/xml; charset=utf-8",
};

function resolveRequestFile(pathname) {
	const basePath = base.replace(/\/$/, "");
	const stripped =
		pathname === basePath
			? "/"
			: pathname.startsWith(base)
				? pathname.slice(base.length)
				: pathname;
	const relative = normalize(decodeURIComponent(stripped)).replace(
		/^[/\\]+/,
		"",
	);
	const candidate = resolve(join(root, relative));
	const insideRoot = candidate === root || candidate.startsWith(root + sep);
	if (!insideRoot) return null;
	if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	const index = join(candidate, "index.html");
	return existsSync(index) ? index : null;
}

createServer((request, response) => {
	const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
	const file = resolveRequestFile(url.pathname);
	if (!file) {
		response.writeHead(404);
		response.end("Not found");
		return;
	}
	response.writeHead(200, {
		"content-type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
	});
	createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
	console.log(`Serving ${root} at http://127.0.0.1:${port}${base}`);
});
