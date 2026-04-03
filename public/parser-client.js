// ------------------------------------------------------------
// PARSER v4 – NZBLNK-Parser + Forum-Parser + Heuristik
// ------------------------------------------------------------

// -----------------------------
// NZBLNK direkt parsen
// -----------------------------
function parseNzblnk(raw) {
  const out = {
    date: "",
    title: "",
    group: "",
    header: "",
    password: "",
    nzblnk: raw.trim(),
    filename: ""
  };

  const q = raw.replace(/^nzblnk:\?/, "");
  const params = new URLSearchParams(q);

  if (params.get("t")) out.title = params.get("t").replace(/_/g, " ");
  if (params.get("h")) out.header = params.get("h");
  if (params.get("p")) out.password = params.get("p");

  const groups = params.getAll("g");
  if (groups.length > 0) {
    out.group = groups.join(",");
  }

  if (params.get("d")) {
    const d = params.get("d");
    const m = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) {
      const [_, dd, mm, yyyy] = m;
      out.date = `${yyyy}-${mm}-${dd}`;
    }
  }

  return out;
}

// -----------------------------
// Relative Datumsauflösung
// -----------------------------
function resolveRelativeDate(label) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (/^Heute/i.test(label)) {
    // heute
  } else if (/^Gestern/i.test(label)) {
    d.setDate(d.getDate() - 1);
  } else if (/^Vorgestern/i.test(label)) {
    d.setDate(d.getDate() - 2);
  } else {
    return "";
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ------------------------------------------------------------
// HAUPTPARSER
// ------------------------------------------------------------
window.parseForumText = function parseForumText(raw) {

  // 1) NZBLNK hat absolute Priorität
  if (/^nzblnk:\?/i.test(raw.trim())) {
    return parseNzblnk(raw);
  }

  // 2) Forumstext normal parsen
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const result = {
    date: "",
    title: "",
    group: "",
    header: "",
    password: "",
    nzblnk: "",
    filename: ""
  };

  // ------------------------------------------------------------
  // TITEL-ERKENNUNG (v4.1)
  // ------------------------------------------------------------

  const stdTitle = lines.find(l => /^Standard\s+/i.test(l));
  if (stdTitle) {
    result.title = stdTitle.replace(/^Standard\s+/i, "").trim();
  }

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

  // ------------------------------------------------------------
  // DATUM
  // ------------------------------------------------------------
  const dateLine = lines.find(l =>
    /^\d{2}\.\d{2}\.\d{4}/.test(l) ||
    /^Gestern/i.test(l) ||
    /^Heute/i.test(l) ||
    /^Vorgestern/i.test(l)
  );

  if (dateLine) {
    let iso = "";

    const m = dateLine.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) {
      const [_, dd, mm, yyyy] = m;
      iso = `${yyyy}-${mm}-${dd}`;
    } else {
      iso = resolveRelativeDate(dateLine);
    }

    if (iso) result.date = iso;
  }

  // ------------------------------------------------------------
  // GROUPS
  // ------------------------------------------------------------
  let groupsIdx = lines.findIndex(l =>
    /^Groups?:?$/i.test(l) ||
    /^Group\(s\)$/i.test(l)
  );

  if (groupsIdx !== -1 && lines[groupsIdx + 1]) {
    result.group = lines[groupsIdx + 1]
      .replace(/\|/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .join(",");
  } else {
    const gLine = lines.find(l =>
      /\balt\.binaries\./i.test(l) ||
      /\ba\.b\./i.test(l)
    );
    if (gLine) {
      result.group = gLine
        .replace(/\|/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .join(",");
    }
  }

  // ------------------------------------------------------------
  // HEADER
  // ------------------------------------------------------------
  let headerIdx = lines.findIndex(l => /^Header:?$/i.test(l));
  if (headerIdx !== -1 && lines[headerIdx + 1]) {
    result.header = lines[headerIdx + 1].trim();
  } else {
    const hexLine = lines.find(l => /^[0-9a-z]{16,64}$/i.test(l));
    if (hexLine) result.header = hexLine;
  }

  // ------------------------------------------------------------
  // PASSWORT
  // ------------------------------------------------------------
  let pwIdx = lines.findIndex(l =>
    /^Passwort:?$/i.test(l) ||
    /^Password:?$/i.test(l)
  );

  if (pwIdx !== -1 && lines[pwIdx + 1]) {
    result.password = lines[pwIdx + 1].trim();
  } else {
    const pwLine = lines.find(l =>
      l.length >= 2 &&
      l.length <= 32 &&
      !/\s/.test(l) &&
      !/^http/i.test(l) &&
      !/alt\.binaries/i.test(l)
    );
    if (pwLine) result.password = pwLine;
  }

  // ------------------------------------------------------------
  // NZBLNK
  // ------------------------------------------------------------
  const nzbIdx = lines.findIndex(l => /^NZBLNK$/i.test(l));

  if (nzbIdx !== -1) {
    const next = lines[nzbIdx + 1] || "";
    if (
      next &&
      !/^NZBLNK$/i.test(next) &&
      !/Suchmaske/i.test(next) &&
      !/Suche/i.test(next)
    ) {
      result.nzblnk = next.trim();
    }
  }

  if (!result.nzblnk) {
    const nzbLine = lines.find(l =>
      /^https?:\/\/.*\.nzb/i.test(l) ||
      /^nzb:?/i.test(l)
    );

    if (nzbLine && !/Suchmaske/i.test(nzbLine)) {
      result.nzblnk = nzbLine.trim();
    }
  }

  // ------------------------------------------------------------
  // DATEINAME
  // ------------------------------------------------------------
  const fnIdx = lines.findIndex(l => /^Dateiname/i.test(l));
  if (fnIdx !== -1 && lines[fnIdx + 1]) {
    result.filename = lines[fnIdx + 1].trim();
  }

  return result;
};
