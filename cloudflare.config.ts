import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "lingering-mountain-bef0",
    compatibilityDate: "2026-11-21",
    assets: {
      htmlHandling: "drop-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
});
