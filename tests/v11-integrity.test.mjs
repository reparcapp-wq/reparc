import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, plugins: [{name:"legacy-training-fixture",resolveId(id){if(id === "/__legacy-training.ts") return id;},load(id){if(id === "/__legacy-training.ts") return execFileSync("git",["show","d1834dc:lib/training.ts"],{cwd:root,encoding:"utf8",maxBuffer:2_000_000});}}], resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const { reconcileTrainingData: merge } = await vite.ssrLoadModule("/lib/sync-merge.ts");
const offline = await vite.ssrLoadModule("/lib/offline-store.ts");
const archive = await vite.ssrLoadModule("/lib/cloud-archive.ts");
const { weeklyMuscleVolume } = await vite.ssrLoadModule("/lib/muscle-volume.ts");
const { improvementSample } = await vite.ssrLoadModule("/lib/improvement.ts");
const { contentSecurityPolicy } = await vite.ssrLoadModule("/lib/content-security-policy.ts");
const session = (id, weight = "10") => ({ id, logicalKey: id, date: "2026-09-07", dayId: "UA", unit: "kg", entries: { press: [{ w: weight, r: "8", rir: "3" }] }, createdAt: "2026-09-07T01:00:00Z", updatedAt: "2026-09-07T01:00:00Z" });
const baseline = () => ({ ...t.emptyData(), profile: { name: "Tester", unit: "kg", level: "beginner" } });

