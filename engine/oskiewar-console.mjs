// oskiewar's drop-down console — ` opens it from the top of the screen, the
// way a game console always has.
//
// Two halves: a log that keeps the last few hundred rows the page has said
// (console output and the game's own telemetry, which arrives as
// console.debug(kind, message)), and a prompt underneath it. The prompt knows
// a handful of words and evaluates anything else as JavaScript in the page,
// because the person typing into it is debugging their own browser.
//
// The log reads like the crash screen: one dense row per entry, each token
// inked by what it is (handles pink, numbers mint, units amber, words
// blue-grey, punctuation cyan), objects as a short key: value tree, errors as
// a red heading over a few trimmed stack frames. Identical rows fold into a
// ×N counter, and what browser extensions say into the page is dropped.
//
// While it is down it owns the keyboard: the shell's key handler and pad
// reader both ask `__oskiewarConsoleOpen` and stand aside, so typing a command
// never throws a punch.

export const MAX_ROWS = 300;
const MAX_TEXT = 320;
const MAX_FRAMES = 4;

// The crash screen's inks (oskiewar.js dumpTokenInk), token for token.
export const INK = {
  handle: [255, 126, 205],
  number: [116, 255, 184],
  unit: [255, 205, 74],
  word: [188, 204, 230],
  punct: [112, 234, 255],
};
const UNITS = new Set(["px", "ms", "us", "fps", "vx", "vy", "vz", "in",
  "stk", "pos", "vel", "t", "pts"]);

export function tokenize(text) {
  return String(text).match(/@[a-z0-9_]+|[-+]?\d*\.?\d+|[a-z]+|\s+|./gi) || [];
}

export function tokenKind(token) {
  if (token[0] === "@") return "handle";
  if (/^[-+]?[\d.]+$/.test(token)) return "number";
  if (/^[a-z]+$/i.test(token)) return UNITS.has(token.toLowerCase()) ? "unit" : "word";
  return "punct";
}

// Neighbouring tokens of one ink become one run (spaces ride along), so a
// row is a handful of spans rather than one per token.
export function inkRuns(text) {
  const runs = [];
  for (const token of tokenize(text)) {
    const last = runs.at(-1);
    if (!token.trim()) { if (last) last.text += token; else runs.push({ kind: "word", text: token }); continue; }
    const kind = tokenKind(token);
    if (last && last.kind === kind) last.text += token;
    else runs.push({ kind, text: token });
  }
  return runs;
}

// What browser extensions inject into the page (wallet providers, content
// scripts) is not the game's to show.
const NOISE = /chrome-extension:\/\/|moz-extension:\/\/|safari-(?:web-)?extension:\/\/|contentscript\.js|inpage\.js|MaxListenersExceededWarning|ObjectMultiplex/i;
const EXTENSION_FRAME = /chrome-extension:\/\/|moz-extension:\/\/|safari-(?:web-)?extension:\/\/|contentscript|inpage\.js/i;
const NOISY_FRAME = /chrome-extension:\/\/|moz-extension:\/\/|safari-(?:web-)?extension:\/\/|contentscript|inpage\.js|node:internal|\(native\)|<anonymous>/i;

export function isNoise(entry) {
  if (NOISE.test(entry.text || "")) return true;
  if (entry.error) {
    const raw = entry.error.rawFrames || [];
    if (raw.length && raw.every((frame) => EXTENSION_FRAME.test(frame))) return true;
    if (NOISE.test(entry.error.message) || NOISE.test(entry.error.stack || "")) {
      // An error is the extension's when its own top frame is.
      const top = entry.error.rawFrames?.[0];
      if (!top || NOISY_FRAME.test(top)) return true;
    }
  }
  return false;
}

