// parser-client.js
// v6.2 – robustere Forenparser-Logik für nzb-monkey-go UI

(function () {

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
  // DATE — erkennt Datum überall im Text
  // ------------------------------------------------------------
  function extractDate(text) {
    const m = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (m) {
      const [dd, mm, yyyy] = m[1].split(".");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  }

  // ------------------------------------------------------------
  // GROUPS
  // ------------------------------------------------------------
  function extractGroups(lines) {
    for (let i = 0; i < lines.length; i++) {
      if (/^Groups?:?$/i.test(clean(lines[i]))) {
        const next = clean(lines[i + 1] || "");
        if (next) {
          return next
            .split(/\s+/)
            .map(g => g.trim())
            .filter(Boolean)
            .join(",");
        }
      }
    }
    return "";
  }

  // ------------------------------------------------------------
  // HEADER
  // ------------------------------------------------------------
  function extractHeader(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Header\s*:?\s*$/i.test(line)) {
        return clean(lines[i + 1] || "");
      }

      if (/^Header\s*:/i.test(line)) {
        return clean(line.replace(/^Header\s*:/i, ""));
      }
    }
    return "";
  }

  // ------------------------------------------------------------
  // PASSWORD
  // ------------------------------------------------------------
  function extractPassword(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^(Passwort|Password)\s*:?\s*$/i.test(line)) {
        return clean(lines[i + 1] || "");
      }

      if (/^(Passwort|Password)\s*:/i.test(line)) {
        return clean(line.replace(/^(Passwort|Password)\s*:/i, ""));
      }
    }
    return "";
  }

  // ------------------------------------------------------------
  // NZBLNK
  // ------------------------------------------------------------
  function extractNzblnk(lines) {
    for (const raw of lines) {
      const line = clean(raw);
      const m = line.match(/(nzblnk\?[^\s"'<>]+)/i);
      if (m) return m[1];
    }
    return "";
  }

  // ------------------------------------------------------------
  // TITLE — ML-like scoring + Standard + fallback
  // ------------------------------------------------------------
  function scoreTitle(line) {
    const s = clean(line);
    if (!s) return 0;

    let score = 0;

    if (s.length >= 5 && s.length <= 120) score += 2;
    if (/\b(19|20)\d{2}\b/.test(s)) score += 3;
    if (/\b(SUXXORS|REPACK|PROPER|MGE|DV|WEB|H265|HEVC|2160p|1080p)\b/i.test(s)) score += 3;
    if (!/[.!?]$/.test(s)) score += 1;

    return score;
  }

  function extractTitle(lines) {
    // 1) Standard … Titel
    const std = lines.find(l => /^Standard\s+/i.test(clean(l)));
    if (std) {
      return clean(std.replace(/^Standard\s+/i, ""));
    }

    // 2) ML-like scoring
    let best = { line: "", score: 0 };

    for (const l of lines) {
      const sc = scoreTitle(l);
      if (sc > best.score) best = { line: clean(l), score: sc };
    }

    if (best.score >= 3) return best.line;

    // 3) Fallback: Zeile nach Datum
    for (let i = 0; i < lines.length; i++) {
      if (/(\d{2}\.\d{2}\.\d{4})/.test(lines[i])) {
        return clean(lines[i + 1] || "");
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // MAIN
  // ------------------------------------------------------------
  function parseForumText(text) {
    const lines = normalizeLines(text);
    const flat = lines.join("\n");

    const result = {
      date: extractDate(flat),
      title: extractTitle(lines),
      group: extractGroups(lines),
      header: extractHeader(lines),
      password: extractPassword(lines),
      nzblnk: extractNzblnk(lines),
      filename: ""
    };

    return result;
  }

  window.parseForumText = parseForumText;
})();
