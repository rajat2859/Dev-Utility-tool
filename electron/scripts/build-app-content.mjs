import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildWebApp } from 'vite';
import { build as bundleServer } from 'esbuild';

const electronDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(electronDirectory, '..');

await buildWebApp({
  root: repositoryRoot,
  configFile: path.join(repositoryRoot, 'vite.config.ts'),
  logLevel: 'warn',
});

// Only these two stay external: tesseract.js starts worker threads from its own files, and
// playwright-core locates its own files. They are installed by this folder's package.json.
await bundleServer({
  entryPoints: [path.join(repositoryRoot, 'server.ts')],
  outfile: path.join(electronDirectory, 'build', 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['tesseract.js', 'playwright-core'],
  alias: { vite: path.join(electronDirectory, 'scripts', 'vite-not-bundled.cjs') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

console.log('Desktop app content is ready.');
