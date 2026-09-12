import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule('/lib/training.ts');
const a = await vite.ssrLoadModule('/lib/progress-analysis.ts');
const timing = await vite.ssrLoadModule('/lib/session-duration.ts');
const fixture = () => ({ ...t.emptyData(), profile: { displayName: 'Synthetic', bodyweight: 75, unit: 'kg', level: 'experienced', gender: 'man', programTrack: 'current', goal: 'balanced', equipment: 'full', weightGoal: 'maintain', weightTrackingEnabled: true } });
function add(data, date, options = {}) {
  const day = t.programDays(options.phase ?? 'phase1', 5, data.profile.programTrack)[0];
  const exercise = t.resolveExerciseVariant(day.exercises[0], options.name ?? day.exercises[0].name);
  const modifiedDay = { ...day, exercises: [{ ...exercise, sets: options.sets ?? 2 }] };
  const snapshot = t.buildSessionPlanSnapshot(data, modifiedDay);
  snapshot.programId = options.phase ?? 'phase1'; snapshot.programWeek = options.week;
  const ex = snapshot.exercises[0];
  const at = `${date}T10:00:00.000Z`;
  const id = options.id ?? `${date}:${data.sessions.length}`;
  const session = { id, date, scheduledDate: options.scheduledDate ?? date, dayId: day.id, unit: options.unit ?? 'kg', programId: options.phase ?? 'phase1', programWeek: options.week,
    planSnapshot: snapshot, exerciseExposures: { [ex.key]: { policyVersion: 1, identity: t.loadProfileId(ex), stateAtStart: options.state ?? 'calibrated', noveltyRisk: 'standard', prescribedSets: ex.sets, originalSets: ex.sets, targetRir: 3, relatedHistory: false, startingLoadSource: 'guided', progressionEligible: options.eligible ?? true, suggestedLoad: 20, targetRepLow: ex.repLow, targetRepHigh: ex.repHigh } },
    entries: { [ex.key]: Array.from({ length: ex.sets }, () => ({ w: String(options.load ?? 20), r: String(options.reps ?? ex.repLow), rir: options.rir ?? '3' })) },
    readiness: options.readiness ?? 'normal', completionStatus: 'completed', affectsProgression: options.eligible ?? true, durationSeconds: 1200, startedAt: `${date}T09:40:00.000Z`, completedAt: at, createdAt: at, updatedAt: at, revision: 1, recommendationVersion: 'test-rule1' };
  data.sessions.push(session);
  if (options.recovery !== null) {
    const recoveredAt = new Date(Date.parse(at) + (options.recoveryHours ?? 72) * 3600000).toISOString();
    data.exerciseRecovery.push({ id: `recovery:${id}`, sessionId: id, exerciseIdentity: t.loadProfileId(ex), status: options.recovery ?? 'recovered', createdAt: recoveredAt, updatedAt: recoveredAt });
  }
  return { session, ex, key: ex.key };
}
const report = (data, period = 'week', anchor = '2026-09-07', asOf = '2026-09-20') => a.buildProgressAnalysis(data, period, anchor, asOf);

