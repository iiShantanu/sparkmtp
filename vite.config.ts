// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        includeAssets: ["pwa-192.png", "pwa-512.png", "apple-touch-icon.png"],
        manifest: {
          name: "Spark",
          short_name: "Spark",
          description: "Teacher-guided AI learning for the classroom.",
          start_url: "/student",
          scope: "/",
          display: "standalone",
          orientation: "any",
          background_color: "#0b1020",
          theme_color: "#0b1020",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          navigationPreload: false,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/_serverFn/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "spark-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "spark-assets",
                expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
