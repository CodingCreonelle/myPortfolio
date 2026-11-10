const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const staticDir = path.join(__dirname, 'Project Files');

app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

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
