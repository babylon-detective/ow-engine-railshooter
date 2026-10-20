// oskiewar round room transport, 26.08.05
// Keeps live and stored-demo delivery outside the shared game/render engine.

const WORD = "(?:[bdfgklmnprstvz][aeiou]){3}";
const ROUND_NAME = new RegExp(`^(?:${WORD}-${WORD}-${WORD}|[a-z]{4,7}[0-9]{1,3})$`);

// The relays, by region. Through a relay a fight's round trip is each
// player's round trip to it added together, so the room should live on the
// relay nearest the players; one relay in New Jersey cost two players in
// Los Angeles about 200 ms to reach each other. 26.10.14
export const OSKIEWAR_RELAYS = [
  { region: "nj", host: "session-server.aesthetic.computer" },
  { region: "sfo", host: "relay-sfo.aesthetic.computer" },
];

// Which relay a room lives on. A room that is already live somewhere is
// joined there, whatever is nearest — both players must share one relay. A
// room nobody is hosting goes to the relay that answers fastest, because
// this visitor is about to host it. `pinned` (a region) skips the question
// for tests. Resolves to a host name; never rejects.
export async function chooseRelayHost(room, { fetchImpl = globalThis.fetch,
  pinned = "", timeoutMs = 1500, relays = OSKIEWAR_RELAYS } = {}) {
  const fallback = relays[0].host;
  const pin = relays.find((relay) => relay.region === pinned);
  if (pin) return pin.host;
  if (typeof fetchImpl !== "function") return fallback;
  const within = (promise) => Promise.race([promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  const ask = async (relay, path) => {
    try {
      const started = Date.now();
      const response = await fetchImpl(`https://${relay.host}${path}`, { cache: "no-store" });
      const body = response?.ok ? await response.json() : null;
      return body ? { relay, body, ms: Date.now() - started } : null;
    } catch { return null; }
  };
  if (room) {
    const answers = await Promise.all(relays.map((relay) =>
      within(ask(relay, "/oskiewar-room?match=" + encodeURIComponent("ow-" + room)))));
    const live = answers.find((answer) => answer?.body?.live);
    if (live) return live.relay.host;
  }
  // The public room has one home. "Fastest relay" is a per-visitor answer,
  // so two people arriving while nobody was live each hosted their own
  // dojo1 on a different relay and never met — one waiting for an opponent
  // on sfo, the other on nj (@jeffrey and @fifi, 2026-10-17: "we can't
  // sync ... the title screen should show presence of the other player").
  // Private rooms keep the fastest relay: their address is the invitation,
  // and the live probe above brings the second player to the first.
  if (room === "dojo1") return (relays.find((relay) => relay.region === "sfo") || relays[0]).host;
  // Two pings each, the faster counts: the first pays for the connection.
  const timings = await Promise.all(relays.map(async (relay) => {
    const first = await within(ask(relay, "/oskiewar-ping"));
    const second = first ? await within(ask(relay, "/oskiewar-ping")) : null;
    const best = Math.min(first?.ms ?? Infinity, second?.ms ?? Infinity);
    return { relay, best };
  }));
  timings.sort((a, b) => a.best - b.best);
  return Number.isFinite(timings[0]?.best) ? timings[0].relay.host : fallback;
}

// How far each relay is from here: two pings each, the better counts (the
// first pays for the connection). {region: ms}, finite only.
export async function measureRelayPings({ fetchImpl = globalThis.fetch, timeoutMs = 1500,
  relays = OSKIEWAR_RELAYS } = {}) {
  const pings = {};
  if (typeof fetchImpl !== "function") return pings;
  const within = (promise) => Promise.race([promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  const trip = async (relay) => {
    try {
      const started = Date.now();
      const response = await fetchImpl(`https://${relay.host}/oskiewar-ping`, { cache: "no-store" });
      if (!response?.ok) return null;
      await response.json();
      return Date.now() - started;
    } catch { return null; }
  };
  await Promise.all(relays.map(async (relay) => {
    const first = await within(trip(relay));
    const second = first === null ? null : await within(trip(relay));
    const best = Math.min(first ?? Infinity, second ?? Infinity);
    if (Number.isFinite(best)) pings[relay.region] = best;
  }));
  return pings;
}

// The one global queue (session-server/oskiewar-lobby.mjs): every seat
// says who it is and how far each relay is, and the lobby says who is online
// everywhere and which relay the public room meets on. `relay` resolves to
// that host from the lobby's first word, or null if the lobby is silent for
// `timeoutMs` — the caller falls back to choosing for itself. The socket
// stays open for presence; `onStatus` hears every word.
export function joinLobby({ WebSocketImpl = globalThis.WebSocket,
  origin = "wss://session-server.aesthetic.computer", handle = "", pings = {},
  onStatus = () => {}, timeoutMs = 2500 } = {}) {
  let socket = null, resolved = false, closed = false, resolveRelay;
  const relay = new Promise((resolve) => { resolveRelay = resolve; });
  const settle = (host) => { if (!resolved) { resolved = true; resolveRelay(host); } };
  const timer = setTimeout(() => settle(null), timeoutMs);
  const say = (content) => {
    if (socket?.readyState !== 1) return;
    try { socket.send(JSON.stringify({ type: "oskiewar:seat", content })); } catch {}
  };
  const open = () => {
    if (closed || typeof WebSocketImpl !== "function") { settle(null); return; }
    const query = new URLSearchParams({ handle: String(handle || ""),
      pings: Object.entries(pings).map(([region, ms]) => `${region}:${Math.round(ms)}`).join(",") });
    try { socket = new WebSocketImpl(`${origin}/oskiewar-lobby?${query}`); }
    catch { settle(null); return; }
    socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message?.type !== "oskiewar:lobby" || !message.content) return;
      if (message.content.relay) settle(message.content.relay);
      try { onStatus(message.content); } catch {}
    });
    socket.addEventListener("close", () => { settle(null); if (!closed) setTimeout(open, 3000); });
    socket.addEventListener("error", () => { try { socket.close(); } catch {} });
  };
  open();
  return { relay,
    send: (content = {}) => {
      if (content.handle !== undefined) handle = content.handle;
      if (content.pings) pings = content.pings;
      say({ handle, pings });
    },
    close: () => { closed = true; clearTimeout(timer); try { socket?.close(); } catch {} } };
}

// The datagram lane to the relay (oskiewar-live-manager.mjs, LANE_FRESH_MS).
// Rollback input packets ride it when it is up; everything else, and every
// input packet while it is down, stays on the room socket. `open(offer,
// onText)` is the transport — geckos.io in a browser, a native UDP socket in
// the Mac app — and returns { send(text), close() }. 26.10.15
const LANE_KEEPALIVE_MS = 250;
const LANE_UP_MS = 1200;
export const laneEligible = (content) => content?.t === "i" && content.h === undefined;

export class DatagramLane {
  constructor(offer, { open, onNet = () => {}, now = () => Date.now() } = {}) {
    this.token = String(offer?.token || "");
    this.now = now;
    this.onNet = onNet;
    this.heardAt = 0;
    // Round trip to the relay over this lane, smoothed, in ms.
    this.rttMs = 0;
    this.stats = { sent: 0, received: 0 };
    this.link = null;
    this.closed = false;
    if (!this.token || typeof open !== "function") return;
    try { this.link = open(offer, (text) => this.receive(text)); } catch { this.link = null; }
    if (!this.link) return;
    this.timer = setInterval(() => this.keepalive(), LANE_KEEPALIVE_MS);
    this.timer?.unref?.();
    this.keepalive();
  }

  get up() {
    return !this.closed && !!this.link && this.heardAt > 0 &&
      this.now() - this.heardAt < LANE_UP_MS;
  }

  keepalive() {
    if (this.closed || !this.link) return;
    try { this.link.send(JSON.stringify({ k: this.token, t: this.now() })); } catch {}
  }

  receive(text) {
    let message;
    try { message = JSON.parse(text); } catch { return; }
    this.heardAt = this.now();
    if (message?.u && Number.isFinite(message.t)) {
      const trip = this.now() - message.t;
      if (trip >= 0 && trip < 4000) this.rttMs = this.rttMs ? this.rttMs + (trip - this.rttMs) * .2 : trip;
    }
    if (message?.n && typeof message.n === "object") {
      this.stats.received++;
      this.onNet(message.n);
    }
  }

  // Sends a rollback packet if it belongs on this lane and the lane is up;
  // false sends it back to the socket.
  send(content) {
    if (!laneEligible(content) || !this.up) return false;
    try { this.link.send(JSON.stringify({ k: this.token, n: content })); }
    catch { return false; }
    this.stats.sent++;
    return true;
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    try { this.link?.close?.(); } catch {}
    this.link = null;
  }
}

// The browser's transport: a geckos.io WebRTC channel to the relay, whose
// messages are unordered and never retransmitted. The client script is the
// one aesthetic.computer already serves.
export function geckosLaneOpen(host, {
  load = () => import("/aesthetic.computer/dep/geckos.io-client.3.0.2.min.js"),
  url = "https://" + host, port = 443,
} = {}) {
  return (offer, onText) => {
    if (!offer?.geckos) return null;
    let channel = null, closed = false;
    load().then((module) => {
      if (closed) return;
      const geckos = module.default || module;
      channel = geckos({ url, port,
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      channel.onConnect((error) => {
        if (error || closed) return;
        channel.on("ow", (data) => onText(typeof data === "string" ? data : String(data)));
      });
    }).catch(() => {});
    return {
      send(text) { if (channel) channel.emit("ow", text); },
      close() { closed = true; try { channel?.close(); } catch {} },
    };
  };
}

// The Mac app's transport: a native UDP socket (main.swift, oskiewarUdpOpen),
// whose datagrams come back through native-shell.js.
export function nativeLaneOpen(host) {
  return (offer, onText) => {
    const open = globalThis.oskiewarUdpOpen;
    if (typeof open !== "function" || !offer?.port) return null;
    const id = open(String(offer.host || host), Number(offer.port));
    if (!id) return null;
    (globalThis.__oskiewarDatagramListeners ||= {})[id] = onText;
    return {
      send(text) { globalThis.oskiewarUdpSend?.(id, text); },
      close() {
        delete globalThis.__oskiewarDatagramListeners[id];
        globalThis.oskiewarUdpClose?.(id);
      },
    };
  };
}

function storedLineKey() {
  const fresh = () => Array.from({ length: 20 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try {
    const store = globalThis.localStorage;
    const kept = store?.getItem("oskiewar-line-key");
    if (kept && /^[A-Za-z0-9]{8,40}$/.test(kept)) return kept;
    const key = fresh();
    store?.setItem("oskiewar-line-key", key);
    return key;
  } catch { return fresh(); }
}

export function roundNameFromPath(pathname) {
  const name = String(pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return ROUND_NAME.test(name) ? name : "";
}

export class RoundRoom {
  constructor(name, { WebSocketImpl = globalThis.WebSocket,
    fetchImpl = globalThis.fetch, historyImpl = globalThis.history,
    analytics = () => false, role = "viewer",
    sessionOrigin = "wss://session-server.aesthetic.computer",
    replayOrigin = "", surface = "web", originReady = null,
    laneOpen = null, lineKey = "" } = {}) {
    if (!ROUND_NAME.test(name || "")) throw new Error("Invalid oskiewar round name");
    this.name = name;
    this.WebSocketImpl = WebSocketImpl;
    this.fetchImpl = typeof fetchImpl === "function"
      ? fetchImpl.bind(globalThis) : null;
    this.historyImpl = historyImpl;
    this.analytics = analytics;
    this.sessionOrigin = sessionOrigin;
    this.replayOrigin = replayOrigin;
    // A promise of the relay origin, when the shell is still choosing one:
    // the first open waits for it instead of dialling the default.
    this.originReady = originReady;
    // What the relay's analytics call this seat: "web" for a browser, the
    // app's own name when it holds the chair itself.
    this.surface = surface;
    // (host) => transport for the datagram lane; null keeps every packet on
    // the socket.
    this.laneOpen = laneOpen;
    this.lane = null;
    // A challenger asks for the second chair; a viewer only watches. A denied
    // chair quietly demotes this room to a viewer connection, so the friend
    // who arrived third still sees the fight they were invited to.
    this.role = role === "challenger" ? "challenger" : "viewer";
    this.wantsSeat = this.role === "challenger";
    this.seatRetryAt = 0;
    this.seat = "";
    // When the relay seated this bridge, on the wall clock: a chair handed
    // over a moment ago is not yet a reason to inherit a dark room.
    this.seatedAt = 0;
    this.seatedFrom = "";
    // The line for the chair (relay-side). A seat-seeking bridge stands in it
    // when the chair is taken; `line()` says whether this visitor still wants
    // a turn and what the turn order should call them. `order` and `place`
    // are the relay's latest word on it — null and 0 from an older relay.
    this.lineWanted = this.wantsSeat;
    this.lineName = "";
    // Who this visitor is to the line across a reload (the relay holds a
    // place for its key a few seconds after the socket drops, so an update
    // that reloads everyone does not empty the queue). Kept in localStorage
    // where there is one; otherwise it lives as long as this page.
    this.lineKey = /^[A-Za-z0-9]{8,40}$/.test(lineKey) ? lineKey : storedLineKey();
    this.lineSent = "";
    this.order = null;
    this.place = 0;
    this.viewers = 0;
    this.socket = null;
    // Two named slots, not one shared one. A versus room has no stored replay
    // and 404s forever, so the 1800 ms replay retry below used to hold the
    // only slot almost all the time — and a socket closing in that window
    // asked for a reconnect that was silently dropped, which is how a
    // spectator or a walked-back challenger wedged on "already has a
    // challenger" and never came back.
    this.timers = { reconnect: null, replay: null };
    this.listener = null;
    this.live = false;
    this.hostKnown = false;
    this.replayChecked = false;
    this.hasReplay = false;
    this.lastState = null;
    this.generation = 0;
    this.stopped = false;
    this.deliverySeen = new Set();
  }

  // Watch first (26.10.15): connect as a watcher and stand in the line only
  // when the visitor asks — `line(true)` from the game once they press start.
  // One match runs at a time, so everyone not seated watches it, the title
  // screen included. Call before start().
  watch() {
    if (this.role === "challenger" && !this.socket) {
      this.role = "viewer";
      this.lineWanted = false;
    }
    return this;
  }

  start(listener) {
    this.listener = listener;
    this.stopped = false;
    this.open();
    this.loadDemo();
    return () => this.stop();
  }

  emit(type, content = {}) {
    this.listener?.({ type, content, roundName: this.name, live: this.live });
  }

  track(action, properties = {}) {
    this.analytics(action, {
      source_system: "browser",
      surface: "web",
      ...properties,
    });
  }

  open() {
    if (this.stopped || !this.WebSocketImpl) return;
    if (this.originReady) {
      const ready = this.originReady;
      this.originReady = null;
      Promise.resolve(ready).then((origin) => {
        if (origin) this.sessionOrigin = origin;
      }, () => {}).then(() => this.open());
      return;
    }
    this.clear("reconnect");
    const generation = ++this.generation;
    const id = `ow-${this.name}`;
    const role = this.role === "challenger" ? "&line=1&role=challenger" : "";
    const socket = new this.WebSocketImpl(
      `${this.sessionOrigin}/oskiewar-live?match=${encodeURIComponent(id)}&surface=${encodeURIComponent(this.surface)}${role}`);
    this.socket = socket;
    socket.addEventListener?.("open", () => {
      if (generation !== this.generation) return;
      this.lineSent = "";
      this.sendLine();
      this.emit("status", { label: "waiting", live: false });
    });
    socket.addEventListener?.("message", (event) => {
      if (generation !== this.generation) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "oskiewar:seat") {
        this.seat = String(message.content?.seat || "");
        if (this.seat === "challenger") {
          this.role = "challenger";
          this.seatedAt = Date.now();
          this.seatedFrom = String(message.content?.from || "");
        }
        // A turn that ended stands this bridge down in place: the socket
        // watches on, and walks to the back of the line if it still wants
        // to fight.
        const turn = String(message.content?.turn || "");
        if (turn) {
          this.lineSent = "";
          this.sendLine();
        }
        this.emit("seat", { seat: this.seat, turn });
      } else if (message.type === "oskiewar:status") {
        this.hostKnown = true;
        this.live = Boolean(message.content?.live);
        this.order = message.content?.order || null;
        this.place = Number(message.content?.place) || 0;
        // How many are watching, for the title's count of who is here.
        this.viewers = Number(message.content?.viewers) || 0;
        this.emit("status", { ...message.content,
          label: this.live ? "live" : "waiting" });
        // A denied chair used to be forever: the demoted challenger watched
        // from the grandstand even after the chair emptied, so two windows on
        // one room could both end up seatless. Status frames say whether the
        // second chair is held; when it frees, the walked-back challenger
        // reconnects to take it, paced so a contested chair can't flap.
        // A relay that keeps a line seats from it; racing it would jump it.
        if (this.wantsSeat && this.role === "viewer" && !this.order &&
            message.content?.challenger === false) {
          const at = Date.now();
          if (at - this.seatRetryAt >= 4000) {
            this.seatRetryAt = at;
            this.role = "challenger";
            ++this.generation;
            this.lane?.close();
            this.lane = null;
            this.socket?.close?.(1000, "retaking the chair");
            this.socket = null;
            this.open();
            return;
          }
        }
        if (!this.live) this.loadDemo();
      } else if (message.type === "oskiewar:state") {
        if (message.content?.nextRoundId) {
          this.move(message.content.nextRoundId);
          return;
        }
        if (!this.deliverySeen.has("live")) {
          this.deliverySeen.add("live");
          this.track("live_viewed");
        }
        this.lastState = message.content;
        this.emit("state", message.content);
        if (message.content?.phase === "match") this.loadDemo(true);
      } else if (message.type === "oskiewar:udp") {
        this.lane?.close();
        this.lane = null;
        if (this.laneOpen) {
          const host = String(this.sessionOrigin).replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
          this.lane = new DatagramLane(message.content, { open: this.laneOpen(host),
            onNet: (content) => { if (generation === this.generation) this.emit("net", content); } });
        }
      } else if (message.type === "oskiewar:net") {
        // The rollback lane's packets from the host: input frames, the
        // match-start deal, state hashes. Handed straight to the game.
        this.emit("net", message.content);
      } else if (message.type === "oskiewar:error") {
        // A taken chair is an answer, not a failure: fall back to watching
        // before the server's close comes through, so the reconnect below
        // rejoins as one more face in the grandstand.
        if (this.role === "challenger" &&
            /challenger/i.test(message.content?.message || "")) {
          this.role = "viewer";
          this.seat = "";
          this.emit("seat", { seat: "", denied: true });
        }
        this.emit("status", { label: message.content?.message || "unavailable", live: false });
      }
    });
    const closed = () => {
      if (generation !== this.generation || this.stopped) return;
      this.lane?.close();
      this.lane = null;
      this.socket = null;
      this.live = false;
      this.seat = "";
      this.place = 0;
      this.loadDemo();
      this.schedule("reconnect", () => this.open(), 1200);
    };
    socket.addEventListener?.("close", closed);
    socket.addEventListener?.("error", () => socket.close?.());
  }

  // Whether this visitor wants a turn in the chair, and the name the turn
  // order shows. Cheap to call every tick: only a change goes on the wire.
  line(join, name = this.lineName) {
    this.lineWanted = Boolean(join);
    this.lineName = String(name || "");
    this.sendLine();
  }

  sendLine() {
    if (!this.wantsSeat || this.socket?.readyState !== 1 ||
        typeof this.socket.send !== "function") return;
    const text = JSON.stringify({ type: "oskiewar:line",
      content: { join: this.lineWanted, name: this.lineName, key: this.lineKey } });
    if (text === this.lineSent) return;
    try { this.socket.send(text); this.lineSent = text; } catch {}
  }

  // The challenger's presses, up to the relay and on to the publishing game.
  // Returns whether the wire took them, so the game can pace its own retries.
  sendInput(content) {
    if (this.seat !== "challenger" || this.socket?.readyState !== 1)
      return false;
    try {
      this.socket.send(JSON.stringify({ type: "oskiewar:input", content }));
      return true;
    } catch { return false; }
  }

  // The rollback lane's packets from this seat up to the host. Only the chair
  // may speak, and only while the wire is up; the return says whether it went.
  sendNet(content) {
    if (this.seat !== "challenger" || this.socket?.readyState !== 1)
      return false;
    if (this.lane?.send(content)) return true;
    try {
      this.socket.send(JSON.stringify({ type: "oskiewar:net", content }));
      return true;
    } catch { return false; }
  }

  async loadDemo(force = false) {
    if (this.stopped || !this.fetchImpl || (this.live && !force)) return;
    const generation = this.generation;
    const id = `ow-${this.name}`;
    try {
      const response = await this.fetchImpl(
        `${this.replayOrigin}/api/oskiewar-replays?footage=1&id=${encodeURIComponent(id)}`,
        { cache: "no-store" });
      if (generation !== this.generation || this.stopped) return;
      if (response.ok) {
        const replay = (await response.json()).replay;
        if (generation !== this.generation || this.stopped) return;
        this.replayChecked = true;
        this.hasReplay = Boolean(replay);
        if (replay) {
          if (!this.deliverySeen.has("replay")) {
            this.deliverySeen.add("replay");
            this.track("replay_viewed");
          }
          this.emit("demo", replay);
        }
        return;
      }
      if (response.status === 404) this.replayChecked = true;
    } catch {}
    if (!this.live || force) this.schedule("replay", () => this.loadDemo(force), 1800);
  }

  schedule(slot, action, delay) {
    if (this.timers[slot] || this.stopped) return;
    this.timers[slot] = setTimeout(() => {
      this.timers[slot] = null;
      action();
    }, delay);
  }

  get empty() {
    return this.hostKnown && !this.live && this.replayChecked && !this.hasReplay;
  }

  clear(slot) {
    if (slot) { clearTimeout(this.timers[slot]); this.timers[slot] = null; return; }
    for (const name of Object.keys(this.timers)) this.clear(name);
  }

  move(value) {
    const name = String(value || "").replace(/^ow-/, "");
    if (!ROUND_NAME.test(name) || name === this.name) return;
    this.name = name;
    this.track("round_followed");
    this.live = false;
    this.lastState = null;
    this.hostKnown = false;
    this.replayChecked = false;
    this.hasReplay = false;
    this.deliverySeen = new Set();
    this.clear();
    ++this.generation;
    this.lane?.close();
    this.lane = null;
    this.socket?.close?.(1000, "next round");
    this.socket = null;
    this.historyImpl?.replaceState?.(null, "", `/${name}`);
    this.emit("round", { id: `ow-${name}` });
    this.open();
    this.loadDemo();
  }

  stop() {
    this.stopped = true;
    ++this.generation;
    this.clear();
    this.seat = "";
    this.lane?.close();
    this.lane = null;
    this.socket?.close?.(1000, "leaving");
    this.socket = null;
    this.listener = null;
  }
}
