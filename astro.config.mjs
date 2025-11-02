// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // TODO: Update this URL when deploying to production
  site: "https://10x-cards.pages.dev",
  output: "server",
  integrations: [react(), sitemap()],
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces
  },
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
