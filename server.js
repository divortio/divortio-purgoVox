import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- ES Module Boilerplate ---
// This is needed to get the correct directory path in an ES module.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End Boilerplate ---

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
    // Set the headers for ALL responses. This is the crucial fix.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}).listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
    console.log("✅ COOP and COEP headers are being set for all requests.");
    console.log("Please open http://127.0.0.1:8080 in your browser.");
});