test("three-way sync ignores future device clocks while preserving nonconflicting settings", () => {
  const base = baseline(), local = structuredClone(base), remote = structuredClone(base);
  local.profile.name = "Local"; local.updatedAt = "2099-01-01T00:00:00Z";
  remote.profile.name = "Cloud"; remote.profile.unit = "lb";
  const result = merge(local, remote, base);
  assert.equal(result.data.profile.name, "Cloud"); assert.equal(result.data.profile.unit, "lb");
  assert.ok(result.conflicts.includes("profile.name"));
  const nextLocal = structuredClone(result.data); nextLocal.profile.name = "Intentional later edit";
  assert.equal(merge(nextLocal, result.data, result.data).data.profile.name, "Intentional later edit");
});
test("sync keeps concurrent session edits atomic and does not mutate input snapshots", () => {
  const base = baseline(); base.sessions = [session("same")];
  const local = structuredClone(base), remote = structuredClone(base);
  local.sessions[0].entries.press[0].w = "15";
  remote.sessions[0].entries.press[0].r = "12";
  local.sessions.push(session("local")); remote.sessions.push(session("remote"));
  const before = JSON.stringify([base,local,remote]); const result = merge(local, remote, base);
  assert.deepEqual(result.data.sessions.find(s=>s.id === "same").entries,remote.sessions[0].entries);
  assert.equal(result.data.sessions.length,3); assert.ok(result.conflicts.includes("sessions.same"));
  assert.equal(JSON.stringify([base,local,remote]),before);
});
test("session deletion tombstones survive stale unchanged devices", () => {
  const base = baseline(); base.sessions = [session("same")];
  const remote = structuredClone(base); remote.sessions[0].deletedAt = "2026-09-07T02:00:00Z";
  const result = merge(base,remote,base);
  assert.equal(result.data.sessions[0].deletedAt,remote.sessions[0].deletedAt);
});
test("a cloud read cannot overwrite edits made during the request", () => {
  const observed = baseline(), latest = structuredClone(observed), remote = structuredClone(observed);
  latest.profile.name = "Just typed"; remote.profile.unit = "lb";
  const current = { key:"test",data:latest,revision:6,dirty:true,updatedAt:"2099-01-01" };
  const result = offline.resolveMergedOfflineRecord("test", current, remote, {dirty:false,expectedRevision:5,observedData:observed,serverRevision:8});
  assert.equal(result.data.profile.name,"Just typed"); assert.equal(result.data.profile.unit,"lb");
  assert.equal(result.dirty,true); assert.equal(result.serverRevision,8); assert.equal(result.baseData.profile.name,"Tester");
});
test("a later edit after upload is compared with the uploaded snapshot, not the old cloud", () => {
  const old = baseline(), uploaded = structuredClone(old), latest = structuredClone(old);
  uploaded.profile.name = "First edit"; latest.profile.name = "Second edit";
  const result = offline.resolveOfflineSyncCommit("test",{key:"test",data:latest,baseData:old,revision:7,dirty:true},6,uploaded,undefined,9,uploaded);
  assert.equal(result.data.profile.name,"Second edit"); assert.equal(result.dirty,true);
});
test("archive round-trips large Unicode history exactly and rejects tampered or missing chunks", async () => {
  const data = { ...baseline(), longText: "训练 🏋🏽‍♀️".repeat(40_000) };
  const {chunks,manifest} = await archive.splitArchive(data);
  const store = new Map(chunks.map(c=>[c.id,c.text])); assert.ok(chunks.length > 1);
  assert.deepEqual(await archive.joinArchive(manifest,async id=>store.get(id)),data);
  await assert.rejects(archive.joinArchive(manifest,async()=>"bad"),/verification/);
  await assert.rejects(archive.joinArchive({...manifest,bytes:manifest.bytes+1},async id=>store.get(id)),/Incomplete/);
  assert.equal(archive.validArchive({...manifest,bytes:32_000_001}),false);
  assert.equal(archive.validArchive({...manifest,chunks:[]}),false);
});
test("weekly volume separates direct and indirect work without double-counting sides or deleted sessions", () => {
  const data = baseline(); data.profile = undefined;
  const s = session("logged"); s.planSnapshot = {exercises:[{key:"press",name:"Incline dumbbell press",loadingType:"external",perSide:true,metadataVersion:1,primaryMuscles:["chest"],secondaryMuscles:["triceps","shoulders"]}]};
  s.entries.press.push({w:"",r:"",rir:""});
  data.sessions = [s,{...s,id:"deleted",logicalKey:"deleted",deletedAt:"2026-09-07"}];
  const result = weeklyMuscleVolume(data,"2026-09-07","2026-09-13");
  assert.equal(result.rows.find(r=>r.muscle==="chest").direct,1);
  assert.equal(result.rows.find(r=>r.muscle==="triceps").indirect,1);
  assert.equal(result.rows.find(r=>r.muscle==="triceps").direct,0);
  assert.equal(result.inferredSets,0); assert.equal(result.loggedSessions,1);
});
test("legacy sessions never receive a fabricated recommendation version or evaluation sample", () => {
  const data = baseline(), s = session("old");
  assert.equal(improvementSample(s,data),null);
  s.recommendationVersion = "11.0.0-policy1"; s.notes = "PRIVATE NOTE";
  const sample = improvementSample(s,data);
  assert.equal(sample.recommendationVersion,s.recommendationVersion);
  assert.equal(JSON.stringify(sample).includes("PRIVATE NOTE"),false);
  assert.equal(JSON.stringify(sample).includes("Tester"),false);
  s.deletedAt = "2026-09-07"; assert.equal(improvementSample(s,data),null);
});
test("production script CSP has a nonce, blocks inline handlers and does not allow eval", () => {
  const policy = contentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==");
  const scripts = policy.split(";").find(s=>s.trim().startsWith("script-src "));
  assert.match(scripts,/'nonce-YWJjZGVmZ2hpamtsbW5vcA=='/);
  assert.doesNotMatch(scripts,/unsafe-inline|unsafe-eval/);
  assert.match(policy,/script-src-attr 'none'/);
  assert.throws(()=>contentSecurityPolicy("bad'; script-src *"));
});
test("structured metadata preserves 10.5.1 exercise history identities across every program and swap", async () => {
  const legacy = await vite.ssrLoadModule("/__legacy-training.ts");
  const {exerciseMetadata} = await vite.ssrLoadModule("/lib/exercise-metadata.ts");
  const failures = [];
  for(const phase of ["phase1","phase2"]) for(const track of ["current","women"]) for(const frequency of [3,4,5]) for(const equipment of ["full","limited","home"]) {
    for(const day of legacy.programDays(phase,frequency,track,"balanced",equipment)) for(const exercise of day.exercises) {
      for(const name of [exercise.name,...exercise.alternatives]) {
        const old = legacy.resolveExerciseVariant(exercise,name), next = t.resolveExerciseVariant(exercise,name);
        if(!exerciseMetadata(name)) failures.push(`Missing metadata: ${name}`);
        if(legacy.loadProfileId(old)!==t.loadProfileId(next)) failures.push(`${name}: ${legacy.loadProfileId(old)} -> ${t.loadProfileId(next)}`);
      }
    }
  }
  assert.deepEqual([...new Set(failures)],[]);
});
