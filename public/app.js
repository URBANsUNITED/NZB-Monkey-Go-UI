let term;
let fitAddon;

// ---------------- TERMINAL ----------------

function initTerminal() {
  const container = document.getElementById("terminal");
  if (!container) {
    console.error("Terminal-Container fehlt!");
    return;
  }

term = new Terminal({
  convertEol: true,
  fontFamily: "Consolas, monospace",
  fontSize: 14,
  rendererType: "canvas",     // WICHTIG für Farben
  allowProposedApi: true,     // WICHTIG für Farben
  theme: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
    selection: "#264f78"
  }
});


  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  term.open(container);
  term.write("\x1b[1;36mWillkommen bei nzb-monkey-go UI v2\x1b[0m\r\n");
term.write("\x1b[0;90mBereit für deinen nächsten Download...\x1b[0m\r\n\n");
  fitAddon.fit();

  window.addEventListener("resize", () => fitAddon.fit());
}


// ---------------- THEME ----------------

function applyTerminalTheme(theme) {
  if (!term) return;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const themes = {
  light: {
    background: "#ffffff",
    foreground: "#111827",
    cursor: "#111827"
  },

  dark: {
    background: "#020617",
    foreground: "#e5e7eb",
    cursor: "#e5e7eb"
  },

  dracula: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
    selection: "#264f78",
    black: "#010409",
    red: "#ff7b72",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39c5cf",
    white: "#b1bac4",
    brightBlack: "#6e7681",
    brightRed: "#ffa198",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#56d4dd",
    brightWhite: "#f0f6fc"
  },

  system: prefersDark
    ? {
        background: "#020617",
        foreground: "#e5e7eb",
        cursor: "#e5e7eb"
      }
    : {
        background: "#ffffff",
        foreground: "#111827",
        cursor: "#111827"
      }
};


  term.options.theme = themes[theme];
}

function initTheme() {
  const themeSelect = document.getElementById("theme");
  const saved = localStorage.getItem("theme") || "system";

  themeSelect.value = saved;
  document.documentElement.setAttribute("data-theme", saved);
  applyTerminalTheme(saved);

  themeSelect.addEventListener("change", () => {
    const t = themeSelect.value;
    document.documentElement.setAttribute("data-theme", t);
    applyTerminalTheme(t);
    localStorage.setItem("theme", t);
  });
}


// ---------------- WEBSOCKET ----------------

let ws;

function initWS() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onmessage = (event) => {
  term.write(event.data);
};

  // EINZIGER gültiger Input-Handler
  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stdin", payload: data }));
    }
  });
}


// ---------------- PARSER + COMMAND BUILDER ----------------

function initParser() {
  const rawText = document.getElementById("rawText");
  const parseBtn = document.getElementById("parseBtn");
  const clearPasteBtn = document.getElementById("clearPaste");


  const dateInput = document.getElementById("date");
  const titleInput = document.getElementById("title");
  const groupInput = document.getElementById("group");
  const headerInput = document.getElementById("header");
  const passwordInput = document.getElementById("password");
  const nzblnkInput = document.getElementById("nzblnk");
  const extraArgsInput = document.getElementById("extraArgs");

  const debugJson = document.getElementById("debugJson");
  const debugErrors = document.getElementById("debugErrors");

  const commandPreview = document.getElementById("commandPreview");
  const runBtn = document.getElementById("runBtn");
  const abortBtn = document.getElementById("abortBtn");


  // ---------------- PARSE BUTTON ----------------
  parseBtn.addEventListener("click", () => {
    const raw = rawText.value.trim();
    const data = window.parseForumText ? window.parseForumText(raw) : {};

    fillFields(data);
    buildCommand();
  });

  // ---------------- CLEAR BUTTON ----------------

clearPasteBtn.addEventListener("click", () => {
  rawText.value = "";
  debugJson.textContent = "";
  debugErrors.innerHTML = "";
});

  // ---------------- Abort BUTTON ----------------
abortBtn.addEventListener("click", () => {
  ws.send(JSON.stringify({ type: "abort" }));
  term.write("\r\n[abgebrochen]\r\n");
});

  // ---------------- FELDER FÜLLEN ----------------
  function fillFields(data) {
    dateInput.value = data.date || "";
    titleInput.value = data.title || "";
    groupInput.value = data.group || "";
    headerInput.value = data.header || "";
    passwordInput.value = data.password || "";
    nzblnkInput.value = data.nzblnk || "";

    debugJson.textContent = JSON.stringify(data, null, 2);

["date", "title", "group", "header", "nzblnk"].forEach((k) => {
  if (!data[k]) {
    const li = document.createElement("li");
    li.textContent = `${k} fehlt`;
    debugErrors.appendChild(li);
  }
});
  }

  // ---------------- DATUMSKONVERTER ----------------
  function convertDateForMonkey(dateStr) {
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }

  // ---------------- COMMAND BUILDER ----------------
  function buildCommand() {
    const parts = ["nzb-monkey-go"];

    const nz = nzblnkInput.value.trim();
    const hasNzblnk = nz.startsWith("nzblnk:?");

    // NZBLNK → nur NZBLNK übergeben
if (hasNzblnk) {
  parts.push(`"${nz}"`);

  // Prüfen, ob NZBLNK ein Datum enthält
  const hasDateInNzblnk = /[?&]d=\d{10}/.test(nz);

  // Wenn KEIN Datum im NZBLNK → manuelles Datum anhängen
  if (!hasDateInNzblnk && dateInput.value) {
    parts.push(`--date ${convertDateForMonkey(dateInput.value)}`);
  }

  commandPreview.textContent = parts.join(" ");
  runBtn.disabled = false;
  return;
}


    // Normaler Forenpost
    if (!dateInput.value) {
      commandPreview.textContent = "Bitte Datum setzen!";
      runBtn.disabled = true;
      return;
    }

    parts.push(`--date ${convertDateForMonkey(dateInput.value)}`);
    if (titleInput.value) parts.push(`--title "${titleInput.value}"`);
    if (headerInput.value) parts.push(`--subject "${headerInput.value}"`);
    if (passwordInput.value) parts.push(`--password "${passwordInput.value}"`);

    if (groupInput.value) {
      groupInput.value
        .split(",")
        .map(g => g.trim())
        .filter(Boolean)
        .forEach(g => parts.push(`--group "${g}"`));
    }

    if (extraArgsInput.value) parts.push(extraArgsInput.value);

    commandPreview.textContent = parts.join(" ");
    runBtn.disabled = false;
  }

  // Live-Update
  [
    dateInput,
    titleInput,
    groupInput,
    headerInput,
    passwordInput,
    nzblnkInput,
    extraArgsInput
  ].forEach((el) => el.addEventListener("input", buildCommand));

  // ---------------- RUN BUTTON ----------------
  runBtn.addEventListener("click", () => {
    const command = commandPreview.textContent;

    term.write(`\r\n$ ${command}\r\n`);

    ws.send(JSON.stringify({
      type: "stdin",
      payload: command + "\n"
    }));
  });
}


// ---------------- STARTUP ----------------

window.addEventListener("DOMContentLoaded", () => {
  initTerminal();
  initTheme();
  initWS();
  initParser();
});
