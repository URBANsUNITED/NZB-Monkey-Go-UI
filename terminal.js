import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

export const term = new Terminal({
  convertEol: true,
  fontFamily: "Consolas, monospace",
  fontSize: 14
});

export const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

term.open(document.getElementById("terminal"));
fitAddon.fit();

window.addEventListener("resize", () => fitAddon.fit());

export function applyTerminalTheme(theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const themes = {
    light: {
      background: "#ffffff",
      foreground: "#000000",
      cursor: "#000000",
      selection: "#c0c0c0"
    },
    dark: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#ffffff",
      selection: "#44475a"
    },
    dracula: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
      selection: "#44475a"
    },
    system: prefersDark
      ? {
          background: "#1e1e1e",
          foreground: "#d4d4d4",
          cursor: "#ffffff",
          selection: "#44475a"
        }
      : {
          background: "#ffffff",
          foreground: "#000000",
          cursor: "#000000",
          selection: "#c0c0c0"
        }
  };

  term.setOption("theme", themes[theme] || themes.system);
}
