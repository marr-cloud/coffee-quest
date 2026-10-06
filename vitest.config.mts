import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with the real bindings from wrangler.jsonc.
// GAFETE_SECRET es un secreto: en tests se inyecta un valor fijo, nunca el real.
export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: { bindings: { GAFETE_SECRET: "secreto-solo-para-tests-no-es-el-real" } },
		}),
	],
});
