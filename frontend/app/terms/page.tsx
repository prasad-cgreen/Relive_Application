import { FileCheck2 } from "lucide-react";
import { LegalPage } from "../../components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      icon={FileCheck2}
      intro="This page is a design placeholder and must be replaced with counsel-approved terms before production launch."
      sections={[
        ["Service scope", "Relive is intended to help eligible users access and understand their own credit information through approved providers."],
        ["Account security", "Users are responsible for protecting their account access and must never disclose a one-time password to another person."],
        ["Accuracy and availability", "Credit information originates from authorized data providers. Provider availability and report contents may vary."],
      ]}
    />
  );
}
