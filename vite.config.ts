// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { NitroConfig } from "nitro/types";
import { guardWorkerRequire } from "./src/lib/worker-require-guard";
import { VitePWA } from "vite-plugin-pwa";
import { SCRIPT_TEMA } from "./src/lib/tema";

const workerNitroConfig: NitroConfig = {
    rollupConfig: {
      plugins: [
        {
          name: "esporte360-worker-require-guard",
          generateBundle: {
            order: "post",
            handler(
              _options: unknown,
              bundle: Record<string, { type: "chunk"; code: string } | { type: "asset" }>,
            ) {
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
  vite: {
    plugins: [
      {
        name: "esporte-offline-document",
        apply: "build",
        generateBundle(_options, bundle) {
          const entry = Object.values(bundle).find((b) => b.type === "chunk" && b.facadeModuleId?.endsWith("/src/offline-entry.tsx"));
          if (!entry || entry.type !== "chunk") return;
          const styles = Object.values(bundle).filter((b) => b.type === "asset" && b.fileName.endsWith(".css")).map((b) => `<link rel="stylesheet" href="/${b.fileName}">`).join("");
          this.emitFile({ type: "asset", fileName: "offline-shell.html", source: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Esporte 360 — Sem internet</title><script>${SCRIPT_TEMA}</script>${styles}</head><body><div id="offline-app"></div><script type="module" src="/${entry.fileName}"></script></body></html>` });
        },
      },
      VitePWA({
        strategies: "generateSW", filename: "sw.js", registerType: "autoUpdate", injectRegister: null,
        manifest: false, devOptions: { enabled: false }, outDir: "dist/client",
        workbox: {
          skipWaiting: false, clientsClaim: false, navigateFallback: null,
          globDirectory: "dist/client",
          importScripts: ["/sw-limpeza.js", "/sw-notificacoes-compat.js"],
          globPatterns: ["assets/**/*.{js,css}", "offline-shell.html", "icons/*.png", "favicon.png"],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin && ["/", "/alunos", "/turmas", "/presenca"].includes(url.pathname) && url.search === "",
              handler: "NetworkFirst", options: {
                cacheName: "esporte-public-opening", networkTimeoutSeconds: 4,
                plugins: [{
                  // Never cache SSR HTML. Offline boot uses one anonymous document,
                  // not another route's response; routing uses the original URL.
                  cacheWillUpdate: async () => null,
                  handlerDidError: async () => (await caches.match("/offline-shell.html", { ignoreSearch: true })) ?? Response.error(),
                }],
              },
            },
            { urlPattern: ({ url }) => url.origin === self.location.origin && /^\/assets\/[^/]+-[a-zA-Z0-9_-]{8,}\.(js|css|png|jpg|webp|woff2)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "esporte-versioned-assets" } },
          ],
        },
      }),
    ],
    environments: { client: { build: { rollupOptions: { input: { offline: "src/offline-entry.tsx" } } } } },
  },
  nitro: workerNitroConfig,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
