// Company agents, for developers. Staff without a terminal use the admin page instead: /admin/agents (ADMIN_PASSWORD).
// An agent's mobile number is their referral code (referrals with it earn them a benefit), and each agent gets a QR
// code that opens Relive's login with that number already filled in and locked.
//   npm run agent -w backend -- add 9876500001 "Priya Nair"   add (or rename / reactivate) an agent and write their QR code
//   npm run agent -w backend -- list                          agents, how many users each referred, and how many via their QR
//   npm run agent -w backend -- qr 9876500001                 write the QR code again
//   npm run agent -w backend -- deactivate 9876500001         the number stops counting as an agent's
// add and qr take --site <url> for the address in the QR code (default https://relive.co.in).
// QR codes are saved in backend/exports/agent-qr/ (not committed: they carry the agent's number).
import { mkdirSync } from "node:fs";
import QRCode from "qrcode";
import { mobileSchema } from "@relive/shared";
import { production } from "./clients.js";
import { decrypt, hashMobile } from "../lib/crypto.js";
import { listAgents, QR_OPTIONS, referralLink, saveAgent } from "../services/referral.js";

const args = process.argv.slice(2);
const siteAt = args.indexOf("--site");
const site = siteAt >= 0 ? args.splice(siteAt, 2)[1]! : "https://relive.co.in";
const [command, rawMobile, name] = args;

async function writeQr(mobile: string, agentName: string) {
  mkdirSync("exports/agent-qr", { recursive: true });
  const file = `exports/agent-qr/${agentName.replace(/[^a-z0-9]+/gi, "-")}-${mobile.slice(-4)}.png`;
  await QRCode.toFile(file, referralLink(site, mobile), QR_OPTIONS);
  console.log(`QR code saved: backend/${file}\n  It opens ${referralLink(site, mobile)}`);
}

const mobile = () => {
  const parsed = mobileSchema.safeParse(rawMobile ?? "");
  if (!parsed.success) throw new Error(`"${rawMobile ?? ""}" is not a valid 10-digit mobile number`);
  return parsed.data;
};

try {
  if (command === "add" && name?.trim()) {
    const number = mobile();
    const agent = await saveAgent(name.trim(), number);
    console.log(`Agent ${agent.name} (+91 ••••••${agent.mobileLast4}) is active. Referral code: ${number}`);
    await writeQr(number, agent.name);
  } else if (command === "qr") {
    const agent = await production.agent.findUnique({ where: { mobileHash: hashMobile(mobile()) } });
    if (!agent) console.log("No agent with that number. Add them first.");
    else await writeQr(decrypt(agent.mobileEncrypted), agent.name);
  } else if (command === "deactivate") {
    const { count } = await production.agent.updateMany({ where: { mobileHash: hashMobile(mobile()) }, data: { active: false } });
    console.log(count ? "Deactivated: referrals with this number no longer count as an agent's." : "No agent with that number.");
  } else if (command === "list") {
    const agents = await listAgents();
    if (agents.length === 0) console.log("No agents yet.");
    console.table(agents.map((a) => ({ name: a.name, mobile: `••••••${a.mobile.slice(-4)}`, active: a.active, referrals: a.referrals, viaQr: a.viaQr, added: a.createdAt.slice(0, 10) })));
  } else {
    console.log('Usage: npm run agent -w backend -- add <mobile> "<name>" | list | qr <mobile> | deactivate <mobile>  [--site <url>]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await production.$disconnect();
}
