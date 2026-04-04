import express from "express";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../../public")));

const server = app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentProc = null;

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // PROCESS ABORT
if (data.type === "abort") {
  if (currentProc) {
    currentProc.kill("SIGKILL");
    ws.send("\n[prozess abgebrochen]\n");
    currentProc = null;
  }
  return;
}

    // STDIN → START PROCESS
    if (data.type === "stdin") {
      const command = data.payload.trim();

      if (currentProc) {
        currentProc.kill("SIGKILL");
        currentProc = null;
      }

currentProc = pty.spawn("bash", ["-c", command], {
  name: "xterm-color",
  cols: 120,
  rows: 40,
  cwd: process.env.HOME,
  env: process.env
});

currentProc.onData((data) => {
  ws.send(data);
});

currentProc.onExit((evt) => {
  ws.send(`\n[exit ${evt.exitCode}]\n`);
  currentProc = null;
});


    }
  });
});
