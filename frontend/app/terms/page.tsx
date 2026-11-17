import { redirect } from "next/navigation";

// Old URL: the Terms of Use now live at /terms-conditions.
export default function OldTermsPage() {
  redirect("/terms-conditions");
}
