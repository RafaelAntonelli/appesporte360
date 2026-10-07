// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { NitroConfig } from "nitro/types";
import { guardWorkerRequire } from "./src/lib/worker-require-guard";

const workerNitroConfig: NitroConfig = {
    rollupConfig: {
      plugins: [
        {
          name: "esporte360-worker-require-guard",
          generateBundle: {
            order: "post",
            handler(_options, bundle) {
              for (const entry of Object.values(bundle)) {
                if (entry.type === "chunk") entry.code = guardWorkerRequire(entry.code);
              }
            },
          },
        },
      ],
    },
};

export default defineConfig({
  nitro: workerNitroConfig,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
