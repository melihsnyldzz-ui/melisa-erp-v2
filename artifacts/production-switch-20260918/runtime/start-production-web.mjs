import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (process.argv.length !== 3 || !path.isAbsolute(root || '') || !fs.existsSync(path.join(root, 'index.html'))) throw Error('ABSOLUTE_WEB_BUILD_REQUIRED');
const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.use(express.static(root, { index: 'index.html', dotfiles: 'deny' }));
app.use((req, res) => req.method === 'GET' && !path.extname(req.path) ? res.sendFile(path.join(root, 'index.html')) : res.sendStatus(404));
app.listen(5188, '127.0.0.1', () => console.log('Melisa production web: http://127.0.0.1:5188'));
const lanApp = express();
lanApp.disable('x-powered-by');
lanApp.use((req, res, next) => /^192\.168\.1\.(?:\d{1,3})$/.test(req.socket.remoteAddress || '') ? next() : res.sendStatus(403));
lanApp.use(app);
lanApp.listen(5188, '192.168.1.46', () => console.log('Melisa production web LAN: http://192.168.1.46:5188'));
