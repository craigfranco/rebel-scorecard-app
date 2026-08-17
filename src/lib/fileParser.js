// Client-side file parsing utilities using SheetJS for Excel and PapaParse for CSV

// Location suffixes appended in upload files but not in stored property names
// e.g. "Holiday Inn Express & Suites Moreno Valley - Riverside" → strip "- Riverside"
const LOCATION_SUFFIX_RE = /\s*-\s*(riverside|downtown|airport|north|south|east|west|central|midtown|uptown|old town|lakefront|waterfront|beachfront|harbor|marina|strip|galleria|market|square|plaza|village|heights|hills|valley|park|gardens|meadows|landing|crossing|junction|station|gateway|corridor|loop|skyway|bay|cove|ridge|bluff|summit|pointe|point|grove|woods|forest|lake|creek|brook|springs|falls|shores|harbor)\b.*/i;

// Known alternate names used in upload files that don't fuzzy-match a stored property.
// Key = normalized lowercased alias, Value = canonical property name as stored in the DB.
const NAME_ALIASES = {
  'the coachman': 'Coachman Lake Tahoe',
};

// Normalize a property name for fuzzy matching
export function normalizeName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(LOCATION_SUFFIX_RE, '')   // strip location suffixes like "- Riverside"
    .replace(/\s*-\s*\w+(\s+\w+){0,2}\s*$/, '')  // strip any trailing "- Xyz" or "- Xyz Abc" suffix not caught above
    .replace(/&/g, 'and')              // normalize & → and
    .replace(/[^a-z0-9 ]/g, ' ')      // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export function bestMatch(nameOrStrId, properties, strId = null) {
  // Always filter to active properties only — never match inactive/duplicate records
  const activeProperties = properties.filter(p => p.is_active !== false);

  // 1. Exact case-insensitive name match (after alias resolution)
  const rawNameInput = typeof nameOrStrId === 'string' ? nameOrStrId.trim() : '';
  const rawName = rawNameInput && NAME_ALIASES[rawNameInput.toLowerCase()]
    ? NAME_ALIASES[rawNameInput.toLowerCase()]
    : rawNameInput;
  if (rawName) {
    const exactMatch = activeProperties.find(
      p => p.name.trim().toLowerCase() === rawName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
  }

  // 2. str_id match
  const sid = strId || (rawName && rawName.match(/^\d+$/) ? rawName : null);
  if (sid) {
    const byStrId = activeProperties.find(p => p.str_id && String(p.str_id) === String(sid));
    if (byStrId) return byStrId;
    // If an explicit strId was passed but didn't match, fall through to name matching
    // (only skip if strId was the only identifier — no name available)
    if (strId && !rawName) {
      console.warn(`[bestMatch] str_id="${sid}" matched no active property — skipping row`);
      return null;
    }
  }

  // 3. Fuzzy normalized name match
  const name = rawName || nameOrStrId;
  if (!name) return null;
  const needle = normalizeName(name);
  if (!needle) return null;

  let best = null, bestScore = 0;
  for (const p of activeProperties) {
    const hay = normalizeName(p.name);
    if (hay === needle) return p; // normalized exact match

    // Containment: one name fully contained in the other
    if (hay.includes(needle) || needle.includes(hay)) {
      const score = Math.min(needle.length, hay.length) / Math.max(needle.length, hay.length);
      if (score > bestScore) { bestScore = score; best = p; }
      continue;
    }

    // Word overlap (ignore short words, but keep numbers like "39" — strong identifiers)
    const isToken = w => w.length > 2 || /^\d+$/.test(w);
    const needleWords = needle.split(' ').filter(isToken);
    const hayWords = hay.split(' ').filter(isToken);
    if (!needleWords.length || !hayWords.length) continue;
    const matched = needleWords.filter(w => hayWords.includes(w)).length;
    const score = matched / Math.max(needleWords.length, hayWords.length);
    if (score > bestScore) { bestScore = score; best = p; }
  }

  const result = bestScore >= 0.4 ? best : null;
  if (!result) {
    console.warn(`[bestMatch] No match found for "${name}" (normalized: "${needle}")`);
  }
  return result;
}

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPapaParse() {
  if (window.Papa) return window.Papa;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    script.onload = () => resolve(window.Papa);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Parse file and return { headers: string[], rows: any[][] }
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const Papa = await loadPapaParse();
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (results) => {
          const nonEmpty = results.data.filter(row => row.some(c => c !== '' && c != null));
          if (!nonEmpty.length) { resolve({ headers: [], rows: [] }); return; }
          // Find the first row that looks like a header (>= 3 non-numeric string cells).
          // Break on first match so data rows with text values (e.g. STR rank columns like "5 of 7")
          // don't overwrite the real header.
          let headerIdx = 0;
          for (let i = 0; i < Math.min(nonEmpty.length, 8); i++) {
            const row = nonEmpty[i];
            const strCells = row.filter(c => c !== '' && c != null && isNaN(Number(c))).length;
            if (strCells >= 3) { headerIdx = i; break; }
          }
          const headers = nonEmpty[headerIdx].map((h, i) => h !== '' && h != null ? String(h).trim() : `col_${i}`);
          const rows = nonEmpty.slice(headerIdx + 1);
          resolve({ headers, rows });
        },
        error: reject,
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await loadXLSX();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        // Find the first row that looks like a data/header row (has >= 3 non-empty cells)
        // For the Rebel P&L format, row index 3 (4th row) has actual column headers
        // But we'll return ALL rows so the user can see them
        const nonEmpty = data.filter(row => row.some(c => c !== ''));
        if (!nonEmpty.length) { resolve({ headers: [], rows: [] }); return; }

        // Detect header row: find first row where most cells are non-numeric strings
        let headerIdx = 0;
        for (let i = 0; i < Math.min(nonEmpty.length, 8); i++) {
          const row = nonEmpty[i];
          const strCells = row.filter(c => c !== '' && c != null && isNaN(Number(c))).length;
          if (strCells >= 3) { headerIdx = i; break; }
        }

        const headers = nonEmpty[headerIdx].map((h, i) => h !== '' ? String(h).trim() : `col_${i}`);
        const rows = nonEmpty.slice(headerIdx + 1);
        resolve({ headers, rows });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  throw new Error('unsupported_type');
}

