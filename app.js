// ========================================================================
//  ICT.OS — TRADING JOURNAL — PWA
//  Backend : Supabase (auth + base de données, synchronisé multi-appareils)
// ========================================================================

// ---- 1) CONFIGURATION ----
const SUPABASE_URL = "https://xyiictiolluhozyngvsk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ym9XO56FKMTZjLBaGJh7-g_X0qlI-9m";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- 2) CONSTANTES ----
const DIRECTIONS = ["Long", "Short"];
const SESSIONS = ["Asia", "London", "NY"];
const RISK_LEVELS = [0.25, 0.50, 1.00];
const RESULTATS = ["Win", "Loss", "Breakeven"];
const IMPACTS = ["Faible", "Moyen", "Élevé"];
const STATUTS_GOAL = ["En cours", "Atteint", "Manqué"];

// ---- Types de news économiques (hiérarchie ICT — du plus au moins volatil) ----
const EVENT_TYPES = ["FOMC / FED", "Powell Speech", "NFP", "CPI", "PPI", "GDP", "PMI", "Retail Sales", "Unemployment Claims", "Trade Balance", "Autre"];
const HIGH_IMPACT_TYPES = ["FOMC / FED", "NFP", "CPI", "PPI"];

// ---- Checklists types ICT (issues de tes notes "When Avoid Trading ?") ----
const WEEKLY_BIAS_TEMPLATE = [
  "Bad Market Conditions — Previous Day Large Range Day",
  "Bad Market Conditions — EQ of Higher Time Frame Dealing Range",
  "Bad Market Conditions — Clustering of NWOG / NDOG",
  "Bad Market Conditions — Weekly Target Reached",
  "Bad Market Conditions — Friday on a TGIF setup reached on Thursday",
  "Bad Market Conditions — Multiple return intraweek inside Current NWOG",
  "London Session — Yesterday Large Range Day x2 ADR",
  "London Session — 3 Consecutive Up/Down Close Candle",
  "London Session — Before a Long Week End",
  "London Session — After a Holiday",
  "London Session — After a FOMC Event",
];
const DAILY_BIAS_TEMPLATE = [
  "Pre-Market — FOMC Days : do it early or do nothing",
  "Pre-Market — Elongated move overnight → wait 09:30am",
  "AM Session — After a large range day → avoid AM, trade PM",
  "AM Session — If the move was already delivered at 09:30am → trade PM",
  "AM Session — Large range overnight → choppy AM conditions",
  "AM Session — After Holiday → avoid AM",
  "AM Session — Avoid AM the day after a FOMC event",
  "AM Session — Fed Chair Powell speaks AM → come back after Lunch",
  "AM Session — Small ORG",
  "PM Session — Day before a Holiday → trade AM, avoid PM",
  "PM Session — Day before FED Chair Powell speaks → trade AM, avoid PM",
  "Last Hour — Avoid on a Trending Day",
];

const STATUT_COLORS = {
  "Long": "var(--info)", "Short": "var(--warning)",
  "Win": "var(--win)", "Loss": "var(--loss)", "Breakeven": "var(--muted)",
  "Asia": "var(--info)", "London": "var(--accent)", "NY": "var(--warning)",
  "Faible": "var(--muted)", "Moyen": "var(--warning)", "Élevé": "var(--danger)",
  "En cours": "var(--info)", "Atteint": "var(--win)", "Manqué": "var(--loss)",
};

// ---- 3) ETAT LOCAL ----
let currentUser = null;
let cache = { accounts: [], setups: [], trades: [], daily_reviews: [], weekly_planners: [], economic_news: [], daily_planners: [], goals: [] };
let currentPage = "dashboard";
let modalContext = null;

// ---- 4) HELPERS ----
function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStr() { const d = new Date(); return d.toISOString().slice(0, 16).replace("T", " "); }
function fmtDateFR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function daysUntil(iso) {
  if (!iso) return Infinity;
  const a = new Date(String(iso).slice(0, 10) + "T00:00:00"), b = new Date(todayStr() + "T00:00:00");
  return Math.round((a - b) / 86400000);
}
function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay() || 7; // dimanche = 7
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
function badge(text, color) {
  if (!text) return "";
  return `<span class="badge" style="background:${color || "var(--muted)"}">${text}</span>`;
}
function escapeAttr(v) { return String(v == null ? "" : v).replace(/"/g, "&quot;"); }
function findAccount(id) { return cache.accounts.find(a => a.id === id); }
function findSetup(id) { return cache.setups.find(s => s.id === id); }
function findReview(id) { return cache.daily_reviews.find(r => r.id === id); }
function accountLabel(a) { return a ? (a.nom || "Compte #" + a.id) : "—"; }
function setupLabel(s) { return s ? (s.nom || "Setup #" + s.id) : "—"; }

// ---- 5) SUPABASE CRUD GENERIQUE ----
async function fetchAll(table, orderCol = "id", ascending = false) {
  const { data, error } = await sb.from(table).select("*").order(orderCol, { ascending });
  if (error) { showToast("Erreur chargement " + table); console.error(error); return []; }
  return data;
}
async function insertRow(table, values) {
  values.user_id = currentUser.id;
  values.date_creation = values.date_creation || nowStr();
  const { data, error } = await sb.from(table).insert(values).select().single();
  if (error) { showToast("Échec enregistrement : " + (error.message || error.hint || "erreur inconnue")); console.error(error); return null; }
  return data;
}
async function updateRow(table, id, values) {
  const { data, error } = await sb.from(table).update(values).eq("id", id).select().single();
  if (error) { showToast("Échec mise à jour : " + (error.message || error.hint || "erreur inconnue")); console.error(error); return null; }
  return data;
}
async function deleteRow(table, id) {
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) { showToast("Erreur suppression"); console.error(error); return false; }
  return true;
}
async function refreshCache() {
  const [accounts, setups, trades, daily_reviews, weekly_planners, economic_news, daily_planners, goals] = await Promise.all([
    fetchAll("accounts", "nom", true),
    fetchAll("setups", "nom", true),
    fetchAll("trades", "trade_date", false),
    fetchAll("daily_reviews", "review_date", false),
    fetchAll("weekly_planners", "week_start_date", false),
    fetchAll("economic_news", "date_event", false),
    fetchAll("daily_planners", "planner_date", false),
    fetchAll("goals"),
  ]);
  cache = { accounts, setups, trades, daily_reviews, weekly_planners, economic_news, daily_planners, goals };
}

// ---- calculs comptes (Total Balance, Total Profit, ROI, nombre de trades) ----
function accountStats(a) {
  const trades = cache.trades.filter(t => t.account_id === a.id);
  const totalProfit = round2(trades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const totalBalance = round2((Number(a.starting_balance) || 0) + totalProfit);
  const roi = a.starting_balance ? round2((totalProfit / a.starting_balance) * 100) : 0;
  return { totalProfit, totalBalance, roi, nbTrades: trades.length };
}
function setupStats(s) {
  const trades = cache.trades.filter(t => t.setup_id === s.id);
  const wins = trades.filter(t => t.resultat === "Win").length;
  const winrate = trades.length ? round2((wins / trades.length) * 100) : null;
  return { nbTrades: trades.length, winrate };
}

// ========================================================================
//  AUTHENTIFICATION
// ========================================================================
let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  const t = document.getElementById("auth-title"), s = document.getElementById("auth-sub");
  const sub = document.getElementById("auth-submit"), st = document.getElementById("auth-switch-text"), sl = document.getElementById("auth-switch-link");
  document.getElementById("auth-error").style.display = "none";
  if (mode === "login") { t.textContent = "Connexion"; s.textContent = "ICT.OS — accède à ton compte"; sub.textContent = "Se connecter"; st.textContent = "Pas encore de compte ?"; sl.textContent = "Créer un compte"; }
  else { t.textContent = "Créer un compte"; s.textContent = "ICT.OS — synchronise tes données"; sub.textContent = "Créer mon compte"; st.textContent = "Déjà un compte ?"; sl.textContent = "Se connecter"; }
}
function authError(msg) { const el = document.getElementById("auth-error"); el.textContent = msg; el.style.display = "block"; }
async function handleAuthSubmit() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) { authError("Renseigne un email et un mot de passe."); return; }
  if (authMode === "login") {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { authError(error.message); return; }
    onLoggedIn(data.user);
  } else {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { authError(error.message); return; }
    if (data.user && !data.session) { authError("Compte créé — vérifie ta boîte mail pour confirmer, puis connecte-toi."); setAuthMode("login"); }
    else if (data.user) onLoggedIn(data.user);
  }
}
async function onLoggedIn(user) {
  currentUser = user;
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
  document.getElementById("user-email-lbl").textContent = user.email;
  await refreshCache();
  showPage("dashboard");
}
async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById("app-screen").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
}

