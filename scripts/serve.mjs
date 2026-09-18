// Local static preview for the landing page.
//
// `wrangler dev` cannot start on this machine (workerd will not spawn), so this
// is how the page is looked at before it goes out. It serves ./public exactly as
// the Worker's assets binding does for static files — which is enough to check
// layout, type and colour. It deliberately does NOT emulate the Worker's own
// routes (/app, /api/*); those are verified against the deployed URL with curl.
//
//   node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const PORT = Number(process.argv[2] ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';

  // Keep a request from climbing out of ./public with ../ segments.
  const target = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('403 Forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: ${path}`);
  }
}).listen(PORT, () => {
  console.log(`Bream preview serving ./public on http://127.0.0.1:${PORT}`);
});