// "    at fn (https://host/a/b.js?x:12:3)" / "fn@https://host/b.js:12:3"
export function parseStack(stack) {
  const raw = [];
  const frames = [];
  for (const line of String(stack || "").split("\n")) {
    const trimmed = line.trim();
    let match = trimmed.match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
    if (!match) match = trimmed.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
    if (!match) continue;
    raw.push(trimmed);
    if (NOISY_FRAME.test(trimmed)) continue;
    let url = match[2];
    try { url = decodeURIComponent(url); } catch {}
    const file = url.split(/[?#]/)[0].split(/[/;]/).pop() || url;
    frames.push({ fn: match[1] || "", file, line: +match[3], column: +match[4] });
  }
  return { raw, frames };
}

function errorShape(error) {
  const { raw, frames } = parseStack(error?.stack);
  return { name: String(error?.name || "Error"),
    message: String(error?.message ?? error),
    stack: String(error?.stack || ""), rawFrames: raw,
    frames: frames.slice(0, MAX_FRAMES),
    more: Math.max(0, frames.length - MAX_FRAMES) };
}

const isError = (value) => value instanceof Error ||
  (value && typeof value === "object" && typeof value.stack === "string" &&
    "message" in value);

function brief(value) {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return String(value);
  if (Array.isArray(value)) return "[" + value.length + " items]";
  return "{" + Object.keys(value).length + " keys}";
}

// console.log("%c[boot]%c ready", css, css): %c styles are devtools-only, so
// they and their arguments go; %s %d %o take theirs as text.
function format(parts) {
  if (typeof parts[0] !== "string" || !parts[0].includes("%")) return parts;
  const rest = parts.slice(1);
  const head = parts[0].replace(/%([cdisfoO%])/g, (all, code) => {
    if (code === "%") return "%";
    if (!rest.length) return all;
    const value = rest.shift();
    return code === "c" ? "" : brief(value);
  });
  return [head, ...rest];
}

// Turn one console call into an entry: level, a short source tag, and either
// text, a value to draw as a tree, or an error.
export function entryFrom(level, parts) {
  parts = format(parts);
  let tag = "";
  if (typeof parts[0] === "string" && parts.length > 1 &&
      /^[A-Z][A-Z0-9_]{2,}$/.test(parts[0])) {
    tag = parts[0]; parts = parts.slice(1);
  }
  if (typeof parts[0] === "string") {
    const bracket = parts[0].match(/^\s*\[([\w.-]{1,24})\]\s*/);
    if (bracket) { tag = tag || bracket[1]; parts = [parts[0].slice(bracket[0].length), ...parts.slice(1)]; }
  }
  const error = parts.find(isError);
  const words = [];
  const values = [];
  for (const part of parts) {
    if (part === error) continue;
    if (part && typeof part === "object") values.push(part);
    else words.push(String(part));
  }
  let text = words.join(" ").trim();
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + " … +" + (text.length - MAX_TEXT);
  const entry = { level, tag, text, values, error: error ? errorShape(error) : null,
    count: 1, at: Date.now() };
  entry.sig = signature(entry);
  return entry;
}

function signature(entry) {
  let values = "";
  try { values = JSON.stringify(entry.values)?.slice(0, 400) ?? ""; }
  catch { values = entry.values.map(brief).join(); }
  const error = entry.error
    ? entry.error.name + entry.error.message + (entry.error.rawFrames[0] || "") : "";
  return [entry.level, entry.tag, entry.text, values, error].join("\u0001");
}

// The row store, apart from the DOM: folds repeats, drops noise, keeps a cap.
export function createLogBuffer({ max = MAX_ROWS } = {}) {
  const rows = [];
  const counts = { log: 0, info: 0, warn: 0, error: 0, debug: 0, echo: 0, hidden: 0 };
  return {
    rows, counts,
    push(entry) {
      if (isNoise(entry)) { counts.hidden++; return { type: "drop", entry }; }
      counts[entry.level] = (counts[entry.level] || 0) + 1;
      const last = rows.at(-1);
      if (last && last.sig === entry.sig) {
        last.count++;
        last.at = entry.at;
        return { type: "repeat", entry: last };
      }
      rows.push(entry);
      const evicted = rows.length > max ? rows.splice(0, rows.length - max) : [];
      return { type: "append", entry, evicted };
    },
    clear() {
      rows.splice(0);
      for (const key in counts) counts[key] = 0;
    },
  };
}

const GLYPH = { log: "•", info: "i", warn: "!", error: "×", debug: "◆", echo: "›" };

const STYLE = `
#ow-console { --bg: 7, 9, 18; --panel: 30, 14, 27; --rule: 255, 92, 116;
  --hd: 255, 92, 116; --amber: 255, 205, 74; --mint: 116, 255, 184;
  --cyan: 112, 234, 255; --pink: 255, 126, 205; --grey: 188, 204, 230;
  --violet: 206, 166, 255; --ink: 248, 244, 255; --dim: 116, 128, 156;
  position: fixed; z-index: 40; left: 0; right: 0; top: 0;
  height: 46vh; display: flex; flex-direction: column;
  background: rgb(var(--panel)); color: rgb(var(--ink));
  border-bottom: .45vmin solid rgb(var(--rule));
  box-shadow: 0 0 0 1.2vmin rgba(var(--bg), .55), 0 1vmin 4vmin rgba(0,0,0,.5);
  font: 400 clamp(11px, 1.9vmin, 22px)/1.32 "Comic Relief", "Comic Sans MS", Arial, sans-serif;
  font-variant-numeric: tabular-nums;
  transform: translateY(-105%); transition: transform .16s ease-out;
  visibility: hidden; }
#ow-console.pastel { --panel: 40, 22, 66; --rule: 255, 150, 210; --hd: 255, 150, 210; }
#ow-console.open { transform: none; visibility: visible; }
#ow-console-head { display: flex; align-items: baseline; gap: 1.6em;
  padding: .9vmin 2vmin .6vmin; background: rgba(var(--bg), .55);
  border-bottom: 1px solid rgba(var(--rule), .28); white-space: nowrap;
  overflow: hidden; }
#ow-console-head b { color: rgb(var(--hd)); font-weight: 700; letter-spacing: .02em; }
#ow-console-head .stat { color: rgb(var(--dim)); }
#ow-console-head .stat i { font-style: normal; color: rgb(var(--mint)); }
#ow-console-head .stat.warn i { color: rgb(var(--amber)); }
#ow-console-head .stat.error i { color: rgb(var(--hd)); }
#ow-console-head .hint { margin-left: auto; color: rgb(var(--dim)); }
@media (max-width: 560px) { #ow-console-head { gap: 1em; } #ow-console-head .hint { display: none; } }
#ow-console-log { flex: 1; overflow-y: auto; padding: .5vmin 0 .6vmin;
  scrollbar-width: thin; scrollbar-color: rgba(var(--rule), .4) transparent; }
.ow-row { display: grid; grid-template-columns: 4.3em 1.1em minmax(0, 1fr) auto;
  column-gap: .5em; padding: .12em 2vmin; border-left: .35em solid transparent; }
.ow-row:hover { background: rgba(255, 255, 255, .035); }
.ow-row .time { color: rgb(var(--dim)); opacity: .8; }
.ow-row .glyph { text-align: center; font-weight: 700; color: rgb(var(--grey)); }
.ow-row .body { min-width: 0; overflow-wrap: anywhere; }
.ow-row .line { display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; overflow: hidden; }
.ow-row.wide .line { -webkit-line-clamp: unset; }
.ow-row .tag { display: inline-block; margin-right: .55em; padding: 0 .4em;
  border-radius: .3em; font-size: .82em; font-weight: 700; letter-spacing: .03em;
  color: rgb(var(--t)); background: rgba(var(--t), .13); vertical-align: .08em; }
.ow-row .count { align-self: start; color: rgb(var(--bg)); background: rgb(var(--amber));
  border-radius: .7em; padding: 0 .45em; font-size: .82em; font-weight: 700; }
.ow-row.warn { background: rgba(var(--amber), .06); border-left-color: rgba(var(--amber), .7); }
.ow-row.warn .glyph { color: rgb(var(--amber)); }
.ow-row.error { background: rgba(var(--hd), .09); border-left-color: rgb(var(--hd)); }
.ow-row.error .glyph { color: rgb(var(--hd)); }
.ow-row.debug .glyph { color: rgb(var(--violet)); font-size: .8em; }
.ow-row.info .glyph { color: rgb(var(--cyan)); }
.ow-row.echo { margin-top: .35em; }
.ow-row.echo .glyph, .ow-row.echo .line { color: rgb(var(--amber)); }
.ow-row .err-name { color: rgb(var(--hd)); font-weight: 700; margin-right: .5em; }
.ow-row .err-msg { color: rgb(var(--ink)); }
.ow-row .frame { padding-left: 1.1em; color: rgb(var(--grey));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ow-row .frame .at { color: rgb(var(--amber)); }
.ow-row .frame .fn { margin-right: .6em; }
.ow-row .more { padding-left: 1.1em; color: rgb(var(--dim)); }
.ow-row .tree { padding-left: 1.1em; }
.ow-row .tree .tree { padding-left: 1.2em; }
.ow-row .key { color: rgb(var(--violet)); }
.ow-row .str { color: rgb(var(--ink)); }
.ow-row .bool { color: rgb(var(--amber)); }
.ow-row .nil, .ow-row .sum { color: rgb(var(--dim)); }
.ow-row .handle { color: rgb(var(--pink)); }
.ow-row .number { color: rgb(var(--mint)); }
.ow-row .unit { color: rgb(var(--amber)); }
.ow-row .word { color: rgb(var(--grey)); }
.ow-row .punct { color: rgb(var(--cyan)); }
#ow-console-form { display: flex; gap: .6em; align-items: center;
  padding: .7vmin 2vmin 1.1vmin; background: rgba(var(--bg), .55);
  border-top: 1px solid rgba(var(--rule), .28); }
#ow-console-form span { color: rgb(var(--amber)); font-weight: 700; }
#ow-console-input { flex: 1; min-width: 0; background: transparent; border: 0;
  outline: 0; color: inherit; font: inherit; caret-color: rgb(var(--amber)); }
`;

// Tags take one of the crash screen's dump-icon inks, the same one each time.
const TAG_INKS = ["--cyan", "--violet", "--mint", "--amber", "--pink", "--grey"];
function tagInk(tag) {
  if (/ERROR|FAIL|REFUSED|DESYNC/.test(tag)) return "--hd";
  let hash = 0;
  for (const char of tag.split("_")[0]) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_INKS[hash % TAG_INKS.length];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function inked(parent, text) {
  for (const run of inkRuns(text)) parent.append(el("span", run.kind, run.text));
  return parent;
}

// A hash reads by its head, a float by three places.
export function short(value) {
  if (typeof value === "number")
    return Number.isInteger(value) || !Number.isFinite(value) ? String(value) : String(+value.toFixed(3));
  if (typeof value !== "string") return String(value);
  if (/^[0-9a-f]{20,}$/i.test(value)) return value.slice(0, 10) + "…";
  return value.length > 64 ? value.slice(0, 64) + "…" : value;
}
const literal = (value) => typeof value === "string" ? JSON.stringify(short(value)) : short(value);

function primitive(value) {
  if (typeof value === "string") return el("span", "str", literal(value));
  if (typeof value === "number" || typeof value === "bigint") return el("span", "number", short(value));
  if (typeof value === "boolean") return el("span", "bool", String(value));
  if (value == null) return el("span", "nil", String(value));
  if (typeof value === "function") return el("span", "sum", "ƒ " + (value.name || "anonymous"));
  return el("span", "sum", String(value));
}

const isPrimitive = (value) => value === null || typeof value !== "object";

// A short array or a flat little object reads best on one line.
function inline(value) {
  if (Array.isArray(value)) {
    if (!value.every(isPrimitive)) return null;
    const head = value.length > 8 ? value.slice(0, 6) : value;
    const text = "[" + head.map(literal).join(", ") +
      (head.length < value.length ? ", … +" + (value.length - head.length) : "") + "]";
    return text.length <= 64 ? text : null;
  }
  const keys = Object.keys(value);
  if (keys.length > 4 || !keys.every((key) => isPrimitive(value[key]))) return null;
  const text = "{ " + keys.map((key) => key + ": " + literal(value[key])).join(", ") + " }";
  return text.length <= 64 ? text : null;
}

function tree(value, depth = 0) {
  const node = el("div", "tree");
  const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value);
  const shown = keys.slice(0, depth ? 8 : 14);
  for (const key of shown) {
    let item;
    try { item = value[key]; } catch (error) { item = "‹" + error.message + "›"; }
    const row = el("div");
    row.append(el("span", "key", String(key)), el("span", "punct", ": "));
    if (isPrimitive(item)) row.append(primitive(item));
    else {
      const flat = inline(item);
      if (flat) inked(row, flat);
      else if (depth >= 1 || Object.keys(item).length > 6) row.append(el("span", "sum", brief(item)));
      else { row.append(el("span", "sum", Array.isArray(item) ? "[" + item.length + "]" : "")); row.append(tree(item, depth + 1)); }
    }
    node.append(row);
  }
  if (keys.length > shown.length)
    node.append(el("div", "more", "… " + (keys.length - shown.length) + " more"));
  return node;
}

function renderBody(entry) {
  const body = el("div", "body");
  const line = el("div", "line");
  if (entry.tag) {
    const tag = el("span", "tag", entry.tag);
    tag.style.setProperty("--t", "var(" + tagInk(entry.tag) + ")");
    line.append(tag);
  }
  if (entry.error) {
    line.append(el("span", "err-name", entry.error.name));
    if (entry.text) inked(line, entry.text);
    body.append(line, el("div", "err-msg line", entry.error.message));
    for (const frame of entry.error.frames) {
      const row = el("div", "frame");
      if (frame.fn) row.append(el("span", "fn", frame.fn));
      row.append(el("span", "at", frame.file + ":" + frame.line + ":" + frame.column));
      body.append(row);
    }
    if (entry.error.more)
      body.append(el("div", "more", "+" + entry.error.more + (entry.error.more === 1 ? " frame" : " frames")));
    return body;
  }
  if (entry.level === "echo") line.append(entry.text);
  else if (entry.text) inked(line, entry.text);
  for (const value of entry.values) {
    const flat = inline(value);
    if (flat) { if (entry.text) line.append(" "); inked(line, flat); }
  }
  body.append(line);
  for (const value of entry.values)
    if (!inline(value)) body.append(tree(value));
  return body;
}

const clock = (ms) => new Date(ms).toTimeString().slice(0, 8);

export function mountConsole({ commands = {} } = {}) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const root = document.createElement("div");
  root.id = "ow-console";
  root.setAttribute("role", "log");
  root.setAttribute("aria-label", "debug console");
  root.innerHTML = `<div id="ow-console-head"></div><div id="ow-console-log"></div>
    <form id="ow-console-form" autocomplete="off"><span>&gt;</span>
    <input id="ow-console-input" spellcheck="false" aria-label="console command"></form>`;
  document.body.append(root);
  const head = root.querySelector("#ow-console-head");
  const log = root.querySelector("#ow-console-log");
  const form = root.querySelector("#ow-console-form");
  const input = root.querySelector("#ow-console-input");

  const buffer = createLogBuffer();
  const nodes = new WeakMap();
  const history = [];
  let historyAt = 0;
  let open = false;

  function renderHead() {
    const { counts, rows } = buffer;
    const stat = (kind, n, one, many = one + "s", title = "") => n
      ? `<span class="stat ${kind}"${title && ` title="${title}"`}><i>${n}</i> ${n === 1 ? one : many}</span>` : "";
    head.innerHTML = `<b>oskiewar console</b>` +
      stat("", rows.length, "row") + stat("error", counts.error, "error") +
      stat("warn", counts.warn, "warning") +
      stat("", counts.hidden, "hidden", "hidden", "browser-extension lines left out") +
      `<span class="hint">help · ↑ history · \` close</span>`;
  }
  let headQueued = false;
  const queueHead = () => {
    if (headQueued || !open) return;
    headQueued = true;
    requestAnimationFrame(() => { headQueued = false; renderHead(); });
  };

  function renderRow(entry) {
    const row = el("div", "ow-row " + entry.level);
    row.append(el("span", "time", clock(entry.at)),
      el("span", "glyph", GLYPH[entry.level] || "•"), renderBody(entry), el("span"));
    // A clamped line opens on click; selecting text does not toggle it.
    row.addEventListener("click", () => {
      if (!getSelection()?.toString()) row.classList.toggle("wide");
    });
    return row;
  }

  function write(level, parts) {
    let entry;
    try { entry = entryFrom(level, parts); }
    catch (error) { entry = entryFrom("error", ["console could not show a line: " + error?.message]); }
    const result = buffer.push(entry);
    if (result.type === "drop") return queueHead();
    const pinned = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    if (result.type === "repeat") {
      const row = nodes.get(result.entry);
      if (row) {
        row.firstChild.textContent = clock(result.entry.at);
        row.lastChild.className = "count";
        row.lastChild.textContent = "×" + result.entry.count;
      }
    } else {
      for (const old of result.evicted) nodes.get(old)?.remove();
      const row = renderRow(entry);
      nodes.set(entry, row);
      // Rows are kept while closed, so opening shows what already happened.
      log.append(row);
    }
    if (pinned) log.scrollTop = log.scrollHeight;
    queueHead();
  }

  // Everything the page says lands here as well as in devtools.
  for (const kind of ["log", "info", "warn", "error", "debug"]) {
    const original = console[kind].bind(console);
    console[kind] = (...parts) => { write(kind, parts); original(...parts); };
  }
  addEventListener("error", (event) => {
    if (event.error) return write("error", [event.error]);
    const where = (event.filename || "").split("/").pop();
    write("error", [event.message + (where ? " " + where + ":" + event.lineno : "")]);
  });
  addEventListener("unhandledrejection", (event) =>
    write("error", isError(event.reason) ? ["unhandled", event.reason]
      : ["unhandled: " + brief(event.reason)]));

  const builtins = {
    help: () => "words: " + Object.keys(builtins).join(", ") +
      " — anything else runs as JavaScript",
    clear: () => { buffer.clear(); log.replaceChildren(); renderHead(); return ""; },
    ...commands,
  };

  // A command's answer is shown as the answer to that word: tagged with it.
  function answer(word, value) {
    if (value === undefined || value === "") return;
    const tag = builtins[word] ? word : "";
    if (isError(value)) return write("error", [value]);
    write("log", tag ? [tag.toUpperCase().padEnd(3, "_"), value] : [value]);
  }

  function run(text) {
    const line = text.trim();
    if (!line) return;
    history.push(line);
    historyAt = history.length;
    write("echo", [line]);
    const [word, ...rest] = line.split(/\s+/);
    try {
      const result = builtins[word]
        ? builtins[word](rest.join(" "))
        : (0, eval)(line);
      if (typeof result?.then === "function")
        result.then((value) => answer(word, value ?? "(nothing)"),
          (error) => write("error", [isError(error) ? error : String(error)]));
      else answer(word, result);
    } catch (error) {
      write("error", [error]);
    }
  }

  function setOpen(value) {
    open = Boolean(value);
    globalThis.__oskiewarConsoleOpen = open;
    root.classList.toggle("open", open);
    if (open) {
      // `theme pastel-night` dresses the console to match.
      root.classList.toggle("pastel", globalThis.__oskiewarTheme === "pastel-night");
      renderHead();
      log.scrollTop = log.scrollHeight;
      input.focus();
    } else {
      input.blur();
      document.querySelector("canvas")?.focus?.();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });

  // Capture phase, so the backtick never reaches the game's key handler.
  addEventListener("keydown", (event) => {
    if (event.code === "Backquote" && !event.metaKey && !event.ctrlKey) {
      // A backtick typed into some other field is that field's character.
      const field = event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;
      if (field && event.target !== input) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(!open);
      return;
    }
    if (!open || event.target !== input) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    else if (event.key === "ArrowUp" && history.length) {
      event.preventDefault();
      historyAt = Math.max(0, historyAt - 1);
      input.value = history[historyAt];
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyAt = Math.min(history.length, historyAt + 1);
      input.value = history[historyAt] ?? "";
    }
    event.stopPropagation();
  }, true);

  globalThis.__oskiewarConsoleOpen = false;
  return { open: () => setOpen(true), close: () => setOpen(false), write,
    get isOpen() { return open; } };
}
