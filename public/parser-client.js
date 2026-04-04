// parser-client.js
// v5.0 – robuste Forenparser-Logik für nzb-monkey-go UI

(function () {
  function normalizeLines(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(l => l.trimEnd());
  }

  function extractDate(lines) {
    // 1) explizites Datum im Format DD.MM.YYYY
    for (const line of lines) {
      const m = line.match(/(\d{2}\.\d{2}\.\d{4})/);
      if (m) {
        const [dd, mm, yyyy] = m[1].split(".");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // 2) Fallback: nichts gefunden
    return "";
  }

  function extractGroups(lines) {
    // Suche nach "Group(s)" / "Groups" Block
    const idx = lines.findIndex(l =>
      /^Groups?:?$/i.test(l) ||
      /^Group\(s\)$/i.test(l)
    );

    if (idx >= 0 && lines[idx + 1]) {
      const line = lines[idx + 1].trim();
      // Varianten: "alt.binaries.a51 | alt.binaries.frogs | alt.binaries.holiday"
      return line
        .split("|")
        .map(g => g.trim())
        .filter(Boolean)
        .join(",");
    }

    return "";
  }

  function extractHeader(lines) {
    // "Header" Zeile + nächste Zeile
    const idx = lines.findIndex(l => /^Header$/i.test(l));
    if (idx >= 0 && lines[idx + 1]) {
      return lines[idx + 1].trim();
    }

    // Fallback: manchmal "Header:" in einer Zeile
    const inline = lines.find(l => /^Header\s*:/i.test(l));
    if (inline) {
      return inline.replace(/^Header\s*:/i, "").trim();
    }

    return "";
  }

  function extractPassword(lines) {
    // "Password" Zeile + nächste Zeile
    const idx = lines.findIndex(l => /^Password$/i.test(l));
    if (idx >= 0 && lines[idx + 1]) {
      return lines[idx + 1].trim();
    }

    // Inline-Variante
    const inline = lines.find(l => /^Password\s*:/i.test(l));
    if (inline) {
      return inline.replace(/^Password\s*:/i, "").trim();
    }

    return "";
  }

  function extractFilename(lines) {
    // "Dateiname für SABnzbd und Newsleecher" + nächste Zeile
    const idx = lines.findIndex(l =>
      /^Dateiname\b/i.test(l) ||
      /Dateiname für SABnzbd/i.test(l)
    );

    if (idx >= 0 && lines[idx + 1]) {
      return lines[idx + 1].trim();
    }

    // Fallback: Zeile mit {{PASSWORD}}
    const withPass = lines.find(l => /\{\{.+\}\}/.test(l));
    if (withPass) {
      return withPass.trim();
    }

    return "";
  }

  function extractNzblnk(lines) {
    // Suche nach Zeilen, die mit nzblnk anfangen oder einen nzblnk-Link enthalten
    const nzLine = lines.find(l => /nzblnk\?/i.test(l));
    if (nzLine) {
      const m = nzLine.match(/(nzblnk\?[^\s"]+)/i);
      if (m) return m[1].trim();
    }
    return "";
  }

  // ------------------------------------------------------------
  // TITEL-ERKENNUNG v5.0
  // ------------------------------------------------------------

  function extractTitle(lines, result) {
    // v5 – Release Pattern Detection (neu)
    if (!result.title) {
      const releaseRegex =
        /\b(19|20)\d{2}\b.*\b(GERMAN|DL|WEB|H265|HEVC|REPACK|2160p|1080p|720p|DV|HDR|REMUX)\b/i;

      const releaseCandidates = lines
        .map(l => l.trim())
        .filter(l => releaseRegex.test(l));

      if (releaseCandidates.length >= 2) {
        const first = releaseCandidates[0];
        const second = releaseCandidates[1];

        if (second.length <= first.length + 20) {
          result.title = second;
        } else {
          result.title = first;
        }
      } else if (releaseCandidates.length === 1) {
        result.title = releaseCandidates[0];
      }
    }

    // v4.1 – deine bestehende Logik (Standard, Groups, Datum)
    // ------------------------------------------------------------
    // TITEL-ERKENNUNG (v4.1)
    // ------------------------------------------------------------

    // "Standard ..." Titel
    if (!result.title) {
      const stdTitle = lines.find(l => /^Standard\s+/i.test(l));
      if (stdTitle) {
        result.title = stdTitle.replace(/^Standard\s+/i, "").trim();
      }
    }

    // Titel relativ zu "Groups"
    if (!result.title) {
      const gIdx = lines.findIndex(l =>
        /^Groups?:?$/i.test(l) ||
        /^Group\(s\)$/i.test(l)
      );

      if (gIdx > 0) {
        let t = lines[gIdx - 1].trim();

        if (gIdx > 1 && lines[gIdx - 2].trim().length > 0) {
          const prev = lines[gIdx - 2].trim();
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
        /^\d{2}\.\d{2}\.\d{4}/.test(l) ||
        /^Gestern/i.test(l) ||
        /^Heute/i.test(l) ||
        /^Vorgestern/i.test(l)
      );

      if (dateLine) {
        const idx = lines.indexOf(dateLine);
        if (idx >= 0 && lines[idx + 1]) {
          result.title = lines[idx + 1].trim();
        }
      }
    }

    // Fallback: aus Dateiname ableiten (ohne {{PASSWORD}})
    if (!result.title && result.filename) {
      result.title = result.filename.split("{{")[0].trim();
    }

    return result.title || "";
  }

  // ------------------------------------------------------------
  // HAUPTPARSER
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
    result.header = extractHeader(lines);
    result.password = extractPassword(lines);
    result.filename = extractFilename(lines);
    result.nzblnk = extractNzblnk(lines);

    extractTitle(lines, result);

    return result;
  }

  window.parseForumText = parseForumText;
})();
