// parser-client.js
// v6.0 – "ML-ähnlicher" Forenparser für nzb-monkey-go UI

(function () {
  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function normalizeLines(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(l => l.replace(/[\u00A0\u200B\u200C\u200D]/g, "").trimEnd());
  }

  function clean(s) {
    return (s || "").replace(/[\u00A0\u200B\u200C\u200D]/g, "").trim();
  }

  // ------------------------------------------------------------
  // Date
  // ------------------------------------------------------------

  function extractDate(lines) {
    for (const line of lines) {
      const m = line.match(/(\d{2}\.\d{2}\.\d{4})/);
      if (m) {
        const [dd, mm, yyyy] = m[1].split(".");
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return "";
  }

  // ------------------------------------------------------------
  // Groups
  // ------------------------------------------------------------

  function extractGroups(lines) {
    const idx = lines.findIndex(l =>
      /^Groups?:?$/i.test(clean(l)) ||
      /^Group\(s\)$/i.test(clean(l))
    );

    if (idx >= 0 && lines[idx + 1]) {
      const line = clean(lines[idx + 1]);
      return line
        .split(/[\|\s]+/)
        .map(g => g.trim())
        .filter(Boolean)
        .join(",");
    }

    return "";
  }

  // ------------------------------------------------------------
  // Header (inkl. versteckt in BBCode)
  // ------------------------------------------------------------

  function extractHeader(lines) {
    // 1) Klassische Varianten
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Header\s*:?\s*$/i.test(line)) {
        if (lines[i + 1]) return clean(lines[i + 1]);
      }

      if (/^Header\s*:/i.test(line)) {
        return clean(line.replace(/^Header\s*:/i, ""));
      }
    }

    // 2) Versteckt in BBCode / Code-Blöcken
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^

\[(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = true;
        continue;
      }
      if (/^

\[\/(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = false;
        continue;
      }

      if (inBlock) {
        const m = line.match(/Header\s*:\s*([A-Za-z0-9]+)$/i);
        if (m) return clean(m[1]);
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // Password (inkl. aus Dateiname)
  // ------------------------------------------------------------

  function extractPassword(lines, filename) {
    // 1) Klassisch: "Password" / "Passwort"
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Passwort\s*:?\s*$/i.test(line) || /^Password\s*:?\s*$/i.test(line)) {
        if (lines[i + 1]) return clean(lines[i + 1]);
      }

      if (/^(Passwort|Password)\s*:/i.test(line)) {
        return clean(line.replace(/^(Passwort|Password)\s*:/i, ""));
      }
    }

    // 2) Versteckt in BBCode
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^

\[(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = true;
        continue;
      }
      if (/^

\[\/(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = false;
        continue;
      }

      if (inBlock) {
        const m = line.match(/(Passwort|Password)\s*:\s*([^\s]+)/i);
        if (m) return clean(m[2]);
      }
    }

    // 3) Aus Dateiname extrahieren
    if (filename) {
      // {{PASSWORD}}
      let m = filename.match(/\{\{([^}]+)\}\}/);
      if (m) return clean(m[1]);

      // [PASSWORD]
      m = filename.match(/

\[([^\]

]+)\]

/);
      if (m && m[1].length > 4 && !/\.(mkv|mp4|rar|nzb)$/i.test(m[1])) {
        return clean(m[1]);
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // Filename
  // ------------------------------------------------------------

  function extractFilename(lines) {
    const idx = lines.findIndex(l =>
      /^Dateiname\b/i.test(clean(l)) ||
      /Dateiname für SABnzbd/i.test(clean(l))
    );

    if (idx >= 0 && lines[idx + 1]) {
      return clean(lines[idx + 1]);
    }

    const withPass = lines.find(l => /\{\{.+\}\}/.test(l));
    if (withPass) return clean(withPass);

    return "";
  }

  // ------------------------------------------------------------
  // NZBLNK (inkl. Spoiler/Show/Code)
  // ------------------------------------------------------------

  function extractNzblnk(lines) {
    const findInLine = (line) => {
      const m = line.match(/(nzblnk\?[^\s"'<>]+)/i);
      return m ? clean(m[1]) : "";
    };

    // 1) Direkt in Zeile
    for (const raw of lines) {
      const line = clean(raw);
      const found = findInLine(line);
      if (found) return found;
    }

    // 2) "NZBLNK" + nächste Zeile
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (/^NZBLNK$/i.test(line) && lines[i + 1]) {
        const found = findInLine(clean(lines[i + 1]));
        if (found) return found;
      }
    }

    // 3) In [Show]/[Spoiler]/[Code]-Blöcken
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^

\[(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = true;
        continue;
      }
      if (/^

\[\/(code|spoiler|show|nzb)\]

/i.test(line)) {
        inBlock = false;
        continue;
      }

      if (inBlock) {
        const found = findInLine(line);
        if (found) return found;
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // ML-ähnliche Titel-Erkennung (Scoring)
  // ------------------------------------------------------------

  function scoreTitleCandidate(line) {
    const s = clean(line);
    if (!s) return 0;

    let score = 0;

    // Länge
    if (s.length >= 10 && s.length <= 140) score += 2;

    // Jahr
    if (/\b(19|20)\d{2}\b/.test(s)) score += 3;

    // Qualitäts-/Release-Tags
    if (/\b(2160p|1080p|720p|WEB|H265|HEVC|DV|HDR|REMUX|BLURAY|BDRIP)\b/i.test(s)) score += 3;

    // Sprache
    if (/\b(GERMAN|DL|MULTI|DUBBED)\b/i.test(s)) score += 2;

    // Release-Suffix
    if (/\b(REPACK|PROPER|MGE|SUXXORS|iNTERNAL|UNRATED)\b/i.test(s)) score += 2;

    // Kein Satzende-Punkt
    if (!/[.!?]$/.test(s)) score += 1;

    // Keine typischen Beschreibungssätze
    if (!/Laden und mit der entpackten|Hinweis: Upload führt zu|Es kann ein paar Stunden dauern/i.test(s)) {
      score += 1;
    }

    return score;
  }

  function extractTitle(lines, result) {
    // 1) Release-Pattern (v5)
    let best = { line: "", score: 0 };

    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      const sc = scoreTitleCandidate(line);
      if (sc > best.score) {
        best = { line, score: sc };
      }
    }

    if (best.score >= 4) {
      result.title = best.line;
    }

    // 2) Deine alte Logik (v4.1) als Fallback

    // "Standard ..." Titel
    if (!result.title) {
      const stdTitle = lines.find(l => /^Standard\s+/i.test(clean(l)));
      if (stdTitle) {
        result.title = clean(stdTitle.replace(/^Standard\s+/i, ""));
      }
    }

    // Titel relativ zu "Groups"
    if (!result.title) {
      const gIdx = lines.findIndex(l =>
        /^Groups?:?$/i.test(clean(l)) ||
        /^Group\(s\)$/i.test(clean(l))
      );

      if (gIdx > 0) {
        let t = clean(lines[gIdx - 1]);

        if (gIdx > 1 && clean(lines[gIdx - 2]).length > 0) {
          const prev = clean(lines[gIdx - 2]);
          if (prev.toLowerCase().includes(t.toLowerCase().slice(0, 10))) {
            t = prev;
          }
        }

        result.title = t;
      }
    }

    // Titel relativ zu Datum (Zeile nach Datum)
    if (!result.title) {
      const dateLine = lines.find(l =>
        /^\d{2}\.\d{2}\.\d{4}/.test(clean(l)) ||
        /^Gestern/i.test(clean(l)) ||
        /^Heute/i.test(clean(l)) ||
        /^Vorgestern/i.test(clean(l))
      );

      if (dateLine) {
        const idx = lines.indexOf(dateLine);
        if (idx >= 0 && lines[idx + 1]) {
          result.title = clean(lines[idx + 1]);
        }
      }
    }

    // 3) Fallback: aus Dateiname ableiten
    if (!result.title && result.filename) {
      result.title = clean(result.filename.split("{{")[0]);
    }

    return result.title || "";
  }

  // ------------------------------------------------------------
  // Main parser
  // ------------------------------------------------------------

  function parseForumText(text) {
    const lines = normalizeLines(text);

    const result = {
      date: "",
      title: "",
      group: "",
      header: "",
      password: "",
      nzblnk: "",
      filename: ""
    };

    result.date = extractDate(lines);
    result.group = extractGroups(lines);
    result.filename = extractFilename(lines);
    result.header = extractHeader(lines);
    result.nzblnk = extractNzblnk(lines);
    result.password = extractPassword(lines, result.filename);
    extractTitle(lines, result);

    return result;
  }

  window.parseForumText = parseForumText;
})();