// ========================================================================
//  NAVIGATION
// ========================================================================
function showPage(key) {
  currentPage = key;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === key));
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === "page-" + key));
  renderPage(key);
  closeMobileMenu();
}
function openMobileMenu() { document.getElementById("sidebar").classList.add("open"); document.getElementById("sidebar-overlay").classList.add("open"); }
function closeMobileMenu() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("sidebar-overlay").classList.remove("open"); }
function renderPage(key) {
  if (key === "dashboard") renderDashboard();
  else if (key === "journal") renderJournal();
  else if (key === "review") renderReview();
  else if (key === "weekly") renderWeekly();
  else if (key === "daily") renderDaily();
  else if (key === "stats") renderStats();
  else if (key === "goals") renderGoals();
  else if (key === "accounts") renderAccounts();
  else if (key === "setups") renderSetups();
}
async function refreshAll() { await refreshCache(); renderPage(currentPage); }
function goToFilter(page, selectId, value) {
  showPage(page);
  const sel = document.getElementById(selectId);
  if (sel) { sel.value = value; renderPage(page); }
}
function ensureFilterOptions(selectId, options) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.filled) return;
  options.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.value !== undefined ? o.value : o;
    opt.textContent = o.label !== undefined ? o.label : o;
    sel.appendChild(opt);
  });
  sel.dataset.filled = "1";
  sel.addEventListener("change", () => renderPage(currentPage));
}

