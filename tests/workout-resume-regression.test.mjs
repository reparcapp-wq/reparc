import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const status = await vite.ssrLoadModule("/lib/training-session-status.ts");
const { createTrainingSyncGate } = await vite.ssrLoadModule("/lib/training-sync-gate.ts");
const { RecoveryCheck, recoveryWait } = await vite.ssrLoadModule("/components/recovery-check.tsx");
const calibration = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const fixture = () => ({ ...t.emptyData(), profile: { displayName: "Synthetic", bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "bulk", weightTrackingEnabled: true } });
function completeDay(data, day, date) {
  const planSnapshot = t.buildSessionPlanSnapshot(data, day);
  return { id: date + day.id, date, dayId: day.id, unit: "kg", programId: "phase2", programWeek: data.program.week, programFrequency: data.program.frequency,
    planSnapshot, entries: Object.fromEntries(planSnapshot.exercises.map(e => [e.key, Array.from({length:e.sets}, () => ({w:"20",r:"10",rir:"4"}))])),
    completionStatus:"completed", revision:1, createdAt:date+"T02:00:00Z", updatedAt:date+"T03:00:00Z", completedAt:date+"T03:00:00Z" };
}
test("complete Phase 2 weeks never loop to Day 1; next week starts with its own unfinished days", () => {
  for (const track of ["current", "women"]) for (const frequency of [3,4,5]) {
    const data=fixture(); data.profile.programTrack=track; data.program.activeId="phase2"; data.program.frequency=frequency;
    const days=t.programDays("phase2",frequency,track);
    data.sessions=days.map((day,i)=>completeDay(data,day,`2026-10-${20+i}`));
    const before=JSON.stringify(data);
    assert.equal(t.nextUnfinishedProgramDay(data),null);
    assert.equal(status.phaseTwoWeekStatus(data).complete,true);
    assert.deepEqual(t.absenceDayIds(data,3),[]);
    assert.equal(JSON.stringify(data),before);
    data.program.week=2;
    assert.equal(t.nextUnfinishedProgramDay(data).id,days[0].id);
    assert.equal(status.phaseTwoWeekStatus(data).complete,false);
  }
});
test("latest repeated Day 1 remains reviewable and partial/skipped/other-frequency sessions never complete a week", () => {
  const data=fixture();data.program.activeId="phase2";
  const days=t.programDays("phase2",5);
  data.sessions=days.map((day,i)=>completeDay(data,day,`2026-10-${20+i}`));
  data.sessions.push(completeDay(data,days[0],"2026-10-27"));
  assert.equal(status.phaseTwoWeekStatus(data).byDay.get(days[0].id).date,"2026-10-27");
  for (const invalid of [{completionStatus:"partial"},{skippedExerciseKeys:[days[4].exercises[0].id]},{programFrequency:3},{deletedAt:"2026-10-25T00:00:00Z"},{entries:{}}]) {
    const copy=structuredClone(data);Object.assign(copy.sessions[4],invalid);
    assert.equal(status.phaseTwoWeekStatus(copy).complete,false);
    assert.equal(t.nextUnfinishedProgramDay(copy).id,days[4].id);
  }
});
test("midnight refresh respects unfinished sessions, historical edits and explicit make-up dates", () => {
  const base={visible:true,editing:false,makeup:false,started:true,completed:false};
  assert.equal(status.canRefreshTrainingDate(base),false);
  assert.equal(status.canRefreshTrainingDate({...base,completed:true}),true);
  assert.equal(status.canRefreshTrainingDate({...base,started:false}),true);
  for (const override of [{editing:true},{makeup:true},{visible:false}]) assert.equal(status.canRefreshTrainingDate({...base,completed:true,...override}),false);
});
test("an older cloud read cannot replace a save even after that save finishes; double saves are blocked", async () => {
  const gate=createTrainingSyncGate(); const read=gate.beginRead();
  assert.equal(read,0); assert.equal(gate.beginRead(),null);
  let release; const oldRead=new Promise(resolve=>{release=resolve;});
  let shown="old";
  const completion=oldRead.then(value=>{if(gate.acceptsRead(read))shown=value;gate.endRead();});
  assert.equal(gate.beginWrite(),true);assert.equal(gate.beginWrite(),false);assert.equal(gate.beginRead(),null);
  shown="new saved workout";gate.endWrite(); release("stale remote");await completion;
  assert.equal(shown,"new saved workout");
  const fresh=gate.beginRead();assert.equal(gate.acceptsRead(fresh),true);gate.endRead();
  const duringTyping=gate.beginRead();gate.invalidateRead();assert.equal(gate.acceptsRead(duringTyping),false);gate.endRead();
  assert.equal(gate.beginWrite(),true);gate.endWrite();
});
test("recovery unlocks at exactly 48 hours, not calendar dates or update timestamps", () => {
  const finished="2026-10-23T19:43:15.616Z", unlock=Date.parse(finished)+48*3600000;
  assert.equal(recoveryWait(finished,unlock-1).ready,false);
  assert.equal(recoveryWait(finished,unlock).ready,true);
  assert.equal(recoveryWait(finished,Date.parse("2026-10-28T00:00:00Z")).ready,true);
  assert.equal(recoveryWait("bad timestamp",unlock).ready,false);
  for(const now of [unlock-1,unlock]) {
    const html=renderToStaticMarkup(React.createElement(RecoveryCheck,{completedAt:finished,now,busy:false,onSelect(){}}));
    const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(x=>x[0]);
    assert.equal(buttons.length,4);
    assert.equal(buttons.filter(x=>x.includes("disabled=")).length,now<unlock?2:0);
    assert.ok(!buttons[2].includes("disabled=")); assert.ok(!buttons[3].includes("disabled="));
  }
});
test("hack squat equipment substitutions have separate history, conservative sets and no inherited SBS max", () => {
  const data=fixture();data.program.activeId="phase2";
  const day=t.programDays("phase2",5).find(d=>d.exercises.some(e=>e.id==="p2-hack-squat"));
  const hack=day.exercises.find(e=>e.id==="p2-hack-squat");
  assert.ok(hack.alternatives.includes("Linear leg press"));
  data.program.trainingMaxes[hack.id]=180;
  data.sessions=[completeDay(data,day,"2026-10-20")];
  const old=JSON.stringify(data.sessions);
  const vertical=t.resolveExerciseVariant(hack,"Linear leg press");
  const key=t.exerciseKey(hack,{[hack.id]:vertical.name});
  assert.equal(t.exerciseFromKey(key).sbsRole,undefined);
  assert.equal(vertical.ratio,undefined);
  assert.notEqual(t.loadProfileId(vertical),t.loadProfileId(hack));
  assert.notEqual(t.loadProfileId(vertical),t.loadProfileId(t.resolveExerciseVariant(hack,"Leg press")));
  assert.equal(t.comparableExerciseHistory(data,vertical).length,0);
  assert.equal(t.suggestedTrainingMax(data,vertical,"kg"),0);
  const plan=calibration.buildExposurePlan(data,{...day,exercises:[hack]},"2026-10-28",()=>vertical);
  assert.ok(plan.day.exercises[0].sets<=2);
  assert.ok(plan.exposures[hack.id].targetRir>=3);
  data.swaps[hack.id]=vertical.name;
  const snapshot=t.buildSessionPlanSnapshot(data,plan.day);
  assert.equal(snapshot.exercises[0].sbsRole,undefined);
  assert.equal(snapshot.exercises[0].name,vertical.name);
  assert.equal(snapshot.exercises[0].key,key);
  assert.equal(t.resolveExerciseVariant(hack,hack.name).sbsRole,"auxiliary");
  assert.equal(JSON.stringify(data.sessions),old);
});
