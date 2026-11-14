const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const staticDir = path.join(__dirname, 'Project Files');
const ALLOWED_DATASETS = new Set(['pages', 'projects', 'experience', 'socials']);
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

app.disable('x-powered-by');
app.locals.dataDir = path.join(staticDir, 'data');
app.locals.adminJsPath = path.join(staticDir, 'assets', 'js', 'admin-menu.js');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

function isLoopbackAddress(addr) {
  const normalized = String(addr || '').trim();
  return LOOPBACK_IPS.has(normalized);
}

function isLocalOrigin(originHeader) {
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  } catch (_err) {
    return false;
  }
}

function requireAdminAccess(req, res, next) {
  const originHeader = req.get('origin');
  if (originHeader && !isLocalOrigin(originHeader)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: cross-origin admin request' });
  }

  const configuredToken = String(process.env.ADMIN_API_TOKEN || '').trim();
  if (configuredToken) {
    const headerToken = String(req.get('x-admin-token') || '').trim();
    const authHeader = String(req.get('authorization') || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (headerToken !== configuredToken && bearerToken !== configuredToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    return next();
  }

  const remoteAddr = (req.socket && req.socket.remoteAddress) || req.ip || '';
  if (!isLoopbackAddress(remoteAddr)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: loopback only' });
  }

  return next();
}

app.use('/api/admin', requireAdminAccess, express.json({ limit: '2mb' }));

app.get('/api/admin/status', (_req, res) => {
  res.status(200).json({
    ok: true,
    directWrite: true,
    datasets: Array.from(ALLOWED_DATASETS),
  });
});

function handleAdminDatasetWrite(req, res) {
  const dataset = String(req.params.dataset || '').toLowerCase();
  if (!ALLOWED_DATASETS.has(dataset)) {
    return res.status(400).json({ ok: false, error: 'Unknown dataset' });
  }

  const rawBody = req.body;
  const payload =
    rawBody &&
    typeof rawBody === 'object' &&
    !Array.isArray(rawBody) &&
    Object.prototype.hasOwnProperty.call(rawBody, '__adminPayload')
      ? rawBody.__adminPayload
      : rawBody;

  const isValidShape =
    dataset === 'projects'
      ? Array.isArray(payload)
      : Boolean(payload && typeof payload === 'object' && !Array.isArray(payload));

  if (!isValidShape) {
    return res.status(400).json({ ok: false, error: `Invalid payload shape for ${dataset}` });
  }

  const targetDataDir = req.app.locals.dataDir || path.join(staticDir, 'data');
  const filePath = path.join(targetDataDir, `${dataset}.json`);
  try {
    const formatted = JSON.stringify(payload, null, 2) + '\n';
    fs.writeFileSync(filePath, formatted, 'utf8');
    return res.status(200).json({
      ok: true,
      dataset,
      file: `Project Files/data/${dataset}.json`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : 'Write failed' });
  }
}

app.put('/api/admin/data/:dataset', handleAdminDatasetWrite);
app.post('/api/admin/data/:dataset', handleAdminDatasetWrite);

function handleAdminAuthUpdate(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const salt = String(body.salt || '').trim();
  const hash = String(body.hash || '').trim();

  if (!/^[0-9a-f]{16,64}$/.test(salt) || !/^[0-9a-f]{64}$/.test(hash)) {
    return res.status(400).json({ ok: false, error: 'Invalid auth verifier format' });
  }

  const adminJsPath = req.app.locals.adminJsPath || path.join(staticDir, 'assets', 'js', 'admin-menu.js');
  try {
    const src = fs.readFileSync(adminJsPath, 'utf8');
    const saltRe = /(var\s+DEFAULT_AUTH_SALT\s*=\s*')[0-9a-f]+(')/;
    const hashRe = /(var\s+DEFAULT_AUTH_HASH\s*=\s*')[0-9a-f]+(')/;
    if (!saltRe.test(src) || !hashRe.test(src)) {
      return res.status(500).json({ ok: false, error: 'Auth constants not found in admin-menu.js' });
    }
    const updated = src
      .replace(saltRe, `$1${salt}$2`)
      .replace(hashRe, `$1${hash}$2`);
    fs.writeFileSync(adminJsPath, updated, 'utf8');
    return res.status(200).json({
      ok: true,
      file: 'Project Files/assets/js/admin-menu.js',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : 'Auth write failed' });
  }
}

app.put('/api/admin/auth', handleAdminAuthUpdate);
app.post('/api/admin/auth', handleAdminAuthUpdate);

app.use(
  express.static(staticDir, {
    index: 'index.html',
    extensions: ['html'],
    etag: true,
    setHeaders: (res, filePath) => {
      if (/\.(css|js)$/i.test(filePath) && res.req && res.req.query && res.req.query.v) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res) => {
  res.status(404).send('Not Found');
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
