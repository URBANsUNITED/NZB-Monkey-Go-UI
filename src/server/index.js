import express from "express";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
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
        currentProc = null;
        ws.send(JSON.stringify({ type: "stdout", payload: "\n[prozess abgebrochen]\n" }));
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

      currentProc = spawn("bash", ["-c", command]);

      currentProc.stdout.on("data", (chunk) => {
  ws.send(chunk.toString());
});

      currentProc.stderr.on("data", (chunk) => {
  ws.send(chunk.toString());
});

      currentProc.on("close", (code) => {
        ws.send(JSON.stringify({ type: "stdout", payload: `\n[exit ${code}]\n` }));
        currentProc = null;
      });
    }
  });
});
