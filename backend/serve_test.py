#!/usr/bin/env python
# Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
# Wren Terminal - Simple HTTP Server for Testing

import http.server
import socketserver
import os

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        http.server.SimpleHTTPRequestHandler.end_headers(self)

Handler = MyHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    print(f"Open http://localhost:{PORT}/test_streaming.html in your browser")
    httpd.serve_forever()
