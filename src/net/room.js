// Online room transport over WebRTC data channels (PeerJS). One phone hosts (peer id derived from a
// 4-letter room code); up to 3 others join with the code. Star topology: clients talk only to the host.
/* global Peer */

const PREFIX = 'smash64-fanrec-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const MAX_PLAYERS = 4;

// STUN for direct connections; free public TURN relays as a fallback for strict (cellular) NATs.
const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];

export function randomCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }

export class Room {
  constructor() {
    this.peer = null; this.conns = new Map(); this.host = null; this.isHost = false;
    this.code = null; this.handlers = {}; this.closed = false; this.myId = null;
  }
  on(ev, fn) { this.handlers[ev] = fn; return this; }
  emit(ev, ...a) { this.handlers[ev]?.(...a); }
  makePeer(id) {
    if (!window.Peer) throw new Error('PeerJS failed to load (no network?)');
    return new Peer(id, { config: { iceServers: ICE }, debug: 0 });
  }
  // host a new room; resolves with the code
  create(tries = 0) {
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const peer = this.makePeer(PREFIX + code);
      peer.on('open', id => {
        this.peer = peer; this.code = code; this.isHost = true; this.myId = 'host';
        peer.on('connection', conn => this.accept(conn));
        peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
        resolve(code);
      });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); this.create(tries + 1).then(resolve, reject); }
        else if (!this.peer) reject(e); else this.emit('error', e);
      });
    });
  }
  accept(conn) {
    conn.on('open', () => {
      if (this.conns.size >= MAX_PLAYERS - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
      this.conns.set(conn.peer, conn);
      this.emit('join', conn.peer);
    });
    conn.on('data', msg => this.emit('message', conn.peer, msg));
    const gone = () => { if (this.conns.delete(conn.peer)) this.emit('leave', conn.peer); };
    conn.on('close', gone); conn.on('error', gone);
  }
  // join an existing room by code
  join(code) {
    return new Promise((resolve, reject) => {
      code = code.toUpperCase().trim();
      const peer = this.makePeer(undefined);
      let done = false;
      const fail = e => { if (!done) { done = true; reject(e); } else this.emit('error', e); };
      peer.on('error', e => fail(e.type === 'peer-unavailable' ? new Error('Room ' + code + ' not found') : e));
      peer.on('open', id => {
        this.peer = peer; this.myId = id; this.code = code;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => fail(new Error('Could not reach room ' + code + ' (connection timed out)')), 15000);
        conn.on('open', () => { clearTimeout(timer); done = true; this.host = conn; resolve(id); });
        conn.on('data', msg => { if (msg?.t === 'full') fail(new Error('Room is full')); else this.emit('message', 'host', msg); });
        conn.on('close', () => { if (!this.closed) this.emit('hostLeft'); });
        conn.on('error', e => fail(e));
      });
    });
  }
  send(to, msg) { if (to === 'host') { this.host?.open && this.host.send(msg); return; } const c = this.conns.get(to); if (c?.open) c.send(msg); }
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) c.send(msg); }
  toHost(msg) { if (this.isHost) this.emit('message', 'host', msg); else this.send('host', msg); }
  close() { this.closed = true; try { this.peer?.destroy(); } catch {} this.conns.clear(); }
}
