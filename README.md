# NZB-Monkey-Go-UI
Eine UI für den NZB-Monkey-Go als Dockerfile

# nzb-monkey-go UI v2

Eine moderne, browserbasierte Benutzeroberfläche für **nzb-monkey-go**, optimiert für Copy‑Paste‑Workflows aus Usenet‑Foren, inklusive Live‑Parser, Terminal‑Integration und Prozesssteuerung.

Die UI ermöglicht es, Forenbeiträge oder NZBLNK‑Links einzufügen, automatisch zu analysieren und daraus gültige nzb-monkey-go‑Befehle zu generieren — ohne Kommandozeilenwissen.

---

## 🚀 Funktionsumfang

### ✔ Copy‑Paste Parser
- Vollautomatische Erkennung von:
  - Datum (absolut & relativ: *Heute*, *Gestern*, *Vorgestern*)
  - Titel
  - Groups / Newsgroups
  - Header / Subject‑Hash
  - Passwort
  - NZBLNK‑Links
  - Dateiname (falls vorhanden)
- Robuste Heuristiken für unstrukturierte Forenbeiträge
- NZBLNK‑Parser mit Unterstützung für:
  - `t=` Titel
  - `h=` Header
  - `p=` Passwort
  - `g=` mehrere Groups
  - `d=` Datum (Unix‑Timestamp oder DD.MM.YYYY)

### ✔ NZBLNK‑Sondermodus
- Wird ein NZBLNK erkannt, hat dieser Priorität.
- Enthält der NZBLNK **kein Datum**, kann der Nutzer ein Datum manuell setzen.
- Die UI ergänzt dann automatisch `--date DD.MM.YYYY` im Befehl.

### ✔ Live‑Command‑Builder
- Jede Änderung an den Eingabefeldern aktualisiert den Befehl sofort.
- Unterstützt:
  - `--date`
  - `--title`
  - `--subject`
  - `--password`
  - `--group` (mehrfach)
  - zusätzliche Argumente

### ✔ Debug‑Panel
- Zeigt das vollständige Parser‑Ergebnis als JSON
- Listet fehlende Felder auf

### ✔ Terminal‑Integration (xterm.js)
- Vollwertiges Terminal im Browser
- Live‑Ausgabe des Backend‑Prozesses
- Eingaben werden direkt an den laufenden Prozess gesendet

### ✔ Prozesssteuerung
- **Run‑Button**: startet den nzb-monkey-go‑Prozess
- **Abort‑Button**: bricht den laufenden Prozess sofort ab (SIGKILL)
- Backend verhindert parallele Prozesse

### ✔ Komfortfunktionen
- **Clear‑Button** zum Leeren des Copy‑Paste‑Feldes
- Theme‑Auswahl (System, Hell, Dunkel, Dracula)
- Automatisches Terminal‑Resizing

---

## 🧩 Architektur

public/
│
├── index.html        # UI-Layout
├── styles.css        # UI-Design
├── app.js            # UI-Logik, Parser-Integration, Terminal-Steuerung
├── parser-client.js  # Vollständiger Parser (Forum + NZBLNK)
├── terminal.js       # Xterm-Initialisierung

Backend:

src/
└── server/
└── index.js      # Express-Server + WebSocket + Prozesssteuerung


---

## 🔌 Backend-Funktionen

### WebSocket-Kommunikation
- `stdin` → führt Befehle aus
- `stdout` → sendet Terminalausgabe an den Browser
- `abort` → beendet laufende Prozesse

### Prozesshandling
- Jeder Befehl wird mit `spawn("bash", ["-c", command])` ausgeführt
- Läuft immer nur **ein** Prozess gleichzeitig
- Abbruch erfolgt über `SIGKILL`

---

## 🧠 Parser-Logik (Kurzfassung)

### 1. NZBLNK-Erkennung
Wenn der Text mit `nzblnk:?` beginnt:
- Parameter werden extrahiert
- Titel, Header, Passwort, Groups, Datum übernommen
- Falls kein Datum enthalten → UI erlaubt manuelle Ergänzung

### 2. Forenparser
Erkennt:
- Datum (auch relativ)
- Titel (mehrere Heuristiken)
- Groups (mehrere Formate)
- Header (Hex‑Hash)
- Passwort (Heuristik)
- NZBLNK im Text
- Dateiname

### 3. Heuristiken
- Entfernt Leerzeilen
- Normalisiert Group‑Formate
- Erkennt NZB‑Links
- Fallback‑Titel nach Datum

---

## 🖥 Terminal-Funktionen

- Live‑Ausgabe
- Eingabeweiterleitung
- Resize‑Support
- Themes
- Prozessabbruch

---

## 📱 Mobile Hinweise

Die UI ist primär Desktop‑optimiert, funktioniert aber auch auf mobilen Geräten.  
Eine vollständig mobile Version ist geplant.

---

## Wie starten?

http://localhost:3000


## 📄 Lizenz
Privatprojekt – keine Weitergabe ohne Zustimmung.

## ✨ Autor
URBANsUNITED + Copilot (Microsoft)
