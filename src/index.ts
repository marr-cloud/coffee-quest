/**
 * Cloudflare Worker entry point.
 *
 * `CloudflareBindings` is generated from wrangler.jsonc by `pnpm cf-typegen`.
 * Never hand-write the Env interface: it drifts from the real bindings.
 */
export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const url = new URL(request.url);

		// Structured JSON logging stays queryable in Workers Logs and Logpush.
		console.log(JSON.stringify({ event: "request", method: request.method, path: url.pathname }));

		return Response.json({ message: `Hello World from ${env.ENVIRONMENT}` });
	},
} satisfies ExportedHandler<CloudflareBindings>;
