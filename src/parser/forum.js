function parseForumText(raw) {
  const result = {};

  //
  // 1. Rohtext säubern, aber Zeilenumbrüche behalten
  //
  const text = raw
    .replace(/\r/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // HTML entfernen
    .trim();

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  //
  // 2. DATUM
  //
  let dateLine = lines.find(l =>
    /(Heute|Gestern|\d{2}\.\d{2}\.\d{4}),/.test(l)
  );

  if (!dateLine) {
    dateLine = lines.find(l => /Alt\s+\d{2}\.\d{2}\.\d{4},/.test(l));
  }

  if (dateLine) {
    const m = dateLine.match(/(Heute|Gestern|\d{2}\.\d{2}\.\d{4})/);
    if (m) result.date = convertDate(m[1]);
  }

  //
  // 3. TITEL
  //
  let title = null;

  const dankeIdx = lines.findIndex(l =>
    /Anzahl 'Danke' von diesem User erhalten/.test(l)
  );

  if (dankeIdx !== -1) {
    const candidates = [];

    if (dankeIdx + 1 < lines.length) candidates.push(lines[dankeIdx + 1]);
    if (dankeIdx + 2 < lines.length) candidates.push(lines[dankeIdx + 2]);

    const long = candidates
      .filter(l => l.length > 10 && /[A-Za-z]/.test(l))
      .sort((a, b) => b.length - a.length);

    if (long.length > 0) title = long[0].trim();
  }

  // Fallback: erste lange Zeile nach Datum
  if (!title && dateLine) {
    const dateIdx = lines.indexOf(dateLine);
    for (let i = dateIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.length > 20 && /[A-Za-z]/.test(l)) {
        title = l.trim();
        break;
      }
    }
  }

  if (title) result.title = title;

  //
  // 4. GROUP(S)
  //
  let group = null;

  // Variante: "Groups:" oder "Group:"
  let groupIdx = lines.findIndex(l =>
    /^Groups?:/i.test(l)
  );

  if (groupIdx !== -1) {
    const m = lines[groupIdx].match(/^Groups?:\s*(.+)$/i);
    if (m && m[1]) {
      group = m[1].trim();
    } else if (groupIdx + 1 < lines.length) {
      group = lines[groupIdx + 1].trim();
    }
  }

  // Variante: "Group(s)"
  if (!group) {
    groupIdx = lines.findIndex(l => /^Group\(s\)/i.test(l));
    if (groupIdx !== -1 && groupIdx + 1 < lines.length) {
      group = lines[groupIdx + 1].trim();
    }
  }

  // Normalisieren: Pipes, Tabs, Mehrfachspaces → Kommas
  if (group) {
    group = group
      .replace(/\|/g, ",")
      .replace(/\s+/g, ",")
      .replace(/,+/g, ",")
      .replace(/^,|,$/g, "");
    result.group = group;
  }

  //
  // 5. HEADER
  //
  let header = null;
  let headerIdx = lines.findIndex(l => /^Header:?/i.test(l));

  if (headerIdx !== -1) {
    const m = lines[headerIdx].match(/^Header:?\s*(.+)$/i);
    if (m && m[1]) {
      header = m[1].trim();
    } else if (headerIdx + 1 < lines.length) {
      header = lines[headerIdx + 1].trim();
    }
  }

  if (header) result.header = header;

  //
  // 6. PASSWORT
  //
  let password = null;
  let pwIdx = lines.findIndex(l => /^(Passwort|Password):?/i.test(l));

  if (pwIdx !== -1) {
    let m = lines[pwIdx].match(/^(Passwort|Password):?\s*(.+)$/i);
    if (m && m[2]) {
      password = m[2].trim();
    } else if (pwIdx + 1 < lines.length) {
      password = lines[pwIdx + 1].trim();
    }
  }

  if (password) result.password = password;

  //
  // 7. NZBLNK
  //
  const nzbIdx = lines.findIndex(l => /^NZBLNK/i.test(l));

  if (nzbIdx !== -1) {
    const m = lines[nzbIdx].match(/^NZBLNK\s*(.+)$/i);
    if (m && m[1]) {
      result.nzblnk = m[1].trim();
    } else {
      result.nzblnk = "NZBLNK";
    }
  }

  return result;
}

//
// 8. DATUMSKONVERTER
//
function convertDate(raw) {
  const now = new Date();

  if (raw === "Heute") return now.toISOString().slice(0, 10);

  if (raw === "Gestern") {
    const d = new Date(now.getTime() - 86400000);
    return d.toISOString().slice(0, 10);
  }

  const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return null;
}

module.exports = { parseForumText };
