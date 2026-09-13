import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, appType: 'custom', root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { MuscleAnatomy, ANATOMY_GROUPS } = await vite.ssrLoadModule('/components/muscle-anatomy.tsx');
const { bodyFront, bodyBack } = await vite.ssrLoadModule('/lib/anatomy-paths.ts');
const { MUSCLES } = await vite.ssrLoadModule('/lib/exercise-metadata.ts');
const { buildProgressAnalysis } = await vite.ssrLoadModule('/lib/progress-analysis.ts');
const { emptyData } = await vite.ssrLoadModule('/lib/training.ts');
const review = () => buildProgressAnalysis(emptyData(), 'week', '2026-09-07', '2026-09-13');
function render(data, selected = 'chest') {
  const before = JSON.stringify(data);
  const html = renderToStaticMarkup(React.createElement(MuscleAnatomy, { review: data, selected, select() {} }));
  assert.equal(JSON.stringify(data), before, 'The anatomy display must not change report data');
  return html;
}

test('licensed anatomy covers all ten report groups with explicit mappings, not name guessing', () => {
  const regions = [...bodyFront, ...bodyBack];
  assert.deepEqual([...new Set(regions.map(r => ANATOMY_GROUPS[r.slug]).filter(Boolean))].sort(), [...MUSCLES].sort());
  assert.equal(ANATOMY_GROUPS.quadriceps, 'quads');
  assert.equal(ANATOMY_GROUPS.hamstring, 'hamstrings');
  assert.equal(ANATOMY_GROUPS.deltoids, 'shoulders');
  assert.equal(ANATOMY_GROUPS.obliques, 'trunk');
  for (const name of ['forearm', 'adductors', 'tibialis', 'head', 'neck', 'hands', 'knees']) assert.equal(ANATOMY_GROUPS[name], undefined);
  assert.ok(regions.flatMap(r => Object.values(r.path).flat()).length > 100, 'Keep detailed anatomical geometry');
  for (const r of regions) for (const d of Object.values(r.path).flat()) assert.match(d, /^M[\d .-]/);
});

test('empty records stay gray and untracked anatomy stays neutral, without invented targets', () => {
  const html = render(review());
  assert.doesNotMatch(html, /data-status="(?:on-track|hold|adjust)"/);
  assert.match(html, /data-region="forearm" data-status="untracked"/);
  assert.equal((html.match(/<button type="button"/g) ?? []).length, 10);
  assert.equal((html.match(/0 direct · 0 supporting/g) ?? []).length, 10);
});

test('muscle paths and named controls preserve report statuses and exact separate counts', () => {
  const data = review();
  data.muscles.forEach((row, i) => { row.direct = i; row.indirect = i + 2; row.status = ['on-track', 'hold', 'adjust', 'insufficient'][i % 4]; });
  const html = render(data, 'back');
  for (const row of data.muscles) {
    assert.match(html, new RegExp(`data-muscle="${row.muscle}" data-status="${row.status}"`));
    assert.ok(html.includes(`${row.direct} direct · ${row.indirect} supporting`));
  }
  assert.match(html, /data-muscle="back" data-status="hold" data-selected="true"/);
  assert.doesNotMatch(html, /data-muscle="chest"[^>]+data-selected="true"/);
  assert.equal((html.match(/aria-label="Back, back:/g) ?? []).length, 1, 'One keyboard control for the whole back group');
  assert.match(html, /role="button" tabindex="0"/);
});

test('geometry ships with its license and light/dark and reduced-motion styles', async () => {
  const license = await readFile(new URL('../public/licenses/body-highlighter.txt', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(license, /Copyright \(c\) 2022 ELABBASSI Hicham/);
  assert.match(license, /MIT License/);
  assert.match(css, /html\.light \.anatomy-stage/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
