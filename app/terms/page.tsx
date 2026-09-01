import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms & safety", description: "RepArc use terms and general strength-training safety limits." };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms & safety · 2 September 2026" title="Train with informed judgment." summary="RepArc is an adult strength-training log and planning aid. It does not replace individualized coaching or medical care.">
      <section><h2>Who may use RepArc</h2><p>You must be at least 18 and able to consent to these terms. Keep access to your email secure because passwordless codes can open your account. Do not attempt to access another person&apos;s records or misuse the service.</p></section>
      <section><h2>General information, not medical advice</h2><p>Programs, load estimates, readiness prompts and technique cues are general educational information. They are not diagnosis, rehabilitation, nutrition treatment, pregnancy guidance or a guarantee of strength, muscle or health outcomes. Evidence describes group averages; individual response varies.</p></section>
      <section><h2>Safety limits</h2><p>Use suitable equipment, a safe environment and qualified supervision where needed. Stop a set for sharp, sudden or worsening pain, faintness, chest pain, severe shortness of breath or loss of control. Seek appropriate medical help for urgent symptoms and professional advice for injury, pregnancy, medical conditions or uncertainty about exercise suitability.</p></section>
      <section><h2>Your choices and records</h2><p>You remain responsible for exercise selection, load, range of motion, form, frequency and whether to train. Check entries and backups for accuracy. Offline and synchronization features reduce interruption risk but cannot guarantee uninterrupted availability or recovery from every device, browser or provider failure.</p></section>
      <section><h2>Service changes</h2><p>RepArc may update programs, features and these terms as evidence, security or operations change. Ready app updates are shown in the interface and do not require signing out. Material policy changes should be reviewed before continued use.</p></section>
      <section><h2>Ending use</h2><p>You may stop using RepArc at any time. Export data first if wanted, then use Delete account to erase the account and associated RepArc cloud records. Deletion cannot recover an unexported history.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms may be sent to <a href="mailto:reparcapp@gmail.com">reparcapp@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
