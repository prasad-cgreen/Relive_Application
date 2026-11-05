import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.log(`Relive API listening on http://127.0.0.1:${env.PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
