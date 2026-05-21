const SUPABASE_URL      = 'https://iubmajperipojqtlhwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1Ym1hanBlcmlwb2pxdGxod3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODM2MzcsImV4cCI6MjA5NDA1OTYzN30.IiUQAGO9rFuSC2LQlFr6dzmQPatCS-N7mjZdJzEQRNs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── INFO COMPLETENESS ──
const INFO_KEYS = ['leg_ouders_p1','leg_ouders_p2','leg_kinderen','huwelijkse_vw','testament','werkgever_p1','werkgever_p2','loonstroken_p1','loonstroken_p2','jaaropgave_p1','jaaropgave_p2','belasting_p1','belasting_p2','waarde_autos','pensioen_p1','pensioen_p2','saldi','saldo_polis','lijfrente','kapitaalverz','schulden','schenkingen','notarisakte','hypotheekgegevens','hypotheekakte','woz','jaaropgave_hyp','jaarcijfers_p1','jaarcijfers_p2'];

function isInfoComplete(infoDataStr) {
  if (!infoDataStr) return false;
  try {
    const data = JSON.parse(infoDataStr);
    if (data._nvt) return true;
    return INFO_KEYS.every(key => {
      const d = data[key] || { b: 1, a: 0 };
      return d.b !== 1 || d.a === 1;
    });
  } catch (e) { return false; }
}

// ── COLUMNS ──
const COLUMNS = [
  { id: 'fase1',     label: 'Klanten 1e fase',   color: '#2a5f8f' },
  { id: 'controle',  label: 'Controle Advocaat',  color: '#1a6e4a' },
  { id: 'concepten', label: 'Klanten concepten',  color: '#d4771a' },
  { id: 'getekend',  label: 'Getekend',           color: '#7a4f1e' },
  { id: 'advocaat',  label: 'Advocaat',           color: '#5b3d8c' },
  { id: 'rechtbank', label: 'Rechtbank',          color: '#c8390a' },
  { id: 'gemeente',  label: 'Gemeente',           color: '#4a4a4a' },
  { id: 'afronding', label: 'Afronding',          color: '#1a6e4a' },
];

// Fields per column. type: 'date' | 'yn' | 'info_btn' | 'docs_btn'
// Note: 'afspraak' is the DB field for "Concepten verstuurd"
const COLUMN_FIELDS = {
  fase1: {
    fields: [
      { label: 'Toevoeging bevestigd', key: 'bevestigd',  type: 'date' },
      { label: 'Klant gemaild',        key: 'gemaild',     type: 'yn'   },
      {                                                     type: 'info_btn' },
      { label: 'Actie voor',          key: 'actie_voor',     type: 'date' },
      { label: '1e concept',          key: 'eerste_concept', type: 'date' },
    ],
    hasOpm: true,
  },
  concepten: {
    fields: [
      { label: 'Concepten verstuurd', key: 'afspraak',            type: 'date' },
      { label: 'Reactie ontvangen',   key: 'reactie_ontvangen',   type: 'date' },
      { label: 'Concepten akkoord',   key: 'concepten_akkoord',   type: 'date' },
    ],
    hasOpm: true,
  },
  controle: {
    fields: [
      { label: 'Ter controle', key: 'ter_controle', type: 'date' },
      { label: 'Antwoord',     key: 'antwoord',     type: 'date' },
      { label: 'Verwerkt', key: 'naar_klanten', type: 'date' },
    ],
    hasOpm: true,
  },
  getekend: {
    fields: [
      { label: 'Klanten getekend', key: 'akkoord_klanten', type: 'date' },
      {                                                      type: 'docs_btn' },
      { label: 'Verstuurd Advocaat', key: 'docs_verstuurd',  type: 'date' },
    ],
    hasOpm: true,
  },
  advocaat: {
    fields: [
      { label: 'Belafspraak', key: 'belafspraak', type: 'date' },
      { label: 'Rechtbank',   key: 'rechtbank',   type: 'date' },
    ],
    hasOpm: true,
  },
  rechtbank: {
    fields: [
      { label: 'Beschikking',       key: 'beschikking',       type: 'date' },
      { label: 'Verstuurd klanten', key: 'verstuurd_klanten', type: 'date' },
      { label: 'Akkoord klanten',   key: 'akkoord_klanter',   type: 'date' },
    ],
    hasOpm: true,
  },
  gemeente: {
    fields: [
      { label: 'Verstuurd gemeente',     key: 'verstuurd_gemeente',    type: 'date' },
      { label: 'Inschrijving ontvangen', key: 'inschrijving_ontvangen', type: 'date' },
    ],
    hasOpm: true,
  },
  afronding: {
    fields: [
      { label: 'Ingelicht en beeindigd', key: 'beeindigd',              type: 'date' },
      { label: 'Vergoeding aangevraagd', key: 'vergoeding_aangevraagd', type: 'date' },
      { label: 'Vergoeding ontvangen',   key: 'vergoeding_ontvangen',   type: 'date' },
      { label: 'ZOZA afgerond',          key: 'zoza_afgerond',          type: 'date' },
    ],
    hasOpm: true,
  },
};

