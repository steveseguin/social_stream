import http.server
import socketserver
import os
from urllib.parse import unquote

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Decode URL-encoded paths
        self.path = unquote(self.path)
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        # Enable CORS for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run_server(port=80):
    try:
        with socketserver.TCPServer(("", port), CustomHandler) as httpd:
            print(f"Server running at http://localhost:{port}/")
            print(f"Serving directory: {os.getcwd()}")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {port} is already in use. Try a different port.")
        else:
            raise e
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    run_server()