// Auto-detect which column index maps to which KPI field
// Returns { hotel_name: idx, budgeted_gop_actual: idx, ... }
export function autoDetectMapping(headers, docType) {
  const h = headers.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
  console.log('[autoDetectMapping] normalized headers:', h);

  const find = (...terms) => {
    for (const t of terms) {
      const idx = h.findIndex(x => x.includes(t));
      if (idx !== -1) return idx;
    }
    return null;
  };

  const base = {
    hotel_name: find('property', 'hotel', 'hotelname', 'propertyname', 'name', 'account', 'site') ?? 0,
  };

  if (docType === 'GOP Report') {
    return {
      ...base,
      budgeted_gop_actual: find('actualamt', 'actualgop', 'actualdollar', 'gopactual', 'actual') ?? find('amt'),
      gop_margin_actual:   find('actualrev', 'actualmargin', 'actualpct', 'margin') ?? find('rev'),
      budgeted_gop_target: find('budgetamt', 'budgetgop', 'budgetdollar', 'gopbudget', 'budget') ?? null,
      budgeted_gop_prior:  find('prioryearamt', 'lastyearamt', 'prioramt', 'pyramt', 'priorgopamt') ?? null,
      gop_margin_budget:   find('budgetrev', 'budgetmargin', 'budgetpct') ?? null,
      gop_margin_prior:    find('prioryearamt', 'lastyearamt', 'priorgop', 'prioractual') ?? find('prior'),
      total_revenue:        find('totalrevenue', 'totalrev', 'totalroomrevenue', 'roomrevenue', 'totaloperatingrevenue', 'operatingrevenue') ?? null,
    };
  }
  if (docType === 'RGI/STR Report') {
    const result = {
      ...base,
      str_id:              find('deploymentid', 'deployment', 'strid', 'strnumber', 'strcode', 'propertyid', 'propertycode', 'propid', 'propcode', 'id') ?? null,
      revpar_index_change: find('revparindexpctchg', 'revparindexchg', 'revparindexpct', 'revparindexpercent', 'changepct', 'changeyoy', 'pctchg', 'yoy', 'change') ?? null,
      revpar_index:        find('revparindex', 'rgiindex', 'indexactual', 'rgi', 'revparindexvalue') ?? find('index') ?? find('revpar') ?? null,
      revpar_index_prior:  find('prioryearindex', 'indexprior', 'prioryear', 'prior', 'lastyear') ?? null,
    };
    console.log('[autoDetectMapping] RGI mapping result:', result, 'from headers:', headers);
    return result;
  }
  if (docType === 'GSS Report') {
    return {
      ...base,
      gss_actual: find('gssactual', 'gss', 'score', 'actual') ?? null,
      gss_prior:  find('gssprior', 'prioryear', 'prior', 'lastyear') ?? null,
    };
  }
  if (docType === 'Forecast Accuracy') {
    return {
      ...base,
      forecast_actual_revenue: find('actualrevenue', 'actualrev', 'actual') ?? null,
      forecast_primary_forecast: find('primaryforecast', 'forecast', 'forecastrev') ?? null,
    };
  }
  return base;
}

