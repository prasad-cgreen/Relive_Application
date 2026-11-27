// Sets the agents admin page's shared password. It is stored readable in the database (admin_password table); staff can
// change it later on the page. Setting it signs everyone out of the admin page.
//   npm run admin-password -w backend -- "<new password>"   use this password (8+ characters)
//   npm run admin-password -w backend                        make up a strong one and print it once
import { randomBytes } from "node:crypto";
import { adminPasswordSchema } from "@relive/shared";
import { production } from "./clients.js";
import { setAdminPassword } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.js";

const given = process.argv[2];
try {
  const password = adminPasswordSchema.safeParse(given ?? randomBytes(12).toString("base64url"));
  if (!password.success) throw new Error(password.error.issues[0]!.message);
  await setAdminPassword(password.data);
  await writeAudit({ eventType: "ADMIN_PASSWORD_CHANGED", status: "SUCCESS", metadata: { via: "CLI" } });
  console.log(given ? "Admin password set." : `Admin password set to: ${password.data}\nIt's also in the database: admin_password table, password column.`);
  console.log("Anyone signed in to /admin/agents has been signed out.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await production.$disconnect();
}
