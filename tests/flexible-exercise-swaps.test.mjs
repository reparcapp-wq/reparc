import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({configFile:false,appType:'custom',root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const t=await vite.ssrLoadModule('/lib/training.ts');
const swaps=await vite.ssrLoadModule('/lib/exercise-swap-state.ts');
const calibration=await vite.ssrLoadModule('/lib/exercise-calibration.ts');
const {ExerciseSwap}=await vite.ssrLoadModule('/components/training-tools.tsx');
const blank={w:'',r:'',rir:''};
function fixture(){
 const data={...t.emptyData(),profile:{displayName:'Synthetic',bodyweight:75,unit:'kg',level:'experienced',gender:'man',programTrack:'current',goal:'balanced',equipment:'full',weightGoal:'bulk',weightTrackingEnabled:true}};
 data.program.activeId='phase2';data.program.trainingMaxes={'p2-ohp':90};
 const day=t.programDays('phase2',5).find(d=>d.exercises.some(e=>e.id==='p2-d2-leg-curl'));
 const snapshot=t.buildSessionPlanSnapshot(data,day);const curl=snapshot.exercises.find(e=>e.id==='p2-d2-leg-curl');
 const session={id:'partial',date:'2026-10-29',dayId:day.id,unit:'kg',programId:'phase2',programWeek:1,programFrequency:5,completionStatus:'partial',entries:Object.fromEntries(snapshot.exercises.map(e=>[e.key,Array.from({length:e.sets},()=>({...blank}))])),planSnapshot:snapshot,exerciseExposures:{},revision:1,createdAt:'2026-10-29T02:00:00Z',updatedAt:'2026-10-29T02:00:00Z'};
 session.entries[snapshot.exercises[0].key][0]={w:'35',r:'10',rir:'4'};data.sessions=[session];
 return {data,day,session,curl};
}
test('completed/history and any entered field use next-time choices; untouched partial slots remain swappable',()=>{
 assert.equal(swaps.exerciseSwapScope(undefined,[blank]),'current');
 assert.equal(swaps.exerciseSwapScope(undefined,[{...blank,w:'0'}]),'next');
 assert.equal(swaps.exerciseSwapScope(undefined,[{...blank,r:'10'}]),'next');
 assert.equal(swaps.exerciseSwapScope(undefined,[{...blank,rir:'4'}]),'next');
 for(const completionStatus of ['completed','adjusted','skipped',undefined])assert.equal(swaps.exerciseSwapScope({completionStatus},[blank]),'next');
 assert.equal(swaps.exerciseSwapScope({completionStatus:'partial'},[blank]),'current');
 assert.equal(swaps.exerciseSwapScope({completionStatus:'partial'},[blank],true),'next');
});
test('swapping an unlogged partial slot preserves actual sets, timestamps, maxes and a reversible prior revision',()=>{
 const {data,session,curl}=fixture(),before=structuredClone(data);
 const resolved=t.resolveExerciseVariant({...curl,alternatives:[]},'Lying leg curl');const key=curl.id+':Lying leg curl';
 const replacement={...resolved,key,sets:1};const exposure={policyVersion:1,identity:t.loadProfileId(resolved),stateAtStart:'uncalibrated',noveltyRisk:'moderate',prescribedSets:1,originalSets:curl.sets,targetRir:4,relatedHistory:false,startingLoadSource:'guided',progressionEligible:false};
 const result=swaps.swapUnloggedSavedExercise(data,session.id,curl.key,replacement,exposure,'2026-10-29T03:00:00Z');
 assert.deepEqual(data,before);assert.deepEqual(result.program,before.program);assert.equal(result.sessions[0].revision,2);assert.equal(result.sessions[0].completionStatus,'partial');
 assert.deepEqual(result.sessionRevisions[0].previous,before.sessions[0]);assert.deepEqual(result.sessions[0].entries[key],[blank]);assert.equal(result.sessions[0].entries[curl.key],undefined);
 for(const original of session.planSnapshot.exercises.filter(e=>e.key!==curl.key))assert.deepEqual(result.sessions[0].entries[original.key],session.entries[original.key]);
 assert.deepEqual(t.trainingDataValidationIssues(result),[]);
 for(const mutate of [d=>d.sessions[0].completionStatus='completed',d=>d.sessions[0].entries[curl.key][0].w='35']){const rejected=structuredClone(before);mutate(rejected);assert.throws(()=>swaps.swapUnloggedSavedExercise(rejected,session.id,curl.key,replacement,exposure,'2026-10-29T03:00:00Z'));}
});
test('main-lift substitutes have no SBS prescription or inherited max and retain first-exposure protection',()=>{
 for(const track of ['current','women'])for(const frequency of [3,4,5]){
  const {data}=fixture();data.profile.programTrack=track;data.program.frequency=frequency;
  for(const day of t.programDays('phase2',frequency,track))for(const base of day.exercises.filter(e=>e.sbsRole==='main')){
   for(const name of base.alternatives){
    const replacement=t.resolveExerciseVariant(base,name);assert.equal(replacement.sbsRole,undefined);assert.equal(replacement.ratio,undefined);assert.notEqual(t.loadProfileId(base),t.loadProfileId(replacement));
    const plan=calibration.buildExposurePlan(data,{...day,exercises:[base]},'2026-10-29',()=>replacement);
    assert.ok(plan.day.exercises[0].sets<=2);assert.ok(plan.exposures[base.id].targetRir>=3);assert.equal(plan.exposures[base.id].progressionEligible,false);
    const changed={...data,swaps:{[base.id]:name}};const snap=t.buildSessionPlanSnapshot(changed,plan.day);assert.equal(snap.exercises[0].name,name);assert.equal(snap.exercises[0].sbsRole,undefined);
    const s={...data.sessions[0],id:'substitute',planSnapshot:snap,entries:{[snap.exercises[0].key]:Array.from({length:snap.exercises[0].sets},()=>({w:'90',r:'25',rir:'0'}))},affectsProgression:true,exerciseExposures:{},trainingMaxesBefore:{[base.id]:90},trainingMaxesAfter:{[base.id]:90}};
    const replay=t.recalculatePhase2Progression({...changed,sessions:[s],program:{...changed.program,trainingMaxes:{[base.id]:90}}});assert.equal(replay.program.trainingMaxes[base.id],90);
    assert.equal(t.resolveExerciseVariant(base,base.name).sbsRole,'main');
   }
  }
 }
});
test('saved-workout chooser is enabled, labels its next-time scope, and marks the future preference',()=>{
 const html=renderToStaticMarkup(React.createElement(ExerciseSwap,{id:'curl',name:'Lying leg curl',baseName:'Seated leg curl',selectionName:'Seated leg curl',nextTime:true,options:['Seated leg curl','Lying leg curl'],open:true,disabled:false,onToggle(){},onSelect(){}}));
 assert.doesNotMatch(html,/disabled=""/);assert.match(html,/This workout stays unchanged/);assert.match(html,/Next time: Seated leg curl/);assert.match(html,/aria-pressed="true"[^>]*>.*?Seated leg curl/s);
});


test('decline sit-ups record added weight, have a separate identity, and never produce an estimated max', async()=>{
 const base=t.programDays('phase2',5).flatMap(d=>d.exercises).find(e=>e.name==='Cable crunch');
 const replacement=t.resolveExerciseVariant(base,'Decline sit-up');
 const rules=await vite.ssrLoadModule('/lib/exercise-swaps.ts');
 const guide=await vite.ssrLoadModule('/lib/exercise-guidance.ts');
 assert.ok(rules.exerciseSwapOptions(base.name,base.alternatives).includes('Decline sit-up'));
 assert.equal(replacement.loadingType,'bodyweight');assert.equal(replacement.perSide,false);
 assert.equal(t.supportsEstimatedMax(replacement),false);assert.notEqual(t.loadProfileId(base),t.loadProfileId(replacement));
 assert.match(guide.exerciseGuidance(replacement.name).cues.join(' '),/Log only the added plate weight/);
});
