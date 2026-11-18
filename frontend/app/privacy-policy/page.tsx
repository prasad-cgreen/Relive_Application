import { ShieldCheck } from "lucide-react";
import { LegalPage, type LegalSection } from "../../components/legal-page";
import { LEGAL } from "../../lib/legal";

const { company, brand, address, grievanceOfficer, email, phone } = LEGAL;

const sections: LegalSection[] = [
  {
    heading: "Who we are",
    content: [
      `${brand} is operated by ${company} ("${brand}", "we", "us" or "our"). This Privacy Policy explains what personal data we collect when you use ${brand}, why we collect it, who we share it with and the choices you have.`,
      `We are the Data Fiduciary for your personal data under the Digital Personal Data Protection Act, 2023. This policy applies to the ${brand} website and services in India.`,
    ],
  },
  {
    heading: "What we collect",
    content: [
      "Information you give us:",
      [
        "your mobile number, and an alternate mobile number if you give one for your credit report;",
        "your PAN, your name as on PAN, and your date of birth and email address if you choose to add them;",
        "what brings you to Relive (the concern you select) and anything you write in \"Tell us in your own words\";",
        "the details you share when you ask the Relive team to call you back.",
      ],
      "Information we receive from others, with your consent:",
      [
        "the result of your PAN verification, including the name registered with your PAN;",
        "your credit report from credit information companies such as Experian and CRIF High Mark: your credit score, loans and cards, lenders, balances, overdue amounts, payment history and credit enquiries.",
      ],
      "Information collected automatically:",
      [
        "the time, IP address and browser details recorded when you give consent;",
        "a sign-in session cookie, and security and activity logs (for example, OTP requests and report fetches) that protect your account;",
        "a bot check by Cloudflare Turnstile on the sign-in screen.",
      ],
    ],
  },
  {
    heading: "Why we use it",
    content: [
      [
        "To verify your mobile number and PAN, and keep your account secure.",
        "To fetch your credit report and show your score, accounts and payment history on your dashboard.",
        "To write a summary of your report and suggested next steps, based on what you tell us.",
        "To call you back and support you when you ask for help.",
        "To send you service messages, and promotional messages if you have agreed to them.",
        "To prevent fraud and misuse, fix problems and improve Relive.",
        "To meet our legal obligations and respond to lawful requests from authorities.",
      ],
      "We use your personal data only for the purposes you consented to, or where the law otherwise allows.",
    ],
  },
  {
    heading: "Your consent",
    content: [
      "We ask for your consent on the sign-in screen before we send an OTP or fetch your report. We record when you consented, the version of the text you agreed to, and the IP address and browser you used.",
      `You can withdraw your consent at any time by writing to ${email}. Once you withdraw it, we will stop the processing that depends on it, such as fetching new reports or sending promotional messages. This does not affect processing that already took place, and some services may no longer be available to you.`,
    ],
  },
  {
    heading: "How we use AI for your summary",
    content: [
      "The Relive assessment on your dashboard is written by an AI model provided by OpenAI, acting as our service provider. To write it, we send the figures from your credit report (score, accounts, lender names, balances and payment history), the concern you selected and the text you wrote.",
      "We do not send your name, PAN, mobile number, date of birth, email address or account numbers. The summary only helps you understand your report. It is not used to make any decision about you.",
    ],
  },
  {
    heading: "Who we share it with",
    content: [
      "We share your personal data only as needed to run Relive, with:",
      [
        "credit information companies (such as Experian and CRIF High Mark), to fetch your credit report;",
        "verification and messaging partners, to send OTPs and verify your PAN;",
        "service providers who host our systems, protect against bots, send emails and write your AI summary, under contracts that require them to protect your data;",
        "the Relive team, only as needed to help you;",
        "government bodies, regulators, courts or law enforcement, where the law requires it;",
        "a buyer or successor if our business is merged or transferred, who must protect your data as this policy describes.",
      ],
      "We never sell your personal data. We do not share your credit report with lenders or other third parties for their marketing.",
    ],
  },
  {
    heading: "Where your data is processed",
    content: [
      "Some of our service providers, such as the provider of our AI summary, may process data outside India. We transfer personal data only as permitted under Indian law, and we choose providers that keep it secure.",
    ],
  },
  {
    heading: "How we protect it",
    content: [
      [
        "Data is encrypted in transit (HTTPS) and sensitive details, such as your mobile number, PAN and what you write to us, are encrypted when stored.",
        "OTPs and sign-in tokens are stored only in a scrambled (hashed) form, OTPs expire after 5 minutes, and sessions end after 8 hours.",
        "Access to your data is limited to people who need it, and access to your report is logged.",
      ],
      "No system is completely secure. If a breach affects your personal data, we will inform you and the Data Protection Board of India as the law requires.",
    ],
  },
  {
    heading: "How long we keep it",
    content: [
      "We keep your personal data while your account is active and for as long as needed for the purposes above. A credit report is treated as current for 30 days, after which a fresh one can be fetched with your consent.",
      "When you delete your account or the purpose ends, we delete your data or make it anonymous, unless the law requires us to keep certain records (such as consent and security logs) for longer.",
    ],
  },
  {
    heading: "Your rights",
    content: [
      "Under the Digital Personal Data Protection Act, 2023, you have the right to:",
      [
        "get a summary of the personal data we hold about you and how we use it;",
        "correct, complete or update your personal data;",
        "have your personal data erased, unless the law requires us to keep it;",
        "withdraw your consent;",
        "have your grievance addressed by us;",
        "nominate a person to exercise your rights if you die or are unable to.",
      ],
      `To use any of these rights, write to ${email}. We may ask you to confirm your identity first. If you are not satisfied with our response, you can complain to the Data Protection Board of India.`,
    ],
  },
  {
    heading: "Cookies and similar technologies",
    content: [
      "We use one essential cookie to keep you signed in. It cannot be read by scripts on the page and expires after 8 hours. Cloudflare Turnstile may use its own essential cookies to check that you are not a bot. Your browser's local storage remembers whether you were signed in.",
      "We do not use advertising cookies or third-party analytics. If you block essential cookies in your browser, you will not be able to sign in.",
    ],
  },
  {
    heading: "Children",
    content: [
      "Relive is only for people aged 18 and over. We do not knowingly collect personal data from children. If we learn that we have, we will delete it.",
    ],
  },
  {
    heading: "Deleting your account",
    content: [
      `To delete your account and data, write to ${email} from your registered email, or call ${phone}, and tell us your registered mobile number. After confirming it is you, we will delete your profile, credit reports, the answers you gave us and your call back requests, and confirm when this is done. We keep only the records the law requires.`,
    ],
  },
  {
    heading: "Changes to this policy",
    content: [
      "We may update this policy from time to time. We will show the date of the latest version at the top of this page. If a change materially affects how we use your personal data, we will ask for your consent again.",
    ],
  },
  {
    heading: "Grievance Officer and contact",
    content: [
      "For questions, requests or complaints about your personal data, contact our Grievance Officer:",
      [`Name: ${grievanceOfficer}`, `Email: ${email}`, `Phone: ${phone}`, `Address: ${company}, ${address}`],
      "We will acknowledge your complaint within 24 hours and aim to resolve it within 15 days.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      icon={ShieldCheck}
      intro="Your financial information is personal. This policy explains, in plain language, what Relive collects, why, and how you stay in control."
      sections={sections}
    />
  );
}
