const SUPABASE_URL      = 'https://iubmajperipojqtlhwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1Ym1hanBlcmlwb2pxdGxod3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODM2MzcsImV4cCI6MjA5NDA1OTYzN30.IiUQAGO9rFuSC2LQlFr6dzmQPatCS-N7mjZdJzEQRNs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PHASES = [
  { id: 'nieuw',     label: 'Nieuw',        color: '#4a4a4a', soft: '#e5e5e0' },
  { id: 'ph1',       label: 'Toevoegingen', color: '#2a5f8f', soft: '#ddeaf5' },
  { id: 'pha',       label: 'Klanten',      color: '#d4771a', soft: '#fce8cc' },
  { id: 'ph2',       label: 'Teurlings',    color: '#1a6e4a', soft: '#d5ede2' },
  { id: 'ph3',       label: 'Rechtbank',    color: '#7a4f1e', soft: '#edddd0' },
  { id: 'ph4',       label: 'Gemeente',     color: '#5b3d8c', soft: '#e8dff5' },
  { id: 'ph5',       label: 'Afhandeling',  color: '#c8390a', soft: '#f5ddd7' },
  { id: 'afgerond',  label: 'Afgerond',     color: '#1a6e4a', soft: '#d5ede2' },
];

// Progress phases (not nieuw/afgerond) for the dot row
const PROGRESS_PHASES = ['ph1', 'pha', 'ph2', 'ph3', 'ph4', 'ph5'];

let rows = [], alarmSettings = {};

// ── PHASE DETECTION ──
function hasValue(v) { return !!v && v !== 'n.v.t.'; }

