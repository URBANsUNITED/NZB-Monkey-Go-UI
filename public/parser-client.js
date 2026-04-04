// parser-client.js
// v6.6 – NZBLNK als Datenquelle + Titel-Fix

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
  // DATE
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
      const line = clean(lines[i]);

      if (
        /^Groups?$/i.test(line) ||
        /^Groups?:?$/i.test(line) ||
        /^Group\(s\)$/i.test(line) ||
        /^Group\(s\):?$/i.test(line)
      ) {
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
  // FILENAME
  // ------------------------------------------------------------
  function extractFilename(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Dateiname\b/i.test(line)) {
        return clean(lines[i + 1] || "");
      }

      if (/Dateiname für SABnzbd und Newsleecher/i.test(line)) {
        return clean(lines[i + 1] || "");
      }
    }

    const withPass = lines.find(l => /\{\{.+\}\}/.test(l));
    if (withPass) return clean(withPass);

    return "";
  }

  // ------------------------------------------------------------
  // NZBLNK
  // ------------------------------------------------------------
function extractNzblnk(lines) {
  for (const raw of lines) {
    const line = clean(raw);
    const m = line.match(/(nzblnk[:?][^\s"'<>]+)/i);
    if (m) return m[1];
  }
  return "";
}


  // ------------------------------------------------------------
  // TITLE
  // ------------------------------------------------------------
  function scoreTitle(line) {
    const s = clean(line);
    if (!s) return 0;

    // NZBLNK-Zeilen nie als Titel werten
    if (/^nzblnk\?/i.test(s)) return 0;

    let score = 0;

    if (s.length >= 5 && s.length <= 120) score += 2;
    if (/\b(19|20)\d{2}\b/.test(s)) score += 3;
    if (/\b(SUXXORS|REPACK|PROPER|MGE|DV|WEB|H265|HEVC|2160p|1080p|AV1)\b/i.test(s)) score += 3;
    if (!/[.!?]$/.test(s)) score += 1;

    return score;
  }

  function normalizeTitle(title) {
    let t = clean(title);
    const prefixRegex = /^(AV1|HEVC|H\.265|H265|x265|x264)\s+/i;
    t = t.replace(prefixRegex, "").trim();
    return t;
  }

  function extractTitle(lines) {
    const std = lines.find(l => /^Standard\s+/i.test(clean(l)));
    if (std) return normalizeTitle(std.replace(/^Standard\s+/i, ""));

    let best = { line: "", score: 0 };

    for (const l of lines) {
      const sc = scoreTitle(l);
      if (sc > best.score) best = { line: clean(l), score: sc };
    }

    if (best.score >= 3) return normalizeTitle(best.line);

    for (let i = 0; i < lines.length; i++) {
      if (/(\d{2}\.\d{2}\.\d{4})/.test(lines[i])) {
        return normalizeTitle(lines[i + 1] || "");
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // NZBLNK → Felder überschreiben
  // ------------------------------------------------------------
  function applyNzblnkOverrides(result) {
    if (!result.nzblnk) return;

    const raw = result.nzblnk;
    const qIndex = raw.indexOf("?");
    if (qIndex === -1) return;

    const query = raw.slice(qIndex + 1);
    const params = new URLSearchParams(query);

    const t = params.get("t");
    const h = params.get("h");
    const p = params.get("p");
    const g = params.get("g");
    const d = params.get("d");

    if (t) result.title = normalizeTitle(decodeURIComponent(t));
    if (h) result.header = h;
    if (p) result.password = p;
    if (g) result.group = g;

    if (d && !isNaN(Number(d))) {
      const ts = Number(d) * 1000;
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) {
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        result.date = `${yyyy}-${mm}-${dd}`;
      }
    }
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
      filename: extractFilename(lines)
    };

    // NZBLNK als Datenquelle auswerten
    applyNzblnkOverrides(result);

    return result;
  }

  window.parseForumText = parseForumText;
})();
