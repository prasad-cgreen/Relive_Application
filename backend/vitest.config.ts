import { defineConfig } from "vitest/config";

// Tests always use mock providers: real IndiConnect calls send SMS and are billed.
export default defineConfig({ test: { env: { NODE_ENV: "test", OTP_PROVIDER: "mock", PAN_PROVIDER: "mock", BUREAU_PROVIDER: "mock" } } });
