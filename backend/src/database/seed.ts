import { production } from "./clients.js";
import { hashMobile } from "../lib/crypto.js";

// User 1: Primary Demo User (Direct to Dashboard)
const mobile = "9876543210";
const user = await production.user.upsert({
  where: { mobileHash: hashMobile(mobile) },
  update: { status: "ACTIVE", blockedUntil: null },
  create: { mobileHash: hashMobile(mobile), mobileLast4: mobile.slice(-4), status: "ACTIVE" },
});
console.log(`Demo user ready: ${user.id} (mobile ending ${user.mobileLast4})`);

// User 2: Dedicated PAN Card & KYC Verification Flow Test Account
const kycMobile = "9876543211";
const kycUser = await production.user.upsert({
  where: { mobileHash: hashMobile(kycMobile) },
  update: { status: "ACTIVE", blockedUntil: null },
  create: { mobileHash: hashMobile(kycMobile), mobileLast4: kycMobile.slice(-4), status: "ACTIVE" },
});

await production.userProfile.upsert({
  where: { userId: kycUser.id },
  update: {},
  create: {
    userId: kycUser.id,
    firstName: "Priya",
    lastName: "Patel",
    email: "priya.demo@relive.test",
    dateOfBirth: new Date("1995-08-20"),
    source: "NSDL",
    verified: true,
  },
});

// Reset any completed reports/kyc for this user so it always lands on the KYC PAN screen
await production.creditReport.deleteMany({ where: { userId: kycUser.id } });
await production.kycVerification.deleteMany({ where: { userId: kycUser.id } });
await production.userConsent.deleteMany({ where: { userId: kycUser.id } });

console.log(`PAN/KYC test user ready: ${kycUser.id} (mobile ${kycMobile}, OTP: 123456)`);

await production.$disconnect();
