import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy · RepArc", description: "How RepArc handles account and training data." };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Your data stays yours." summary="This notice explains what RepArc stores, why it is needed, where offline copies live, and how to remove it.">
      <section><h2>What RepArc stores</h2><p>RepArc stores your verified email and internal account ID; the training label you choose; profile preferences such as units, program track, lifting experience, bodyweight and goals; workout entries, swaps, readiness selections, training maxes and weigh-ins; and any feedback you submit. Minimal crash diagnostics are collected only when you opt in. Short-lived security counters record the account ID, protected action, request count and timing—but never workout contents or network addresses—to control abuse.</p></section>
      <section><h2>Why it is used</h2><p>The data is used to authenticate you, generate and adjust training views, preserve history, synchronize devices, restore backups, investigate feedback and keep the service reliable. RepArc does not sell personal data, use it for advertising, or store payment information.</p></section>
      <section><h2>Offline and cloud copies</h2><p>Your latest training copy and unfinished workout drafts can be stored in this browser&apos;s IndexedDB and local storage so training continues without a connection. Authentication credentials use protected cookies. Cloud account and training records are processed by Supabase; the web app is hosted by Netlify; authentication email is delivered through the configured mail provider.</p></section>
      <section><h2>Retention and control</h2><p>Training data remains until you change or delete it. Submitted feedback is automatically deleted after 180 days, opt-in diagnostics after 30 days, and inactive security counters after 2 days. Account deletion removes the account and its live cloud training profile, feedback, diagnostics and counters immediately, plus that account&apos;s offline copy on the current device. Provider backups may retain encrypted copies until their normal backup cycle expires. You can export CSV and JSON copies from Data &amp; account before deletion.</p></section>
      <section><h2>Shared devices and backups</h2><p>Signing out removes the protected session but intentionally preserves that account&apos;s isolated offline training copy for the next sign-in. Use Delete account when you want the current-device copy erased too. Files you export are outside RepArc&apos;s control, so protect or delete them yourself.</p></section>
      <section><h2>Questions or requests</h2><p>Use the private feedback form in Data &amp; account for privacy questions. If you can sign in, the deletion control is the fastest way to exercise deletion rights. Do not include medical or highly sensitive information in feedback.</p></section>
    </LegalPage>
  );
}
