'use strict';
// UHS v0.1: local test implementation, not a production-ready identity service.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT || 8082);
const PREVIEW_ONLY = process.env.UHS_LOCAL_ACCOUNTS !== '1';
const HOST = process.env.HOST || (PREVIEW_ONLY ? '0.0.0.0' : '127.0.0.1');
const ROOT = '/UHS';
const DB_FILE = path.join(__dirname, 'data', 'accounts.json');
const PUBLIC = path.join(__dirname, 'public');
const sessions = new Map();
const attempts = new Map();
const MAX_BODY = 16 * 1024;
let state = { nextId: 1000, members: [] };
if (!PREVIEW_ONLY && fs.existsSync(DB_FILE)) {
  state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!Number.isSafeInteger(state.nextId) || state.nextId < 1000 || !Array.isArray(state.members)) {
    throw new Error('Invalid account store');
  }
}
function persist() {
  // One Node process; synchronous write keeps new IDs serialized.
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function json(res, code, obj, headers = {}) {
  const text = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(text);
}
function cookie(req, key) {
  const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(key+'='));
  return value ? value.slice(key.length + 1) : null;
}
function memberView(member) { return { id: member.id, displayName: member.displayName, email: member.email, joinedAt: member.joinedAt }; }
function currentMember(req) {
  const token = cookie(req, 'uhs_session');
  const session = token && sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
  return state.members.find(m => m.id === session.memberId) || null;
}
function issueSession(res, member) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { memberId: member.id, expiresAt: Date.now() + 7*24*3600*1000 });
  return `uhs_session=${token}; HttpOnly; SameSite=Lax; Path=${ROOT}; Max-Age=604800`;
}
async function body(req) {
  let chunks=[], count=0;
  for await (const chunk of req) { count+=chunk.length; if(count>MAX_BODY) throw new Error('Request too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function limited(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let item = attempts.get(ip);
  if (!item || now-item.start > 15*60*1000) item = {start:now, count:0};
  item.count++;
  attempts.set(ip, item);
  return item.count > 35;
}
const files = {
  '/UHS': 'index.html', '/UHS/': 'index.html',
  '/UHS/styles.css': 'styles.css', '/UHS/app.js': 'app.js',
  '/UHS/uhs-welcome.png': 'uhs-welcome.png'
};
const mimetypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.method === 'GET' && pathname === '/healthz') return json(res,200,{status:'ok',previewOnly:PREVIEW_ONLY});
    if (req.method === 'GET' && pathname === ROOT+'/api/status') return json(res,200,{previewOnly:PREVIEW_ONLY});
    if (req.method === 'GET' && files[pathname]) {
      const file = path.join(PUBLIC, files[pathname]);
      res.writeHead(200, { 'content-type': mimetypes[path.extname(file)], 'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      fs.createReadStream(file).pipe(res); return;
    }
    if (PREVIEW_ONLY && pathname.startsWith(ROOT+'/api/') && pathname !== ROOT+'/api/status') return json(res,503,{error:'Account creation and login are disabled in this public preview until persistent account storage and security are complete.'});
    if (req.method === 'GET' && pathname === ROOT+'/api/me') {
      const m = currentMember(req);
      return json(res, 200, {member: m ? memberView(m) : null});
    }
    if (req.method === 'POST' && pathname === ROOT+'/api/register') {
      if (limited(req)) return json(res, 429, {error:'Too many attempts. Try again later.'});
      const data = await body(req);
      const displayName = String(data.displayName||'').trim();
      const email = String(data.email||'').trim().toLowerCase();
      const password = String(data.password||'');
      if (displayName.length < 2 || displayName.length > 60) return json(res,400,{error:'Display name must be 2–60 characters.'});
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res,400,{error:'Enter a valid email address.'});
      if (password.length < 12 || Buffer.byteLength(password,'utf8') > 256) return json(res,400,{error:'Password must be at least 12 characters (maximum 256 bytes).'});
      if (state.members.some(m => m.email === email)) return json(res,409,{error:'An account with this email already exists.'});
      if (!Number.isSafeInteger(state.nextId + 1)) return json(res, 503, {error:'Member ID range exhausted.'});
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      const member = { id: state.nextId, displayName, email, salt, hash, joinedAt: new Date().toISOString() };
      state.members.push(member); state.nextId++;
      persist();
      return json(res,201,{ member:memberView(member), notice:'Account created for local testing.' },{'Set-Cookie':issueSession(res,member)});
    }
    if (req.method === 'POST' && pathname === ROOT+'/api/login') {
      if (limited(req)) return json(res,429,{error:'Too many attempts. Try again later.'});
      const data = await body(req);
      const email = String(data.email||'').trim().toLowerCase();
      const password = String(data.password||'');
      const member = state.members.find(m => m.email === email);
      // Use scrypt even for nonexistent users to reduce account enumeration via timing.
      const salt = member ? member.salt : '00000000000000000000000000000000';
      const derived = await scrypt(password,salt,64);
      const reference = Buffer.from(member ? member.hash : '00'.repeat(64),'hex');
      if (!member || !crypto.timingSafeEqual(derived,reference)) return json(res,401,{error:'Invalid email or password.'});
      return json(res,200,{member:memberView(member)},{'Set-Cookie':issueSession(res,member)});
    }
    if (req.method === 'POST' && pathname === ROOT+'/api/logout') {
      const token = cookie(req,'uhs_session'); if(token) sessions.delete(token);
      return json(res,200,{ok:true},{'Set-Cookie':`uhs_session=; HttpOnly; SameSite=Lax; Path=${ROOT}; Max-Age=0`});
    }
    json(res,404,{error:'Not found'});
  } catch (e) {
    console.error('Request error:',e.message);
    json(res,400,{error:'The request could not be completed.'});
  }
});
server.listen(PORT, HOST, ()=>console.log(`UHS test server: http://${HOST}:${PORT}${ROOT}/`));
