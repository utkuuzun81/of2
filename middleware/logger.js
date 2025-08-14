import morgan from 'morgan';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const rfs = require('rotating-file-stream');
import path from 'path';
import fs from 'fs';

// logs klasörü oluşturuluyor (yoksa)
const logDirectory = path.join('logs');
if (!fs.existsSync(logDirectory)) fs.mkdirSync(logDirectory);

// access.log dosyasını günlük rotate edecek şekilde ayarla
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: logDirectory
});

export default morgan('combined', { stream: accessLogStream });
