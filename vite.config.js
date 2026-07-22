import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.test.{js,jsx}"],
    testTimeout: 15000,
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 2048,
  },
});
