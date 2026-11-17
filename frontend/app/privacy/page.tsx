import { redirect } from "next/navigation";

// Old URL: the Privacy Policy now lives at /privacy-policy.
export default function OldPrivacyPage() {
  redirect("/privacy-policy");
}
