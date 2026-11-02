#!/usr/bin/env python3
"""
Мини-сервер для локального просмотра сайта.

Отличие от `python3 -m http.server`: поддерживает Range-запросы,
поэтому аудио умеет перематываться и продолжать играть с того же места
после перехода между страницами.

Запуск:  python3 serve.py [порт]
По умолчанию: http://localhost:8123/
"""

import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class RangeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        if not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None

        size = os.path.getsize(path)
        ctype = self.guess_type(path)

        range_header = self.headers.get("Range")
        match = re.match(r"bytes=(\d*)-(\d*)$", range_header or "")
        if not match:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            with open(path, "rb") as f:
                self.wfile.write(f.read())
            return None

        start_raw, end_raw = match.groups()
        if start_raw == "":
            # bytes=-500 — последние 500 байт
            length = min(int(end_raw or 0), size)
            start = size - length
            end = size - 1
        else:
            start = int(start_raw)
            end = int(end_raw) if end_raw else size - 1
            end = min(end, size - 1)

        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None

        length = end - start + 1
        with open(path, "rb") as f:
            f.seek(start)
            data = f.read(length)

        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
        return None

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    server = ThreadingHTTPServer(("", port), RangeHandler)
    print("Сайт доступен: http://localhost:%d/" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено")


if __name__ == "__main__":
    main()