// Known P&L column layout for Rebel Hotel Co files
// Row structure: [ActAMT, Act%REV, BudAMT, Bud%REV, VarAMT, Var%REV, PYrAMT, PYr%REV, VarPYAMT, VarPY%REV, PropertyName, ...]
export function detectRebelPLLayout(headers) {
  // Heuristic: if col 10 looks like property names and cols 0-9 look like numbers
  return headers.length >= 11;
}

export function applyMapping(rows, mapping) {
  const result = rows.map(row => {
    const get = (idx) => (idx != null && idx < row.length) ? row[idx] : null;
    const num = (val) => {
      if (val === null || val === '' || val === undefined) return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };
    return {
      hotel_name: get(mapping.hotel_name) != null ? String(get(mapping.hotel_name)).trim() : '',
      str_id:     get(mapping.str_id) != null ? String(get(mapping.str_id)).trim() : null,
      budgeted_gop_actual: num(get(mapping.budgeted_gop_actual)),
      gop_margin_actual:   num(get(mapping.gop_margin_actual)),
      budgeted_gop_target: num(get(mapping.budgeted_gop_target)),
      budgeted_gop_prior:  num(get(mapping.budgeted_gop_prior)),
      gop_margin_budget:   num(get(mapping.gop_margin_budget)),
      gop_margin_prior:    num(get(mapping.gop_margin_prior)),
      total_revenue:        num(get(mapping.total_revenue)),
      revpar_index_change: num(get(mapping.revpar_index_change)),
      revpar_index:        num(get(mapping.revpar_index)),
      revpar_index_prior:  num(get(mapping.revpar_index_prior)),
      gss_actual:          num(get(mapping.gss_actual)),
      gss_prior:           num(get(mapping.gss_prior)),
      forecast_actual_revenue: num(get(mapping.forecast_actual_revenue)),
      forecast_primary_forecast: num(get(mapping.forecast_primary_forecast)),
      };
      });
  console.log('[applyMapping] sample rows (first 3):', result.slice(0, 3).map(r => ({ hotel_name: r.hotel_name, str_id: r.str_id, revpar_index: r.revpar_index, revpar_index_change: r.revpar_index_change })));
  return result.filter(r => {
    const hasName = r.hotel_name && r.hotel_name !== 'Property' && r.hotel_name.length > 1;
    const hasStrId = r.str_id && r.str_id.length > 0;
    const hasKpi = r.revpar_index != null || r.revpar_index_change != null || r.revpar_index_prior != null ||
                   r.budgeted_gop_actual != null || r.budgeted_gop_target != null || r.budgeted_gop_prior != null ||
                   r.gop_margin_actual != null || r.gop_margin_budget != null || r.gop_margin_prior != null ||
                   r.total_revenue != null ||
                   r.gss_actual != null || r.gss_prior != null ||
                   r.forecast_actual_revenue != null || r.forecast_primary_forecast != null;
    return hasName || hasStrId || hasKpi;
  });
}