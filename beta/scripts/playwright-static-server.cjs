const fs = require('fs');
const path = require('path');
const http = require('http');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.onnx_data': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream'
};

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function buildHeaders(filePath, size) {
  return {
    'Content-Type': contentType(filePath),
    'Content-Length': size,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function startStaticServer(options = {}) {
  const root = options.root || process.cwd();
  const host = options.host || '127.0.0.1';
  const port = options.port || 4173;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://${host}:${port}`);
        const pathname = decodeURIComponent(reqUrl.pathname);
        const relativePath = pathname.replace(/^\/+/, '');
        let filePath = path.join(root, relativePath);

        if (!filePath.startsWith(root)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (pathname === '/' || pathname === '') {
          filePath = path.join(root, 'index.html');
        }

        fs.stat(filePath, (err, stats) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          if (stats.isDirectory()) {
            const indexPath = path.join(filePath, 'index.html');
            fs.stat(indexPath, (indexErr, indexStats) => {
              if (indexErr || !indexStats.isFile()) {
                res.writeHead(404);
                res.end('Not Found');
                return;
              }
              res.writeHead(200, buildHeaders(indexPath, indexStats.size));
              fs.createReadStream(indexPath).pipe(res);
            });
            return;
          }

          res.writeHead(200, buildHeaders(filePath, stats.size));
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (error) {
        res.writeHead(500);
        res.end(String(error));
      }
    });

    server.on('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

module.exports = {
  startStaticServer
};
