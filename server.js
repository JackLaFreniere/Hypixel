// Simple Node.js server with proper cache headers for local development
// Run with: node server.js

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware for cache headers
app.use((req, res, next) => {
    const ext = path.extname(req.url);
    
    // Static assets - 1 year cache with immutable
    if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.json'].includes(ext)) {
        res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Vary': 'Accept-Encoding'
        });
    }
    // HTML files - 1 hour cache
    else if (ext === '.html' || req.url === '/') {
        res.set({
            'Cache-Control': 'public, max-age=3600, must-revalidate',
            'Vary': 'Accept-Encoding'
        });
    }
    
    next();
});

// Serve static files
app.use(express.static('./', {
    etag: true,
    lastModified: true
}));

// Handle SPA routing
app.get('*', (req, res) => {
    if (path.extname(req.url) === '') {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log('📊 Cache headers are properly set for performance audits');
    console.log('🎯 Ready for Lighthouse testing!');
});

// Instructions:
// 1. npm init -y (if no package.json exists)
// 2. npm install express
// 3. node server.js
// 4. Open http://localhost:3000 in your browser