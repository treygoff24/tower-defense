import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  server: { port: 3000 },
  build: { target: 'es2022' },
  define: {
    __VERSION__: JSON.stringify(packageJson.version || '0.0.0'),
  },
});
