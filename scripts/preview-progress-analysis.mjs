// Synthetic-data-only visual QA. Not a Next route; never bundled into production.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, configFile: false, appType: 'custom', plugins: [react()], resolve: { alias: { '@': root } }, server: { host: '127.0.0.1', port: 5194, strictPort: true } });
server.middlewares.use(async (req, res, next) => {
  if (req.url !== '/') return next();
  const html = await server.transformIndexHtml('/', '<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RepArc analysis — synthetic QA</title></head><body><div id="root"></div><script type="module" src="/tests/fixtures/progress-analysis-preview.jsx"></script></body></html>');
  res.setHeader('Content-Type', 'text/html'); res.end(html);
});
await server.listen(); console.log('Synthetic review preview: http://127.0.0.1:5194');