function getPhase(row) {
  if (hasValue(row.zoza_afgerond))                                                                              return 'afgerond';
  if (hasValue(row.beeindigd) || hasValue(row.vergoeding_aangevraagd) || hasValue(row.vergoeding_ontvangen))   return 'ph5';
  if (hasValue(row.inschrijving_ontvangen) || hasValue(row.verstuurd_gemeente))                                 return 'ph4';
  if (hasValue(row.akkoord_klanter) || hasValue(row.verstuurd_klanten) || hasValue(row.beschikking) ||
      hasValue(row.rechtbank) || hasValue(row.belafspraak) || hasValue(row.docs_verstuurd))                     return 'ph3';
  if (hasValue(row.akkoord_klanten) || hasValue(row.naar_klanten) || hasValue(row.antwoord) || hasValue(row.ter_controle)) return 'ph2';
  if (hasValue(row.concepten_akkoord) || hasValue(row.reactie_ontvangen) || hasValue(row.datum_afspraak) || hasValue(row.actie_voor)) return 'pha';
  if (hasValue(row.bevestigd) || hasValue(row.aangevraagd))                                                    return 'ph1';
  return 'nieuw';
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
  return !!(row.concepten_akkoord && row.concepten_akkoord !== 'n.v.t.');
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
  return !!(row.naar_klanten && row.naar_klanten !== 'n.v.t.');
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

function countAlarms(row) {
  let count = 0;
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
  return count;
}

// ── DATE HELPERS ──
function formatDate(val) {
  if (!val || val === 'n.v.t.') return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(val) {
  if (!val || val === 'n.v.t.') return false;
  const d = new Date(val);
  if (isNaN(d)) return false;
  return d < new Date();
}

// ── KEY DATES PER PHASE ──
const PHASE_DATE_FIELDS = {
  nieuw:    [],
  ph1:      [{ label: 'Aangevraagd', key: 'aangevraagd' }, { label: 'Bevestigd', key: 'bevestigd' }],
  pha:      [{ label: 'Afspraak datum', key: 'datum_afspraak' }, { label: 'Actie voor', key: 'actie_voor' }, { label: 'Concepten akkoord', key: 'concepten_akkoord' }],
  ph2:      [{ label: 'Ter controle', key: 'ter_controle' }, { label: 'Antwoord', key: 'antwoord' }, { label: 'Naar klanten', key: 'naar_klanten' }],
  ph3:      [{ label: 'Rechtbank', key: 'rechtbank' }, { label: 'Beschikking', key: 'beschikking' }],
  ph4:      [{ label: 'Verstuurd gemeente', key: 'verstuurd_gemeente' }, { label: 'Inschrijving ontvangen', key: 'inschrijving_ontvangen' }],
  ph5:      [{ label: 'Beeindigd', key: 'beeindigd' }, { label: 'Vergoeding ontvangen', key: 'vergoeding_ontvangen' }, { label: 'ZOZA afgerond', key: 'zoza_afgerond' }],
  afgerond: [{ label: 'ZOZA afgerond', key: 'zoza_afgerond' }],
};

// ── RENDER BOARD ──
function renderBoard() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';

  PHASES.forEach(phase => {
    const phaseRows = rows
      .filter(r => getPhase(r) === phase.id)
      .sort((a, b) => {
        if (a.flagged !== b.flagged) return (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0);
        const ac = countAlarms(a), bc = countAlarms(b);
        if (ac !== bc) return bc - ac;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });

    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.dataset.phase = phase.id;

    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.style.background = phase.color;

    const title = document.createElement('h2');
    title.textContent = phase.label;

    const countBadge = document.createElement('span');
    countBadge.className = 'kanban-col-count';
    countBadge.dataset.countEl = phase.id;
    countBadge.textContent = phaseRows.length;

    header.appendChild(title);
    header.appendChild(countBadge);
    col.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'kanban-cards';
    cardsWrap.dataset.cardsWrap = phase.id;

    if (phaseRows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kanban-empty';
      empty.dataset.emptyPlaceholder = phase.id;
      empty.textContent = 'Geen dossiers';
      cardsWrap.appendChild(empty);
    } else {
      phaseRows.forEach(row => {
        cardsWrap.appendChild(renderCard(row, phase));
      });
    }

    col.appendChild(cardsWrap);
    board.appendChild(col);
  });
}

function renderCard(row, phase) {
  const alarmCount = countAlarms(row);
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.cardId = row.id;
  card.dataset.klant = (row.klant || '').toLowerCase();

  // Colored top border
  const topBorder = document.createElement('div');
  topBorder.className = 'card-top-border';
  topBorder.style.background = phase.color;
  card.appendChild(topBorder);

  const body = document.createElement('div');
  body.className = 'card-body';

  // Header row: name + badges
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

  // Progress dots: ph1 pha ph2 ph3 ph4 ph5
  const phaseOrder = ['nieuw','ph1','pha','ph2','ph3','ph4','ph5','afgerond'];
  const currentPhaseIndex = phaseOrder.indexOf(phase.id);

  const dots = document.createElement('div');
  dots.className = 'card-dots';

  PROGRESS_PHASES.forEach(pid => {
    const pIdx = phaseOrder.indexOf(pid);
    const phaseInfo = PHASES.find(p => p.id === pid);
    const dot = document.createElement('span');
    dot.className = 'dot' + (currentPhaseIndex >= pIdx ? ' reached' : '');
    if (currentPhaseIndex >= pIdx && phaseInfo) {
      dot.style.background = phaseInfo.color;
    }
    dots.appendChild(dot);
  });
  body.appendChild(dots);

  // Key dates for this phase
  const dateFields = PHASE_DATE_FIELDS[phase.id] || [];
  if (dateFields.length > 0) {
    const datesWrap = document.createElement('div');
    datesWrap.className = 'card-dates';
    dateFields.forEach(field => {
      const val = row[field.key];
      const formatted = formatDate(val);
      const overdue = val && val !== 'n.v.t.' && isOverdue(val);

      const dateRow = document.createElement('div');
      dateRow.className = 'card-date-row';

      const lbl = document.createElement('span');
      lbl.className = 'card-date-label';
      lbl.textContent = field.label;

      const valEl = document.createElement('span');
      valEl.className = 'card-date-val' + (overdue ? ' overdue' : '') + (!hasValue(val) ? ' empty' : '');
      valEl.textContent = formatted;

      dateRow.appendChild(lbl);
      dateRow.appendChild(valEl);
      datesWrap.appendChild(dateRow);
    });
    body.appendChild(datesWrap);
  }

  // Opmerkingen preview
  if (row.opmerkingen && row.opmerkingen.trim()) {
    const opm = document.createElement('div');
    opm.className = 'card-opm';
    opm.textContent = row.opmerkingen.trim().slice(0, 80);
    body.appendChild(opm);
  }

  card.appendChild(body);

  // Click to navigate (excluding flag button)
  card.addEventListener('click', () => {
    if (row.id) window.location.href = `info.html?id=${row.id}`;
  });

  return card;
}

// ── SEARCH FILTER ──
function filterCards(query) {
  const q = (query || '').trim().toLowerCase();
  PHASES.forEach(phase => {
    const cardsWrap = document.querySelector(`[data-cards-wrap="${phase.id}"]`);
    if (!cardsWrap) return;

    const cards = cardsWrap.querySelectorAll('.card');
    let visible = 0;

    cards.forEach(card => {
      const klant = card.dataset.klant || '';
      const match = !q || klant.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    let emptyEl = cardsWrap.querySelector('[data-empty-placeholder]');
    if (visible === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'kanban-empty';
        emptyEl.dataset.emptyPlaceholder = phase.id;
        cardsWrap.appendChild(emptyEl);
      }
      emptyEl.textContent = q ? 'Leeg' : 'Geen dossiers';
      emptyEl.style.display = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
    }

    const countEl = document.querySelector(`[data-count-el="${phase.id}"]`);
    if (countEl) countEl.textContent = visible;
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
  const msg      = document.getElementById('loginMsg');
  if (!email || !password) { showLoginMsg('Vul e-mailadres en wachtwoord in.', true); return; }
  btn.disabled = true; btn.textContent = 'Inloggen...';
  const { error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Inloggen';
  if (error) showLoginMsg('Onjuiste gegevens.', true);
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
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
  }
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

// Keyboard shortcut
document.getElementById('emailInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('passwordInput').focus(); });
document.getElementById('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });

// pageshow fix: only reload if loading overlay is stuck (bfcache)
window.addEventListener('pageshow', e => {
  if (e.persisted && document.getElementById('loadingOverlay').style.display !== 'none') {
    window.location.reload();
  }
});

init();
