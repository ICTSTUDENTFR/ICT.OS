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
const EVENT_TYPES = [
  "FOMC / FED", "Powell Speech", "NFP", "CPI", "PPI", "GDP", "PMI", "Retail Sales",
  "Unemployment Claims", "Trade Balance",
  "BOE Monetary Policy Report", "Monetary Policy Summary", "CB Consumer Confidence",
  "Trump Speak", "MPC Official Bank Rate Votes", "Official Bank Rate", "BOE Gov Bailey Speaks",
  "Core PCE Price Index m/m", "Employment Cost Index", "Revised UoM Consumer Sentiment",
  "Revised UoM Inflation Expectations", "Autre",
];
const HIGH_IMPACT_TYPES = ["FOMC / FED", "NFP", "CPI", "PPI"];
const ACCOUNT_TYPES = [{ value: "examen", label: "Compte examen" }, { value: "actif", label: "Compte actif" }];
const ACCOUNT_STATUSES = [{ value: "en_cours", label: "En cours" }, { value: "valide", label: "Validé" }, { value: "echoue", label: "Échoué" }];
const WALLET_TYPES = [{ value: "profit_reel", label: "Bénéfice réel généré" }, { value: "retrait", label: "Retrait" }, { value: "epargne", label: "Épargne" }];
const EVENT_NAME_PRESETS = [
  "FOMC", "NFP", "CPI", "PPI", "GDP", "PMI", "Trade Balance",
  "BOE Monetary Policy Report", "Monetary Policy Summary", "CB Consumer Confidence",
  "Trump Speak", "MPC Official Bank Rate Votes", "Official Bank Rate", "BOE Gov Bailey Speaks",
  "Core PCE Price Index m/m", "Employment Cost Index", "Revised UoM Consumer Sentiment",
  "Revised UoM Inflation Expectations", "Unemployment Claims",
];

const STATUT_COLORS = {
  "Long": "var(--info)", "Short": "var(--warning)",
  "Win": "var(--win)", "Loss": "var(--loss)", "Breakeven": "var(--muted)",
  "Asia": "var(--info)", "London": "var(--accent)", "NY": "var(--warning)",
  "Faible": "var(--muted)", "Moyen": "var(--warning)", "Élevé": "var(--danger)",
  "En cours": "var(--info)", "Atteint": "var(--win)", "Manqué": "var(--loss)",
  "valide": "var(--win)", "echoue": "var(--loss)", "en_cours": "var(--info)",
};
const ACCOUNT_STATUS_LABEL = { en_cours: "En cours", valide: "Validé", echoue: "Échoué" };

// ---- 3) ETAT LOCAL ----
let currentUser = null;
let cache = { accounts: [], setups: [], trades: [], daily_reviews: [], weekly_planners: [], economic_news: [], daily_planners: [], goals: [], wallet_entries: [] };
let currentPage = "dashboard";
let modalContext = null;

// ---- 4) HELPERS ----
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function todayStr() {
  const d = new Date();
  return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + n);
  return toISODate(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
}
function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  const day = u.getUTCDay() || 7;
  if (day !== 1) u.setUTCDate(u.getUTCDate() - (day - 1));
  return toISODate(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
}
function nowStr() { const d = new Date(); return d.toISOString().slice(0, 16).replace("T", " "); }
function fmtDateFR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function daysUntil(iso) {
  if (!iso) return null;
  const [y1, m1, d1] = String(iso).slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = todayStr().split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1), b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((a - b) / 86400000);
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
function badgeSubtle(text, color) {
  if (!text) return "";
  return `<span class="badge-subtle" style="color:${color || "var(--muted)"}">${text}</span>`;
}
function statIconHtml(iconClass, colorClass) {
  return `<div class="stat-icon stat-icon-${colorClass}"><i class="ph ${iconClass}"></i></div>`;
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
  const [accounts, setups, trades, daily_reviews, weekly_planners, economic_news, daily_planners, goals, wallet_entries] = await Promise.all([
    fetchAll("accounts", "nom", true),
    fetchAll("setups", "nom", true),
    fetchAll("trades", "trade_date", false),
    fetchAll("daily_reviews", "review_date", false),
    fetchAll("weekly_planners", "week_start_date", false),
    fetchAll("economic_news", "date_event", false),
    fetchAll("daily_planners", "planner_date", false),
    fetchAll("goals"),
    fetchAll("wallet_entries", "entry_date", false),
  ]);
  cache = { accounts, setups, trades, daily_reviews, weekly_planners, economic_news, daily_planners, goals, wallet_entries };
}

