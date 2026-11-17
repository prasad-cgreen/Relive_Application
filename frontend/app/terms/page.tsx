import { FileCheck2 } from "lucide-react";
import { LegalPage, type LegalSection } from "../../components/legal-page";
import { LEGAL } from "../../lib/legal";

const { company, brand, address, grievanceOfficer, email, phone, jurisdiction } = LEGAL;

const sections: LegalSection[] = [
  {
    heading: "About these Terms",
    content: [
      `These Terms of Use ("Terms") govern your use of the ${brand} website and services, operated by ${company} ("${brand}", "we", "us" or "our").`,
      `By ticking the consent box on the sign-in screen, or by using ${brand} in any other way, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use ${brand}.`,
    ],
  },
  {
    heading: `What ${brand} does`,
    content: [
      `${brand} helps you understand your credit report and work through your debts. With your consent, we:`,
      [
        "fetch your credit report from credit information companies such as Experian and CRIF High Mark, through authorised partners;",
        "show your score, accounts, overdue amounts and payment history on your dashboard, with a plain-language summary;",
        `let you request a call back from the ${brand} team about any account.`,
      ],
      `${brand} is not a lender, a bank or a credit information company. We do not lend money, make credit decisions or change what your report says. We do not negotiate with your lenders or settle any debt on your behalf unless you sign a separate written agreement with us for that service.`,
    ],
  },
  {
    heading: "Who can use Relive",
    content: [
      "You may use Relive only if you are at least 18 years old, live in India and can enter into a binding contract under Indian law.",
      "You must use your own mobile number and your own PAN. Using another person's details, even with their permission, is not allowed.",
    ],
  },
  {
    heading: "Verifying your identity",
    content: [
      "We verify your mobile number with a one-time password (OTP) and your PAN through licensed verification providers. If you give an alternate mobile number for your credit report, we verify that number with an OTP too.",
      "If we cannot verify your details, or they appear to be incorrect or not yours, we may ask for more information, refuse to fetch a report, or suspend your access.",
    ],
  },
  {
    heading: "Your account and security",
    content: [
      "Never share an OTP with anyone, including anyone who says they are from Relive. We will never ask you for an OTP over a call, message or email.",
      "For your security, a sign-in session ends automatically after 8 hours, and repeated wrong OTPs lock sign-in for a short time.",
      `If you think someone else has used your account, contact us straight away at ${email}.`,
    ],
  },
  {
    heading: "Your credit report",
    content: [
      "When you consent, you authorise us to request your credit report on your behalf from credit information companies, under the Credit Information Companies (Regulation) Act, 2005 and the terms of those companies. Checking your own report is a soft enquiry and does not affect your credit score.",
      "The report is prepared by the credit information company from data your lenders send them. We show it as we receive it. If something in your report is wrong, you can raise a dispute directly with the credit information company that issued it, and we can guide you on how.",
    ],
  },
  {
    heading: "Summaries and information on Relive",
    content: [
      "The summary on your dashboard (the Relive assessment) is generated automatically from your credit report and what you tell us, partly using artificial intelligence (AI). It may be incomplete or contain mistakes.",
      "Everything on Relive is general information to help you understand your situation. It is not financial, legal, tax or investment advice. Please confirm current balances, dues and terms with your lender before you act.",
      "We do not promise any particular outcome, such as a higher credit score, a loan approval, a settlement or a waiver.",
    ],
  },
  {
    heading: "Fees",
    content: [
      "Fetching your credit report, viewing your dashboard and requesting a call back are free.",
      "If we offer a paid service in the future, we will show you its fees and terms clearly, and you will be charged only after you agree to them separately.",
    ],
  },
  {
    heading: "Messages and calls from us",
    content: [
      "We may contact you by SMS, WhatsApp, email and phone about your account, your credit report and your requests (service messages). With your consent, we may also tell you about our services and relevant offers (promotional messages).",
      `You can stop promotional messages at any time by writing to ${email}. Service messages, such as OTPs and replies to your requests, will continue while you use Relive. We follow the applicable TRAI rules for commercial communication.`,
    ],
  },
  {
    heading: "Acceptable use",
    content: [
      "When using Relive, you must not:",
      [
        "use another person's mobile number, PAN or identity, or pretend to be someone else;",
        "try to access another person's account or data, or any part of Relive you are not meant to reach;",
        "get around our security checks, rate limits or bot protection, or use bots or scripts to access Relive;",
        "upload or send viruses or other harmful code, or disrupt how Relive works;",
        "copy, scrape, resell or reverse engineer Relive or its data;",
        "use Relive for anything unlawful, fraudulent or misleading.",
      ],
    ],
  },
  {
    heading: "Our content and brand",
    content: [
      `The Relive name, logo, design, software and content belong to ${company} or its licensors. You may use them only to use Relive for your own personal purposes. Your credit report and the information you give us remain yours.`,
    ],
  },
  {
    heading: "Services from other providers",
    content: [
      "Relive relies on other providers for OTP delivery, PAN verification, credit reports, hosting and similar services. Their availability is outside our control, and some services may be slow or unavailable at times. Where they apply, their own terms also govern how they handle your request.",
    ],
  },
  {
    heading: "Limits of our responsibility",
    content: [
      "We work to keep Relive accurate, secure and available, but we provide it \"as is\" and cannot guarantee that it will always be uninterrupted or error-free.",
      "As far as the law allows, we are not responsible for losses caused by errors in information supplied by credit information companies or lenders, by decisions you take based on information shown on Relive, or by events outside our reasonable control. Nothing in these Terms limits any right you have that cannot be limited by law.",
    ],
  },
  {
    heading: "Your responsibility",
    content: [
      "If you break these Terms or the law while using Relive, or use someone else's details, you agree to make good any loss, claim or cost this causes us, as far as the law allows.",
    ],
  },
  {
    heading: "Closing your account",
    content: [
      `You can stop using Relive at any time and ask us to delete your account by writing to ${email} from your registered email, or by calling ${phone}. The Privacy Policy explains what we delete and what the law requires us to keep.`,
      "We may suspend or close your access if you break these Terms, if we are required to by law, or to protect you, other users or Relive.",
    ],
  },
  {
    heading: "Changes to these Terms",
    content: [
      "We may update these Terms from time to time. We will show the date of the latest version at the top of this page. If a change materially affects how we use your information, we will ask for your consent again before it applies to you.",
    ],
  },
  {
    heading: "Governing law and disputes",
    content: [
      `These Terms are governed by the laws of India. Please contact us first so we can try to resolve any concern. If a dispute cannot be resolved, the courts at ${jurisdiction} will have jurisdiction.`,
    ],
  },
  {
    heading: "Grievances and contact",
    content: [
      "If you have a question or complaint about Relive, please contact our Grievance Officer:",
      [`Name: ${grievanceOfficer}`, `Email: ${email}`, `Phone: ${phone}`, `Address: ${company}, ${address}`],
      "We will acknowledge your complaint within 24 hours and aim to resolve it within 15 days.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      icon={FileCheck2}
      intro="Please read these Terms carefully. They explain what Relive does, what you agree to when you use it, and how to reach us."
      sections={sections}
    />
  );
}
