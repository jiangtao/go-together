import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

const playwrightArtifactDirectory = path.resolve(
  process.env.PLAYWRIGHT_ARTIFACT_DIR ?? ".generated/playwright"
)

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.join(playwrightArtifactDirectory, "test-results"),
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(playwrightArtifactDirectory, "report"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run serve:e2e",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet-1024",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel: "chromium",
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-360",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: "chromium",
        viewport: { width: 360, height: 800 },
      },
    },
  ],
})
