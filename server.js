// 드리프트 러시 온라인 서버
// - public/ 폴더의 게임 파일을 보여주고
// - /ws 주소의 WebSocket으로 방 만들기, 참가, 위치 중계를 맡는다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_PLAYERS = 8;   // 한 방 최대 인원
const GRID_SIZE = 8;     // 레이스는 항상 8대 (빈자리는 AI)
const AI_NAMES = ['번개', '소나기', '회오리', '불꽃', '바람', '파도', '별똥', '은하'];
const AI_KARTS = ['red', 'blue', 'yellow', 'mint', 'fin', 'blaze', 'aurora', 'phantom'];
const KART_IDS = new Set(['red', 'blue', 'yellow', 'mint', 'fin', 'blaze', 'aurora', 'phantom', 'solar']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

/* ---------- 정적 파일 ---------- */
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { url = '/'; }
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  const file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUB)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

/* ---------- 방 관리 ---------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const rooms = new Map();
let nextId = 1;

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cleanName = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 10) || '플레이어';
const kartOk = k => (KART_IDS.has(k) ? k : 'red');

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; } while (rooms.has(c));
  return c;
}
function send(ws, o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }
function broadcast(room, o, except) {
  const s = JSON.stringify(o);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s);
}
function pushLobby(room) {
  broadcast(room, {
    t: 'lobby', room: room.code, host: room.host, state: room.state, laps: room.laps, diff: room.diff,
    players: [...room.players.values()].sort((a, b) => a.joined - b.joined).map(p => ({ id: p.id, name: p.name, kart: p.kart, inRace: p.inRace }))
  });
}

wss.on('connection', ws => {
  ws.id = 'p' + (nextId++);
  ws.room = null;
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m && typeof m.t === 'string') handle(ws, m);
  });
  ws.on('close', () => leave(ws));
});

function handle(ws, m) {
  if (m.t === 'ping') return;
  if (m.t === 'create') {
    if (ws.room) leave(ws);
    const room = { code: newCode(), players: new Map(), host: ws.id, state: 'lobby', laps: 2, diff: 1, race: null };
    rooms.set(room.code, room);
    join(ws, room, m);
    return;
  }
  if (m.t === 'join') {
    const room = rooms.get(String(m.room || '').toUpperCase());
    if (!room) return send(ws, { t: 'err', msg: '그 코드의 방이 없어. 코드를 다시 확인해줘.' });
    if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: '방이 꽉 찼어. (최대 8명)' });
    if (ws.room) leave(ws);
    join(ws, room, m);
    return;
  }
  const room = ws.room;
  if (!room) return;
  const me = room.players.get(ws.id);
  if (!me) return;
  switch (m.t) {
    case 'kart':
      if (!me.inRace) { me.kart = kartOk(m.kart); pushLobby(room); }
      break;
    case 'settings':
      if (ws.id === room.host && room.state === 'lobby') {
        if ([1, 2, 3].includes(m.laps)) room.laps = m.laps;
        if ([0, 1, 2].includes(m.diff)) room.diff = m.diff;
        pushLobby(room);
      }
      break;
    case 'start':
      if (ws.id === room.host && room.state === 'lobby') startRace(room);
      break;
    case 's': // 내 카트 위치
      if (room.state === 'racing' && me.inRace && Array.isArray(m.d)) broadcast(room, { t: 's', id: ws.id, d: m.d.slice(0, 8) }, ws);
      break;
    case 'a': // 방장이 계산한 AI 카트 위치
      if (room.state === 'racing' && ws.id === room.host && Array.isArray(m.d)) broadcast(room, { t: 'a', d: m.d.slice(0, GRID_SIZE) }, ws);
      break;
    case 'finish':
      if (room.state === 'racing' && me.inRace) finish(room, ws.id, Number(m.time));
      break;
    case 'aifin':
      if (room.state === 'racing' && ws.id === room.host && room.race.ai.has(m.id)) finish(room, m.id, Number(m.time));
      break;
    case 'leave':
      leave(ws);
      break;
  }
}

function join(ws, room, m) {
  ws.room = room;
  room.players.set(ws.id, { id: ws.id, ws, name: cleanName(m.name), kart: kartOk(m.kart), inRace: false, joined: Date.now() });
  send(ws, { t: 'joined', id: ws.id, room: room.code });
  pushLobby(room);
}

function startRace(room) {
  const humans = [...room.players.values()];
  const slots = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  const names = shuffle(AI_NAMES), karts = shuffle(AI_KARTS);
  const grid = [], ai = new Set();
  humans.forEach((p, i) => { p.inRace = true; grid.push({ id: p.id, kart: p.kart, name: p.name, ai: false, slot: slots[i] }); });
  for (let i = humans.length; i < GRID_SIZE; i++) {
    const id = 'ai' + i;
    ai.add(id);
    grid.push({ id, kart: karts[i % karts.length], name: names[i % names.length], ai: true, slot: slots[i] });
  }
  room.state = 'racing';
  room.race = { grid, ai, finished: new Map(), startAt: Date.now(), firstFinish: 0, timer: null };
  broadcast(room, { t: 'start', grid, laps: room.laps, diff: room.diff, host: room.host });
  pushLobby(room);
  // 안전장치: 바퀴당 3분이 지나도 안 끝나면 강제로 종료
  room.race.timer = setTimeout(() => endRace(room), (room.laps * 180 + 30) * 1000);
}

function finish(room, id, time) {
  const r = room.race;
  if (!r || r.finished.has(id)) return;
  if (!isFinite(time) || time <= 0) time = (Date.now() - r.startAt) / 1000;
  r.finished.set(id, time);
  broadcast(room, { t: 'fin', id, time });
  // 첫 번째 사람이 들어오면 남은 사람에게 60초를 준다
  if (!r.ai.has(id) && !r.firstFinish) {
    r.firstFinish = Date.now();
    clearTimeout(r.timer);
    r.timer = setTimeout(() => endRace(room), 60000);
  }
  checkAllHumans(room);
}

function checkAllHumans(room) {
  const r = room.race;
  if (!r) return;
  const racing = [...room.players.values()].filter(p => p.inRace);
  if (racing.length && racing.every(p => r.finished.has(p.id))) {
    clearTimeout(r.timer);
    r.timer = setTimeout(() => endRace(room), 3000);
  }
}

function endRace(room) {
  if (room.state !== 'racing') return;
  if (room.race) clearTimeout(room.race.timer);
  room.state = 'lobby';
  room.race = null;
  for (const p of room.players.values()) p.inRace = false;
  broadcast(room, { t: 'raceEnd' });
  pushLobby(room);
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  room.players.delete(ws.id);
  if (room.players.size === 0) {
    if (room.race) clearTimeout(room.race.timer);
    rooms.delete(room.code);
    return;
  }
  if (room.state === 'racing' && room.race) {
    // 레이스 중에 나간 사람의 카트는 AI가 이어서 달린다
    room.race.ai.add(ws.id);
    broadcast(room, { t: 'left', id: ws.id, toAI: true });
  } else {
    broadcast(room, { t: 'left', id: ws.id });
  }
  if (room.host === ws.id) {
    const next = [...room.players.values()].sort((a, b) => a.joined - b.joined)[0];
    room.host = next.id;
    broadcast(room, { t: 'host', id: room.host });
  }
  pushLobby(room);
  if (room.state === 'racing') checkAllHumans(room);
}

// 끊긴 연결 정리
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Drift Rush server listening on ${PORT}`));
