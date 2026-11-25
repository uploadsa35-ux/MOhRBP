/**
 * Application Entry Point (Node.js & Vercel Serverless)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compiledServer = path.join(__dirname, 'dist', 'server.js');

let appHandler;
if (fs.existsSync(compiledServer)) {
  const mod = await import('./dist/server.js');
  appHandler = mod.default || mod.app;
} else {
  console.warn('Warning: dist/server.js not found. Please run "npm run build" first.');
}

export default appHandler;
