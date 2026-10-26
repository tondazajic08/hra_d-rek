# Falešná Firebase Realtime Database na testy multiplayeru (REST: GET/PUT/POST/DELETE + proud EventSource) + statické soubory hry
# Umí libovolné cesty (hraci/…, hlas/<id>/…); pravidla nekontroluje.
# Spuštění: python tools/falesna_databaze.py . 8001   → hra: http://127.0.0.1:8001/index.html?mpdb=http://127.0.0.1:8001
# Třetí číslo = zpoždění v ms jako u skutečné databáze (polovina na zápis, polovina na proud): … . 8001 120
import json, sys, time, threading, queue, random, string
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8001
DELAY = (int(sys.argv[3]) if len(sys.argv) > 3 else 0) / 2000   # s na každou cestu
DB = {}
LOCK = threading.Lock()
CLIENTS = []   # (cesta jako seznam, fronta)

def resolve(v):
    if isinstance(v, dict):
        if v == {'.sv': 'timestamp'}:
            return int(time.time() * 1000)
        return {k: resolve(x) for k, x in v.items()}
    return v

def get(parts):
    o = DB
    for k in parts:
        if not isinstance(o, dict) or k not in o: return None
        o = o[k]
    return o

def set_at(parts, v):
    o = DB
    for k in parts[:-1]:
        if not isinstance(o.get(k), dict): o[k] = {}
        o = o[k]
    if v is None: o.pop(parts[-1], None)
    else: o[parts[-1]] = v

def broadcast(parts, data):
    for cp, q in list(CLIENTS):
        if parts[:len(cp)] == cp:   # změna uvnitř sledované cesty
            q.put((time.time(), 'event: put\ndata: ' + json.dumps({'path': '/' + '/'.join(parts[len(cp):]), 'data': data}) + '\n\n'))
        elif cp[:len(parts)] == parts:   # přepsaný předek sledované cesty
            q.put((time.time(), 'event: put\ndata: ' + json.dumps({'path': '/', 'data': get(cp)}) + '\n\n'))

def push_id():
    return '-' + ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(19))

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
    def parts(self):
        p = self.path.split('?')[0]
        if not p.endswith('.json'): return None
        return [x for x in p[:-len('.json')].split('/') if x]
    def reply(self, data):
        body = json.dumps(data).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body)
    def body(self):
        if DELAY: time.sleep(DELAY)
        n = int(self.headers.get('Content-Length', 0))
        return resolve(json.loads(self.rfile.read(n) or b'null'))
    def do_GET(self):
        parts = self.parts()
        if parts is None: return super().do_GET()
        if 'text/event-stream' in self.headers.get('Accept', ''):
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.end_headers()
            q = queue.Queue()
            with LOCK:
                snap = get(parts)
                CLIENTS.append((parts, q))
            try:
                self.wfile.write(('event: put\ndata: ' + json.dumps({'path': '/', 'data': snap}) + '\n\n').encode()); self.wfile.flush()
                while True:
                    try:
                        t, msg = q.get(timeout=10)
                        if DELAY: time.sleep(max(0, t + DELAY - time.time()))
                    except queue.Empty: msg = 'event: keep-alive\ndata: null\n\n'
                    self.wfile.write(msg.encode()); self.wfile.flush()
            except Exception:
                pass
            finally:
                CLIENTS.remove((parts, q))
            return
        with LOCK: data = get(parts)
        self.reply(data)
    def do_PUT(self):
        parts, v = self.parts(), self.body()
        with LOCK:
            set_at(parts, v); broadcast(parts, v)
        self.reply(v)
    def do_POST(self):
        parts, v = self.parts(), self.body()
        k = push_id()
        with LOCK:
            set_at(parts + [k], v); broadcast(parts + [k], v)
        self.reply({'name': k})
    def do_DELETE(self):
        if DELAY: time.sleep(DELAY)
        parts = self.parts()
        with LOCK:
            set_at(parts, None); broadcast(parts, None)
        self.reply(None)

ThreadingHTTPServer.request_queue_size = 128   # víc prohlížečů najednou (výchozích 5 nestačilo – soubory hry se pak nenačetly)
ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
