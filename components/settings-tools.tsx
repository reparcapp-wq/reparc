"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, FileUp, MessageSquareText, RefreshCw, ShieldCheck, Smartphone, Trash2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadTrainingBackup, parseTrainingBackup, restoredTrainingData, type BackupPreview, type RestoreMode } from "@/lib/backup";
import { diagnosticsEnabled, setDiagnosticsEnabled, submitBetaFeedback } from "@/lib/diagnostics";
import type { Account } from "@/lib/account-client";
import type { TrainingData } from "@/lib/training";
import type { PwaLifecycle } from "@/hooks/use-pwa";

export function SettingsTools({ account, data, pwa, onRestore, onSignOut, onDeleteAccount, onMessage }: {
  account: Account;
  data: TrainingData;
  pwa: PwaLifecycle;
  onRestore: (data: TrainingData, mode: RestoreMode) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => diagnosticsEnabled(account.id));
  const [feedbackCategory, setFeedbackCategory] = useState("bug");
  const [feedback, setFeedback] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toolSection, setToolSection] = useState<"account" | "app" | "restore" | "diagnostics" | "feedback" | "danger" | null>(null);

  const chooseBackup = async (file?: File) => {
    if (!file) return;
    try {
      const next = parseTrainingBackup(await file.text());
      setPreview(next);
      setRestoreMode("merge");
      setRestoreOpen(true);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "That backup could not be read.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restore = async () => {
    if (!preview) return;
    setRestoreBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTrainingBackup(data, `pre-restore-backup-${stamp}.json`);
      const next = restoredTrainingData(data, preview.data, restoreMode);
      const saved = await onRestore(next, restoreMode);
      if (saved) {
        setRestoreOpen(false);
        onMessage(`${restoreMode === "merge" ? "Backup merged" : "Backup restored"}. A pre-restore safety copy was downloaded.`);
      } else {
        onMessage("The backup was validated but could not be saved.");
      }
    } finally {
      setRestoreBusy(false);
    }
  };

  const toggleDiagnostics = (enabled: boolean) => {
    setDiagnostics(enabled);
    setDiagnosticsEnabled(account.id, enabled);
    onMessage(enabled ? "Minimal crash diagnostics enabled" : "Crash diagnostics disabled");
  };

  const sendFeedback = async () => {
    if (!navigator.onLine) {
      onMessage("Reconnect before sending feedback.");
      return;
    }
    setFeedbackBusy(true);
    try {
      await submitBetaFeedback(feedbackCategory, feedback, includeContext, { online: navigator.onLine, view: "settings" });
      setFeedback("");
      onMessage("Thank you — your beta feedback was sent.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Feedback could not be sent.");
    } finally {
      setFeedbackBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await onSignOut();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Sign out could not be completed.");
    }
  };

  const removeAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setDeleteBusy(true);
    try {
      await onDeleteAccount();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Account deletion could not be completed. Your data was not changed.");
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <div className="grid overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#121512] md:col-span-2" aria-label="Data and account tools">
        {([
          ["account", "Account & privacy", account.email, ShieldCheck],
          ["app", "App & updates", pwa.installed ? "Installed on this device" : "Install and update options", Smartphone],
          ["restore", "Restore backup", "Validate and restore a JSON backup", FileUp],
          ["diagnostics", "Diagnostics", diagnostics ? "Minimal crash signals on" : "Off", RefreshCw],
          ["feedback", "Private feedback", "Report a bug or share an idea", MessageSquareText],
          ["danger", "Danger zone", "Delete account and training data", Trash2],
        ] as const).map(([value, label, summary, Icon], index) => <button key={value} type="button" aria-expanded={toolSection === value} onClick={() => setToolSection((current) => current === value ? null : value)} style={{ order: index * 2 }} className={`flex min-h-[4rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${index ? "border-t border-white/[0.07]" : ""}`}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${value === "danger" ? "bg-red-300/10 text-red-300" : "bg-white/[0.06] text-stone-300"}`}><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className={`block text-sm ${value === "danger" ? "text-red-200" : "text-stone-200"}`}>{label}</strong><span className="mt-0.5 block truncate text-[11px] text-stone-500">{summary}</span></span><ChevronDown className={`size-4 shrink-0 text-stone-600 transition-transform ${toolSection === value ? "rotate-180" : ""}`} /></button>)}

      {toolSection === "account" && <article style={{ order: 1 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><ShieldCheck className="size-5" /></div><div><p className="eyebrow text-stone-500">Secure account</p><h2 className="mt-1 font-semibold">{account.email}</h2></div></div>
        <p className="mt-4 text-xs leading-5 text-stone-400">Cloud records are isolated to this verified account. Signing out leaves an encrypted-session-free offline copy scoped to this account on the device.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button type="button" variant="outline" className="mt-5 min-h-11 w-full rounded-xl border-white/10 bg-white/[0.035] text-stone-300">Sign out on this device</Button></AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#171a17] text-stone-100"><AlertDialogHeader><AlertDialogTitle>Sign out of this device?</AlertDialogTitle><AlertDialogDescription>Your cloud data will remain safe. This account&apos;s offline records stay isolated on the device for your next sign-in.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Stay signed in</AlertDialogCancel><AlertDialogAction onClick={() => void signOut()}>Sign out</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
        <p className="mt-4 text-center text-[11px] text-stone-500"><a href="/privacy" className="underline decoration-white/20 underline-offset-4 hover:text-stone-300">Privacy</a><span aria-hidden="true"> · </span><a href="/terms" className="underline decoration-white/20 underline-offset-4 hover:text-stone-300">Terms & safety</a></p>
      </article>}

      {toolSection === "app" && <article style={{ order: 3 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><Smartphone className="size-5" /></div><div><p className="eyebrow text-stone-500">Installed app</p><h2 className="mt-1 font-semibold">{pwa.installed ? "Installed on this device" : "Faster access and offline launch"}</h2></div></div>
        <p className="mt-4 text-xs leading-5 text-stone-400">The app checks for updates when it opens, returns to the foreground, reconnects, and periodically while open. Updates wait for your approval so they never interrupt a set.</p>
        {pwa.installAvailable && <Button type="button" onClick={() => void pwa.install()} disabled={pwa.installing} className="mt-5 min-h-11 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c]"><Download className="size-4" />{pwa.installing ? "Opening installer…" : "Install app"}</Button>}
        {pwa.iosInstallHelp && <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-xs leading-5 text-stone-300">On iPhone or iPad, open the Share menu in Safari and choose <strong>Add to Home Screen</strong>.</p>}
        {pwa.updateAvailable && <Button type="button" variant="outline" onClick={pwa.applyUpdate} className="mt-3 min-h-11 w-full rounded-xl border-amber-300/30 text-amber-300"><RefreshCw className="size-4" />Install ready update</Button>}
        {pwa.installed && !pwa.updateAvailable && <p className="mt-4 text-xs text-emerald-300" role="status">Installed · app shell is current</p>}
      </article>}

      {toolSection === "danger" && <article style={{ order: 11 }} className="border-t border-red-300/20 bg-red-300/[0.035] p-5 sm:p-6">
        <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-300/10 text-red-300"><Trash2 className="size-5" /></div><div><p className="eyebrow text-red-300/70">Danger zone</p><h2 className="mt-1 font-semibold text-red-100">Delete account and training data</h2></div></div>
        <p className="mt-4 max-w-2xl text-xs leading-5 text-stone-400">Permanently deletes this account, cloud training history, weigh-ins, feedback, diagnostics, and this account&apos;s offline copy on the current device. Download a full backup first if you may want the records later.</p>
        <Button type="button" variant="outline" onClick={() => { setDeleteConfirmation(""); setDeleteOpen(true); }} className="mt-5 min-h-11 w-full rounded-xl border-red-300/30 bg-red-300/[0.04] text-red-200 hover:bg-red-300/10 hover:text-red-100"><Trash2 className="size-4" />Delete my account</Button>
      </article>}

      {toolSection === "restore" && <article style={{ order: 5 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-stone-300"><FileUp className="size-5" /></div><div><p className="eyebrow text-stone-500">Restore backup</p><h2 className="mt-1 font-semibold">Validate before changing anything</h2></div></div>
        <p className="mt-4 max-w-2xl text-xs leading-5 text-stone-400">The app previews session counts and dates first. Restoring automatically downloads your current data as a rollback copy.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => void chooseBackup(event.target.files?.[0])} className="sr-only" aria-label="Choose RepArc JSON backup" />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="mt-5 min-h-12 w-full rounded-xl border-white/10 bg-white/[0.035] text-stone-300"><Upload className="size-4" />Choose JSON backup</Button>
      </article>}

      {toolSection === "diagnostics" && <article style={{ order: 7 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
        <p className="eyebrow text-stone-500">Privacy-friendly diagnostics</p><h2 className="mt-2 font-semibold">Share crash signals</h2>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-4"><span className="text-sm">Send minimal technical errors</span><Switch checked={diagnostics} onCheckedChange={toggleDiagnostics} aria-label="Send minimal technical errors" /></label>
        <p className="mt-3 text-xs leading-5 text-stone-400">Off by default. Reports are linked only to the internal account ID for abuse control and exclude email, workout entries, access tokens, URLs, and stack traces. Reporting can never block the app.</p>
      </article>}

      {toolSection === "feedback" && <article style={{ order: 9 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
        <div className="flex items-center gap-3"><MessageSquareText className="size-5 text-amber-300" /><div><p className="eyebrow text-stone-500">Private beta</p><h2 className="mt-1 font-semibold">Tell us what happened</h2></div></div>
        <label htmlFor="feedback-category" className="mt-4 block text-xs font-semibold text-stone-300">Feedback type</label>
        <select id="feedback-category" value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-stone-100"><option value="bug">Something broke</option><option value="confusing">Something was confusing</option><option value="idea">Feature idea</option><option value="other">Other</option></select>
        <label htmlFor="feedback-message" className="mt-4 block text-xs font-semibold text-stone-300">Message</label>
        <Textarea id="feedback-message" value={feedback} onChange={(event) => setFeedback(event.target.value.slice(0, 2000))} placeholder="What were you trying to do, and what happened? Do not include medical or highly sensitive information." className="mt-2 min-h-28 border-white/10 bg-white/[0.04] text-stone-100" />
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-xs text-stone-300"><input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} className="size-5 accent-amber-300" />Include app version, page, install state, and online status</label>
        <Button type="button" onClick={() => void sendFeedback()} disabled={feedbackBusy || feedback.trim().length < 3} className="mt-3 min-h-11 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c]">{feedbackBusy ? "Sending…" : "Send private feedback"}</Button>
      </article>}
      </div>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#171a17] text-stone-100 sm:max-w-xl">
          <DialogHeader><DialogTitle>Review this backup</DialogTitle><DialogDescription>Nothing changes until you confirm. The current profile will be downloaded first.</DialogDescription></DialogHeader>
          {preview && <div className="grid grid-cols-2 gap-3 rounded-xl bg-black/20 p-4 text-sm"><div><p className="text-xs text-stone-500">Sessions</p><p className="mt-1 font-mono text-lg">{preview.sessions}</p></div><div><p className="text-xs text-stone-500">Weigh-ins</p><p className="mt-1 font-mono text-lg">{preview.weighIns}</p></div><div className="col-span-2"><p className="text-xs text-stone-500">Training dates</p><p className="mt-1">{preview.firstDate && preview.lastDate ? `${preview.firstDate} to ${preview.lastDate}` : "No completed sessions"}</p></div></div>}
          <RadioGroup value={restoreMode} onValueChange={(value) => setRestoreMode(value as RestoreMode)} className="grid gap-2" aria-label="Restore behavior">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-4"><RadioGroupItem value="merge" id="restore-merge" /><span><strong className="block text-sm">Merge histories — recommended</strong><span className="mt-1 block text-xs leading-5 text-stone-400">Keeps the newest revision of each session and combines unique history from both copies.</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-300/20 p-4"><RadioGroupItem value="replace" id="restore-replace" /><span><strong className="block text-sm text-red-200">Replace this account</strong><span className="mt-1 block text-xs leading-5 text-stone-400">Makes the backup authoritative on this device and in the cloud. Your automatic pre-restore download is the rollback.</span></span></label>
          </RadioGroup>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRestoreOpen(false)}>Cancel</Button><Button type="button" onClick={() => void restore()} disabled={restoreBusy} className={restoreMode === "replace" ? "bg-red-300 text-[#0b0d0c] hover:bg-red-200" : "bg-amber-300 text-[#0b0d0c] hover:bg-amber-200"}>{restoreBusy ? "Restoring…" : restoreMode === "merge" ? "Merge backup" : "Replace account data"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleteBusy) setDeleteOpen(open); }}>
        <AlertDialogContent className="border-red-300/20 bg-[#171a17] text-stone-100">
          <AlertDialogHeader><AlertDialogTitle>Delete this RepArc account?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. It removes cloud records and this account&apos;s current-device copy. A backup is not created automatically.</AlertDialogDescription></AlertDialogHeader>
          <label htmlFor="delete-account-confirmation" className="text-xs font-semibold text-stone-300">Type <span className="font-mono text-red-300">DELETE</span> to confirm</label>
          <Input id="delete-account-confirmation" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="border-red-300/20 bg-black/20 font-mono text-stone-100" />
          <AlertDialogFooter><AlertDialogCancel disabled={deleteBusy}>Keep account</AlertDialogCancel><AlertDialogAction disabled={deleteConfirmation !== "DELETE" || deleteBusy} onClick={(event) => { event.preventDefault(); void removeAccount(); }} className="bg-red-300 text-[#0b0d0c] hover:bg-red-200">{deleteBusy ? "Deleting…" : "Permanently delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
