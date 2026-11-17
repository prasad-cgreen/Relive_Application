// `npm run dev`: starts API + web with a fresh login. Sessions from earlier runs are ignored by the API
// (development only, see backend/src/middleware/auth.ts). tsx-watch restarts on file edits keep this value,
// so saving a file doesn't log you out; only a new `npm run dev` does.
import { spawn } from "node:child_process";

const child = spawn("npm run dev:servers", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, RELIVE_DEV_RUN_STARTED_AT: String(Date.now()) },
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