// ---- calculs comptes ----
function accountStats(a) {
  const trades = cache.trades.filter(t => t.account_id === a.id).sort((x, y) => (x.trade_date || "").localeCompare(y.trade_date || ""));
  const totalProfit = round2(trades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const totalBalance = round2((Number(a.starting_balance) || 0) + totalProfit);
  const roi = a.starting_balance ? round2((totalProfit / a.starting_balance) * 100) : 0;

  // suivi peak/drawdown (approximation à partir des soldes en fin de trade)
  let running = Number(a.starting_balance) || 0, peak = running, maxDDPercent = 0;
  trades.forEach(t => {
    running += Number(t.profit_loss) || 0;
    if (running > peak) peak = running;
    const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
    if (dd > maxDDPercent) maxDDPercent = dd;
  });
  const currentDDPercent = peak > 0 ? Math.max(0, ((peak - running) / peak) * 100) : 0;
  const drawdownUsedPercent = a.max_drawdown_percent ? Math.min(100, (currentDDPercent / a.max_drawdown_percent) * 100) : null;

  const profitTarget = (a.target != null && a.target !== "") ? (Number(a.target) - Number(a.starting_balance || 0)) : null;
  const progressPercent = (profitTarget && profitTarget > 0) ? Math.max(0, Math.min(100, (totalProfit / profitTarget) * 100)) : null;

  const today = todayStr();
  const dailyPL = round2(trades.filter(t => t.trade_date === today).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const daysRemaining = a.deadline_date ? daysUntil(a.deadline_date) : null;

  return { totalProfit, totalBalance, roi, nbTrades: trades.length, maxDDPercent: round2(maxDDPercent), currentDDPercent: round2(currentDDPercent), drawdownUsedPercent: drawdownUsedPercent == null ? null : round2(drawdownUsedPercent), profitTarget, progressPercent, dailyPL, daysRemaining, cumulSeries: (() => { let r = Number(a.starting_balance) || 0; return trades.map(t => { r += Number(t.profit_loss) || 0; return { date: t.trade_date, value: r }; }); })() };
}
function setupStats(s) {
  const trades = cache.trades.filter(t => t.setup_id === s.id).sort((x, y) => (x.trade_date || "").localeCompare(y.trade_date || ""));
  const wins = trades.filter(t => t.resultat === "Win").length;
  const winrate = trades.length ? round2((wins / trades.length) * 100) : null;
  let cum = 0;
  const series = trades.map(t => { cum += Number(t.profit_loss) || 0; return cum; });
  return { nbTrades: trades.length, winrate, series, totalPL: round2(cum) };
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
  document.getElementById("app-loader").style.display = "flex";
  document.getElementById("user-email-lbl").textContent = user.email;
  try {
    await refreshCache();
    showPage("dashboard");
    renderNotifications();
  } catch (err) {
    console.error("Erreur au chargement du dashboard :", err);
    showToast("Une erreur est survenue au chargement — réessaie ou recharge la page.");
  } finally {
    // Le loader ne doit JAMAIS rester bloqué à l'écran : même en cas d'erreur ci-dessus,
    // on le masque pour ne jamais empêcher l'utilisateur d'interagir avec l'appli.
    document.getElementById("app-loader").style.display = "none";
  }
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
function collapseSidebar() {
  document.getElementById("sidebar").classList.add("collapsed");
  document.getElementById("sidebar-expand-btn").classList.add("show");
  localStorage.setItem("ictos-sidebar-collapsed", "1");
}
function expandSidebar() {
  document.getElementById("sidebar").classList.remove("collapsed");
  document.getElementById("sidebar-expand-btn").classList.remove("show");
  localStorage.setItem("ictos-sidebar-collapsed", "0");
}
function initSidebarCollapse() {
  if (localStorage.getItem("ictos-sidebar-collapsed") === "1") collapseSidebar();
}
function renderPage(key) {
  const pageEl = document.getElementById("page-" + key);
  if (pageEl) { pageEl.classList.remove("fade-in"); void pageEl.offsetWidth; pageEl.classList.add("fade-in"); }
  if (key === "dashboard") renderDashboard();
  else if (key === "journal") renderJournal();
  else if (key === "review") renderReview();
  else if (key === "weekly") renderWeekly();
  else if (key === "daily") renderDaily();
  else if (key === "stats") renderStats();
  else if (key === "goals") renderGoals();
  else if (key === "wallet") renderWallet();
  else if (key === "accounts") renderAccounts();
  else if (key === "setups") renderSetups();
}
async function refreshAll() { await refreshCache(); renderPage(currentPage); renderNotifications(); }
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
//  CHARTS (SVG légers, sans dépendance)
// ========================================================================
function sparklineSVG(values) {
  if (!values || values.length < 2) return `<span style="color:var(--muted);font-size:11px;">—</span>`;
  const w = 110, h = 32, pad = 3;
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const range = (max - min) || 1;
  const last = values[values.length - 1];
  const color = last >= 0 ? "var(--win)" : "var(--loss)";
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function equityCurveSVG(points) {
  if (!points || points.length < 2) return `<p style="color:var(--muted);font-size:12.5px;margin:0;">Pas encore assez de trades pour tracer une courbe d'equity.</p>`;
  const w = 760, h = 210, padL = 46, padR = 14, padT = 14, padB = 24;
  const values = points.map(p => p.value);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const range = (max - min) || 1;
  const stepX = (w - padL - padR) / (points.length - 1);
  const coords = points.map((p, i) => [padL + i * stepX, h - padB - ((p.value - min) / range) * (h - padT - padB)]);
  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const zeroY = h - padB - ((0 - min) / range) * (h - padT - padB);
  const areaPath = linePath + ` L${coords[coords.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} L${coords[0][0].toFixed(1)},${zeroY.toFixed(1)} Z`;
  const last = values[values.length - 1];
  const color = last >= 0 ? "var(--win)" : "var(--loss)";
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" preserveAspectRatio="none">
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="4 4"/>
      <path d="${areaPath}" style="fill:${color};opacity:.14"/>
      <path d="${linePath}" fill="none" style="stroke:${color}" stroke-width="2.5"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px;"><span>${fmtDateFR(points[0].date)}</span><span>${fmtDateFR(points[points.length - 1].date)}</span></div>`;
}
function ringSVG(percentRemaining, size, dangerBelow, warnBelow) {
  size = size || 92; dangerBelow = dangerBelow == null ? 20 : dangerBelow; warnBelow = warnBelow == null ? 50 : warnBelow;
  const r = size / 2 - 9, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percentRemaining));
  const dash = c * (pct / 100);
  const color = pct <= dangerBelow ? "var(--loss)" : pct <= warnBelow ? "var(--warning)" : "var(--win)";
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--table-head)" stroke-width="9"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="52%" text-anchor="middle" dy="0.35em" font-size="17" font-weight="700" style="fill:var(--text)">${Math.round(pct)}%</text>
  </svg>`;
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
    ["ph-currency-circle-dollar", "accent", `$${totalBalance.toFixed(2)}`, "Total Balance", () => showPage("accounts"), null],
    ["ph-trend-up", totalProfit >= 0 ? "win" : "loss", `$${totalProfit.toFixed(2)}`, "Total Profit", () => showPage("accounts"), totalProfit >= 0 ? "win" : "loss"],
    ["ph-percent", "violet", `${winrate}%`, "Winrate global", () => showPage("stats"), null],
    ["ph-notebook", "warning", tradesCeMois, "Trades ce mois", () => showPage("journal"), null],
    ["ph-medal", "muted", goalsEnCours, "Goals en cours", () => showPage("goals"), null],
  ];
  const wrap = document.getElementById("dash-cards");
  wrap.innerHTML = cards.map((c, i) => `
    <div class="stat-card clickable" data-i="${i}">
      ${statIconHtml(c[0], c[1])}
      <div class="num ${c[5] || ""}">${c[2]}</div>
      <div class="label">${c[3]}</div>
    </div>`).join("");
  wrap.querySelectorAll(".stat-card").forEach(el => el.addEventListener("click", () => cards[Number(el.dataset.i)][4]()));

  document.getElementById("dash-accounts").innerHTML = stats.length ? stats.map(({ a, s }) => `
    <tr onclick="openAccountDialog(${a.id})" style="cursor:pointer;">
      <td data-label="Compte">${accountLabel(a)}</td><td data-label="Balance" class="mono">$${s.totalBalance.toFixed(2)}</td>
      <td data-label="Profit" class="mono" style="color:${s.totalProfit >= 0 ? "var(--win)" : "var(--loss)"}">$${s.totalProfit.toFixed(2)}</td>
      <td data-label="ROI" class="mono">${s.roi}%</td><td data-label="Trades">${s.nbTrades}</td><td data-label="Target" class="mono">${a.target != null ? "$" + a.target : "—"}</td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="6">Aucun compte — crée ton premier compte.</td></tr>`;

  const goalsRows = cache.goals.filter(g => g.statut === "En cours").slice(0, 6);
  document.getElementById("dash-goals").innerHTML = goalsRows.length ? goalsRows.map(g => {
    const pct = g.target_value ? Math.min(100, round2((g.current_value / g.target_value) * 100)) : 0;
    return `<tr onclick="openGoalDialog(${g.id})" style="cursor:pointer;">
      <td data-label="Titre">${g.titre}</td><td data-label="Progression">${pct}% (${g.current_value ?? 0}/${g.target_value ?? "—"})</td>
      <td data-label="Échéance">${fmtDateFR(g.deadline) || "—"}</td><td data-label="Statut">${badge(g.statut, STATUT_COLORS[g.statut])}</td></tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="4">Aucun goal en cours</td></tr>`;

  const wp = currentWeeklyPlanner();
  const news = wp ? cache.economic_news.filter(n => n.weekly_planner_id === wp.id) : [];
  document.getElementById("dash-news").innerHTML = news.length ? news.map(n => `
    <tr><td data-label="Date" class="${n.date_event === today ? "due-today" : ""}">${fmtDateFR(n.date_event)}</td><td data-label="Event">${n.event}</td>
    <td data-label="Impact">${badgeSubtle(n.impact, STATUT_COLORS[n.impact])}</td><td data-label="Implication">${n.implication || "—"}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">Aucune news renseignée pour cette semaine</td></tr>`;

  // colonne droite : comptes examen
  const examAccounts = cache.accounts.filter(a => a.account_type === "examen");
  const exWrap = document.getElementById("dash-exam-cards");
  if (!examAccounts.length) {
    exWrap.innerHTML = `<div class="panel"><p style="color:var(--muted);margin:0;font-size:12.5px;">Aucun compte examen configuré. Ajoute-en un depuis l'onglet Comptes (type = "Compte examen").</p></div>`;
  } else {
    let html = "";
    examAccounts.forEach(a => {
      const s = accountStats(a);
      if (a.account_status === "en_cours" && s.daysRemaining != null) {
        const urgent = s.daysRemaining <= 3;
        html += `<div class="stat-hero ${urgent ? "urgent" : ""}" onclick="showPage('accounts')" style="cursor:pointer;">
          <i class="ph ph-hourglass stat-hero-icon"></i>
          <div class="stat-hero-label">Temps restant — ${accountLabel(a)}</div>
          <div class="num">${s.daysRemaining >= 0 ? s.daysRemaining + " j" : "Dépassé"}</div>
          <div class="sub">Échéance le ${fmtDateFR(a.deadline_date)}</div>
        </div>`;
      }
    });
    const enCours = examAccounts.filter(a => a.account_status === "en_cours").length;
    const valides = examAccounts.filter(a => a.account_status === "valide").length;
    const echoues = examAccounts.filter(a => a.account_status === "echoue").length;
    html += `<div class="panel">
      <h3><i class="ph ph-exam"></i> Statut des comptes examen</h3>
      <div class="chart-row">
        <div class="chip chip-win"><i class="ph ph-check-circle"></i> ${valides} validé${valides > 1 ? "s" : ""}</div>
        <div class="chip"><i class="ph ph-hourglass-medium"></i> ${enCours} en cours</div>
        <div class="chip chip-danger"><i class="ph ph-x-circle"></i> ${echoues} échoué${echoues > 1 ? "s" : ""}</div>
      </div>
    </div>`;
    exWrap.innerHTML = html;
  }
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
function tradeOptionsHtml(selectedId, dateFilter) {
  let list = cache.trades;
  if (dateFilter) list = list.filter(t => t.trade_date === dateFilter);
  if (!list.length) list = cache.trades;
  return `<option value="">— Aucun —</option>` + list.map(t => `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${fmtDateFR(t.trade_date)} — ${t.ticker}</option>`).join("");
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
      <td data-label="Date">${fmtDateFR(t.trade_date)}</td>
      <td data-label="Ticker" style="font-weight:bold;">${t.ticker || "—"}</td>
      <td data-label="Direction">${badgeSubtle(t.direction, STATUT_COLORS[t.direction])}</td>
      <td data-label="Compte">${accountLabel(findAccount(t.account_id))}</td>
      <td data-label="Setup">${setupLabel(findSetup(t.setup_id))}</td>
      <td data-label="Session">${badgeSubtle(t.session, STATUT_COLORS[t.session])}</td>
      <td data-label="Risk" class="mono">${t.risk_percent}%</td>
      <td data-label="RR" class="mono">${t.rr != null ? t.rr + "R" : "—"}</td>
      <td data-label="Résultat">${badgeSubtle(t.resultat, STATUT_COLORS[t.resultat])}</td>
      <td data-label="P/L" class="mono" style="color:${(t.profit_loss || 0) >= 0 ? "var(--win)" : "var(--loss)"};font-weight:bold;">$${Number(t.profit_loss || 0).toFixed(2)}</td>
      <td class="row-actions">
        <button onclick="openTradeDialog(${t.id})"><i class="ph ph-pencil-simple"></i></button>
        <button onclick="confirmDelete('trades', ${t.id}, renderJournal)"><i class="ph ph-trash"></i></button>
      </td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="11">Aucun trade — enregistre ton premier trade.</td></tr>`;
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
      { key: "rr", label: "RR (ratio risque/gain, ex: 2.5)", type: "number", value: row.rr },
      { key: "session", label: "Session", type: "select", options: SESSIONS, value: row.session || "London" },
      { key: "resultat", label: "Résultat (Win / Loss)", type: "select", options: RESULTATS, value: row.resultat || "Win" },
      { key: "profit_loss", label: "Profit / Loss ($)", type: "number", required: true, value: row.profit_loss ?? 0 },
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
    rows.map(r => {
      const linked = cache.trades.find(t => t.daily_review_id === r.id);
      return `
      <div class="panel" style="margin-bottom:0;cursor:pointer;" onclick="openReviewDialog(${r.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong>${fmtDateFR(r.review_date)}</strong>
          <button class="row-actions" style="background:none;border:none;color:var(--muted);" onclick="event.stopPropagation();confirmDelete('daily_reviews', ${r.id}, renderReview)"><i class="ph ph-trash"></i></button>
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
          ${linked ? `<div style="margin-top:6px;"><span style="color:var(--muted);">Trade lié</span> ${linked.ticker} (${fmtDateFR(linked.trade_date)})</div>` : ""}
        </div>
      </div>`;
    }).join("") + `</div>`
    : `<div class="panel"><p style="color:var(--muted);margin:0;">Aucune Daily Review — crée ta première review.</p></div>`;
}

function openReviewDialog(id) {
  const row = id ? cache.daily_reviews.find(r => r.id === id) : {};
  const linkedTrade = id ? cache.trades.find(t => t.daily_review_id === id) : null;
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
      { key: "trade_link", label: "Lier un trade du journal (optionnel)", type: "select-raw", optionsHtml: tradeOptionsHtml(linkedTrade ? linkedTrade.id : null, row.review_date), virtual: true },
      { key: "notes", label: "Notes", type: "textarea", value: row.notes },
    ],
    onSaved: async (saved, virtual) => {
      if (virtual.trade_link) await updateRow("trades", Number(virtual.trade_link), { daily_review_id: saved.id });
      await refreshAll();
    },
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

  const news = cache.economic_news.filter(n => n.weekly_planner_id === wp.id).sort((a, b) => (a.date_event || "").localeCompare(b.date_event || ""));
  document.getElementById("weekly-news-tbody").innerHTML = news.length ? news.map(n => `
    <tr><td data-label="Date">${fmtDateFR(n.date_event)}</td><td data-label="Heure">${n.heure || "—"}</td><td data-label="Type">${n.event_type || "—"}</td><td data-label="Event">${n.event}</td><td data-label="Impact">${badgeSubtle(n.impact, STATUT_COLORS[n.impact])}</td><td data-label="Implication">${n.implication || "—"}</td>
    <td class="row-actions"><button onclick="openNewsDialog(${n.id})"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('economic_news', ${n.id}, renderWeekly)"><i class="ph ph-trash"></i></button></td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="7">Aucune news économique renseignée</td></tr>`;

  renderWeekAdviceGrid(wp, news);
}
function newsEventDatalist() {
  return `<datalist id="event-name-presets">${EVENT_NAME_PRESETS.map(n => `<option value="${escapeAttr(n)}">`).join("")}</datalist>`;
}
function openNewsDialog(id) {
  const row = id ? cache.economic_news.find(n => n.id === id) : {};
  const wp = currentWeeklyPlanner();
  const isAllDay = row.heure === "Toute la journée";
  openModal({
    title: id ? "Modifier la news" : "Nouvelle news économique",
    table: "economic_news", id,
    fields: [
      { key: "date_event", label: "Date", type: "date", required: true, value: row.date_event || todayStr() },
      { key: "all_day", label: "Annonce toute la journée (pas d'heure précise)", type: "checkbox", virtual: true, value: isAllDay },
      { key: "heure", label: "Heure (ex: 08:30)", type: "text", value: isAllDay ? "" : row.heure },
      { key: "event_type", label: "Type d'évènement", type: "select", options: EVENT_TYPES, value: row.event_type || "Autre" },
      { key: "event", label: "Évènement", type: "text-list", listId: "event-name-presets", required: true, value: row.event },
      { key: "impact", label: "Impact", type: "select", options: IMPACTS, value: row.impact || "Moyen" },
      { key: "implication", label: "Ce que cela implique", type: "textarea", value: row.implication },
    ],
    beforeSave: (values, virtual) => {
      values.weekly_planner_id = wp ? wp.id : row.weekly_planner_id;
      if (virtual.all_day) values.heure = "Toute la journée";
    },
    onSaved: refreshAll,
  });
}

// ========================================================================
//  DAILY PLANNER (checklist type ICT — regroupe biais semaine + journée)
// ========================================================================
const DAILY_BIAS_TEMPLATE = [
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
    <tr><td data-label="Date">${fmtDateFR(n.date_event)}</td><td data-label="Event">${n.event}</td><td data-label="Impact">${badgeSubtle(n.impact, STATUT_COLORS[n.impact])}</td><td data-label="Implication">${n.implication || "—"}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">Aucune news économique aujourd'hui</td></tr>`;

  const weekNews = cache.economic_news.filter(n => n.weekly_planner_id === dp.weekly_planner_id);
  renderDailyAdviceBanner(dp.planner_date, weekNews);
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
async function loadDailyTemplate() {
  const dp = await ensureDailyPlanner();
  const existingLabels = new Set((dp.bias_checklist || []).map(it => it.label));
  const toAdd = DAILY_BIAS_TEMPLATE.filter(l => !existingLabels.has(l)).map(label => ({ label, checked: false }));
  if (!toAdd.length) { showToast("Checklist type déjà chargée"); return; }
  const items = [...(dp.bias_checklist || []), ...toAdd];
  await updateRow("daily_planners", dp.id, { bias_checklist: items });
  await refreshAll();
}

// ========================================================================
//  MOTEUR DE RECOMMANDATION TRADING (règles ICT)
// ========================================================================
const SESSION_SLOTS = ["London", "Pre-Market", "NY AM", "Lunch", "NY PM", "Last Hour"];
const ADVICE_RANK = { "ok": 0, "caution": 1, "avoid": 2 };
const ADVICE_LABEL = { "ok": "Trade OK", "caution": "Prudence", "avoid": "Éviter" };

function weekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 0 || day === 6) return null;
  return day - 1;
}
function computeDayAdvice(dateStr, weekNews) {
  const slots = {};
  SESSION_SLOTS.forEach(s => { slots[s] = { status: "ok", reasons: [] }; });
  const bump = (slot, status, reason) => {
    if (ADVICE_RANK[status] > ADVICE_RANK[slots[slot].status]) slots[slot].status = status;
    slots[slot].reasons.push(reason);
  };
  const bumpAll = (status, reason) => SESSION_SLOTS.forEach(s => bump(s, status, reason));
  const bumpPM = (status, reason) => { bump("NY PM", status, reason); bump("Last Hour", status, reason); };

  const today = weekNews.filter(n => n.date_event === dateStr);
  const tomorrow = weekNews.filter(n => n.date_event === addDays(dateStr, 1));
  const yesterday = weekNews.filter(n => n.date_event === addDays(dateStr, -1));
  const hasType = (list, type) => list.some(n => n.event_type === type);
  const highToday = today.filter(n => HIGH_IMPACT_TYPES.includes(n.event_type) || n.impact === "Élevé");

  if (hasType(today, "NFP")) {
    bump("Pre-Market", "caution", "NFP à 8:30am — prudence avant la news.");
    bump("London", "caution", "Range asiatique/London avant le Judas Swing du NFP.");
    bump("NY AM", "avoid", "N'échange pas NFP entre 8h et 9h30 — attends 9h30-10am.");
    bump("Lunch", "caution", "NFP : le vrai mouvement peut se poursuivre après 9h30.");
    bumpPM("avoid", "Évite la PM session le jour du NFP.");
  }
  if (hasType(today, "FOMC / FED")) {
    bump("Pre-Market", "caution", "Jour de FOMC : trade tôt (7h-8h30) ou pas du tout.");
    bump("NY AM", "avoid", "Évite l'AM session le jour du FOMC.");
    bump("Lunch", "caution", "FOMC : le 1er run (14h) est souvent un leurre.");
    bumpPM("avoid", "Le vrai mouvement FOMC arrive vers 14h25-14h30, pas avant.");
  }
  if (hasType(today, "CPI") || hasType(today, "PPI")) {
    bump("Pre-Market", "avoid", "Ne rien faire avant CPI/PPI — roulette russe.");
    bump("NY AM", "caution", "Attends 30min minimum ou l'Opening Bell 9h30 après CPI/PPI.");
    bumpPM("caution", "PPI le lendemain d'un CPI : prudence sur la PM.");
  }
  if (hasType(today, "Powell Speech")) {
    bump("NY AM", "caution", "Powell parle — Price Action possiblement erratique (Smoke Screen).");
    bumpPM("caution", "Powell : configuration à observer 15-30min après son discours.");
  }
  const highTomorrow = tomorrow.filter(n => HIGH_IMPACT_TYPES.includes(n.event_type));
  if (highTomorrow.length) bumpPM("avoid", `Veille de ${highTomorrow.map(n => n.event_type).join(", ")} — n'échange pas la PM session.`);
  const powellTomorrow = tomorrow.some(n => n.event_type === "Powell Speech");
  if (powellTomorrow) bumpPM("avoid", "Veille d'un discours de Powell — trade l'AM, évite la PM.");

  if (hasType(yesterday, "FOMC / FED")) {
    bump("NY AM", "avoid", "Lendemain de FOMC — on observe, on ne trade pas l'AM.");
    bump("Lunch", "caution", "Lendemain de FOMC — collecte de données pour la PM.");
  }
  if (highToday.length >= 2) bump("NY AM", "avoid", "2 news à fort impact dans la session — configuration Seek & Destroy probable.");

  const wd = weekdayIndex(dateStr);
  if (wd === 0 && !today.length) {
    const hasHighLaterInWeek = weekNews.some(n => HIGH_IMPACT_TYPES.includes(n.event_type) && n.date_event > dateStr);
    if (hasHighLaterInWeek) bumpAll("caution", "Lundi d'une semaine à évènement (NFP/FOMC/CPI) — journée de consolidation probable.");
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
    : `<li>Aucune news à fort impact détectée — journée sans contrainte particulière.</li>`;
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
    ["ph-notebook", "warning", totalTrades, "Trades enregistrés"],
    ["ph-percent", "violet", winrate + "%", "Winrate global"],
    ["ph-currency-circle-dollar", "accent", "$" + totalPL.toFixed(2), "P/L cumulé"],
  ].map(c => `<div class="stat-card">${statIconHtml(c[0], c[1])}<div class="num">${c[2]}</div><div class="label">${c[3]}</div></div>`).join("");

  // courbe d'equity réelle (cumul du P/L, tous comptes confondus)
  const sortedTrades = [...cache.trades].sort((a, b) => (a.trade_date || "").localeCompare(b.trade_date || ""));
  let cum = 0;
  const equityPoints = sortedTrades.map(t => { cum += Number(t.profit_loss) || 0; return { date: t.trade_date, value: round2(cum) }; });
  document.getElementById("stats-equity").innerHTML = equityCurveSVG(equityPoints);

  // drawdown restant (comptes avec une limite définie)
  const ddAccounts = cache.accounts.filter(a => a.max_drawdown_percent);
  const ddPanel = document.getElementById("stats-drawdown-panel");
  if (ddAccounts.length) {
    ddPanel.style.display = "block";
    document.getElementById("stats-drawdown").innerHTML = ddAccounts.map(a => {
      const s = accountStats(a);
      const remaining = s.drawdownUsedPercent == null ? 100 : 100 - s.drawdownUsedPercent;
      return `<div class="ring-wrap">${ringSVG(remaining)}<div class="ring-label">${accountLabel(a)}<br>drawdown restant</div></div>`;
    }).join("");
  } else ddPanel.style.display = "none";

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

  // par setup (winrate + sparkline de la tendance P/L cumulée)
  const bySetup = cache.setups.map(s => ({ s, ...setupStats(s) }));
  const bestSetup = bySetup.filter(x => x.nbTrades > 0).sort((a, b) => (b.winrate || 0) - (a.winrate || 0))[0];
  document.getElementById("stats-setup").innerHTML =
    (bestSetup ? `<div class="page-note" style="margin-top:0;">🏆 Setup le plus réussi : <strong>${setupLabel(bestSetup.s)}</strong> (${bestSetup.winrate}%)</div>` : "") +
    (bySetup.length ? bySetup.map(x => `
      <div class="setup-chart-row">
        <div style="flex:1;min-width:120px;">
          <div style="font-weight:600;font-size:13px;">${setupLabel(x.s)}</div>
          <div style="font-size:11.5px;color:var(--muted);">${x.nbTrades} trades ${x.winrate != null ? "· " + x.winrate + "% winrate" : ""}</div>
        </div>
        ${sparklineSVG(x.series)}
        <div class="mono" style="width:80px;text-align:right;font-weight:700;color:${x.totalPL >= 0 ? "var(--win)" : "var(--loss)"};">$${x.totalPL.toFixed(2)}</div>
      </div>`).join("") : `<p style="color:var(--muted);">Aucun setup créé.</p>`);

  // gains jour / semaine / mois
  const today = todayStr();
  const weekStart = mondayOf(today);
  const monthStart = today.slice(0, 7);
  const gainsJour = round2(cache.trades.filter(t => t.trade_date === today).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const gainsSemaine = round2(cache.trades.filter(t => (t.trade_date || "") >= weekStart).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const gainsMois = round2(cache.trades.filter(t => (t.trade_date || "").startsWith(monthStart)).reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  document.getElementById("stats-gains").innerHTML = `
    <div class="cards-grid" style="margin-bottom:0;">
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
      <td data-label="Titre">${g.titre}</td>
      <td data-label="Progression">${pct}% (${g.current_value ?? 0}/${g.target_value ?? "—"})<div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div></td>
      <td data-label="Échéance">${fmtDateFR(g.deadline) || "—"}</td>
      <td data-label="Statut">${badge(g.statut, STATUT_COLORS[g.statut])}</td>
      <td class="row-actions"><button onclick="openGoalDialog(${g.id})"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('goals', ${g.id}, renderGoals)"><i class="ph ph-trash"></i></button></td>
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
//  WALLET
// ========================================================================
function renderWallet() {
  const totals = { profit_reel: 0, retrait: 0, epargne: 0 };
  cache.wallet_entries.forEach(w => { totals[w.entry_type] = (totals[w.entry_type] || 0) + (Number(w.amount) || 0); });
  document.getElementById("wallet-cards").innerHTML = [
    ["ph-hand-coins", "win", "$" + round2(totals.profit_reel).toFixed(2), "Bénéfice réel généré"],
    ["ph-arrow-line-down", "warning", "$" + round2(totals.retrait).toFixed(2), "Retraits"],
    ["ph-piggy-bank", "accent", "$" + round2(totals.epargne).toFixed(2), "Épargne"],
  ].map(c => `<div class="stat-card">${statIconHtml(c[0], c[1])}<div class="num">${c[2]}</div><div class="label">${c[3]}</div></div>`).join("");

  const rows = [...cache.wallet_entries];
  document.getElementById("wallet-tbody").innerHTML = rows.length ? rows.map(w => {
    const label = (WALLET_TYPES.find(t => t.value === w.entry_type) || {}).label || w.entry_type;
    return `<tr>
      <td data-label="Date">${fmtDateFR(w.entry_date)}</td>
      <td data-label="Type">${label}</td>
      <td data-label="Montant" class="mono">$${Number(w.amount || 0).toFixed(2)}</td>
      <td data-label="Notes">${w.notes || "—"}</td>
      <td class="row-actions"><button onclick="openWalletDialog(${w.id})"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('wallet_entries', ${w.id}, renderWallet)"><i class="ph ph-trash"></i></button></td>
    </tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="5">Aucune entrée — ajoute ton premier mouvement.</td></tr>`;
}
function openWalletDialog(id) {
  const row = id ? cache.wallet_entries.find(w => w.id === id) : {};
  openModal({
    title: id ? "Modifier l'entrée" : "Nouvelle entrée Wallet",
    table: "wallet_entries", id,
    fields: [
      { key: "entry_type", label: "Type", type: "select-raw", optionsHtml: WALLET_TYPES.map(t => `<option value="${t.value}" ${t.value === row.entry_type ? "selected" : ""}>${t.label}</option>`).join(""), value: row.entry_type },
      { key: "amount", label: "Montant ($)", type: "number", required: true, value: row.amount },
      { key: "entry_date", label: "Date", type: "date", required: true, value: row.entry_date || todayStr() },
      { key: "notes", label: "Notes", type: "textarea", value: row.notes },
    ],
    onSaved: refreshAll,
  });
}

// ========================================================================
//  COMPTES (Examen / Actif)
// ========================================================================
function accountCardHtml(a) {
  const s = accountStats(a);
  const isExam = a.account_type === "examen";
  const chips = [];
  if (isExam) {
    if (s.daysRemaining != null) {
      const cls = s.daysRemaining <= 3 ? "chip-danger" : s.daysRemaining <= 7 ? "chip-warning" : "";
      chips.push(`<div class="chip ${cls}"><i class="ph ph-hourglass"></i> ${s.daysRemaining >= 0 ? s.daysRemaining + " j restants" : "Échéance dépassée"}</div>`);
    }
    if (s.progressPercent != null) chips.push(`<div class="chip chip-win"><i class="ph ph-trend-up"></i> ${Math.round(s.progressPercent)}% de l'objectif</div>`);
    if (s.drawdownUsedPercent != null) {
      const cls = s.drawdownUsedPercent >= 80 ? "chip-danger" : s.drawdownUsedPercent >= 50 ? "chip-warning" : "";
      chips.push(`<div class="chip ${cls}"><i class="ph ph-gauge"></i> Drawdown ${Math.round(s.drawdownUsedPercent)}% de la limite</div>`);
    }
    chips.push(`<div class="chip ${s.dailyPL >= 0 ? "chip-win" : "chip-danger"}"><i class="ph ph-calendar-check"></i> P/L du jour : $${s.dailyPL.toFixed(2)}</div>`);
    chips.push(`<div class="chip"><i class="ph ph-flag"></i> ${ACCOUNT_STATUS_LABEL[a.account_status] || "En cours"}</div>`);
  }
  return `
    <div class="account-card">
      <div class="account-card-head">
        <div>
          <div style="font-weight:700;font-size:15px;">${accountLabel(a)}</div>
          <div style="font-size:11.5px;color:var(--muted);">${isExam ? "Compte examen" : "Compte actif"}</div>
        </div>
        <div class="row-actions"><button onclick="openAccountDialog(${a.id})"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('accounts', ${a.id}, renderAccounts)"><i class="ph ph-trash"></i></button></div>
      </div>
      <div class="cards-grid" style="margin-bottom:0;">
        <div><div class="label">Starting Balance</div><div class="mono" style="font-weight:700;">$${Number(a.starting_balance || 0).toFixed(2)}</div></div>
        <div><div class="label">Total Balance</div><div class="mono" style="font-weight:700;">$${s.totalBalance.toFixed(2)}</div></div>
        <div><div class="label">Total Profit</div><div class="mono" style="font-weight:700;color:${s.totalProfit >= 0 ? "var(--win)" : "var(--loss)"};">$${s.totalProfit.toFixed(2)}</div></div>
        <div><div class="label">ROI</div><div class="mono" style="font-weight:700;">${s.roi}%</div></div>
        <div><div class="label">Trades</div><div class="mono" style="font-weight:700;">${s.nbTrades}</div></div>
        <div><div class="label">Target</div><div class="mono" style="font-weight:700;">${a.target != null ? "$" + a.target : "—"}</div></div>
      </div>
      ${chips.length ? `<div class="account-chips">${chips.join("")}</div>` : ""}
    </div>`;
}
function renderAccounts() {
  const exam = cache.accounts.filter(a => a.account_type === "examen");
  const actif = cache.accounts.filter(a => a.account_type !== "examen");
  document.getElementById("accounts-exam-list").innerHTML = exam.length ? exam.map(accountCardHtml).join("") : `<div class="panel"><p style="color:var(--muted);margin:0;">Aucun compte examen.</p></div>`;
  document.getElementById("accounts-actif-list").innerHTML = actif.length ? actif.map(accountCardHtml).join("") : `<div class="panel"><p style="color:var(--muted);margin:0;">Aucun compte actif.</p></div>`;
}
function openAccountDialog(id) {
  const row = id ? cache.accounts.find(a => a.id === id) : {};
  openModal({
    title: id ? "Modifier le compte" : "Nouveau compte",
    table: "accounts", id,
    fields: [
      { key: "nom", label: "Nom du compte", type: "text", required: true, value: row.nom },
      { key: "account_type", label: "Type de compte", type: "select-raw", optionsHtml: ACCOUNT_TYPES.map(t => `<option value="${t.value}" ${t.value === (row.account_type || "actif") ? "selected" : ""}>${t.label}</option>`).join(""), value: row.account_type },
      { key: "starting_balance", label: "Starting Balance ($)", type: "number", required: true, value: row.starting_balance ?? 0 },
      { key: "target", label: "Target ($)", type: "number", value: row.target },
      { key: "deadline_date", label: "Échéance (comptes examen)", type: "date", value: row.deadline_date },
      { key: "max_drawdown_percent", label: "Drawdown max autorisé (%)", type: "number", value: row.max_drawdown_percent },
      { key: "daily_loss_limit_percent", label: "Limite de perte quotidienne (%)", type: "number", value: row.daily_loss_limit_percent },
      { key: "account_status", label: "Statut", type: "select-raw", optionsHtml: ACCOUNT_STATUSES.map(t => `<option value="${t.value}" ${t.value === (row.account_status || "en_cours") ? "selected" : ""}>${t.label}</option>`).join(""), value: row.account_status },
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
      <td data-label="Nom">${setupLabel(s)}</td><td data-label="Description">${s.description || "—"}</td><td data-label="Nb trades">${st.nbTrades}</td>
      <td data-label="Winrate">${st.winrate == null ? "—" : st.winrate + "%"}</td>
      <td data-label="Tendance P/L">${sparklineSVG(st.series)}</td>
      <td class="row-actions"><button onclick="openSetupDialog(${s.id})"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('setups', ${s.id}, renderSetups)"><i class="ph ph-trash"></i></button></td>
    </tr>`;
  }).join("") : `<tr class="empty-row"><td colspan="6">Aucun setup — crée ton premier setup.</td></tr>`;
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
//  NOTIFICATIONS (calculées côté client — alertes in-app + navigateur)
// ========================================================================
function getNotifPref() { return localStorage.getItem("ictos-notif-pref") || "all"; }
function setNotifPref(v) { localStorage.setItem("ictos-notif-pref", v); renderNotifications(); }

function computeNotifications() {
  const list = [];
  const now = new Date();
  const today = todayStr();

  const hasTradeToday = cache.trades.some(t => t.trade_date === today);
  if (!hasTradeToday && now.getHours() >= 18) {
    list.push({ id: "journal-reminder", level: "info", icon: "ph-notebook", text: "N'oublie pas de compléter ton Trading Journal aujourd'hui.", page: "journal" });
  }
  const recentTrades = cache.trades.filter(t => (t.trade_date || "") >= addDays(today, -7));
  if (cache.trades.length && !recentTrades.length) {
    list.push({ id: "stats-stale", level: "info", icon: "ph-chart-line-up", text: "Aucun trade cette semaine — pense à mettre à jour tes statistiques.", page: "stats" });
  }
  cache.goals.filter(g => g.statut === "En cours" && g.deadline).forEach(g => {
    const d = daysUntil(g.deadline);
    if (d != null && d <= 3 && d >= 0) list.push({ id: "goal-" + g.id, level: "urgent", icon: "ph-target", text: `Goal "${g.titre}" : échéance dans ${d} j.`, page: "goals" });
    else if (d != null && d > 3 && d <= 7) list.push({ id: "goal-soon-" + g.id, level: "info", icon: "ph-target", text: `Goal "${g.titre}" : échéance dans ${d} j.`, page: "goals" });
  });
  cache.accounts.forEach(a => {
    if (a.account_type !== "examen" || a.account_status !== "en_cours") return;
    const s = accountStats(a);
    if (s.daysRemaining != null && s.daysRemaining <= 3) list.push({ id: "acc-time-" + a.id, level: "urgent", icon: "ph-hourglass", text: `Compte "${accountLabel(a)}" : ${s.daysRemaining >= 0 ? s.daysRemaining + " j restants" : "échéance dépassée"}.`, page: "accounts" });
    if (a.max_drawdown_percent && s.drawdownUsedPercent != null && s.drawdownUsedPercent >= 80) list.push({ id: "acc-dd-" + a.id, level: "urgent", icon: "ph-warning", text: `Compte "${accountLabel(a)}" : drawdown à ${Math.round(s.drawdownUsedPercent)}% de la limite.`, page: "accounts" });
    if (a.daily_loss_limit_percent && a.starting_balance) {
      const dailyLossPct = s.dailyPL < 0 ? (-s.dailyPL / a.starting_balance) * 100 : 0;
      if (dailyLossPct >= a.daily_loss_limit_percent * 0.8) list.push({ id: "acc-daily-" + a.id, level: "urgent", icon: "ph-trend-down", text: `Compte "${accountLabel(a)}" : perte du jour proche de la limite quotidienne.`, page: "accounts" });
    }
  });
  return list;
}
function renderNotifications() {
  if (!currentUser) return;
  const pref = getNotifPref();
  const all = computeNotifications();
  const visible = pref === "urgent" ? all.filter(n => n.level === "urgent") : all;

  const dot = document.getElementById("notif-dot");
  if (visible.length) { dot.style.display = "flex"; dot.textContent = visible.length > 9 ? "9+" : visible.length; }
  else dot.style.display = "none";

  const listEl = document.getElementById("notif-list");
  listEl.innerHTML = visible.length ? visible.map(n => `
    <div class="notif-item ${n.level}" onclick="showPage('${n.page}');document.getElementById('notif-panel').classList.remove('open');">
      <i class="ph ${n.icon}"></i><span>${n.text}</span>
    </div>`).join("") : `<div class="notif-empty">Rien à signaler pour le moment 👍</div>`;

  document.getElementById("notif-pref-urgent").classList.toggle("active", pref === "urgent");
  document.getElementById("notif-pref-all").classList.toggle("active", pref === "all");

  maybeSendBrowserNotifications(all.filter(n => n.level === "urgent"));
}
function maybeSendBrowserNotifications(urgentList) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = todayStr();
  urgentList.forEach(n => {
    const dedupKey = "ictos-notif-sent-" + n.id + "-" + today;
    if (localStorage.getItem(dedupKey)) return;
    try { new Notification("ICT.OS", { body: n.text, icon: "icon-192.png" }); } catch (e) { /* ignore */ }
    localStorage.setItem(dedupKey, "1");
  });
}
function toggleNotifPanel() {
  const panel = document.getElementById("notif-panel");
  panel.classList.toggle("open");
  if (panel.classList.contains("open") && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// ========================================================================
//  THÈME CLAIR / SOMBRE
// ========================================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.innerHTML = theme === "dark" ? `<i class="ph ph-sun"></i>` : `<i class="ph ph-moon"></i>`;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", "#1B4946");
}
function initTheme() {
  const saved = localStorage.getItem("ictos-theme");
  const preferred = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("ictos-theme", next);
  applyTheme(next);
}

// ========================================================================
//  GESTE DE BALAYAGE (ouvrir/fermer la sidebar sur mobile)
// ========================================================================
function initSwipeGestures() {
  let startX = null, startY = null, tracking = false;
  document.addEventListener("touchstart", e => {
    if (!currentUser) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    const sidebarOpen = document.getElementById("sidebar").classList.contains("open");
    tracking = (!sidebarOpen && startX < 50) || sidebarOpen;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!currentUser || !tracking || startX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX, dy = t.clientY - startY;
    const sidebarOpen = document.getElementById("sidebar").classList.contains("open");
    if (Math.abs(dx) > 45 && Math.abs(dy) < 90) {
      if (!sidebarOpen && dx > 0) openMobileMenu();
      else if (sidebarOpen && dx < 0) closeMobileMenu();
    }
    startX = null; startY = null; tracking = false;
  }, { passive: true });
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
      input = `<div class="field-checkbox"><input type="checkbox" name="${f.key}" ${f.value ? "checked" : ""}></div>`;
    } else if (f.type === "file") {
      input = `<input type="file" name="${f.key}" accept="${f.accept || "*"}">`;
    } else if (f.type === "text-list") {
      input = `<input type="text" name="${f.key}" list="${f.listId}" value="${f.value != null ? escapeAttr(f.value) : ""}" ${f.required ? "required" : ""}>` + newsEventDatalist();
    } else {
      input = `<input type="${f.type}" name="${f.key}" value="${f.value != null ? escapeAttr(f.value) : ""}" ${f.required ? "required" : ""}>`;
    }
    if (f.type === "checkbox") return `<div class="field"><label style="display:inline;">${f.label}${f.required ? " *" : ""}</label> ${input}</div>`;
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
  const values = {}; const virtualValues = {}; const fileFields = []; let missingRequired = false;
  fields.forEach(f => {
    if (f.type === "file") { fileFields.push({ f, el: form.elements[f.key] }); return; }
    const el = form.elements[f.key]; if (!el) return;
    let val;
    if (f.type === "checkbox") val = el.checked;
    else {
      val = el.value;
      if (f.required && !val) missingRequired = true;
      if (val === "") val = null;
      if (val !== null && (f.type === "number" || f.numeric)) val = Number(val);
    }
    if (f.virtual) { virtualValues[f.key] = val; return; }
    values[f.key] = val;
  });
  if (missingRequired) { showToast("Merci de remplir les champs obligatoires"); return; }
  if (beforeSave) beforeSave(values, virtualValues);

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
  if (onSaved) await onSaved(saved, virtualValues);
}
function confirmDelete(table, id, afterFn) {
  if (!confirm("Supprimer cet élément ? Cette action est irréversible.")) return;
  deleteRow(table, id).then(async ok => {
    if (ok) { showToast("Supprimé"); await refreshCache(); if (afterFn) afterFn(); else renderPage(currentPage); renderNotifications(); }
  });
}

// ========================================================================
//  FILET DE SÉCURITÉ GLOBAL
//  Si une erreur JS imprévue survient n'importe où dans l'appli, on s'assure
//  que le loader plein écran ne reste jamais bloqué et n'empêche jamais
//  l'utilisateur d'interagir avec l'interface.
// ========================================================================
function forceHideLoaderOnError() {
  const loader = document.getElementById("app-loader");
  if (loader && loader.style.display !== "none") loader.style.display = "none";
}
window.addEventListener("error", forceHideLoaderOnError);
window.addEventListener("unhandledrejection", forceHideLoaderOnError);

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
  document.getElementById("sidebar-collapse-btn").addEventListener("click", collapseSidebar);
  document.getElementById("sidebar-expand-btn").addEventListener("click", expandSidebar);
  initSidebarCollapse();
  document.getElementById("sidebar-logo").addEventListener("click", () => showPage("dashboard"));
  document.getElementById("mobile-topbar-title").addEventListener("click", () => showPage("dashboard"));
  document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
  document.getElementById("notif-btn").addEventListener("click", e => { e.stopPropagation(); toggleNotifPanel(); });
  document.getElementById("notif-pref-urgent").addEventListener("click", () => setNotifPref("urgent"));
  document.getElementById("notif-pref-all").addEventListener("click", () => setNotifPref("all"));
  document.addEventListener("click", e => {
    const panel = document.getElementById("notif-panel");
    if (panel.classList.contains("open") && !panel.contains(e.target) && e.target.id !== "notif-btn") panel.classList.remove("open");
  });
  initTheme();
  initSwipeGestures();

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
  document.getElementById("btn-new-wallet").addEventListener("click", () => openWalletDialog(null));

  document.getElementById("daily-checklist-add").addEventListener("click", addDailyChecklist);
  document.getElementById("daily-checklist-input").addEventListener("keydown", e => { if (e.key === "Enter") addDailyChecklist(); });
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

  setInterval(() => { if (currentUser) renderNotifications(); }, 5 * 60 * 1000);

  sb.auth.getSession().then(({ data }) => { if (data.session) onLoggedIn(data.session.user); });
  if ("serviceWorker" in navigator) {
    // IMPORTANT : on ne branche la logique "recharger sur mise à jour" que s'il y avait
    // déjà un service worker actif AVANT ce chargement. Sur une toute première installation
    // (ou juste après avoir effacé les données du site), navigator.serviceWorker.controller
    // est encore null à ce stade : dans ce cas on n'écoute rien, pour éviter tout rechargement
    // intempestif juste après le premier chargement de la page.
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.update().catch(() => {});
      if (!hadControllerBefore) return;
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated" && !sessionStorage.getItem("ictos-reloaded-for-update")) {
            sessionStorage.setItem("ictos-reloaded-for-update", "1");
            location.reload();
          }
        });
      });
    }).catch(() => {});
  }
});
