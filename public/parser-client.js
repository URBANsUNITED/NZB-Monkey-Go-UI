// parser-client.js
// v7.1 – Kontextbasierter Forenparser (iPhone-freundlich)
// - Datum: Heute / Gestern / Vorgestern + DD.MM.YYYY
// - NZBLNK als Datenquelle (t, h, p, g, d)
// - Titel-Variante B (Standard + optional zweiter Titel)
// - Titel-Prefix-Cleaner (MP3, BD, Remux, AV1, …)
// - Profilzeilen-Blacklist
// - Groups / Header / Passwort / Filename auch OHNE Label erkennbar
// - Keine Längen-Heuristik für Passwort/Header

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
  // DATE (inkl. Heute/Gestern/Vorgestern)
  // ------------------------------------------------------------
  function extractDateFromRelative(line) {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (/^Heute/i.test(line)) return base;
    if (/^Gestern/i.test(line)) { base.setDate(base.getDate() - 1); return base; }
    if (/^Vorgestern/i.test(line)) { base.setDate(base.getDate() - 2); return base; }

    return null;
  }

  function extractDate(text, lines) {
    for (const l of lines) {
      const d = extractDateFromRelative(clean(l));
      if (d) return formatDate(d);
    }

    const m = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (m) {
      const [dd, mm, yyyy] = m[1].split(".");
      return `${yyyy}-${mm}-${dd}`;
    }

    return "";
  }

  function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // ------------------------------------------------------------
  // HELFER: Muster-Erkennung
  // ------------------------------------------------------------
  function looksLikeGroupLine(line) {
    const s = clean(line);
    if (!s) return false;
    if (/a\.b\./i.test(s)) return true;
    if (/alt\.binaries\./i.test(s)) return true;
    return false;
  }

  function looksLikeNzblnk(line) {
    const s = clean(line);
    return /^nzblnk[:?]/i.test(s);
  }

  function looksLikeFilename(line) {
    const s = clean(line);
    if (!s) return false;
    if (/\{\{.+\}\}/.test(s)) return true;
    if (/\b(19|20)\d{2}\b/.test(s) && /[._-]/.test(s)) return true;
    return false;
  }

  function looksLikeHeaderCandidate(line) {
    const s = clean(line);
    if (!s) return false;
    if (!/^[A-Za-z0-9]+$/.test(s)) return false;
    if (looksLikeGroupLine(s)) return false;
    if (looksLikeFilename(s)) return false;
    if (looksLikeNzblnk(s)) return false;
    return true;
  }

  function looksLikePasswordCandidate(line) {
    const s = clean(line);
    if (!s) return false;
    if (looksLikeGroupLine(s)) return false;
    if (looksLikeFilename(s)) return false;
    if (looksLikeNzblnk(s)) return false;
    if (/^Header\s*:?/i.test(s)) return false;
    if (/^Groups?/i.test(s)) return false;
    if (/^Dateiname\b/i.test(s)) return false;
    if (/^(Passwort|Password)\s*:?/i.test(s)) return false;
    return true;
  }

  // ------------------------------------------------------------
  // GROUPS (mit und ohne Label)
  // ------------------------------------------------------------
  function extractGroups(lines) {
    // 1) Mit Label
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (
        /^Groups?$/i.test(line) ||
        /^Groups?:?$/i.test(line) ||
        /^Group\(s\)$/i.test(line) ||
        /^Group\(s\):?$/i.test(line) ||
        /^Group:$/i.test(line) ||
        /^Group\s*$/i.test(line)
      ) {
        const next = clean(lines[i + 1] || "");
        if (next) {
          return next
            .split(/\s*\|\s*|\s+/)
            .map(g => g.trim())
            .filter(Boolean)
            .join(",");
        }
      }
    }

    // 2) Ohne Label – Zeile, die wie Group aussieht
    for (const raw of lines) {
      const line = clean(raw);
      if (looksLikeGroupLine(line)) {
        return line
          .split(/\s*\|\s*|\s+/)
          .map(g => g.trim())
          .filter(Boolean)
          .join(",");
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // HEADER (mit und ohne Label)
  // ------------------------------------------------------------
  function extractHeader(lines) {
    // 1) Mit Label
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Header\s*:?\s*$/i.test(line)) return clean(lines[i + 1] || "");
      if (/^Header\s*:/i.test(line)) return clean(line.replace(/^Header\s*:/i, ""));
    }

    // 2) Ohne Label – Kandidat suchen
    for (const raw of lines) {
      const line = clean(raw);
      if (looksLikeHeaderCandidate(line)) {
        return line;
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // PASSWORD (mit und ohne Label)
  // ------------------------------------------------------------
  function extractPassword(lines) {
    // 1) Mit Label
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^(Passwort|Password)\s*:?\s*$/i.test(line)) return clean(lines[i + 1] || "");
      if (/^(Passwort|Password)\s*:/i.test(line)) return clean(line.replace(/^(Passwort|Password)\s*:/i, ""));
    }

    // 2) Ohne Label – Kandidat suchen
    for (const raw of lines) {
      const line = clean(raw);
      if (looksLikePasswordCandidate(line)) {
        return line;
      }
    }

    return "";
  }

  // ------------------------------------------------------------
  // FILENAME (mit und ohne Label)
  // ------------------------------------------------------------
  function extractFilename(lines) {
    // 1) Mit Label
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);

      if (/^Dateiname\b/i.test(line)) return clean(lines[i + 1] || "");
      if (/Dateiname für SABnzbd und Newsleecher/i.test(line)) return clean(lines[i + 1] || "");
    }

    // 2) Zeile mit {{…}}
    const withPass = lines.find(l => /\{\{.+\}\}/.test(l));
    if (withPass) return clean(withPass);

    // 3) Fallback: Zeile, die wie ein Filename aussieht
    for (const raw of lines) {
      const line = clean(raw);
      if (looksLikeFilename(line)) return line;
    }

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
  // TITLE (v7.1 – Variante B)
  // ------------------------------------------------------------

  const TITLE_BLACKLIST = [
    /^Registriert seit/i,
    /^Beiträge/i,
    /^Anzahl 'Danke'/i,
    /^Ort:/i,
    /ist offline/i,
    /ist online/i,
    /^Team /i,
    /^Benutzerbild/i
  ];

  const CATEGORY_PREFIX = /^(MP3|FLAC|Movie|Film|PC|Game|Games|XXX|Doku|BD|BDRip|Remux|Software|App|Application)\s*[-:]*\s*/i;

  function scoreTitle(line) {
    const s = clean(line);
    if (!s) return 0;
    if (looksLikeNzblnk(s)) return 0;
    if (TITLE_BLACKLIST.some(rx => rx.test(s))) return 0;

    let score = 0;
    if (s.length >= 5 && s.length <= 140) score += 2;
    if (/\b(19|20)\d{2}\b/.test(s)) score += 3;
    if (/\b(2160p|1080p|720p|WEB|BluRay|HDR|DV|AV1|HEVC|H265|Remux)\b/i.test(s)) score += 3;
    if (!/[.!?]$/.test(s)) score += 1;

    return score;
  }

  function normalizeTitle(title) {
    let t = clean(title);

    t = t.replace(CATEGORY_PREFIX, "").trim();
    t = t.replace(/^(AV1|HEVC|H\.265|H265|x265|x264)\s+/i, "").trim();
    t = t.replace(/^(BD|BD[-–—:]|BD\s*[-–—]\s*Remux|BD\s*Remux)\s+/i, "").trim();
    t = t.replace(/^Remux\s+/i, "").trim();
    t = t.replace(/^[-–—:]\s*/, "").trim();

    return t;
  }

  function extractTitle(lines) {
    const cleaned = lines.map(l => clean(l));

    // 1) Standard-Titel (Variante B)
    const stdIndex = cleaned.findIndex(l => /^Standard\s+/i.test(l));
    if (stdIndex !== -1) {
      const stdTitle = normalizeTitle(cleaned[stdIndex].replace(/^Standard\s+/i, ""));
      const next = cleaned[stdIndex + 1] || "";

      if (
        next &&
        !TITLE_BLACKLIST.some(rx => rx.test(next)) &&
        normalizeTitle(next) !== stdTitle
      ) {
        return normalizeTitle(next);
      }

      return stdTitle;
    }

    // 2) Doppel-Titel (z.B. "Mp3 XYZ" / "XYZ")
    for (let i = 0; i < cleaned.length - 1; i++) {
      const a = normalizeTitle(cleaned[i]);
      const b = normalizeTitle(cleaned[i + 1]);

      if (a && b && a !== b && a.includes(b)) {
        return b;
      }
    }

    // 3) Scoring
    let best = { line: "", score: 0 };

    for (const l of cleaned) {
      const sc = scoreTitle(l);
      if (sc > best.score) best = { line: l, score: sc };
    }

    if (best.score >= 3) return normalizeTitle(best.line);

    // 4) Fallback: Zeile nach Datum
    for (let i = 0; i < cleaned.length; i++) {
      if (/(\d{2}\.\d{2}\.\d{4})/.test(cleaned[i])) {
        return normalizeTitle(cleaned[i + 1] || "");
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
      if (!isNaN(dt.getTime())) result.date = formatDate(dt);
    }
  }

  // ------------------------------------------------------------
  // MAIN
  // ------------------------------------------------------------
  function parseForumText(text) {
    const lines = normalizeLines(text);
    const flat = lines.join("\n");

    const result = {
      date: extractDate(flat, lines),
      title: extractTitle(lines),
      group: extractGroups(lines),
      header: extractHeader(lines),
      password: extractPassword(lines),
      nzblnk: extractNzblnk(lines),
      filename: extractFilename(lines)
    };

    applyNzblnkOverrides(result);

    return result;
  }

  window.parseForumText = parseForumText;
})();
