// parser-client.js
// v6.1 – robustere Forenparser-Logik für nzb-monkey-go UI

(function () {
  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function normalizeLines(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(l => l.replace(/[\u00A0\u200B\u200C\u200D]/g, "").trim());
  }

  function clean(s) {
    return (s || "").replace(/[\u00A0\u200B\u200C\u200D]/g, "").trim();
  }

  // ------------------------------------------------------------
  // Date (egal wo im Text)
  // ------------------------------------------------------------

  function extractDateFromText(text) {
    const m = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (m) {
      const [dd, mm, yyyy] = m[1].split(".");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  }

  // ------------------------------------------------------------
  // Groups
  // ------------------------------------------------------------

  function extractGroups(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Groups?\s*:?\s*$/i.test(line) || /^Group\(s\)\s*:?\s*$/i.test(line)) {
        const next = clean(lines[i + 1] || "");
        if (next) {
          return next
            .split(/[\|\s]+/)
            .map(g => g.trim())
            .filter(Boolean)
            .join(",");
        }
      }
    }
    return "";
  }

  // ------------------------------------------------------------
  // Header
  // ------------------------------------------------------------

  function extractHeader(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Header\s*:?\s*$/i.test(line)) {
        const next = clean(lines[i + 1] || "");
        if (next) return next;
      }

      if (/^Header\s*:/i.test(line)) {
        return clean(line.replace(/^Header\s*:/i, ""));
      }
    }

    // BBCode-Blöcke
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
        const m = line.match(/Header\s*:\s*([A-Za-z0-9]+)/i);
        if (m) return clean(m[1]);
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // Filename
  // ------------------------------------------------------------

  function extractFilename(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (/^Dateiname\b/i.test(line) || /Dateiname für SABnzbd/i.test(line)) {
        const next = clean(lines[i + 1] || "");
        if (next) return next;
      }
    }

    const withPass = lines.find(l => /\{\{.+\}\}/.test(l));
    if (withPass) return clean(withPass);

    return "";
  }

  // ------------------------------------------------------------
  // Password (inkl. aus Dateiname)
  // ------------------------------------------------------------

  function extractPassword(lines, filename) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^(Passwort|Password)\s*:?\s*$/i.test(line)) {
        const next = clean(lines[i + 1] || "");
        if (next) return next;
      }

      if (/^(Passwort|Password)\s*:/i.test(line)) {
        return clean(line.replace(/^(Passwort|Password)\s*:/i, ""));
      }
    }

    // BBCode-Blöcke
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

    // Aus Dateiname
    if (filename) {
      let m = filename.match(/\{\{([^}]+)\}\}/);
      if (m) return clean(m[1]);

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
  // NZBLNK
  // ------------------------------------------------------------

  function extractNzblnk(lines) {
    const findInLine = (line) => {
      const m = line.match(/(nzblnk\?[^\s"'<>]+)/i);
      return m ? clean(m[1]) : "";
    };

    for (const raw of lines) {
      const line = clean(raw);
      const found = findInLine(line);
      if (found) return found;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (/^NZBLNK$/i.test(line) && lines[i + 1]) {
        const found = findInLine(clean(lines[i + 1]));
        if (found) return found;
      }
    }

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
  // Titel – Scoring + Fallbacks
  // ------------------------------------------------------------

  function scoreTitleCandidate(line) {
    const s = clean(line);
    if (!s) return 0;

    let score = 0;

    if (s.length >= 5 && s.length <= 140) score += 2;
    if (/\b(19|20)\d{2}\b/.test(s)) score += 3;
    if (/\b(2160p|1080p|720p|WEB|H265|HEVC|DV|HDR|REMUX|BLURAY|BDRIP)\b/i.test(s)) score += 3;
    if (/\b(GERMAN|DL|MULTI|DUBBED)\b/i.test(s)) score += 2;
    if (/\b(REPACK|PROPER|MGE|SUXXORS|iNTERNAL|UNRATED)\b/i.test(s)) score += 2;
    if (!/[.!?]$/.test(s)) score += 1;
    if (!/Laden und mit der entpackten|Hinweis: Upload führt zu|Es kann ein paar Stunden dauern/i.test(s)) {
      score += 1;
    }

    return score;
  }

  function extractTitle(lines, result) {
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

    // Fallbacks wie vorher

    if (!result.title) {
      const stdTitle = lines.find(l => /^Standard\s+/i.test(clean(l)));
      if (stdTitle) {
        result.title = clean(stdTitle.replace(/^Standard\s+/i, ""));
      }
    }

    if (!result.title) {
      const gIdx = lines.findIndex(l =>
        /^Groups?\s*:?\s*$/i.test(clean(l)) ||
        /^Group\(s\)\s*:?\s*$/i.test(clean(l))
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

    if (!result.title && result.filename) {
      result.title = clean(result.filename.split("{{")[0]);
    }

    return result.title || "";
  }

  // ------------------------------------------------------------
  // Main
  // ------------------------------------------------------------

  function parseForumText(text) {
    const lines = normalizeLines(text);
    const flat = lines.join("\n");

    const result = {
      date: "",
      title: "",
      group: "",
      header: "",
      password: "",
      nzblnk: "",
      filename: ""
    };

    result.date = extractDateFromText(flat);
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
