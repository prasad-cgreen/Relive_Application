import { ShieldCheck } from "lucide-react";
import { LegalPage } from "../../components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      icon={ShieldCheck}
      intro="This page is a design placeholder and must be replaced with counsel-approved language before production launch."
      sections={[
        ["Information and purpose", "Relive will clearly identify the personal information it requests and the purpose for which each item is processed."],
        ["Consent and control", "Identity verification and credit-report access will use separate, explicit authorization. Applicable withdrawal and grievance options will be provided."],
        ["Security and retention", "Sensitive information will be protected using access controls, encryption, retention limits and auditable security practices."],
      ]}
    />
  );
}
