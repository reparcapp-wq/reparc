import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("keeps selected controls legible against the dark interface", async () => {
  const css = await readFile(path.join(root, "app/globals.css"), "utf8");

  assert.match(css, /\.choice-card:has\(\[data-state="checked"\]\)[^{]*\{[^}]*background:\s*#f7c66b/s);
  assert.match(css, /\.choice-card:has\(\[data-state="checked"\]\)[^{]*\{[^}]*color:\s*#0b0d0c/s);
  assert.match(css, /\.selection-button\[data-selected="true"\][^{]*\{[^}]*background:\s*#f7c66b\s*!important/s);
  assert.match(css, /\[data-slot="tabs-trigger"\]\[data-state="active"\][^{]*\{[^}]*color:\s*#0b0d0c\s*!important/s);
});

test("prevents iPhone focus zoom without disabling accessible page zoom", async () => {
  const css = await readFile(path.join(root, "app/globals.css"), "utf8");
  const layout = await readFile(path.join(root, "app/layout.tsx"), "utf8");

  assert.match(css, /\.set-input[^{]*\{[^}]*font-size:\s*1rem/s);
  assert.doesNotMatch(layout, /userScalable|maximumScale|user-scalable|maximum-scale/);
});

test("adds restrained motion while preserving reduced-motion accessibility", async () => {
  const css = await readFile(path.join(root, "app/globals.css"), "utf8");
  const app = await readFile(path.join(root, "components/training-app.tsx"), "utf8");

  assert.match(css, /@keyframes motion-rise/);
  assert.match(css, /\.motion-stagger > \*/);
  assert.match(css, /\[data-slot="progress-indicator"\]/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(app, /data-sync-state=\{state\}/);
  assert.match(app, /className="motion-page[^\"]*"[^>]*role="tabpanel"/);
  assert.match(app, /className="mb-4 lg:hidden"/);
  assert.match(app, /fixed bottom-5 right-5 z-50 hidden/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("waits for a completed set field to finish before starting rest", async () => {
  const source = await readFile(path.join(root, "components/training-app.tsx"), "utf8");

  assert.match(source, /pendingRestSetsRef/);
  assert.match(source, /onBlur=\{\(\) => finishSet\(key, setIndex\)\}/);
  assert.doesNotMatch(source, /if \(exercise && startsRest\)/);
});

test("keeps required onboarding, focused training, and the evidence guide accessible", async () => {
  const app = await readFile(path.join(root, "components/training-app.tsx"), "utf8");
  const guide = await readFile(path.join(root, "components/training-guide.tsx"), "utf8");

  assert.match(app, /\['man', 'Man', Mars\]/);
  assert.match(app, /profile\?\.programTrack \?\?/);
  assert.match(app, /Open guide/);
  assert.match(app, /I confirm that I am 18 or older/);
  assert.match(app, /Choose exactly \$\{frequency\} preferred training days/);
  assert.match(app, /my-progress-onboarding-v2/);
  assert.match(app, /setupVersion: 2/);
  assert.match(app, /Exercise \{activeExerciseIndex \+ 1\} of/);
  assert.match(app, /exerciseIndex !== activeExerciseIndex/);
  assert.match(app, /settingsSection === "overview"/);
  assert.match(guide, /role="tablist"/);
  assert.match(guide, /active === "program"/);
  assert.match(guide, /Evidence library/);
  assert.match(guide, /Last reviewed 30 August 2026/);
  assert.match(guide, /not pregnancy or postpartum prescriptions/i);
});

test("keeps the active guide topic visible and applies the RepArc identity", async () => {
  const guide = await readFile(path.join(root, "components/training-guide.tsx"), "utf8");
  const manifest = await readFile(path.join(root, "app/manifest.ts"), "utf8");
  const logo = await readFile(path.join(root, "public/favicon.svg"), "utf8");

  assert.match(guide, /topicListRef/);
  assert.match(guide, /list\.scrollTo\(\{ left:/);
  assert.match(guide, /prefers-reduced-motion: reduce/);
  assert.match(guide, /aria-controls=\{`guide-panel-\$\{topic\.id\}`\}/);
  assert.match(manifest, /name:\s*"RepArc"/);
  assert.match(manifest, /short_name:\s*"RepArc"/);
  assert.match(logo, /M13 47A35 35 0 0 1 48 12/);
});

test("uses the animated RepArc mark for full-screen loading states", async () => {
  const css = await readFile(path.join(root, "app/globals.css"), "utf8");
  const brand = await readFile(path.join(root, "components/brand-lockup.tsx"), "utf8");
  const account = await readFile(path.join(root, "components/account-gate.tsx"), "utf8");
  const app = await readFile(path.join(root, "components/training-app.tsx"), "utf8");
  const routeLoading = await readFile(path.join(root, "app/loading.tsx"), "utf8");

  assert.match(brand, /export function RepArcLoader/);
  assert.match(brand, /reparc-loader-arc/);
  assert.match(css, /@keyframes reparc-arc-trace/);
  assert.match(css, /@keyframes reparc-letter-draw/);
  assert.match(css, /@keyframes reparc-node-pulse/);
  assert.match(account, /<RepArcLoader label="Opening secure account"/);
  assert.match(app, /<RepArcLoader label="Preparing your training log"/);
  assert.match(app, /REPARC_LOADER_MINIMUM_MS = 2_600/);
  assert.match(app, /await waitForRepArcLoader\(loaderStartedAt\)/);
  assert.match(routeLoading, /<RepArcLoader/);
  assert.doesNotMatch(account, /<Dumbbell/);
});