const MAX_FIELDS = 4; // pad all cards to this many field rows for uniform height

let rows = [], alarmSettings = {}, currentFilter = 'all';
let dragRowId = null;

// ── VALUE HELPERS ──
function hasValue(v) { return !!v && v !== 'n.v.t.'; }

function formatDate(val) {
  if (!val) return '—';
  if (val === 'n.v.t.') return 'n.v.t.';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function isOverdue(val) {
  if (!val || val === 'n.v.t.') return false;
  const d = new Date(val);
  if (isNaN(d)) return false;
  return d < new Date();
}

// ── COLUMN PLACEMENT ──
// Initial column is determined by the last-filled date field, checking from last to first column.
function getInitialColumn(row) {
  // afronding (no next phase)
  if (hasValue(row.zoza_afgerond) || hasValue(row.vergoeding_ontvangen) ||
      hasValue(row.vergoeding_aangevraagd) || hasValue(row.beeindigd))            return 'afronding';
  // inschrijving_ontvangen = last of gemeente → afronding
  if (hasValue(row.inschrijving_ontvangen))                                       return 'afronding';
  if (hasValue(row.verstuurd_gemeente))                                           return 'gemeente';
  // akkoord_klanter = last of rechtbank → gemeente
  if (hasValue(row.akkoord_klanter))                                              return 'gemeente';
  if (hasValue(row.verstuurd_klanten) || hasValue(row.beschikking))               return 'rechtbank';
  // rechtbank field = last of advocaat → rechtbank column
  if (hasValue(row.rechtbank))                                                    return 'rechtbank';
  if (hasValue(row.belafspraak))                                                  return 'advocaat';
  // docs_verstuurd = last of getekend → advocaat
  if (hasValue(row.docs_verstuurd))                                               return 'advocaat';
  // exception: Via Rechtbank = Nee (belafspraak = n.v.t.) → akkoord_klanten moves to afronding
  if (hasValue(row.akkoord_klanten) && row.belafspraak === 'n.v.t.')             return 'afronding';
  if (hasValue(row.akkoord_klanten))                                              return 'getekend';
  // concepten_akkoord = last of concepten → getekend
  if (hasValue(row.concepten_akkoord))                                            return 'getekend';
  if (hasValue(row.reactie_ontvangen) || hasValue(row.afspraak))                  return 'concepten';
  // naar_klanten = last of controle → concepten
  if (hasValue(row.naar_klanten))                                                 return 'concepten';
  if (hasValue(row.antwoord) || hasValue(row.ter_controle))                       return 'controle';
  // eerste_concept = last of fase1 → controle
  if (hasValue(row.eerste_concept))                                               return 'controle';
  return 'fase1';
}

function getColumn(row) {
  return row.kanban_column || getInitialColumn(row);
}

// ── ALARM CHECKS ──
function isActieVoorOverdue(row) {
  const v = row.actie_voor;
  if (!v || v === 'n.v.t.') return false;
  return new Date(v) < new Date();
}

function isBevestigdOverdue(row) {
  if (row.bevestigd) return false;
  const aangevraagd = row.aangevraagd;
  if (!aangevraagd || aangevraagd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_docs_teurlings) || 14;
  const deadline = new Date(aangevraagd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isTerControleOverdue(row) {
  if (row.ter_controle) return false;
  return !!(row.eerste_concept && row.eerste_concept !== 'n.v.t.');
}

function isVergoedingAangevraagdOverdue(row) {
  if (row.vergoeding_aangevraagd) return false;
  return !!(row.beeindigd && row.beeindigd !== 'n.v.t.');
}

function isVergoedingOntvangenOverdue(row) {
  if (row.vergoeding_ontvangen) return false;
  const aangevraagd = row.vergoeding_aangevraagd;
  if (!aangevraagd || aangevraagd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_vergoeding_rvr) || 0;
  if (!days) return false;
  const deadline = new Date(aangevraagd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isReactieOverdue(row) {
  if (row.reactie_ontvangen) return false;
  const afspraak = row.afspraak;
  if (!afspraak || afspraak === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_klanten_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(afspraak);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isConceptenAkkoordOverdue(row) {
  if (row.concepten_akkoord) return false;
  const reactie = row.reactie_ontvangen;
  if (!reactie || reactie === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_klanten_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(reactie);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isAntwoordOverdue(row) {
  if (row.antwoord) return false;
  const terControle = row.ter_controle;
  if (!terControle || terControle === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_teurlings_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(terControle);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isNaarKlantenOverdue(row) {
  if (row.naar_klanten) return false;
  return !!(row.antwoord && row.antwoord !== 'n.v.t.');
}

function isAkkoordKlantenOverdue(row) {
  if (row.akkoord_klanten) return false;
  return !!row.concepten_akkoord;
}

function isDocsVerstuurdOverdue(row) {
  if (row.docs_verstuurd) return false;
  return !!(row.akkoord_klanten && row.akkoord_klanten !== 'n.v.t.');
}

function isBelafspraakOverdue(row) {
  if (row.belafspraak) return false;
  return !!(row.docs_verstuurd && row.docs_verstuurd !== 'n.v.t.');
}

function isRechtbankOverdue(row) {
  if (row.rechtbank) return false;
  const belafspraak = row.belafspraak;
  if (!belafspraak || belafspraak === 'n.v.t.') return false;
  return new Date(belafspraak) < new Date();
}

function isBeschikkingOverdue(row) {
  if (row.beschikking) return false;
  const rechtbank = row.rechtbank;
  if (!rechtbank || rechtbank === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_beschikking) || 0;
  if (!days) return false;
  const deadline = new Date(rechtbank);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isVerstuurKlantenOverdue(row) {
  if (row.verstuurd_klanten) return false;
  return !!(row.beschikking && row.beschikking !== 'n.v.t.');
}

function isAkkoordKlanterOverdue(row) {
  if (row.akkoord_klanter) return false;
  const verstuurd = row.verstuurd_klanten;
  if (!verstuurd || verstuurd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_akkoord_beschikking) || 0;
  if (!days) return false;
  const deadline = new Date(verstuurd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isVerstuurGemeenteOverdue(row) {
  if (row.verstuurd_gemeente) return false;
  return !!(row.akkoord_klanter && row.akkoord_klanter !== 'n.v.t.');
}

function isInschrijvingOverdue(row) {
  if (row.inschrijving_ontvangen) return false;
  const verstuurd = row.verstuurd_gemeente;
  if (!verstuurd || verstuurd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_inschrijving_gemeente) || 0;
  if (!days) return false;
  const deadline = new Date(verstuurd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isBeeindigdOverdue(row) {
  if (row.beeindigd) return false;
  return !!(row.inschrijving_ontvangen && row.inschrijving_ontvangen !== 'n.v.t.');
}

function isZozaOverdue(row) {
  if (row.zoza_afgerond) return false;
  return !!(row.beeindigd && row.beeindigd !== 'n.v.t.' && row.vergoeding_ontvangen);
}

function isGeneralOverdue(row, key, prevKey) {
  if (row[key]) return false;
  return !!row[prevKey];
}

function isAfspraakOverdue(row) {
  if (row.afspraak) return false;
  if (row.naar_klanten && row.naar_klanten !== 'n.v.t.') return true;
  if (row.naar_klanten === 'n.v.t.') return !!row.eerste_concept;
  return false;
}

function isDocsUrgent(row) {
  if (row.docs_compleet === 'ja') return false;
  return !!(row.akkoord_klanten && row.akkoord_klanten !== 'n.v.t.');
}

function countAlarms(row) {
  let count = 0;
  if (row.gemaild === 'nee')                count++;
  if (isActieVoorOverdue(row))              count++;
  if (isBevestigdOverdue(row))              count++;
  if (isTerControleOverdue(row))            count++;
  if (isVergoedingAangevraagdOverdue(row))  count++;
  if (isVergoedingOntvangenOverdue(row))    count++;
  if (isReactieOverdue(row))                count++;
  if (isConceptenAkkoordOverdue(row))       count++;
  if (isAntwoordOverdue(row))               count++;
  if (isNaarKlantenOverdue(row))            count++;
  if (isAkkoordKlantenOverdue(row))         count++;


  if (isAfspraakOverdue(row))                                count++;
  if (isDocsVerstuurdOverdue(row))          count++;
  if (isBelafspraakOverdue(row))            count++;
  if (isRechtbankOverdue(row))              count++;
  if (isBeschikkingOverdue(row))            count++;
  if (isVerstuurKlantenOverdue(row))        count++;
  if (isAkkoordKlanterOverdue(row))         count++;
  if (isVerstuurGemeenteOverdue(row))       count++;
  if (isInschrijvingOverdue(row))           count++;
  if (isBeeindigdOverdue(row))              count++;
  if (isZozaOverdue(row))                   count++;
  if (isDocsUrgent(row))                    count++;
  return count;
}

const FIELD_ALARM_CHECKS = {
  gemaild:                r => r.gemaild === 'nee',
  bevestigd:              r => isBevestigdOverdue(r),
  actie_voor:             r => isActieVoorOverdue(r),
  reactie_ontvangen:      r => isReactieOverdue(r),
  concepten_akkoord:      r => isConceptenAkkoordOverdue(r),
  ter_controle:           r => isTerControleOverdue(r),
  antwoord:               r => isAntwoordOverdue(r),
  naar_klanten:           r => isNaarKlantenOverdue(r),
  akkoord_klanten:        r => isAkkoordKlantenOverdue(r),
  docs_verstuurd:         r => isDocsVerstuurdOverdue(r),
  belafspraak:            r => isBelafspraakOverdue(r),
  rechtbank:              r => isRechtbankOverdue(r),
  beschikking:            r => isBeschikkingOverdue(r),
  verstuurd_klanten:      r => isVerstuurKlantenOverdue(r),
  akkoord_klanter:        r => isAkkoordKlanterOverdue(r),
  verstuurd_gemeente:     r => isVerstuurGemeenteOverdue(r),
  inschrijving_ontvangen: r => isInschrijvingOverdue(r),
  beeindigd:              r => isBeeindigdOverdue(r),
  vergoeding_aangevraagd: r => isVergoedingAangevraagdOverdue(r),
  vergoeding_ontvangen:   r => isVergoedingOntvangenOverdue(r),
  zoza_afgerond:          r => isZozaOverdue(r),


  afspraak:               r => isAfspraakOverdue(r),
};

// ── SORT ──
let globalSort = 'alarm';

function sortColRows(colRows, colId) {
  const sort = globalSort;
  const firstDateKey = (COLUMN_FIELDS[colId]?.fields || []).find(f => f?.type === 'date')?.key;
  return [...colRows].sort((a, b) => {
    if (sort === 'naam') return (a.klant || '').localeCompare(b.klant || '', 'nl');
    if (sort === 'datum' && firstDateKey) {
      const ta = a[firstDateKey] && a[firstDateKey] !== 'n.v.t.' ? new Date(a[firstDateKey]).getTime() : Infinity;
      const tb = b[firstDateKey] && b[firstDateKey] !== 'n.v.t.' ? new Date(b[firstDateKey]).getTime() : Infinity;
      return ta - tb;
    }
    if (a.flagged !== b.flagged) return (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0);
    const ac = countAlarms(a), bc = countAlarms(b);
    if (ac !== bc) return bc - ac;
    return (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0);
  });
}

// ── RENDER BOARD ──
function renderBoard() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';

  COLUMNS.forEach(col => {
    const colRows = sortColRows(rows.filter(r => getColumn(r) === col.id), col.id);

    const colEl = document.createElement('div');
    colEl.className = 'kanban-col' + (col.id === 'fase1' ? ' kanban-col-wide' : '');

    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.style.background = col.color;

    const title = document.createElement('h2');
    title.textContent = col.label;

    const countBadge = document.createElement('span');
    countBadge.className = 'kanban-col-count';
    countBadge.textContent = colRows.length;

    header.appendChild(title);
    header.appendChild(countBadge);
    colEl.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'kanban-cards';
    cardsWrap.dataset.colId = col.id;

    cardsWrap.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cardsWrap.classList.add('drag-over');
    });
    cardsWrap.addEventListener('dragleave', e => {
      if (!cardsWrap.contains(e.relatedTarget)) cardsWrap.classList.remove('drag-over');
    });
    cardsWrap.addEventListener('drop', async e => {
      e.preventDefault();
      cardsWrap.classList.remove('drag-over');
      if (!dragRowId) return;
      const row = rows.find(r => r.id === dragRowId);
      if (!row || getColumn(row) === col.id) return;
      row.kanban_column = col.id;
      renderBoard();
      await db.from('dossiers').update({ kanban_column: col.id }).eq('id', row.id);
    });

    if (colRows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kanban-empty';
      empty.textContent = 'Geen dossiers';
      cardsWrap.appendChild(empty);
    } else {
      colRows.forEach(row => cardsWrap.appendChild(renderCard(row, col)));
    }

    colEl.appendChild(cardsWrap);
    board.appendChild(colEl);
  });
  requestAnimationFrame(syncKanbanScroll);
}

function syncKanbanScroll() {
  const board = document.getElementById('kanbanBoard');
  const track = document.getElementById('kanbanScrollTrack');
  const slider = document.getElementById('kanbanScroller');
  if (!board || !track || !slider) return;
  const max = board.scrollWidth - board.clientWidth;
  track.style.display = max > 10 ? 'block' : 'none';
  slider.max = max;
  slider.value = board.scrollLeft;
}

// ── RENDER CARD ──
function renderCard(row, col) {
  const alarmCount = countAlarms(row);
  const card = document.createElement('div');
  card.className = 'card' + (row.zoza_afgerond && row.zoza_afgerond !== 'n.v.t.' ? ' card-done' : '');
  card.dataset.cardId = row.id;
  card.dataset.klant = (row.klant || '').toLowerCase();
  card.dataset.hasAlarm = alarmCount > 0 ? '1' : '0';
  card.draggable = true;

  card.addEventListener('dragstart', e => {
    dragRowId = row.id;
    setTimeout(() => card.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragRowId = null;
  });

  // Colored top border
  const topBorder = document.createElement('div');
  topBorder.className = 'card-top-border';
  topBorder.style.background = col.color;
  card.appendChild(topBorder);

  const body = document.createElement('div');
  body.className = 'card-body';

  // ── Header: name + alarm badge + flag button ──
  const headerRow = document.createElement('div');
  headerRow.className = 'card-header';

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = row.klant || '(Naamloos)';

  const badges = document.createElement('div');
  badges.className = 'card-badges';

  if (alarmCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'alarm-badge';
    badge.textContent = alarmCount;
    badges.appendChild(badge);
  }

  const flagBtn = document.createElement('button');
  flagBtn.className = 'flag-btn' + (row.flagged ? ' flagged' : '');
  flagBtn.title = row.flagged ? 'Markering verwijderen' : 'Markeren';
  flagBtn.addEventListener('click', e => { e.stopPropagation(); toggleFlag(row, flagBtn); });
  badges.appendChild(flagBtn);

  headerRow.appendChild(name);
  headerRow.appendChild(badges);
  body.appendChild(headerRow);

  // ── Progress dots (one per column) ──
  const colOrder = COLUMNS.map(c => c.id);
  const currentIdx = colOrder.indexOf(col.id);
  const dots = document.createElement('div');
  dots.className = 'card-dots';
  COLUMNS.forEach((c, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i <= currentIdx ? ' reached' : '');
    if (i <= currentIdx) dot.style.background = c.color;
    dots.appendChild(dot);
  });
  body.appendChild(dots);

  // ── Column-specific field rows (always padded to MAX_FIELDS) ──
  const colDef = COLUMN_FIELDS[col.id] || { fields: [], hasOpm: false };
  const padded = colDef.fields.slice();
  while (padded.length < MAX_FIELDS) padded.push(null);

  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'card-fields';

  padded.forEach(field => {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'card-field-row';

    if (!field) {
      fieldRow.style.visibility = 'hidden';
      fieldRow.appendChild(document.createElement('span'));
      fieldsWrap.appendChild(fieldRow);
      return;
    }

    if (field.type === 'date') {
      const val = row[field.key];
      if (FIELD_ALARM_CHECKS[field.key] && FIELD_ALARM_CHECKS[field.key](row)) fieldRow.classList.add('alarm');

      const lbl = document.createElement('span');
      lbl.className = 'card-field-label';
      lbl.textContent = field.label;

      const valEl = document.createElement('span');
      valEl.className = 'card-field-val' + (!val ? ' empty' : '');
      valEl.textContent = formatDate(val);

      fieldRow.appendChild(lbl);
      fieldRow.appendChild(valEl);

    } else if (field.type === 'yn') {
      const val = row[field.key];
      if (FIELD_ALARM_CHECKS[field.key] && FIELD_ALARM_CHECKS[field.key](row)) fieldRow.classList.add('alarm');

      const lbl = document.createElement('span');
      lbl.className = 'card-field-label';
      lbl.textContent = field.label;

      const valEl = document.createElement('span');
      valEl.className = 'card-field-val' + (val === 'ja' ? ' ja' : val === 'nee' ? ' nee' : ' empty');
      valEl.textContent = val || '—';

      fieldRow.appendChild(lbl);
      fieldRow.appendChild(valEl);

    } else if (field.type === 'info_btn') {
      fieldRow.className = 'card-field-row card-field-btn-row';
      const complete = isInfoComplete(row.info_data);
      const btn = document.createElement('a');
      btn.className = 'card-status-btn' + (complete ? ' complete' : '');
      btn.textContent = complete ? '✓ Info compleet' : 'Info incompleet';
      btn.href = `info.html?id=${row.id}`;
      btn.addEventListener('click', e => e.stopPropagation());
      fieldRow.appendChild(btn);

    } else if (field.type === 'docs_btn') {
      fieldRow.className = 'card-field-row card-field-btn-row';
      const complete = row.docs_compleet === 'ja';
      const urgent = !complete && isDocsUrgent(row);
      const link = document.createElement('a');
      link.className = 'info-link-btn' + (complete ? ' complete' : urgent ? ' urgent' : '');
      link.textContent = complete ? '✓ Aktes compleet' : 'Aktes incompleet';
      link.href = `info.html?id=${row.id}`;
      link.addEventListener('click', e => e.stopPropagation());
      fieldRow.appendChild(link);
    }

    fieldsWrap.appendChild(fieldRow);
  });

  body.appendChild(fieldsWrap);

  // ── Opmerkingen (always rendered; invisible for columns without it) ──
  const opmText = row.opmerkingen && row.opmerkingen.trim();
  const opm = document.createElement('div');
  opm.className = 'card-opm'
    + (!colDef.hasOpm ? ' card-opm-hidden' : '')
    + (!opmText ? ' card-opm-empty' : '');
  opm.textContent = opmText ? opmText.slice(0, 100) : '';
  body.appendChild(opm);

  card.appendChild(body);

  card.addEventListener('click', () => {
    if (row.id) window.location.href = `info.html?id=${row.id}&tab=klantstatus`;
  });

  return card;
}

// ── SEARCH / ALARM FILTER ──
function setSort(val) {
  globalSort = val;
  renderBoard();
}

function setFilter(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterCards(document.getElementById('searchInput').value);
}

function filterCards(query) {
  const q = (query || '').trim().toLowerCase();
  COLUMNS.forEach(col => {
    const cardsWrap = document.querySelector(`[data-col-id="${col.id}"]`);
    if (!cardsWrap) return;

    const cards = cardsWrap.querySelectorAll('.card');
    let visible = 0;
    cards.forEach(card => {
      const matchSearch = !q || (card.dataset.klant || '').includes(q);
      const matchFilter = currentFilter !== 'alarm' || card.dataset.hasAlarm === '1';
      const match = matchSearch && matchFilter;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    let emptyEl = cardsWrap.querySelector('.kanban-empty');
    if (visible === 0 && cards.length > 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'kanban-empty';
        cardsWrap.appendChild(emptyEl);
      }
      emptyEl.textContent = q ? 'Geen resultaten' : 'Geen dossiers';
      emptyEl.style.display = '';
    } else if (emptyEl) {
      emptyEl.style.display = visible === 0 ? '' : 'none';
    }

    const hdr = cardsWrap.previousElementSibling;
    if (hdr) {
      const badge = hdr.querySelector('.kanban-col-count');
      if (badge) badge.textContent = visible;
    }
  });
}

// ── FLAG ──
async function toggleFlag(row, btn) {
  row.flagged = !row.flagged;
  btn.classList.toggle('flagged', row.flagged);
  btn.title = row.flagged ? 'Markering verwijderen' : 'Markeren';
  const { error } = await db.from('dossiers').update({ flagged: row.flagged }).eq('id', row.id);
  if (error) {
    row.flagged = !row.flagged;
    btn.classList.toggle('flagged', row.flagged);
    showToast('Opslaan mislukt');
  }
}

// ── DATA ──
async function loadRows() {
  const { data, error } = await db.from('dossiers').select('*').order('created_at', { ascending: true });
  if (error) { showToast('Fout bij laden: ' + error.message); return; }
  rows = data || [];
  renderBoard();
}

function subscribeToChanges() {
  db.channel('dossiers-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dossiers' }, payload => {
      if (payload.eventType === 'INSERT') {
        if (!rows.find(r => r.id === payload.new.id)) {
          rows.push(payload.new);
          renderBoard();
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = rows.findIndex(r => r.id === payload.new.id);
        if (idx !== -1) { rows[idx] = payload.new; renderBoard(); }
      } else if (payload.eventType === 'DELETE') {
        const idx = rows.findIndex(r => r.id === payload.old.id);
        if (idx !== -1) { rows.splice(idx, 1); renderBoard(); }
      }
    })
    .subscribe();
}

async function addRow() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  const { data, error } = await db.from('dossiers').insert({ klant: '' }).select().single();
  if (error || !data) {
    document.getElementById('loadingOverlay').style.display = 'none';
    showToast('Aanmaken mislukt');
    return;
  }
  window.location.href = `info.html?id=${data.id}`;
}

// ── AUTH ──
async function signIn() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');
  if (!email || !password) { showLoginMsg('Vul e-mailadres en wachtwoord in.', true); return; }
  btn.disabled = true; btn.textContent = 'Inloggen...';
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Inloggen';
  if (error) showLoginMsg('Onjuiste gegevens.', true);
  else await enterApp(data.user);
}

function showLoginMsg(text, isError) {
  const msg = document.getElementById('loginMsg');
  msg.textContent = text;
  msg.className = 'login-msg' + (isError ? ' error' : '');
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

function showLogin() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function enterApp(user) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('userEmail').textContent = user.email;

  alarmSettings = JSON.parse(localStorage.getItem('alarmsettings') || '{}');
  try {
    const { data: alarmData } = await db.from('alarmsettings').select('settings').eq('id', 'main').maybeSingle();
    if (alarmData && alarmData.settings) {
      alarmSettings = alarmData.settings;
      localStorage.setItem('alarmsettings', JSON.stringify(alarmData.settings));
    }
    const loadTimeout = new Promise(resolve => setTimeout(resolve, 8000));
    await Promise.race([loadRows(), loadTimeout]);
    subscribeToChanges();
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    initKanbanScroll();
  }
}

function initKanbanScroll() {
  const board  = document.getElementById('kanbanBoard');
  const slider = document.getElementById('kanbanScroller');
  if (!board || !slider) return;
  slider.addEventListener('input', () => { board.scrollLeft = parseInt(slider.value); });
  board.addEventListener('scroll', () => { slider.value = board.scrollLeft; });
  window.addEventListener('resize', syncKanbanScroll);
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── INIT ──
async function init() {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(), 5000));
  try {
    const { data: { session } } = await Promise.race([db.auth.getSession(), timeout]);
    if (session) {
      await enterApp(session.user);
    } else {
      showLogin();
    }
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && document.getElementById('appScreen').style.display === 'none') {
        await enterApp(session.user);
      }
    });
  } catch (e) {
    showLogin();
  }
}

document.getElementById('emailInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('passwordInput').focus(); });
document.getElementById('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });

window.addEventListener('pageshow', e => {
  if (e.persisted && document.getElementById('loadingOverlay').style.display !== 'none') {
    window.location.reload();
  }
});

init();
