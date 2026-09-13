import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, appType: 'custom', root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { ProgressAnalysisView } = await vite.ssrLoadModule('/components/progress-analysis.tsx');
const { MuscleAnatomy } = await vite.ssrLoadModule('/components/muscle-anatomy.tsx');
const { buildProgressAnalysis } = await vite.ssrLoadModule('/lib/progress-analysis.ts');
const { emptyData, isoDate } = await vite.ssrLoadModule('/lib/training.ts');
const source = await readFile(new URL('../components/progress-analysis.tsx', import.meta.url), 'utf8');

function render(date) {
  const data = emptyData(); const before = JSON.stringify(data);
  const html = renderToStaticMarkup(React.createElement(ProgressAnalysisView, { data, initialDate: date, onClose() {}, onTrain() {}, onGuide() {} }));
  assert.equal(JSON.stringify(data), before);
  return html;
}
test('analysis starts with concise navigation and no redundant current-period reset', () => {
  const html = render(isoDate(new Date()));
  for (const label of ['Overview', 'Trends', 'Muscles', 'Details', 'Daily', 'Weekly', 'Monthly']) assert.ok(html.includes(`>${label}</button>`));
  assert.doesNotMatch(html, /Back to this week|>This week<|Full review|>Performance</);
  assert.doesNotMatch(html, /Exercise-by-exercise review|Information-coverage rules/);
  assert.doesNotMatch(html, /0 of 0 recorded|>Recovery checks</, 'An empty period should not show meaningless metric tiles');
});
test('past periods retain an explicit route back to the current period', () => {
  assert.match(render('2026-01-05'), /Back to this week/);
  assert.match(source, /isValidDateOnly\(e.target.value\) && e.target.value <= asOf/);
  assert.match(source, /disabled=\{review.end >= asOf\}/);
});
test('detail topics start collapsed and share an exclusive disclosure group', () => {
  assert.equal((source.match(/name="analysis-details"/g) ?? []).length, 5);
  assert.doesNotMatch(source, /name="analysis-details" open/);
  assert.match(source, /value=\{workout.id\}/);
  assert.match(source, /value=\{exercise\?\.identity/);
  for (const label of ['Record quality', 'Exercise review', 'Included workouts', 'Suggestion results', 'Evidence & privacy']) assert.ok(source.includes(label));
});
test('charts are mutually selected and compact muscle mode replaces the long button list', () => {
  for (const choice of ['Exercises', 'Workload', 'Weight']) assert.ok(source.includes(`trend === "${choice}"`));
  const review = buildProgressAnalysis(emptyData(), 'week', '2026-09-07', '2026-09-13');
  const html = renderToStaticMarkup(React.createElement(MuscleAnatomy, { review, selected: 'calves', select() {}, compact: true }));
  assert.match(html, /Muscle group<select/);
  assert.equal((html.match(/<option /g) ?? []).length, 10);
  assert.doesNotMatch(html, /class="analysis-muscle-buttons"/);
  assert.match(html, /value="calves" selected/);
  assert.match(html, /data-muscle="calves" data-status="insufficient" data-selected="true"/);
});
test('phone labels cannot split mid-word and disclosures have no decorative bottom rule', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.analysis-tabs button \{[^}]*white-space: nowrap;[^}]*overflow-wrap: normal/);
  assert.match(css, /\.analysis-periods \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.analysis-disclosure \{ border: 0;/);
  assert.doesNotMatch(css, /details:not\(\.analysis-card\) \{ border-bottom/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(source, /motion-pop|motion-page/);
});
