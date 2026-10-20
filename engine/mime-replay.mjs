// A MIME card owns one stored round. It never joins or publishes a live room.
export function createMimeReplay(name, { scope = globalThis, fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/.test(name) || name.length > 77)
    throw new Error("Replay unavailable");
  let driver, stopped = false, drawn = 0, ready = false;
  let playing = new URLSearchParams(scope.location.search).get("warm") !== "1";
  const active = () => playing && !scope.document.hidden && !stopped;
  const settle = () => {
    scope.__mimeAudioPlaying = ready && active();
    scope.__oskiewarSfx?.mute(!scope.__mimeAudioPlaying);
    scope.__oskiewarVoice?.mute(!scope.__mimeAudioPlaying);
    scope.__mimeAudioSettle?.(scope.__mimeAudioPlaying);
    if (driver && ready) {
      driver.setTimeScale(active() ? 1 : 0);
      driver.setVisible(active());
    }
  };
  scope.__mimePlayerSettle = play => { playing = play === true; settle(); };
  scope.__mimeSettle ||= scope.__mimePlayerSettle;
  scope.addEventListener("message", event => {
    if (event.source !== scope.parent || scope.parent === scope) return;
    if (event.data?.type === "mime:playing") scope.__mimePlayerSettle(event.data.playing);
    if (event.data?.type === "ac:start-audio" && active()) settle();
  });
  scope.document.addEventListener("visibilitychange", settle);
  orbitGestures(scope);
  scope.addEventListener("pagehide", () => { stopped = true; settle(); });
  const announce = error => {
    ready = true; scope.__mimeReady = true; settle();
    scope.parent.postMessage({ type: "mime:ready", ...(error ? { error: true } : {}) }, "*");
  };
  settle();
  return {
    name,
    start(listener) {
      const controller = new AbortController();
      fetchImpl("/api/oskiewar-replays?footage=1&id=" + encodeURIComponent("ow-" + name),
        { signal: controller.signal, credentials: "omit" })
        .then(async response => {
          if (!response.ok) throw new Error("Replay unavailable");
          const { replay } = await response.json();
          if (stopped) return;
          // A card plays footage: the round as it was drawn, which any engine
          // that reads its spec can show. A round filed without it is not a
          // card, and one from a newer spec asks for an update rather than
          // being guessed at.
          const spec = replay?.footage?.spec;
          if (replay?.format !== "ac.oskiedemo" || replay.game !== "oskiewar" ||
              !Number.isInteger(spec) || !replay.footage.frames?.length)
            throw new Error("Replay unavailable");
          if (spec > (scope.__oskiewarFootageSpec || 1))
            throw new Error("Update Oskiewar to watch");
          scope.__oskiewarResim = false;
          listener({ type: "demo", roundName: name, content: replay, live: false });
        }).catch(error => {
          if (stopped || error.name === "AbortError") return;
          const note = scope.document.createElement("p");
          note.className = "mime-replay-error";
          note.textContent = error.message === "Update Oskiewar to watch"
            ? error.message : "Replay unavailable";
          scope.document.body.append(note); announce(true);
        });
      return () => { stopped = true; controller.abort(); settle(); };
    },
    bind(value) { driver = value; settle(); },
    painted() {
      if (!ready && scope.__oskiewarReplayReady && ++drawn >= 2) announce(false);
    },
  };
}

// The card's lens is the viewer's: one finger turns it round the fight, two
// pinch it closer or further, and a double tap puts it back. The game drains
// `__oskiewarFootageOrbit` once a frame (trackFootageFollowShot). The host is
// told a finger is down, so its corners step aside and a drag on the picture
// stays a turn rather than becoming a swipe to the next card.
function orbitGestures(scope) {
  const orbit = scope.__oskiewarFootageOrbit = { yaw: 0, pitch: 0, zoom: 0, reset: false };
  const doc = scope.document, pointers = new Map();
  let spread = 0, lastTap = 0, moved = false;
  const tell = phase => {
    const message = { type: "mime:interaction", phase };
    if (scope.parent !== scope) scope.parent.postMessage(message, "*");
    else scope.postMessage(message, "*");
  };
  const apart = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  doc.addEventListener("pointerdown", event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY });
    if (pointers.size === 1) moved = false;
    spread = apart();
    tell("hold");
  });
  doc.addEventListener("pointermove", event => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.x = event.clientX; point.y = event.clientY;
    if (Math.hypot(point.x - point.startX, point.y - point.startY) > 8) moved = true;
    if (pointers.size >= 2) {
      const next = apart();
      if (spread > 0 && next > 0) orbit.zoom -= Math.log(next / spread);
      spread = next;
      return;
    }
    // A drag across the card's width is most of a turn; down tips the lens
    // over the top.
    const size = Math.max(1, Math.min(scope.innerWidth, scope.innerHeight));
    orbit.yaw += dx / size * 3.4;
    orbit.pitch += dy / size * 1.6;
  });
  const lift = event => {
    if (!pointers.delete(event.pointerId)) return;
    spread = apart();
    if (pointers.size) return;
    if (event.type === "pointerup" && !moved) {
      if (event.timeStamp - lastTap < 320) { orbit.reset = true; lastTap = 0; }
      else lastTap = event.timeStamp;
    }
    tell("release");
  };
  doc.addEventListener("pointerup", lift);
  doc.addEventListener("pointercancel", lift);
  // Safari's own pinch would zoom the page under the game.
  for (const type of ["gesturestart", "gesturechange"])
    doc.addEventListener(type, event => event.preventDefault(), { passive: false });
  doc.addEventListener("wheel", event => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) orbit.zoom += event.deltaY * .01;
    else { orbit.zoom += event.deltaY * .0025; orbit.yaw += event.deltaX * .004; }
    tell("pulse");
  }, { passive: false });
}