test('review dates handle Monday/Sunday, leap February and year boundaries', () => {
  assert.deepEqual(a.reviewBounds('week', '2026-09-13'), { start: '2026-09-07', end: '2026-09-13' });
  assert.deepEqual(a.reviewBounds('week', '2026-09-07'), { start: '2026-09-07', end: '2026-09-13' });
  assert.equal(a.reviewBounds('month', '2028-02-14').end, '2028-02-29');
  assert.equal(a.reviewBounds('week', '2027-01-01').start, '2026-12-28');
  assert.throws(() => a.reviewBounds('day', '2026-02-31'));
});
test('empty reviews never invent rates, time, strength or successful predictions', () => {
  const r = report(fixture()); assert.equal(r.status, 'insufficient'); assert.equal(r.counts.completionPercent, null); assert.equal(r.measuredDurationSeconds, null);
  assert.equal(r.evaluation.eligible, 0); assert.equal(r.weight.change, null); assert.ok(r.muscles.every((m) => m.status === 'insufficient'));
});
test('analysis is deterministic, read-only and isolated to its input account', () => {
  const data = fixture(); add(data, '2026-09-08'); const before = JSON.stringify(data);
  const first = report(data); assert.deepEqual(report(data), first); assert.equal(JSON.stringify(data), before);
  assert.equal(report(fixture()).sessionCount, 0); assert.equal(first.sessionCount, 1);
  data.sessions[0].entries[Object.keys(data.sessions[0].entries)[0]][0].r = '1'; data.sessions[0].revision++;
  assert.notDeepEqual(report(data), first, 'edits recompute instead of reusing a cached verdict');
});
test('current revisions, logical duplicates, tombstones and future workouts count once or not at all', () => {
  const data = fixture(); const { session } = add(data, '2026-09-08'); session.logicalKey = 'same-workout';
  data.sessions.push({ ...structuredClone(session), id: 'dupe', revision: 2 });
  add(data, '2026-09-21'); assert.equal(report(data).counts.sets, 2);
  data.sessions.push({ ...structuredClone(session), revision: 3, deletedAt: '2026-09-14T00:00:00Z' });
  assert.equal(report(data).sessionCount, 0);
});
test('catch-up is filed under Sep 11 while physical muscle work stays on Sep 12', () => {
  const data = fixture(); add(data, '2026-09-12', { scheduledDate: '2026-09-11' }); add(data, '2026-09-12');
  const eleven = report(data, 'day', '2026-09-11'); const twelve = report(data, 'day', '2026-09-12');
  assert.equal(eleven.sessionCount, 1); assert.equal(twelve.sessionCount, 1);
  assert.equal(eleven.counts.sets, 2); assert.equal(twelve.counts.sets, 2);
  assert.equal(eleven.muscles.find((m) => m.muscle === 'chest').direct, 0);
  assert.equal(twelve.muscles.find((m) => m.muscle === 'chest').direct, 4);
  assert.equal(eleven.workouts[0].performed, '2026-09-12');
});
test('invalid/partial sets are excluded, missing effort stays missing, extra sets cannot inflate completion', () => {
  const data = fixture(); const { session, key } = add(data, '2026-09-08', { rir: '' });
  session.entries[key].push({ w: '20', r: '8', rir: '' }, { w: '-', r: '8', rir: '3' }, { w: '20', r: '', rir: '' }, { w: '', r: '', rir: '' });
  const r = report(data); assert.equal(r.counts.sets, 3); assert.equal(r.counts.invalid, 2); assert.equal(r.counts.extra, 1);
  assert.equal(r.counts.completionPercent, 100); assert.equal(r.counts.rirCoverage, 0); assert.notEqual(r.status, 'on-track');
});
test('unknown exercises are visible exclusions; legacy records never borrow current targets', () => {
  const data = fixture(); const { session, key } = add(data, '2026-09-08'); delete session.planSnapshot; delete session.exerciseExposures;
  session.entries['totally-unknown-exercise'] = [{ w: '10', r: '8', rir: '3' }];
  assert.ok(t.exerciseFromKey(key)); const r = report(data); assert.equal(r.counts.sets, 2); assert.equal(r.counts.unknownPlan, 1);
  assert.equal(r.counts.repKnown, 0); assert.ok(r.warnings.some((s) => s.includes('could not be identified'))); assert.equal(r.confidence, 'low');
});
test('missing or early recovery withholds green without pretending soreness was reported', () => {
  for (const options of [{ recovery: null }, { recoveryHours: 12 }]) {
    const data = fixture(); add(data, '2026-09-08', options); const r = report(data);
    assert.equal(r.recoveryCoverage, '0/1'); assert.equal(r.exercises[0].status, 'hold'); assert.match(r.exercises[0].reason, /not been confirmed/);
    assert.equal(r.muscles.find((m) => m.muscle === 'chest').status, 'insufficient');
  }
});
test('later green answers cannot erase limiting recovery; safety flag survives monthly insufficiency', () => {
  const data = fixture(); const { session, ex } = add(data, '2026-09-08', { recovery: 'limiting' });
  data.exerciseRecovery.push({ id: 'later', sessionId: session.id, exerciseIdentity: t.loadProfileId(ex), status: 'recovered', createdAt: '2026-09-15T10:00:00Z', updatedAt: '2026-09-15T10:00:00Z' });
  const r = report(data, 'month'); assert.equal(r.enough, false); assert.equal(r.status, 'adjust'); assert.equal(r.exercises[0].recommendation.action, 'stop');
  assert.equal(r.muscles.find((m) => m.muscle === 'chest').status, 'adjust');
});
test('pain and severe soreness stop guidance; ordinary menstrual symptoms are not diagnosed as injury', () => {
  for (const readiness of ['pain', 'severe-soreness']) { const data = fixture(); add(data, '2026-09-08', { readiness }); assert.equal(report(data).status, 'adjust'); }
  const data = fixture(); data.profile.gender = 'woman'; add(data, '2026-09-08', { readiness: 'symptoms' }); assert.notEqual(report(data).status, 'adjust');
});
test('new-exercise and return exposures cannot be called strength loss or issue a load increase', () => {
  const data = fixture(); add(data, '2026-09-04'); add(data, '2026-09-08', { state: 'recalibration', eligible: false, sets: 1, load: 10 });
  const e = report(data).exercises[0]; assert.equal(e.trend, 'calibration'); assert.equal(e.recommendation, null); assert.notEqual(e.status, 'on-track');
});
test('per-side kg/lb observations are converted once and compare only fixed first-set effort', () => {
  const data = fixture(); add(data, '2026-09-04', { load: 20, reps: 8 }); add(data, '2026-09-08', { unit: 'lb', load: 44.09, reps: 9 });
  const e = report(data).exercises[0]; assert.equal(e.points.at(-1).load, 20); assert.equal(e.trend, 'improved'); assert.match(e.loadingLabel, /per side/);
  data.sessions[1].entries[Object.keys(data.sessions[1].entries)[0]][0].rir = '0'; assert.equal(report(data).exercises[0].trend, 'not-comparable');
});
test('changed loads and reps, bodyweight and assistance never imply a comparable strength gain', () => {
  for (const name of ['Incline dumbbell press', 'Push-up', 'Assisted pull-up']) {
    const data = fixture(); add(data, '2026-09-04', { name, load: 20, reps: 8 }); add(data, '2026-09-08', { name, load: 22, reps: 9 });
    assert.equal(report(data).exercises[0].trend, 'not-comparable');
  }
});
test('original effort target missing cannot yield a green target-compliance badge', () => {
  const data = fixture(); const { session } = add(data, '2026-09-08'); delete session.exerciseExposures;
  const r = report(data); assert.equal(r.counts.rirTargetKnown, 0); assert.notEqual(r.exercises[0].status, 'on-track');
  assert.equal(r.muscles.find((m) => m.muscle === 'chest').status, 'insufficient');
});
test('established, fully recorded exposures can receive a positive descriptive result', () => {
  const data = fixture(); for (const date of ['2026-08-27','2026-09-01','2026-09-04','2026-09-08']) add(data, date);
  const r = report(data); assert.equal(r.exercises[0].status, 'on-track'); assert.equal(r.exercises[0].confidence, 'high');
  assert.equal(r.exercises[0].recommendation, null, 'the review must not compete with Train');
  assert.equal(r.muscles.find((m) => m.muscle === 'chest').status, 'on-track');
});
test('different saved exercise slots share only the canonical history identity', () => {
  const data = fixture(); const first = add(data, '2026-09-04', { name: 'Pec deck' }); const second = add(data, '2026-09-08', { name: 'Pec deck' });
  const newKey = 'alternate-slot|pec-deck'; second.session.entries[newKey] = second.session.entries[second.key]; delete second.session.entries[second.key];
  second.session.planSnapshot.exercises[0].key = newKey;
  second.session.exerciseExposures[newKey] = second.session.exerciseExposures[second.key]; delete second.session.exerciseExposures[second.key];
  assert.equal(report(data).exercises[0].exposures, 2); assert.equal(report(data).exercises[0].points.length, 2);
  assert.equal(first.ex.name, second.ex.name);
});
test('invalid duration stays absent on normalization and aggregate time reports its coverage', () => {
  const data = fixture(); const { session } = add(data, '2026-09-08'); session.durationSeconds = null;
  const normalized = t.normalizeTrainingData(data); assert.equal(normalized.sessions[0].durationSeconds, undefined);
  add(data, '2026-09-09'); const r = report(data); assert.equal(r.measuredDurationSeconds, 1200); assert.equal(r.durationCoverage, '1/2');
});
test('Phase 2 normal sets and AMRAP use distinct saved targets; deload has no AMRAP', () => {
  for (const week of [1, 7, 14, 21]) {
    const data = fixture(); data.program.activeId = 'phase2'; const { session, key, ex } = add(data, '2026-09-08', { phase: 'phase2', week, sets: 4 });
    const rx = t.sbsPrescription(ex.sbsRole, week);
    session.entries[key] = Array.from({ length: 4 }, (_, i) => ({ w: '40', r: String(i === 3 && !rx.deload ? rx.repOutTarget + 2 : rx.normalReps), rir: '1' }));
    const r = report(data); assert.equal(r.counts.repMet, 4); assert.equal(r.exercises[0].recommendation, null); assert.match(r.exercises[0].action, /Phase 2/);
  }
});
test('Phase 2 protected calibration uses its reduced prescription, not AMRAP rules', () => {
  const data = fixture(); data.program.activeId = 'phase2'; const { session, key } = add(data, '2026-09-08', { phase: 'phase2', week: 1, eligible: false, state: 'preliminary', sets: 1 });
  session.exerciseExposures[key].targetRepLow = 5; session.exerciseExposures[key].targetRepHigh = 5; session.entries[key][0].r = '5';
  assert.equal(report(data).counts.repMet, 1);
});
test('both tracks and all cadences use saved sets, not a hardcoded male program', () => {
  for (const track of ['current', 'women']) for (const frequency of [3, 4, 5]) {
    const data = fixture(); data.profile.programTrack = track; data.program.frequency = frequency; add(data, '2026-09-08', { sets: 1, state: 'preliminary', eligible: false });
    assert.equal(report(data).counts.planned, 1); assert.equal(report(data).counts.sets, 1);
  }
});
test('monthly verdict requires three fully ended eligible weeks; descriptive totals stay visible', () => {
  const data = fixture(); for (const date of ['2026-08-03','2026-08-06','2026-08-10','2026-08-13']) add(data, date);
  assert.equal(report(data, 'month', '2026-08-01').enough, false);
  for (const date of ['2026-08-17','2026-08-20']) add(data, date);
  const r = report(data, 'month', '2026-08-01'); assert.equal(r.validWeeks, 3); assert.equal(r.enough, true); assert.equal(r.counts.sets, 12);
});
test('weight averages require three actual dates in each window and deduplicate revised weigh-ins', () => {
  const data = fixture(); const weight = (date, value, updated = date) => data.weighIns.push({ id: `${date}:${updated}`, date, weight: value, unit: 'kg', createdAt: date, updatedAt: updated, revision: 1 });
  for (const day of ['2026-09-01','2026-09-03','2026-09-05']) weight(day, 70);
  for (const day of ['2026-09-08','2026-09-10']) weight(day, 69);
  assert.equal(report(data, 'day', '2026-09-13').weight.change, null);
  weight('2026-09-12', 69); weight('2026-09-12', 100, '2026-09-11');
  assert.equal(report(data, 'day', '2026-09-13').weight.change, -1);
});
test('suggestion outcome counts need exact followed load, saved version, full effort and delayed recovery', () => {
  const data = fixture(); add(data, '2026-09-08'); add(data, '2026-09-09', { load: 22 }); add(data, '2026-09-10', { rir: '' });
  const r = report(data); assert.deepEqual(r.evaluation, { eligible: 1, metTargetsAndRecovery: 1, excluded: 2 });
});
test('duration grows after partial saves but historical/completed edits preserve original timing', () => {
  const current = { startedAt: '2026-09-08T10:00:00Z', completedAt: '2026-09-08T10:01:00Z', durationSeconds: 60, completionStatus: 'partial' };
  assert.equal(timing.sessionTiming(current, null, '2026-09-08T10:40:00Z', false).durationSeconds, 2400);
  assert.equal(timing.sessionTiming(current, null, '2026-09-10T10:40:00Z', true).durationSeconds, 60);
  assert.equal(timing.sessionTiming({ ...current, completionStatus: 'completed' }, null, '2026-09-08T11:00:00Z', false).durationSeconds, 60);
  assert.equal(timing.sessionTiming({ ...current, completionStatus: 'adjusted' }, null, '2026-09-08T11:00:00Z', false).durationSeconds, 60);
  assert.equal(timing.sessionTiming(undefined, null, '2026-09-08T10:40:00Z', false).durationSeconds, undefined);
  for (const value of [undefined, null, 0, 16, 59, NaN, Infinity, -1, 43201]) assert.equal(timing.measuredSessionDuration({ durationSeconds: value }), null);
  assert.equal(timing.measuredSessionDuration({ durationSeconds: 1200 }), 1200);
});