// ========================================================================
//  DASHBOARD
// ========================================================================
function renderDashboard() {
  const stats = cache.accounts.map(a => ({ a, s: accountStats(a) }));
  const totalBalance = round2(stats.reduce((s, x) => s + x.s.totalBalance, 0));
  const totalProfit = round2(stats.reduce((s, x) => s + x.s.totalProfit, 0));
  const totalTrades = cache.trades.length;
  const wins = cache.trades.filter(t => t.resultat === "Win").length;
  const winrate = totalTrades ? round2((wins / totalTrades) * 100) : 0;
  const goalsEnCours = cache.goals.filter(g => g.statut === "En cours").length;
  const today = todayStr();
  const monthStart = today.slice(0, 7);
  const tradesCeMois = cache.trades.filter(t => (t.trade_date || "").startsWith(monthStart)).length;

  const cards = [
    ["💰", `$${totalBalance.toFixed(2)}`, "Total Balance", () => showPage("accounts"), null],
    ["📈", `$${totalProfit.toFixed(2)}`, "Total Profit", () => showPage("accounts"), totalProfit >= 0 ? "win" : "loss"],
    ["🎯", `${winrate}%`, "Winrate global", () => showPage("stats"), null],
    ["📝", tradesCeMois, "Trades ce mois", () => showPage("journal"), null],
    ["🏆", goalsEnCours, "Goals en cours", () => showPage("goals"), null],
  ];
  const wrap = document.getElementById("dash-cards");
  wrap.innerHTML = cards.map((c, i) => `
    <div class="stat-card clickable" data-i="${i}">
      <div style="font-size:20px;">${c[0]}</div>
      <div class="num ${c[4] || ""}">${c[1]}</div>
      <div class="label">${c[2]}</div>
    </div>`).join("");
  wrap.querySelectorAll(".stat-card").forEach(el => el.addEventListener("click", () => cards[Number(el.dataset.i)][3]()));

  document.getElementById("dash-accounts").innerHTML = stats.length ? stats.map(({ a, s }) => `
    <tr onclick="openAccountDialog(${a.id})" style="cursor:pointer;">
      <td>${accountLabel(a)}</td><td>$${s.totalBalance.toFixed(2)}</td>
      <td style="color:${s.totalProfit >= 0 ? "var(--win)" : "var(--loss)"}">$${s.totalProfit.toFixed(2)}</td>
      <td>${s.roi}%</td><td>${s.nbTrades}</td><td>${a.target != null ? "$" + a.target : "—"}</td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="6">Aucun compte — crée ton premier compte.</td></tr>`;

  const goalsRows = cache.goals.filter(g => g.statut === "En cours").slice(0, 6);
  document.getElementById("dash-goals").innerHTML = goalsRows.length ? goalsRows.map(g => {
    const pct = g.target_value ? Math.min(100, round2((g.current_value / g.target_value) * 100)) : 0;
    return `<tr onclick="openGoalDialog(${g.id})" style="cursor:pointer;">
      <td>${g.titre}</td><td>${pct}% (${g.current_value ?? 0}/${g.target_value ?? "—"})</td>
      <td>${fmtDateFR(g.deadline) || "—"}</td><td>${badge(g.statut, STATUT_COLORS[g.statut])}</td></tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="4">Aucun goal en cours</td></tr>`;

  const wp = currentWeeklyPlanner();
  const news = wp ? cache.economic_news.filter(n => n.weekly_planner_id === wp.id) : [];
  document.getElementById("dash-news").innerHTML = news.length ? news.map(n => `
    <tr><td class="${n.date_event === today ? "due-today" : ""}">${fmtDateFR(n.date_event)}</td><td>${n.event}</td>
    <td>${badge(n.impact, STATUT_COLORS[n.impact])}</td><td>${n.implication || "—"}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">Aucune news renseignée pour cette semaine</td></tr>`;
}

// ========================================================================
//  TRADING JOURNAL
// ========================================================================
function accountOptionsHtml(selectedId) {
  return cache.accounts.map(a => `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${accountLabel(a)}</option>`).join("");
}
function setupOptionsHtml(selectedId) {
  return `<option value="">— Aucun —</option>` + cache.setups.map(s => `<option value="${s.id}" ${s.id === selectedId ? "selected" : ""}>${setupLabel(s)}</option>`).join("");
}
function reviewOptionsHtml(selectedId) {
  return `<option value="">— Aucune —</option>` + cache.daily_reviews.map(r => `<option value="${r.id}" ${r.id === selectedId ? "selected" : ""}>${fmtDateFR(r.review_date)}</option>`).join("");
}

function renderJournal() {
  ensureFilterOptions("journal-filter-account", cache.accounts.map(a => ({ value: a.id, label: accountLabel(a) })));
  ensureFilterOptions("journal-filter-session", SESSIONS);
  ensureFilterOptions("journal-filter-resultat", RESULTATS);
  const fAccount = document.getElementById("journal-filter-account").value;
  const fSession = document.getElementById("journal-filter-session").value;
  const fResultat = document.getElementById("journal-filter-resultat").value;

  let rows = [...cache.trades];
  if (fAccount) rows = rows.filter(t => String(t.account_id) === String(fAccount));
  if (fSession) rows = rows.filter(t => t.session === fSession);
  if (fResultat) rows = rows.filter(t => t.resultat === fResultat);

  const tbody = document.getElementById("journal-tbody");
  tbody.innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td>${fmtDateFR(t.trade_date)}</td>
      <td style="font-weight:bold;">${t.ticker || "—"}</td>
      <td>${badge(t.direction, STATUT_COLORS[t.direction])}</td>
      <td>${accountLabel(findAccount(t.account_id))}</td>
      <td>${setupLabel(findSetup(t.setup_id)) }</td>
      <td>${badge(t.session, STATUT_COLORS[t.session])}</td>
      <td>${t.risk_percent}%</td>
      <td>${badge(t.resultat, STATUT_COLORS[t.resultat])}</td>
      <td style="color:${(t.profit_loss || 0) >= 0 ? "var(--win)" : "var(--loss)"};font-weight:bold;">$${Number(t.profit_loss || 0).toFixed(2)}</td>
      <td class="row-actions">
        <button onclick="openTradeDialog(${t.id})">✎</button>
        <button onclick="confirmDelete('trades', ${t.id}, renderJournal)">🗑</button>
      </td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="10">Aucun trade — enregistre ton premier trade.</td></tr>`;
}

function openTradeDialog(id) {
  if (!cache.accounts.length) { showToast("Crée d'abord un compte dans l'onglet Comptes."); return; }
  const row = id ? cache.trades.find(t => t.id === id) : {};
  openModal({
    title: id ? "Modifier le trade" : "Nouveau trade",
    table: "trades", id,
    bucket: "trade-screenshots",
    fields: [
      { key: "trade_date", label: "Date", type: "date", required: true, value: row.trade_date || todayStr() },
      { key: "ticker", label: "Ticker", type: "text", required: true, value: row.ticker },
      { key: "direction", label: "Direction", type: "select", options: DIRECTIONS, value: row.direction || "Long" },
      { key: "account_id", label: "Compte", type: "select-raw", optionsHtml: accountOptionsHtml(row.account_id), value: row.account_id, numeric: true, required: true },
      { key: "setup_id", label: "Setup", type: "select-raw", optionsHtml: setupOptionsHtml(row.setup_id), value: row.setup_id, numeric: true },
      { key: "contrats", label: "Nombre de contrats", type: "number", value: row.contrats ?? 1 },
      { key: "risk_percent", label: "Risk", type: "select", options: RISK_LEVELS, value: row.risk_percent ?? 0.25 },
      { key: "session", label: "Session", type: "select", options: SESSIONS, value: row.session || "London" },
      { key: "resultat", label: "Résultat (Win / Loss)", type: "select", options: RESULTATS, value: row.resultat || "Win" },
      { key: "profit_loss", label: "Profit / Loss ($)", type: "number", required: true, value: row.profit_loss ?? 0 },
      { key: "daily_review_id", label: "Lien vers une Daily Review", type: "select-raw", optionsHtml: reviewOptionsHtml(row.daily_review_id), value: row.daily_review_id, numeric: true },
      { key: "screenshot", label: "Screenshot du trade", type: "file", accept: "image/*", column: "screenshot_path" },
      { key: "notes", label: "Notes", type: "textarea", value: row.notes },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  DAILY REVIEW
// ========================================================================
function renderReview() {
  const wrap = document.getElementById("review-cards");
  const rows = [...cache.daily_reviews];
  wrap.innerHTML = rows.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">` +
    rows.map(r => `
      <div class="panel" style="margin-bottom:0;cursor:pointer;" onclick="openReviewDialog(${r.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>${fmtDateFR(r.review_date)}</strong>
          <button class="row-actions" style="background:none;border:none;color:var(--muted);" onclick="event.stopPropagation();confirmDelete('daily_reviews', ${r.id}, renderReview)">🗑</button>
        </div>
        <div class="review-photos">
          <span>Daily ${r.photo_daily_path ? "✓" : "—"}</span>
          <span>Hour ${r.photo_hour_path ? "✓" : "—"}</span>
          <span>15min ${r.photo_15min_path ? "✓" : "—"}</span>
          <span>5min ${r.photo_5min_path ? "✓" : "—"}</span>
        </div>
        <div style="font-size:13px;">
          <div><span style="color:var(--muted);">London</span> ${r.recap_london || "—"}</div>
          <div><span style="color:var(--muted);">Asia</span> ${r.recap_asia || "—"}</div>
          <div><span style="color:var(--muted);">NY</span> ${r.recap_ny || "—"}</div>
        </div>
      </div>`).join("") + `</div>`
    : `<div class="panel"><p style="color:var(--muted);margin:0;">Aucune Daily Review — crée ta première review.</p></div>`;
}

function openReviewDialog(id) {
  const row = id ? cache.daily_reviews.find(r => r.id === id) : {};
  openModal({
    title: id ? "Modifier la Daily Review" : "Nouvelle Daily Review",
    table: "daily_reviews", id,
    bucket: "review-photos",
    fields: [
      { key: "review_date", label: "Date", type: "date", required: true, value: row.review_date || todayStr() },
      { key: "photo_daily", label: "Photo — Daily", type: "file", accept: "image/*", column: "photo_daily_path" },
      { key: "photo_hour", label: "Photo — Hour", type: "file", accept: "image/*", column: "photo_hour_path" },
      { key: "photo_15min", label: "Photo — 15min", type: "file", accept: "image/*", column: "photo_15min_path" },
      { key: "photo_5min", label: "Photo — 5min", type: "file", accept: "image/*", column: "photo_5min_path" },
      { key: "recap_london", label: "Récap session London", type: "textarea", value: row.recap_london },
      { key: "recap_asia", label: "Récap session Asia", type: "textarea", value: row.recap_asia },
      { key: "recap_ny", label: "Récap session NY", type: "textarea", value: row.recap_ny },
      { key: "notes", label: "Notes", type: "textarea", value: row.notes },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  WEEKLY PLANNER
// ========================================================================
function currentWeeklyPlanner() {
  const monday = mondayOf(todayStr());
  return cache.weekly_planners.find(w => w.week_start_date === monday) || null;
}
async function ensureWeeklyPlanner() {
  let wp = currentWeeklyPlanner();
  if (!wp) {
    wp = await insertRow("weekly_planners", { week_start_date: mondayOf(todayStr()), bias_checklist: [] });
    await refreshCache();
    wp = currentWeeklyPlanner();
  }
  return wp;
}
async function renderWeekly() {
  let wp = currentWeeklyPlanner();
  if (!wp) wp = await ensureWeeklyPlanner();
  const monday = wp.week_start_date;
  document.getElementById("weekly-week-lbl").textContent = `Semaine du ${fmtDateFR(monday)}`;

  const list = document.getElementById("weekly-checklist");
  const items = wp.bias_checklist || [];
  list.innerHTML = items.length ? items.map((it, i) => `
    <li><input type="checkbox" ${it.checked ? "checked" : ""} onchange="toggleWeeklyChecklist(${i})"> ${it.label}
      <button onclick="removeWeeklyChecklist(${i})">✕</button></li>`).join("")
    : `<li style="color:var(--muted);">Aucun point de biais ajouté pour cette semaine.</li>`;

  const news = cache.economic_news.filter(n => n.weekly_planner_id === wp.id).sort((a, b) => (a.date_event || "").localeCompare(b.date_event || ""));
  document.getElementById("weekly-news-tbody").innerHTML = news.length ? news.map(n => `
    <tr><td>${fmtDateFR(n.date_event)}</td><td>${n.heure || "—"}</td><td>${n.event_type || "—"}</td><td>${n.event}</td><td>${badge(n.impact, STATUT_COLORS[n.impact])}</td><td>${n.implication || "—"}</td>
    <td class="row-actions"><button onclick="openNewsDialog(${n.id})">✎</button><button onclick="confirmDelete('economic_news', ${n.id}, renderWeekly)">🗑</button></td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="7">Aucune news économique renseignée</td></tr>`;

  renderWeekAdviceGrid(wp, news);
}
async function loadWeeklyTemplate() {
  const wp = await ensureWeeklyPlanner();
  const existingLabels = new Set((wp.bias_checklist || []).map(it => it.label));
  const toAdd = WEEKLY_BIAS_TEMPLATE.filter(l => !existingLabels.has(l)).map(label => ({ label, checked: false }));
  if (!toAdd.length) { showToast("Checklist type déjà chargée"); return; }
  const items = [...(wp.bias_checklist || []), ...toAdd];
  await updateRow("weekly_planners", wp.id, { bias_checklist: items });
  await refreshAll();
}
async function toggleWeeklyChecklist(i) {
  const wp = currentWeeklyPlanner(); if (!wp) return;
  const items = [...(wp.bias_checklist || [])];
  items[i] = { ...items[i], checked: !items[i].checked };
  await updateRow("weekly_planners", wp.id, { bias_checklist: items });
  await refreshAll();
}
async function removeWeeklyChecklist(i) {
  const wp = currentWeeklyPlanner(); if (!wp) return;
  const items = [...(wp.bias_checklist || [])];
  items.splice(i, 1);
  await updateRow("weekly_planners", wp.id, { bias_checklist: items });
  await refreshAll();
}
async function addWeeklyChecklist() {
  const input = document.getElementById("weekly-checklist-input");
  const label = input.value.trim(); if (!label) return;
  const wp = await ensureWeeklyPlanner();
  const items = [...(wp.bias_checklist || []), { label, checked: false }];
  await updateRow("weekly_planners", wp.id, { bias_checklist: items });
  input.value = "";
  await refreshAll();
}
function openNewsDialog(id) {
  const row = id ? cache.economic_news.find(n => n.id === id) : {};
  const wp = currentWeeklyPlanner();
  openModal({
    title: id ? "Modifier la news" : "Nouvelle news économique",
    table: "economic_news", id,
    fields: [
      { key: "date_event", label: "Date", type: "date", required: true, value: row.date_event || todayStr() },
      { key: "heure", label: "Heure (ex: 08:30)", type: "text", value: row.heure },
      { key: "event_type", label: "Type d'évènement", type: "select", options: EVENT_TYPES, value: row.event_type || "Autre" },
      { key: "event", label: "Évènement (libellé libre)", type: "text", required: true, value: row.event },
      { key: "impact", label: "Impact", type: "select", options: IMPACTS, value: row.impact || "Moyen" },
      { key: "implication", label: "Ce que cela implique", type: "textarea", value: row.implication },
    ],
    beforeSave: (values) => { values.weekly_planner_id = wp ? wp.id : row.weekly_planner_id; },
    onSaved: refreshAll,
  });
}

// ========================================================================
//  DAILY PLANNER
// ========================================================================
function currentDailyPlanner() {
  const today = todayStr();
  return cache.daily_planners.find(d => d.planner_date === today) || null;
}
async function ensureDailyPlanner() {
  let dp = currentDailyPlanner();
  if (!dp) {
    const wp = await ensureWeeklyPlanner();
    dp = await insertRow("daily_planners", { planner_date: todayStr(), weekly_planner_id: wp.id, bias_checklist: [] });
    await refreshCache();
    dp = currentDailyPlanner();
  }
  return dp;
}
async function renderDaily() {
  let dp = currentDailyPlanner();
  if (!dp) dp = await ensureDailyPlanner();
  document.getElementById("daily-date-lbl").textContent = `Journée du ${fmtDateFR(dp.planner_date)}`;

  const list = document.getElementById("daily-checklist");
  const items = dp.bias_checklist || [];
  list.innerHTML = items.length ? items.map((it, i) => `
    <li><input type="checkbox" ${it.checked ? "checked" : ""} onchange="toggleDailyChecklist(${i})"> ${it.label}
      <button onclick="removeDailyChecklist(${i})">✕</button></li>`).join("")
    : `<li style="color:var(--muted);">Aucun point de biais ajouté pour aujourd'hui.</li>`;

  const news = cache.economic_news.filter(n => n.weekly_planner_id === dp.weekly_planner_id && n.date_event === dp.planner_date);
  document.getElementById("daily-news-tbody").innerHTML = news.length ? news.map(n => `
    <tr><td>${fmtDateFR(n.date_event)}</td><td>${n.event}</td><td>${badge(n.impact, STATUT_COLORS[n.impact])}</td><td>${n.implication || "—"}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">Aucune news économique aujourd'hui</td></tr>`;

  const weekNews = cache.economic_news.filter(n => n.weekly_planner_id === dp.weekly_planner_id);
  renderDailyAdviceBanner(dp.planner_date, weekNews);
}
async function loadDailyTemplate() {
  const dp = await ensureDailyPlanner();
  const existingLabels = new Set((dp.bias_checklist || []).map(it => it.label));
  const toAdd = DAILY_BIAS_TEMPLATE.filter(l => !existingLabels.has(l)).map(label => ({ label, checked: false }));
  if (!toAdd.length) { showToast("Checklist type déjà chargée"); return; }
  const items = [...(dp.bias_checklist || []), ...toAdd];
  await updateRow("daily_planners", dp.id, { bias_checklist: items });
  await refreshAll();
}
async function toggleDailyChecklist(i) {
  const dp = currentDailyPlanner(); if (!dp) return;
  const items = [...(dp.bias_checklist || [])];
  items[i] = { ...items[i], checked: !items[i].checked };
  await updateRow("daily_planners", dp.id, { bias_checklist: items });
  await refreshAll();
}
async function removeDailyChecklist(i) {
  const dp = currentDailyPlanner(); if (!dp) return;
  const items = [...(dp.bias_checklist || [])];
  items.splice(i, 1);
  await updateRow("daily_planners", dp.id, { bias_checklist: items });
  await refreshAll();
}
async function addDailyChecklist() {
  const input = document.getElementById("daily-checklist-input");
  const label = input.value.trim(); if (!label) return;
  const dp = await ensureDailyPlanner();
  const items = [...(dp.bias_checklist || []), { label, checked: false }];
  await updateRow("daily_planners", dp.id, { bias_checklist: items });
  input.value = "";
  await refreshAll();
}

// ========================================================================
//  MOTEUR DE RECOMMANDATION TRADING (règles ICT — d'après tes notes)
// ========================================================================
const SESSION_SLOTS = ["Pre-Market", "London", "NY AM", "Lunch", "NY PM"];
const ADVICE_RANK = { "ok": 0, "caution": 1, "avoid": 2 };
const ADVICE_LABEL = { "ok": "Trade OK", "caution": "Prudence", "avoid": "Éviter" };

function weekdayIndex(dateStr) {
  // 0=Lundi … 4=Vendredi, null si weekend
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=dimanche
  if (day === 0 || day === 6) return null;
  return day - 1;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Construit l'avis (par créneau) pour une date donnée, à partir des news de la semaine
function computeDayAdvice(dateStr, weekNews) {
  const slots = {};
  SESSION_SLOTS.forEach(s => { slots[s] = { status: "ok", reasons: [] }; });
  const bump = (slot, status, reason) => {
    if (ADVICE_RANK[status] > ADVICE_RANK[slots[slot].status]) slots[slot].status = status;
    slots[slot].reasons.push(reason);
  };
  const bumpAll = (status, reason) => SESSION_SLOTS.forEach(s => bump(s, status, reason));

  const today = weekNews.filter(n => n.date_event === dateStr);
  const tomorrow = weekNews.filter(n => n.date_event === addDays(dateStr, 1));
  const yesterday = weekNews.filter(n => n.date_event === addDays(dateStr, -1));
  const hasType = (list, type) => list.some(n => n.event_type === type);
  const highToday = today.filter(n => HIGH_IMPACT_TYPES.includes(n.event_type) || n.impact === "Élevé");

  // --- NFP ---
  if (hasType(today, "NFP")) {
    bump("Pre-Market", "caution", "NFP à 8:30am — prudence avant la news.");
    bump("London", "caution", "Range asiatique/London avant le Judas Swing du NFP.");
    bump("NY AM", "avoid", "N'échange pas NFP entre 8h et 9h30 — attends 9h30-10am.");
    bump("Lunch", "caution", "NFP : le vrai mouvement peut se poursuivre après 9h30.");
    bump("NY PM", "avoid", "Évite la PM session le jour du NFP.");
  }
  // --- FOMC / FED ---
  if (hasType(today, "FOMC / FED")) {
    bump("Pre-Market", "caution", "Jour de FOMC : trade tôt (7h-8h30) ou pas du tout.");
    bump("NY AM", "avoid", "Évite l'AM session le jour du FOMC.");
    bump("Lunch", "caution", "FOMC : le 1er run (14h) est souvent un leurre.");
    bump("NY PM", "avoid", "Le vrai mouvement FOMC arrive vers 14h25-14h30, pas avant.");
  }
  // --- CPI / PPI ---
  if (hasType(today, "CPI") || hasType(today, "PPI")) {
    bump("Pre-Market", "avoid", "Ne rien faire avant CPI/PPI — roulette russe.");
    bump("NY AM", "caution", "Attends 30min minimum ou l'Opening Bell 9h30 après CPI/PPI.");
    bump("NY PM", "caution", "PPI le lendemain d'un CPI : prudence sur la PM.");
  }
  // --- Powell Speech ---
  if (hasType(today, "Powell Speech")) {
    bump("NY AM", "caution", "Powell parle — Price Action possiblement erratique (Smoke Screen).");
    bump("NY PM", "caution", "Powell : configuration à observer 15-30min après son discours.");
  }
  // --- Veille d'un High Impact (NFP/FOMC/CPI/PPI demain) ---
  const highTomorrow = tomorrow.filter(n => HIGH_IMPACT_TYPES.includes(n.event_type));
  if (highTomorrow.length) {
    bump("NY PM", "avoid", `Veille de ${highTomorrow.map(n => n.event_type).join(", ")} — n'échange pas la PM session.`);
  }
  const powellTomorrow = tomorrow.some(n => n.event_type === "Powell Speech");
  if (powellTomorrow) bump("NY PM", "avoid", "Veille d'un discours de Powell — trade l'AM, évite la PM.");

  // --- Lendemain d'un FOMC ---
  if (hasType(yesterday, "FOMC / FED")) {
    bump("NY AM", "avoid", "Lendemain de FOMC — on observe, on ne trade pas l'AM.");
    bump("Lunch", "caution", "Lendemain de FOMC — collecte de données pour la PM.");
  }
  // --- 2 news à fort impact le même jour ---
  if (highToday.length >= 2) {
    bump("NY AM", "avoid", "2 news à fort impact dans la session — configuration Seek & Destroy probable.");
  }
  // --- Lundi sans event mais semaine avec NFP/FOMC/CPI plus tard ---
  const wd = weekdayIndex(dateStr);
  if (wd === 0 && !today.length) {
    const hasHighLaterInWeek = weekNews.some(n => HIGH_IMPACT_TYPES.includes(n.event_type) && n.date_event > dateStr);
    if (hasHighLaterInWeek) bumpAll("caution", "Lundi d'une semaine à évènement (NFP/FOMC/CPI) — journée de consolidation probable, laisse le Weekly Range se dessiner.");
  }
  return slots;
}

function adviceCellHtml(cell) {
  return `<span class="advice-cell advice-${cell.status}" title="${escapeAttr(cell.reasons.join(" "))}">${ADVICE_LABEL[cell.status]}</span>`;
}

function renderWeekAdviceGrid(wp, weekNews) {
  const monday = wp.week_start_date;
  const days = [0, 1, 2, 3, 4].map(i => addDays(monday, i));
  const dayLabels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  let html = `<thead><tr><th>Session</th>${dayLabels.map((l, i) => `<th>${l}<br><span style="font-weight:normal;text-transform:none;">${fmtDateFR(days[i])}</span></th>`).join("")}</tr></thead><tbody>`;
  const advicesByDay = days.map(d => computeDayAdvice(d, weekNews));
  SESSION_SLOTS.forEach(slot => {
    html += `<tr><td style="font-weight:bold;">${slot}</td>` + advicesByDay.map(a => `<td>${adviceCellHtml(a[slot])}</td>`).join("") + `</tr>`;
  });
  html += `</tbody>`;
  document.getElementById("weekly-advice-grid").innerHTML = html;
}

function renderDailyAdviceBanner(dateStr, weekNews) {
  const advice = computeDayAdvice(dateStr, weekNews);
  document.getElementById("daily-advice-banner").innerHTML = SESSION_SLOTS.map(slot =>
    `<div>${slot}<br>${adviceCellHtml(advice[slot])}</div>`).join("");
  const reasons = [];
  SESSION_SLOTS.forEach(slot => advice[slot].reasons.forEach(r => { if (!reasons.includes(r)) reasons.push(r); }));
  document.getElementById("daily-advice-reasons").innerHTML = reasons.length
    ? reasons.map(r => `<li>• ${r}</li>`).join("")
    : `<li>Aucune news à fort impact détectée — journée sans contrainte particulière (garde ta checklist de biais en tête).</li>`;
}

// ========================================================================
//  STATISTIQUES
// ========================================================================
function barRow(label, pct, extra) {
  const p = pct == null ? 0 : pct;
  return `<div class="bar-row">
    <div class="bar-head"><span>${label}</span><span>${pct == null ? "—" : p + "%"}${extra ? " · " + extra : ""}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${p}%;"></div></div>
  </div>`;
}
function renderStats() {
  const totalTrades = cache.trades.length;
  const wins = cache.trades.filter(t => t.resultat === "Win").length;
  const winrate = totalTrades ? round2((wins / totalTrades) * 100) : 0;
  const totalPL = round2(cache.trades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));

  document.getElementById("stats-cards").innerHTML = [
    ["📝", totalTrades, "Trades enregistrés"],
    ["🎯", winrate + "%", "Winrate global"],
    ["💰", "$" + totalPL.toFixed(2), "P/L cumulé"],
  ].map(c => `<div class="stat-card"><div style="font-size:20px;">${c[0]}</div><div class="num">${c[1]}</div><div class="label">${c[2]}</div></div>`).join("");

  // par session
  const bySession = SESSIONS.map(s => {
    const trades = cache.trades.filter(t => t.session === s);
    const w = trades.filter(t => t.resultat === "Win").length;
    const pl = round2(trades.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0));
    return { s, nb: trades.length, winrate: trades.length ? round2((w / trades.length) * 100) : null, pl };
  });
  const bestSession = bySession.filter(x => x.nb > 0).sort((a, b) => (b.winrate || 0) - (a.winrate || 0))[0];
  document.getElementById("stats-session").innerHTML =
    (bestSession ? `<div class="page-note" style="margin-top:0;">🏆 Session la plus réussie : <strong>${bestSession.s}</strong> (${bestSession.winrate}%)</div>` : "") +
    bySession.map(x => barRow(x.s, x.winrate, `${x.nb} trades · $${x.pl.toFixed(2)}`)).join("");

  // par setup
  const bySetup = cache.setups.map(s => {
    const st = setupStats(s);
    return { s, ...st };
  });
  const bestSetup = bySetup.filter(x => x.nbTrades > 0).sort((a, b) => (b.winrate || 0) - (a.winrate || 0))[0];
  document.getElementById("stats-setup").innerHTML =
    (bestSetup ? `<div class="page-note" style="margin-top:0;">🏆 Setup le plus réussi : <strong>${setupLabel(bestSetup.s)}</strong> (${bestSetup.winrate}%)</div>` : "") +
    (bySetup.length ? bySetup.map(x => barRow(setupLabel(x.s), x.winrate, `${x.nbTrades} trades`)).join("") : `<p style="color:var(--muted);">Aucun setup créé.</p>`);

  // gains jour / semaine / mois
  const today = todayStr();
  const weekStart = mondayOf(today);
  const monthStart = today.slice(0, 7);
  const gainsJour = round2(cache.trades.filter(t => t.trade_date === today).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const gainsSemaine = round2(cache.trades.filter(t => (t.trade_date || "") >= weekStart).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const gainsMois = round2(cache.trades.filter(t => (t.trade_date || "").startsWith(monthStart)).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  document.getElementById("stats-gains").innerHTML = `
    <div class="cards-row" style="margin-bottom:0;">
      <div class="stat-card"><div class="num ${gainsJour >= 0 ? "win" : "loss"}">$${gainsJour.toFixed(2)}</div><div class="label">Aujourd'hui</div></div>
      <div class="stat-card"><div class="num ${gainsSemaine >= 0 ? "win" : "loss"}">$${gainsSemaine.toFixed(2)}</div><div class="label">Cette semaine</div></div>
      <div class="stat-card"><div class="num ${gainsMois >= 0 ? "win" : "loss"}">$${gainsMois.toFixed(2)}</div><div class="label">Ce mois</div></div>
    </div>`;
}

// ========================================================================
//  GOALS
// ========================================================================
function renderGoalsRows() {
  const rows = [...cache.goals];
  return rows.length ? rows.map(g => {
    const pct = g.target_value ? Math.min(100, round2(((g.current_value || 0) / g.target_value) * 100)) : 0;
    return `<tr>
      <td>${g.titre}</td>
      <td>${pct}% (${g.current_value ?? 0}/${g.target_value ?? "—"})<div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div></td>
      <td>${fmtDateFR(g.deadline) || "—"}</td>
      <td>${badge(g.statut, STATUT_COLORS[g.statut])}</td>
      <td class="row-actions"><button onclick="openGoalDialog(${g.id})">✎</button><button onclick="confirmDelete('goals', ${g.id}, renderGoals)">🗑</button></td>
    </tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="5">Aucun goal — crée ton premier objectif.</td></tr>`;
}
function renderGoals() { document.getElementById("goals-tbody").innerHTML = renderGoalsRows(); }
function openGoalDialog(id) {
  const row = id ? cache.goals.find(g => g.id === id) : {};
  openModal({
    title: id ? "Modifier le goal" : "Nouveau goal",
    table: "goals", id,
    fields: [
      { key: "titre", label: "Titre", type: "text", required: true, value: row.titre },
      { key: "description", label: "Description", type: "textarea", value: row.description },
      { key: "target_value", label: "Valeur cible", type: "number", value: row.target_value },
      { key: "current_value", label: "Valeur actuelle", type: "number", value: row.current_value ?? 0 },
      { key: "deadline", label: "Échéance", type: "date", value: row.deadline },
      { key: "statut", label: "Statut", type: "select", options: STATUTS_GOAL, value: row.statut || "En cours" },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  COMPTES
// ========================================================================
function renderAccounts() {
  const rows = [...cache.accounts];
  document.getElementById("accounts-tbody").innerHTML = rows.length ? rows.map(a => {
    const s = accountStats(a);
    return `<tr>
      <td>${accountLabel(a)}</td>
      <td>$${Number(a.starting_balance || 0).toFixed(2)}</td>
      <td>$${s.totalBalance.toFixed(2)}</td>
      <td style="color:${s.totalProfit >= 0 ? "var(--win)" : "var(--loss)"};">$${s.totalProfit.toFixed(2)}</td>
      <td>${s.roi}%</td><td>${s.nbTrades}</td><td>${a.target != null ? "$" + a.target : "—"}</td>
      <td class="row-actions"><button onclick="openAccountDialog(${a.id})">✎</button><button onclick="confirmDelete('accounts', ${a.id}, renderAccounts)">🗑</button></td>
    </tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="8">Aucun compte — crée ton premier compte.</td></tr>`;
}
function openAccountDialog(id) {
  const row = id ? cache.accounts.find(a => a.id === id) : {};
  openModal({
    title: id ? "Modifier le compte" : "Nouveau compte",
    table: "accounts", id,
    fields: [
      { key: "nom", label: "Nom du compte", type: "text", required: true, value: row.nom },
      { key: "starting_balance", label: "Starting Balance ($)", type: "number", required: true, value: row.starting_balance ?? 0 },
      { key: "target", label: "Target ($)", type: "number", value: row.target },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  SETUPS
// ========================================================================
function renderSetups() {
  const rows = [...cache.setups];
  document.getElementById("setups-tbody").innerHTML = rows.length ? rows.map(s => {
    const st = setupStats(s);
    return `<tr>
      <td>${setupLabel(s)}</td><td>${s.description || "—"}</td><td>${st.nbTrades}</td>
      <td>${st.winrate == null ? "—" : st.winrate + "%"}</td>
      <td class="row-actions"><button onclick="openSetupDialog(${s.id})">✎</button><button onclick="confirmDelete('setups', ${s.id}, renderSetups)">🗑</button></td>
    </tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="5">Aucun setup — crée ton premier setup.</td></tr>`;
}
function openSetupDialog(id) {
  const row = id ? cache.setups.find(s => s.id === id) : {};
  openModal({
    title: id ? "Modifier le setup" : "Nouveau setup",
    table: "setups", id,
    fields: [
      { key: "nom", label: "Nom du setup", type: "text", required: true, value: row.nom },
      { key: "description", label: "Description", type: "textarea", value: row.description },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  MODAL GENERIQUE
// ========================================================================
function openModal({ title, table, id, fields, onSaved, onRender, beforeSave, bucket }) {
  modalContext = { table, id, fields, onSaved, onRender, beforeSave, bucket };
  document.getElementById("modal-title").textContent = title;
  const form = document.getElementById("modal-form");
  form.innerHTML = fields.map(f => {
    let input;
    if (f.type === "select") {
      input = `<select name="${f.key}">${(f.options || []).map(o => `<option value="${o}" ${String(o) === String(f.value) ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    } else if (f.type === "select-raw") {
      input = `<select name="${f.key}">${f.optionsHtml}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea name="${f.key}">${f.value || ""}</textarea>`;
    } else if (f.type === "checkbox") {
      input = `<input type="checkbox" name="${f.key}" ${f.value ? "checked" : ""} style="width:auto;">`;
    } else if (f.type === "file") {
      input = `<input type="file" name="${f.key}" accept="${f.accept || "*"}">`;
    } else {
      input = `<input type="${f.type}" name="${f.key}" value="${f.value != null ? escapeAttr(f.value) : ""}" ${f.required ? "required" : ""}>`;
    }
    return `<div class="field"><label>${f.label}${f.required ? " *" : ""}</label>${input}</div>`;
  }).join("");

  document.getElementById("modal-save").style.display = "inline-block";
  document.getElementById("modal-save").onclick = saveModal;
  document.getElementById("modal-cancel").textContent = "Annuler";
  document.getElementById("modal-delete").style.display = id ? "inline-block" : "none";
  document.getElementById("modal-overlay").classList.add("open");
  if (onRender) onRender(form);
}
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.getElementById("modal-save").textContent = "Enregistrer";
  document.getElementById("modal-save").onclick = saveModal;
  modalContext = null;
}
async function saveModal() {
  if (!modalContext) return;
  const { table, id, fields, onSaved, beforeSave, bucket } = modalContext;
  const form = document.getElementById("modal-form");
  const values = {}; const fileFields = []; let missingRequired = false;
  fields.forEach(f => {
    if (f.type === "file") { fileFields.push({ f, el: form.elements[f.key] }); return; }
    const el = form.elements[f.key]; if (!el) return;
    if (f.type === "checkbox") { values[f.key] = el.checked; return; }
    let val = el.value;
    if (f.required && !val) missingRequired = true;
    if (val === "") val = null;
    if (val !== null && (f.type === "number" || f.numeric)) val = Number(val);
    values[f.key] = val;
  });
  if (missingRequired) { showToast("Merci de remplir les champs obligatoires"); return; }
  if (beforeSave) beforeSave(values);

  let saved;
  if (id) saved = await updateRow(table, id, values);
  else saved = await insertRow(table, values);
  if (!saved) return;

  for (const { f, el } of fileFields) {
    if (el && el.files && el.files[0] && bucket) {
      const file = el.files[0];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${currentUser.id}/${table}-${saved.id}-${f.key}.${ext}`;
      const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      if (error) { showToast("Erreur envoi fichier"); console.error(error); }
      else await updateRow(table, saved.id, { [f.column || f.key]: path });
    }
  }
  showToast(id ? "Modifications enregistrées" : "Ajouté avec succès");
  closeModal();
  if (onSaved) await onSaved(saved);
}
function confirmDelete(table, id, afterFn) {
  if (!confirm("Supprimer cet élément ? Cette action est irréversible.")) return;
  deleteRow(table, id).then(async ok => {
    if (ok) { showToast("Supprimé"); await refreshCache(); if (afterFn) afterFn(); else renderPage(currentPage); }
  });
}

// ========================================================================
//  INIT
// ========================================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("auth-submit").addEventListener("click", handleAuthSubmit);
  document.getElementById("auth-switch-link").addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));
  document.getElementById("auth-password").addEventListener("keydown", e => { if (e.key === "Enter") handleAuthSubmit(); });
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("menu-toggle-btn").addEventListener("click", openMobileMenu);
  document.getElementById("sidebar-overlay").addEventListener("click", closeMobileMenu);

  document.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", () => showPage(el.dataset.page)));

  document.getElementById("sc-trade").addEventListener("click", () => openTradeDialog(null));
  document.getElementById("sc-review").addEventListener("click", () => openReviewDialog(null));
  document.getElementById("sc-goal").addEventListener("click", () => openGoalDialog(null));
  document.getElementById("sc-account").addEventListener("click", () => openAccountDialog(null));
  document.getElementById("sc-setup").addEventListener("click", () => openSetupDialog(null));

  document.getElementById("btn-new-trade").addEventListener("click", () => openTradeDialog(null));
  document.getElementById("btn-new-review").addEventListener("click", () => openReviewDialog(null));
  document.getElementById("btn-new-news").addEventListener("click", () => openNewsDialog(null));
  document.getElementById("btn-new-goal").addEventListener("click", () => openGoalDialog(null));
  document.getElementById("btn-new-account").addEventListener("click", () => openAccountDialog(null));
  document.getElementById("btn-new-setup").addEventListener("click", () => openSetupDialog(null));

  document.getElementById("weekly-checklist-add").addEventListener("click", addWeeklyChecklist);
  document.getElementById("weekly-checklist-input").addEventListener("keydown", e => { if (e.key === "Enter") addWeeklyChecklist(); });
  document.getElementById("daily-checklist-add").addEventListener("click", addDailyChecklist);
  document.getElementById("daily-checklist-input").addEventListener("keydown", e => { if (e.key === "Enter") addDailyChecklist(); });
  document.getElementById("btn-load-weekly-template").addEventListener("click", loadWeeklyTemplate);
  document.getElementById("btn-load-daily-template").addEventListener("click", loadDailyTemplate);

  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-delete").addEventListener("click", () => {
    if (modalContext && modalContext.id) { confirmDelete(modalContext.table, modalContext.id, () => renderPage(currentPage)); closeModal(); }
  });
  document.getElementById("modal-overlay").addEventListener("click", e => { if (e.target.id === "modal-overlay") closeModal(); });

  document.addEventListener("keydown", e => {
    if (!currentUser) return;
    if (e.ctrlKey && e.key === "n") { e.preventDefault(); openTradeDialog(null); }
    if (e.ctrlKey && e.key === "g") { e.preventDefault(); openGoalDialog(null); }
  });

  sb.auth.getSession().then(({ data }) => { if (data.session) onLoggedIn(data.session.user); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
});
