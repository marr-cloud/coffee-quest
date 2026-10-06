import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

// Narrows the global `Request` to the Cloudflare-flavoured one that
// `worker.fetch()` expects.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("worker", () => {
	it("responds with JSON (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toEqual({ message: "Hello World from development" });
	});

	it("responds with JSON (integration style)", async () => {
		const response = await exports.default.fetch("https://example.com/");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "Hello World from development" });
	});
});
