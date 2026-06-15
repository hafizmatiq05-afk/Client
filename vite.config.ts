import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getConfig } from "@shopify/cli/dist/config.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let config: any;

try {
  config = await getConfig();
} catch {
  // Config loading can fail during build, use defaults
  config = {
    scopes: process.env.SCOPES?.split(",") || [],
  };
}

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.SHOPIFY_API_KEY": JSON.stringify(
      process.env.SHOPIFY_API_KEY
    ),
  },
  ssr: {
    external: ["@shopify/shopify-app-remix"],
  },
});
