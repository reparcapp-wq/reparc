import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgressAnalysisView } from '../../components/progress-analysis';
import { emptyData, programDays, resolveExerciseVariant, buildSessionPlanSnapshot, loadProfileId } from '../../lib/training';
import '../../app/globals.css';

export function syntheticAnalysisData() {
  const data = emptyData(); data.profile = { displayName: 'Synthetic QA', bodyweight: 75, unit: 'kg', level: 'experienced', gender: 'man', programTrack: 'current', goal: 'balanced', equipment: 'full', weightGoal: 'maintain', weightTrackingEnabled: true };
  for (const [i, date] of ['2026-08-27','2026-08-31','2026-09-03','2026-09-07','2026-09-09','2026-09-11'].entries()) {
    const day = programDays('phase1', 5)[i % 2];
    const snapshot = buildSessionPlanSnapshot(data, { ...day, exercises: day.exercises.map((base) => ({ ...resolveExerciseVariant(base, base.name), sets: 2 })) });
    const at = date + 'T10:00:00Z';
    const session = { id: date, date, scheduledDate: date, dayId: day.id, unit: 'kg', programId: 'phase1', planSnapshot: snapshot, entries: {}, exerciseExposures: {}, readiness: 'normal', completionStatus: 'completed', affectsProgression: true, durationSeconds: 2400, completedAt: at, createdAt: at, updatedAt: at, revision: 1, recommendationVersion: 'synthetic-only' };
    snapshot.exercises.forEach((e, j) => {
      session.entries[e.key] = [{ w: '20', r: String(e.repLow), rir: '3' }, { w: '20', r: String(e.repLow), rir: j === 2 ? '' : '3' }];
      session.exerciseExposures[e.key] = { policyVersion: 1, identity: loadProfileId(e), stateAtStart: 'calibrated', noveltyRisk: 'standard', prescribedSets: 2, originalSets: 2, targetRir: 3, relatedHistory: false, startingLoadSource: 'guided', progressionEligible: true, suggestedLoad: 20, targetRepLow: e.repLow, targetRepHigh: e.repHigh };
      const recoveryAt = new Date(Date.parse(at) + 72 * 3600000).toISOString();
      data.exerciseRecovery.push({ id: `${date}:${j}`, sessionId: date, exerciseIdentity: loadProfileId(e), status: i === 4 && j === 0 ? 'limiting' : 'recovered', createdAt: recoveryAt, updatedAt: recoveryAt });
    }); data.sessions.push(session);
  }
  for (let day = 1; day <= 12; day++) { const date = '2026-09-' + String(day).padStart(2, '0'); data.weighIns.push({ id: date, date, unit: 'kg', weight: 75 - day * .05, createdAt: date, updatedAt: date, revision: 1 }); }
  return data;
}
function Preview() {
  const [data, setData] = useState(syntheticAnalysisData);
  const [theme, setTheme] = useState('dark');
  const [notice, setNotice] = useState('');
  return <main className="min-h-screen bg-[#0b0d0c] text-stone-100"><div className="flex flex-wrap gap-4 p-4"><strong>Synthetic QA only</strong><button onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.className = next; }}>Toggle theme</button><button onClick={() => setData({ ...syntheticAnalysisData(), sessions: [], exerciseRecovery: [], weighIns: [] })}>Empty account</button><button onClick={() => setData(syntheticAnalysisData())}>Restore fixture</button><span>{notice}</span></div><ProgressAnalysisView data={data} initialDate="2026-09-07" onClose={() => setNotice('Back to Progress')} onTrain={() => setNotice('Open Train')} onGuide={() => setNotice('Open Guide')} /></main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
