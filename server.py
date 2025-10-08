#!/usr/bin/env python3
"""
Simple Python HTTP server with proper cache headers for local development
Run with: python server.py
"""

import http.server
import socketserver
import os
from urllib.parse import urlparse

class CacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_cache_headers()
        super().end_headers()
    
    def send_cache_headers(self):
        path = urlparse(self.path).path
        ext = os.path.splitext(path)[1].lower()
        
        # Static assets - 1 year cache with immutable
        if ext in ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.json']:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
            self.send_header('Vary', 'Accept-Encoding')
        
        # HTML files - 1 hour cache
        elif ext == '.html' or path == '/':
            self.send_header('Cache-Control', 'public, max-age=3600, must-revalidate')
            self.send_header('Vary', 'Accept-Encoding')
        
        # Enable CORS for local development
        self.send_header('Access-Control-Allow-Origin', '*')

def run_server(port=8000):
    with socketserver.TCPServer(("", port), CacheHTTPRequestHandler) as httpd:
        print(f"🚀 Server running at http://localhost:{port}")
        print("📊 Cache headers are properly set for performance audits")
        print("🎯 Ready for Lighthouse testing!")
        print("Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    run_server()

# Instructions:
# 1. Save this as server.py in your project root
# 2. Run: python server.py
# 3. Open http://localhost:8000 in your browser