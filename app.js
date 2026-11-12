const $ = (id) => document.getElementById(id);
const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const STORAGE_KEY = "finwise-personal-data-v1";

const emptyState = () => ({
  expenses: [], goals: [], debts: [], reminders: [], history: [],
  emergency: null, preferences: { largeText: false, simple: false, language: "en" }
});

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyState();
    const parsed = JSON.parse(saved);
    const base = emptyState();
    return {
      ...base, ...parsed,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      preferences: { ...base.preferences, ...(parsed.preferences || {}) }
    };
  } catch (error) {
    console.error("Could not read FinWise data from this browser.", error);
    document.addEventListener("DOMContentLoaded", () => {
      const notice = document.createElement("p");
      notice.className = "storage-error";
      notice.setAttribute("role", "alert");
      notice.textContent = "Saved data could not be read. Your browser may have blocked local storage; check browser settings before continuing.";
      document.body.prepend(notice);
    });
    return emptyState();
  }
}

const state = readState();
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save FinWise data in this browser.", error);
    alert("FinWise could not save your changes. Check that browser storage is enabled and has space.");
    return false;
  }
}

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  } catch (cause) {
    const error = new Error("FinWise could not reach its local server. Other tools need the server running with npm start.");
    error.name = "NetworkError";
    error.cause = cause;
    throw error;
  }
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

function calculateBudgetLocally(values) {
  const amount = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };
  const income = amount(values.income);
  if (!income) throw new Error("Please enter your monthly income.");
  const needs = amount(values.rent) + amount(values.food) + amount(values.transport) +
    amount(values.bills) + amount(values.insurance);
  const wants = amount(values.wants);
  const savings = income - needs - wants;
  const percent = (value) => Math.round(value / income * 100);
  return {
    income, needs, wants, savings,
    needsPct: percent(needs), wantsPct: percent(wants), savingsPct: percent(savings),
    targetSavings: Math.round(income * 0.2), emergencyFund: needs * 6,
    yearlySavings: Math.max(savings, 0) * 12
  };
}

function budgetGraph(result) {
  const income = Number(result.income);
  const needs = Number(result.needs);
  const wants = Number(result.wants);
  const savings = Number(result.savings);
  const totalExpenses = needs + wants;
  const scale = Math.max(income, totalExpenses, 1);
  const x = 86, width = 500, y = 31, height = 22;
  const needsWidth = needs / scale * width;
  const wantsWidth = wants / scale * width;
  const savingsWidth = Math.max(0, savings) / scale * width;
  const incomeX = x + income / scale * width;
  const overflow = Math.max(0, totalExpenses - income) / scale * width;
  const labelAnchor = incomeX > x + width * 0.8 ? "end" : "start";
  const labelX = labelAnchor === "end" ? incomeX - 5 : incomeX + 5;
  const description = `Needs ${inr(needs)}, wants ${inr(wants)}, savings ${inr(savings)} from income ${inr(income)}.`;
  return `<div class="budget-graph">
    <svg viewBox="0 0 640 86" role="img" aria-label="${escapeHtml(description)}">
      <title>Monthly budget allocation</title><desc>Needs and wants are compared with income. The marker shows monthly income.</desc>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" class="budget-track"></rect>
      <rect x="${x}" y="${y}" width="${needsWidth}" height="${height}" class="budget-segment needs"></rect>
      <rect x="${x + needsWidth}" y="${y}" width="${wantsWidth}" height="${height}" class="budget-segment wants"></rect>
      ${savingsWidth ? `<rect x="${x + needsWidth + wantsWidth}" y="${y}" width="${savingsWidth}" height="${height}" class="budget-segment saved"></rect>` : ""}
      ${overflow ? `<rect x="${incomeX}" y="${y}" width="${overflow}" height="${height}" class="budget-overflow"></rect>` : ""}
      <line x1="${incomeX}" y1="20" x2="${incomeX}" y2="62" class="budget-income-marker"></line>
      <text x="${labelX}" y="15" text-anchor="${labelAnchor}" class="budget-income-label">Income</text>
    </svg>
    <div class="budget-legend">
      <span><i class="needs"></i>Needs <b>${inr(needs)}</b></span>
      <span><i class="wants"></i>Wants <b>${inr(wants)}</b></span>
      ${savings >= 0 ? `<span><i class="saved"></i>Savings <b>${inr(savings)}</b></span>` : `<span><i class="over"></i>Over budget <b>${inr(-savings)}</b></span>`}
    </div>
  </div>`;
}

const summary = (r) => `<div class="mu">Estimated maturity amount</div><div class="big">${inr(r.maturity)}</div>
  <p>Invested ${inr(r.invested)} · Estimated interest ${inr(r.interest)}</p><p class="mu">Actual returns may differ. Check the provider's current terms.</p>`;
const TOOLS = {
  budget: { label: "Budget", url: "/api/budget", fields: [["income", "Monthly income (₹)", ""], ["rent", "Rent / EMI", ""], ["food", "Food & groceries", ""],
    ["transport", "Transport", ""], ["bills", "Bills & recharge", ""], ["insurance", "Insurance premium", ""], ["wants", "Fun & shopping", ""]],
    render: (r) => `<div class="mu">Money left to save</div><div class="big ${r.savings < 0 ? "bad" : ""}">${inr(r.savings)}</div>
      ${budgetGraph(r)}
      <p class="mu">Needs ${r.needsPct}% · Wants ${r.wantsPct}% · Savings ${r.savingsPct}% (20% savings goal: ${inr(r.targetSavings)})</p>
      <p>${r.savingsPct >= 20 ? "Great job! You meet the savings goal." : r.savings >= 0 ? "Review flexible spending to work toward your savings goal." : "Your listed expenses exceed your income. Review the amounts and prioritize essentials."}</p>
      <p class="mu">Six-month emergency fund estimate: ${inr(r.emergencyFund)} · Yearly savings at this rate: ${inr(r.yearlySavings)}</p>` },
  fd: { label: "FD", url: "/api/fd", fields: [["amount", "Deposit amount (₹)", 100000], ["rate", "Interest rate (% p.a.)", 7], ["years", "Years", 3]], render: summary },
  rd: { label: "RD", url: "/api/rd", fields: [["monthly", "Monthly deposit (₹)", 2000], ["rate", "Interest rate (% p.a.)", 6.5], ["months", "Months", 36]], render: summary },
  insurance: { label: "Insurance", url: "/api/insurance", fields: [["income", "Annual income (₹)", 400000], ["loans", "Loans (₹)", 0], ["savings", "Savings (₹)", 0], ["dependents", "Dependents", 3]],
    render: (r) => `<div class="mu">Illustrative term life cover estimate</div><div class="big">${inr(r.lifeCover)}</div>
      <div class="mu">Illustrative family health cover estimate</div><div class="big">${inr(r.healthCover)}</div>
      <p class="mu">A rule-of-thumb estimate only, not a recommendation. Review actual needs and policy terms with a qualified professional.</p>` },
  gov: { label: "Scheme growth", url: "/api/scheme-calc", fields: [["yearly", "Yearly deposit (₹)", 50000], ["rate", "Rate (% p.a.)", 7.1], ["years", "Years", 15]], render: summary }
};

let current = "budget";
function buildTabs() {
  $("tabs").innerHTML = Object.entries(TOOLS).map(([k, t]) => `<button type="button" data-k="${k}" class="${k === current ? "on" : ""}" aria-pressed="${k === current}">${t.label}</button>`).join("");
  $("tabs").querySelectorAll("button").forEach((b) => b.onclick = () => { current = b.dataset.k; buildTabs(); buildForm(); });
}
function buildForm() {
  const t = TOOLS[current];
  $("out").innerHTML = "";
  $("form").innerHTML = t.fields.map(([id, label, value]) => `<div><label for="f_${id}">${label}</label><input id="f_${id}" name="${id}" type="number" min="0" step="any" value="${value}"></div>`).join("") + `<button class="cta" type="submit">Calculate</button>`;
}
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const toolKey = current;
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    const result = toolKey === "budget"
      ? calculateBudgetLocally(body)
      : await api(TOOLS[toolKey].url, body);
    $("out").innerHTML = `<div class="out">${TOOLS[toolKey].render(result)}</div>`;
    if (toolKey === "budget") recordBudget(body, result);
  } catch (error) {
    $("out").innerHTML = `<div class="out bad" role="alert">${escapeHtml(error.message)}</div>`;
  }
});

function monthKey(date) { return String(date || "").slice(0, 7); }
function monthLabel(key) {
  const date = new Date(`${key}-02T12:00:00`);
  return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
function recordBudget(input, result) {
  const key = monthKey(today());
  const snapshot = { month: key, income: Number(input.income), needs: result.needs, wants: result.wants, savings: result.savings };
  const existing = state.history.findIndex((entry) => entry.month === key);
  if (existing >= 0) state.history[existing] = snapshot;
  else state.history.push(snapshot);
  state.history.sort((a, b) => a.month.localeCompare(b.month));
  state.history = state.history.slice(-12);
  if (saveState()) renderHistory();
}

const expenseForm = $("expenseForm");
expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(expenseForm).entries());
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !form.date || !form.name.trim()) return;
  state.expenses.push({ id: uid(), name: form.name.trim(), amount, category: form.category, date: form.date });
  if (saveState()) {
    expenseForm.reset();
    $("expenseDate").value = today();
    renderExpenses();
  }
});

function renderExpenses() {
  const thisMonth = monthKey(today());
  const expenses = state.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  const monthTotal = expenses.filter((item) => monthKey(item.date) === thisMonth).reduce((sum, item) => sum + Number(item.amount), 0);
  $("expenseSummary").innerHTML = `<p class="out"><strong>This month:</strong> ${inr(monthTotal)} across ${expenses.filter((e) => monthKey(e.date) === thisMonth).length} recorded expenses</p>`;
  $("expenseList").innerHTML = expenses.length ? `<h4>Recent expenses</h4><ul class="item-list">${expenses.slice(0, 12).map((item) =>
    `<li><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.date)}</small></span><span>${inr(item.amount)} <button class="icon-button" type="button" data-action="delete-expense" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}">×</button></span></li>`).join("")}</ul>` : `<p class="mu">No expenses recorded yet.</p>`;
  renderExpenseChart();
}

function sixMonths() {
  const months = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
function renderExpenseChart() {
  const months = sixMonths();
  const totals = months.map((month) => state.expenses.filter((item) => monthKey(item.date) === month).reduce((sum, item) => sum + Number(item.amount), 0));
  const max = Math.max(1, ...totals);
  $("expenseChart").innerHTML = months.map((month, i) => `<div class="chart-column" title="${monthLabel(month)}: ${inr(totals[i])}">
    <span>${inr(totals[i])}</span><i style="height:${Math.max(totals[i] ? 4 : 0, totals[i] / max * 100)}%" aria-hidden="true"></i><small>${monthLabel(month)}</small></div>`).join("");
}
function renderHistory() {
  const entries = state.history.filter((item) => item && /^\d{4}-\d{2}$/.test(item.month) &&
    [item.income, item.needs, item.wants, item.savings].every((value) => Number.isFinite(Number(value)))).slice(-6);
  if (!entries.length) {
    $("historyChart").innerHTML = `<p class="mu">Your budget history will appear here after you calculate a budget.</p>`;
  } else {
    const max = Math.max(1, ...entries.map((item) => Math.max(Number(item.income), Number(item.needs) + Number(item.wants))));
    $("historyChart").innerHTML = entries.map((item) => `<div class="history-entry">
      <div><strong>${monthLabel(item.month)}</strong><span>Income ${inr(item.income)} · Saved ${inr(item.savings)}</span></div>
      <div class="bar2" aria-label="Needs ${Math.round(item.needs / max * 100)}%, wants ${Math.round(item.wants / max * 100)}%, savings ${Math.max(0, Math.round(item.savings / max * 100))}%">
        <i style="width:${Math.max(0, item.needs / max * 100)}%;background:#e67e22"></i><i style="width:${Math.max(0, item.wants / max * 100)}%;background:#3498db"></i><i style="width:${Math.max(0, item.savings / max * 100)}%;background:#27ae60"></i></div>
    </div>`).join("");
  }
  renderSavingsTrend(entries);
}
function renderSavingsTrend(entries) {
  const chart = $("savingsTrend");
  if (!entries.length) {
    chart.innerHTML = `<p class="mu">Calculate a monthly budget to start your savings trend.</p>`;
    return;
  }
  const values = entries.map((item) => Number(item.savings));
  let min = Math.min(0, ...values), max = Math.max(0, ...values);
  if (min === max) max = min + 1;
  const left = 54, right = 588, top = 18, bottom = 164;
  const x = (index) => entries.length === 1 ? (left + right) / 2 : left + index * (right - left) / (entries.length - 1);
  const y = (value) => top + (max - value) * (bottom - top) / (max - min);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = max - (max - min) * index / 4;
    const yPosition = y(value);
    return `<line x1="${left}" y1="${yPosition}" x2="${right}" y2="${yPosition}" class="trend-gridline"></line>
      <text x="${left - 8}" y="${yPosition + 4}" text-anchor="end" class="trend-axis-label">${escapeHtml(inr(value))}</text>`;
  }).join("");
  const labels = entries.map((item, index) => `<text x="${x(index)}" y="188" text-anchor="middle" class="trend-axis-label">${escapeHtml(monthLabel(item.month))}</text>`).join("");
  const dots = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" class="trend-dot"><title>${escapeHtml(monthLabel(entries[index].month))}: ${escapeHtml(inr(value))} saved</title></circle>`).join("");
  const zeroLine = min < 0 && max >= 0 ? `<line x1="${left}" y1="${y(0)}" x2="${right}" y2="${y(0)}" class="trend-zero"></line>` : "";
  chart.innerHTML = `<svg viewBox="0 0 600 205" role="img" aria-label="Savings trend by month">
    <title>Monthly savings trend</title><desc>Amounts left after needs and wants in each recorded monthly budget.</desc>
    ${grid}${zeroLine}<polyline points="${points}" class="trend-line"></polyline>${dots}${labels}
  </svg>`;
}

$("goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const target = Number(values.target), saved = Number(values.saved || 0);
  if (!values.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0) return;
  state.goals.push({ id: uid(), name: values.name.trim(), target, saved });
  if (saveState()) { event.currentTarget.reset(); $("goalSaved").value = "0"; renderGoals(); }
});
function renderGoals() {
  $("goalList").innerHTML = state.goals.length ? state.goals.map((goal) => {
    const progress = Math.min(100, Math.round(Number(goal.saved) / Number(goal.target) * 100));
    return `<article class="mini-card"><div class="list-heading"><strong>${escapeHtml(goal.name)}</strong><button class="icon-button" type="button" data-action="delete-goal" data-id="${escapeHtml(goal.id)}" aria-label="Delete ${escapeHtml(goal.name)}">×</button></div>
      <p>${inr(goal.saved)} of ${inr(goal.target)} · ${progress}%</p><div class="progress"><i style="width:${progress}%"></i></div>
      <form class="contribution-form" data-goal-id="${escapeHtml(goal.id)}"><label for="contribution-${escapeHtml(goal.id)}">Add savings (₹)</label><input id="contribution-${escapeHtml(goal.id)}" name="amount" type="number" min="0.01" step="0.01" required><button class="ghost" type="submit">Add</button></form></article>`;
  }).join("") : `<p class="mu">Create a savings goal to start tracking progress.</p>`;
}
$("goalList").addEventListener("submit", (event) => {
  if (!event.target.matches(".contribution-form")) return;
  event.preventDefault();
  const goal = state.goals.find((item) => item.id === event.target.dataset.goalId);
  const amount = Number(new FormData(event.target).get("amount"));
  if (!goal || !Number.isFinite(amount) || amount <= 0) return;
  goal.saved = Number(goal.saved) + amount;
  if (saveState()) renderGoals();
});

$("debtForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const balance = Number(values.balance), rate = Number(values.rate), minimum = Number(values.minimum);
  if (!values.name.trim() || !Number.isFinite(balance) || balance <= 0 || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(minimum) || minimum <= 0) return;
  state.debts.push({ id: uid(), name: values.name.trim(), balance, rate, minimum });
  if (saveState()) { event.currentTarget.reset(); renderDebts(); }
});
$("debtPlanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  renderDebtPlan(Number(values.extra), values.strategy);
});
function renderDebts() {
  $("debtList").innerHTML = state.debts.length ? `<ul class="item-list">${state.debts.map((debt) =>
    `<li><span><strong>${escapeHtml(debt.name)}</strong><small>Rate ${Number(debt.rate).toFixed(2)}% · Minimum ${inr(debt.minimum)}/month</small></span><span>${inr(debt.balance)} <button class="icon-button" type="button" data-action="delete-debt" data-id="${escapeHtml(debt.id)}" aria-label="Delete ${escapeHtml(debt.name)}">×</button></span></li>`).join("")}</ul>` : `<p class="mu">Add your debts to compare payoff estimates.</p>`;
  if (!state.debts.length) $("debtResult").innerHTML = "";
}
function renderDebtPlan(extra, strategy) {
  const result = $("debtResult");
  if (!state.debts.length) { result.innerHTML = `<p class="out bad" role="alert">Add at least one debt before estimating payoff.</p>`; return; }
  if (!Number.isFinite(extra) || extra < 0) { result.innerHTML = `<p class="out bad" role="alert">Enter a valid extra monthly payment.</p>`; return; }
  const debts = state.debts.map((debt) => ({ ...debt, remaining: Number(debt.balance), interestPaid: 0 }));
  let months = 0, paidOff = false;
  while (months < 1200 && debts.some((debt) => debt.remaining > 0.01)) {
    months++;
    const startingBalance = debts.reduce((sum, debt) => sum + debt.remaining, 0);
    debts.forEach((debt) => {
      if (debt.remaining <= 0) return;
      const interest = debt.remaining * Number(debt.rate) / 1200;
      debt.remaining += interest;
      debt.interestPaid += interest;
    });
    let remainingBudget = debts.reduce((sum, debt) => sum + (debt.remaining > 0 ? Number(debt.minimum) : 0), 0) + extra;
    for (const debt of debts) {
      if (debt.remaining <= 0) continue;
      const payment = Math.min(debt.remaining, Number(debt.minimum), remainingBudget);
      debt.remaining -= payment;
      remainingBudget -= payment;
    }
    const priority = debts.filter((debt) => debt.remaining > 0.01).sort((a, b) =>
      strategy === "snowball" ? a.remaining - b.remaining : Number(b.rate) - Number(a.rate));
    for (const debt of priority) {
      if (remainingBudget <= 0) break;
      const payment = Math.min(debt.remaining, remainingBudget);
      debt.remaining -= payment;
      remainingBudget -= payment;
    }
    const endingBalance = debts.reduce((sum, debt) => sum + debt.remaining, 0);
    if (endingBalance >= startingBalance - 0.01) break;
  }
  paidOff = debts.every((debt) => debt.remaining <= 0.01);
  if (!paidOff) {
    result.innerHTML = `<p class="out bad" role="alert">At least one debt does not appear to shrink with the listed minimum payments. Review the rates and payment amounts with your lender.</p>`;
    return;
  }
  const interest = debts.reduce((sum, debt) => sum + debt.interestPaid, 0);
  result.innerHTML = `<div class="out"><strong>Estimated payoff:</strong> ${Math.floor(months / 12)} years ${months % 12} months<br>
    <strong>Estimated interest:</strong> ${inr(interest)}<p class="mu">${strategy === "avalanche" ? "Highest-interest-first can reduce interest costs." : "Smallest-balance-first may help build momentum."} Estimate assumes fixed rates, minimum payments and no new borrowing. Lender fees and changing rates are not included.</p></div>`;
}

$("emergencyForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const needs = Number(values.needs), months = Number(values.months), saved = Number(values.saved);
  if (![needs, months, saved].every(Number.isFinite) || needs < 0 || months < 1 || saved < 0) return;
  state.emergency = { needs, months, saved };
  if (saveState()) renderEmergency();
});
function renderEmergency() {
  if (!state.emergency) { $("emergencyResult").innerHTML = `<p class="mu">Enter your monthly essentials and current emergency savings.</p>`; return; }
  const { needs, months, saved } = state.emergency;
  const target = needs * months, left = Math.max(0, target - saved), progress = target ? Math.min(100, Math.round(saved / target * 100)) : 100;
  $("monthlyNeeds").value = needs; $("fundMonths").value = months; $("fundSaved").value = saved;
  $("emergencyResult").innerHTML = `<div class="mini-card"><strong>Target: ${inr(target)}</strong><p>${left ? `${inr(left)} left to reach your goal.` : "You have reached this target."}</p><div class="progress"><i style="width:${progress}%"></i></div><p class="mu">${progress}% funded · Covers ${needs ? (saved / needs).toFixed(1) : "0"} months at this expense level.</p></div>`;
}

$("reminderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const amount = values.amount ? Number(values.amount) : null;
  if (!values.name.trim() || !values.date || (amount !== null && (!Number.isFinite(amount) || amount < 0))) return;
  state.reminders.push({ id: uid(), name: values.name.trim(), date: values.date, amount, repeat: values.repeat, notifiedOn: "" });
  state.reminders.sort((a, b) => a.date.localeCompare(b.date));
  if (saveState()) { event.currentTarget.reset(); $("reminderDate").value = today(); renderReminders(); }
});
function renderReminders() {
  const reminders = state.reminders.slice().sort((a, b) => a.date.localeCompare(b.date));
  $("reminderList").innerHTML = reminders.length ? `<ul class="item-list">${reminders.map((item) =>
    `<li><span><strong>${escapeHtml(item.name)}</strong><small>Due ${escapeHtml(item.date)}${item.amount ? ` · ${inr(item.amount)}` : ""}${item.repeat && item.repeat !== "none" ? ` · Repeats ${escapeHtml(item.repeat)}` : ""}${item.date < today() ? " · Overdue" : ""}</small></span>
      <span class="reminder-actions"><button class="ghost" type="button" data-action="complete-reminder" data-id="${escapeHtml(item.id)}">Done</button><button class="icon-button" type="button" data-action="delete-reminder" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}">×</button></span></li>`).join("")}</ul>` : `<p class="mu">No reminders yet.</p>`;
}
function nextReminderDate(date, repeat) {
  const [year, month, day] = date.split("-").map(Number);
  const increment = repeat === "yearly" ? 12 : 1;
  const targetMonthIndex = month - 1 + increment;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const targetDay = Math.min(day, new Date(targetYear, targetMonth + 1, 0).getDate());
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}
function checkDueNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date(`${today()}T00:00:00`);
  let changed = false;
  state.reminders.forEach((item) => {
    const due = new Date(`${item.date}T00:00:00`);
    const daysAway = Math.round((due - now) / 86400000);
    if (daysAway >= 0 && daysAway <= 1 && item.notifiedOn !== today()) {
      new Notification("FinWise reminder", { body: `${item.name} is due ${daysAway === 0 ? "today" : "tomorrow"}.` });
      item.notifiedOn = today(); changed = true;
    }
  });
  if (changed) saveState();
}
$("enableNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("This browser does not support desktop notifications. Your reminders are still listed in FinWise.");
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") { checkDueNotifications(); alert("Notifications enabled. FinWise checks reminders while this page is open."); }
    else alert("Notifications were not enabled. Your reminders remain available in the dashboard.");
  } catch (error) {
    console.error("Could not enable browser notifications.", error);
    alert("FinWise could not enable notifications in this browser.");
  }
});

let schemes = [], filter = "All";
const schemeDetails = {
  ppf: { eligibility: "Individuals; one account per person, subject to current rules.", lockIn: "15 years; partial withdrawals subject to rules.", risk: "Government-backed; rate may change." },
  ssy: { eligibility: "Eligible girl child; account opened by guardian within age rules.", lockIn: "Matures under scheme age rules.", risk: "Government-backed; rate may change." },
  nsc: { eligibility: "Available to eligible individuals through post offices.", lockIn: "5 years.", risk: "Government-backed; verify current tax and withdrawal rules." },
  scss: { eligibility: "Generally for eligible senior citizens.", lockIn: "5 years; extension and early closure rules apply.", risk: "Government-backed; rate may change." },
  porD: { eligibility: "Individuals; joint accounts may be available under current rules.", lockIn: "5 years.", risk: "Government-backed; rate may change." },
  kvp: { eligibility: "Individuals; check current purchase conditions.", lockIn: "Maturity period depends on notified rate.", risk: "Government-backed; rate and maturity period may change." },
  nps: { eligibility: "Eligible Indian citizens and resident/non-resident applicants under NPS rules.", lockIn: "Retirement-focused; withdrawal rules apply.", risk: "Market-linked; returns are not guaranteed." },
  apy: { eligibility: "Eligible Indian citizens aged 18–40, subject to scheme conditions.", lockIn: "Pension scheme with exit rules.", risk: "Government-backed pension benefits under scheme terms." },
  pmjjby: { eligibility: "Eligible bank/post-office account holders in the prescribed age range.", lockIn: "Annual renewal; coverage conditions apply.", risk: "Insurance cover; exclusions and renewal conditions apply." },
  pmsby: { eligibility: "Eligible account holders in the prescribed age range.", lockIn: "Annual renewal; coverage conditions apply.", risk: "Accident insurance; exclusions and renewal conditions apply." },
  pmjay: { eligibility: "Only eligible families; check the official eligibility list.", lockIn: "Coverage is subject to scheme eligibility and rules.", risk: "Government health cover; service and hospital conditions apply." },
  pmjdy: { eligibility: "Individuals eligible to open a basic bank account.", lockIn: "No investment lock-in.", risk: "Banking inclusion scheme; confirm benefit conditions." },
  pmfby: { eligibility: "Eligible farmers and notified crops/areas under current rules.", lockIn: "Seasonal enrollment windows apply.", risk: "Insurance; crop, area and claim conditions apply." }
};
const schemeSources = {
  ppf: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  ssy: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  nsc: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  scss: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  porD: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  kvp: "https://www.indiapost.gov.in/Financial/pages/content/post-office-saving-schemes.aspx",
  nps: "https://npstrust.org.in/",
  apy: "https://www.pfrda.org.in/",
  pmjjby: "https://financialservices.gov.in/",
  pmsby: "https://financialservices.gov.in/",
  pmjay: "https://pmjay.gov.in/",
  pmjdy: "https://pmjdy.gov.in/",
  pmfby: "https://pmfby.gov.in/"
};
async function loadSchemes() {
  try {
    schemes = await api("/api/schemes");
    const types = ["All", ...new Set(schemes.map((scheme) => scheme.type))];
    $("filters").innerHTML = types.map((type) => `<button type="button" data-type="${escapeHtml(type)}" class="${type === filter ? "on" : ""}" aria-pressed="${type === filter}">${escapeHtml(type)}</button>`).join("");
    $("filters").querySelectorAll("button").forEach((button) => button.onclick = () => { filter = button.dataset.type; renderSchemes(); });
    renderSchemes();
  } catch (error) {
    console.error("Could not load government schemes.", error);
    $("schemeList").innerHTML = `<p class="out bad" role="alert">Government scheme information could not be loaded. Please try again later.</p>`;
  }
}
function renderSchemes() {
  const visible = schemes.filter((scheme) => filter === "All" || scheme.type === filter);
  $("filters").querySelectorAll("button").forEach((button) => {
    button.classList.toggle("on", button.dataset.type === filter);
    button.setAttribute("aria-pressed", String(button.dataset.type === filter));
  });
  $("schemeList").innerHTML = visible.map((scheme) => {
    const detail = schemeDetails[scheme.id] || { eligibility: "Check current official rules.", lockIn: "Check current official rules.", risk: "Review official terms before applying." };
    const name = escapeHtml(scheme.name);
    return `<article class="card scheme-card"><div><span class="tag">${escapeHtml(scheme.type)}</span>${scheme.rate ? `<span class="tag">${escapeHtml(scheme.rate)}% p.a.</span>` : ""}</div>
      <h3>${name}</h3><p>${escapeHtml(scheme.info)}</p><p><a href="${schemeSources[scheme.id]}" target="_blank" rel="noopener noreferrer">Official information ↗</a></p><details><summary>Eligibility, term &amp; considerations</summary><p><strong>Eligibility:</strong> ${escapeHtml(detail.eligibility)}</p><p><strong>Term:</strong> ${escapeHtml(detail.lockIn)}</p><p><strong>Consider:</strong> ${escapeHtml(detail.risk)}</p></details>
      <label class="compare-check"><input type="checkbox" data-compare="${escapeHtml(scheme.id)}" ${selectedSchemes.has(scheme.id) ? "checked" : ""}> Add to comparison</label></article>`;
  }).join("");
  renderSchemeCompare();
}
const selectedSchemes = new Set();
function renderSchemeCompare() {
  const selected = schemes.filter((scheme) => selectedSchemes.has(scheme.id));
  $("schemeCompare").innerHTML = `<div class="list-heading"><strong>Compare schemes (${selected.length}/3)</strong><button class="ghost" id="clearCompare" type="button">Clear comparison</button></div>` +
    (selected.length ? `<div class="table-scroll"><table><thead><tr><th>Scheme</th><th>Type / rate</th><th>Eligibility</th><th>Term</th><th>Considerations</th></tr></thead><tbody>${selected.map((scheme) => {
      const detail = schemeDetails[scheme.id] || {};
      return `<tr><th>${escapeHtml(scheme.name)}</th><td>${escapeHtml(scheme.type)}${scheme.rate ? ` · ${escapeHtml(scheme.rate)}% p.a.` : ""}</td><td>${escapeHtml(detail.eligibility || "")}</td><td>${escapeHtml(detail.lockIn || "")}</td><td>${escapeHtml(detail.risk || "")}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<p class="mu">Select up to three schemes below to compare their eligibility, term and considerations side by side.</p>`);
}
$("schemeList").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-compare]");
  if (!checkbox) return;
  const id = checkbox.dataset.compare;
  if (checkbox.checked && selectedSchemes.size >= 3) {
    checkbox.checked = false;
    alert("Compare up to three schemes at a time.");
    return;
  }
  if (checkbox.checked) selectedSchemes.add(id); else selectedSchemes.delete(id);
  renderSchemeCompare();
});
$("schemeCompare").addEventListener("click", (event) => {
  if (event.target.id !== "clearCompare") return;
  selectedSchemes.clear();
  renderSchemes();
});

const lessons = [
  { title: "Build a practical budget", icon: "📊", text: "List take-home income, essential costs, flexible spending and savings. A 50/30/20 split can be a starting point, not a rule that fits every household.", simple: "Write down what comes in and what goes out. Try to save a little regularly. Your budget can change when life changes.", hiTitle: "काम का बजट बनाएं", hi: "घर आने वाली आय, जरूरी खर्च, अन्य खर्च और बचत लिखें। 50/30/20 का बंटवारा शुरुआत हो सकता है, लेकिन हर परिवार की जरूरतें अलग होती हैं।", hiSimple: "आय और खर्च लिखें। थोड़ा-थोड़ा नियमित बचाने की कोशिश करें। जरूरत के अनुसार बजट बदल सकते हैं।" },
  { title: "Start an emergency fund", icon: "🧰", text: "Keep accessible savings for unexpected needs. Many people work toward three to six months of essential costs, building gradually and choosing an amount that fits their situation.", simple: "Save a little for surprises like repairs or a gap in income. Start with a small goal and grow it over time.", hiTitle: "आपातकालीन बचत शुरू करें", hi: "अचानक आने वाले खर्चों के लिए आसानी से उपलब्ध बचत रखें। कई लोग धीरे-धीरे 3–6 महीने के जरूरी खर्च जितनी बचत का लक्ष्य रखते हैं।", hiSimple: "मरम्मत या आय रुकने जैसी जरूरतों के लिए थोड़ा बचाएं। छोटे लक्ष्य से शुरू करें।" },
  { title: "Understand interest and inflation", icon: "📈", text: "Compounding means interest can earn interest over time. Inflation means prices rise, so compare the expected return with risk, fees, tax and the changing cost of living.", simple: "Savings can grow when they earn interest. Prices can also rise, so think about both when planning for the future.", hiTitle: "ब्याज और महंगाई समझें", hi: "चक्रवृद्धि में ब्याज पर भी ब्याज मिलता है। महंगाई से कीमतें बढ़ती हैं, इसलिए जोखिम, शुल्क और कर को ध्यान में रखें।", hiSimple: "ब्याज से बचत बढ़ सकती है और महंगाई से कीमतें भी। भविष्य की योजना बनाते समय दोनों पर ध्यान दें।" },
  { title: "Use credit carefully", icon: "💳", text: "Check borrowing costs and repayment terms before taking a loan. Paying bills on time and avoiding unaffordable balances can help protect your credit history.", simple: "Before borrowing, check how much you must repay. Pay on time and borrow only what you can manage.", hiTitle: "उधार सोच-समझकर लें", hi: "ऋण लेने से पहले ब्याज, शुल्क और चुकाने की शर्तें देखें। समय पर भुगतान और संभालने योग्य उधार आपके क्रेडिट इतिहास के लिए मददगार हो सकते हैं।", hiSimple: "उधार लेने से पहले कुल भुगतान जानें। समय पर चुकाएं और उतना ही उधार लें जितना संभाल सकें।" },
  { title: "Separate protection from investing", icon: "🛡️", text: "Insurance is intended to protect against specific losses; investments aim to grow money and carry different risks. Read exclusions, waiting periods, fees and renewal conditions.", simple: "Insurance helps with certain unexpected costs. Investments try to grow money but can lose value. They are not the same thing.", hiTitle: "बीमा और निवेश अलग रखें", hi: "बीमा कुछ खास नुकसान से सुरक्षा देता है; निवेश का उद्देश्य पैसा बढ़ाना है और उसमें अलग जोखिम होते हैं। अपवाद, प्रतीक्षा अवधि, शुल्क और नवीनीकरण की शर्तें पढ़ें।", hiSimple: "बीमा कुछ अचानक होने वाले नुकसान से बचाता है। निवेश में पैसा बढ़ सकता है या घट सकता है। दोनों अलग हैं।" },
  { title: "Stay safe with digital payments", icon: "🔒", text: "Never share your UPI PIN, OTP or password to receive money. Verify the recipient and payment request in your banking app, and contact your bank through its official channel if something seems wrong.", simple: "Never tell anyone your PIN or OTP. Check the name and amount before paying. Your bank will not ask for your secret PIN.", hiTitle: "डिजिटल भुगतान सुरक्षित रखें", hi: "पैसे पाने के लिए कभी UPI PIN, OTP या पासवर्ड साझा न करें। भुगतान से पहले नाम और अनुरोध जांचें। संदेह होने पर बैंक के आधिकारिक माध्यम से संपर्क करें।", hiSimple: "अपना PIN या OTP किसी को न बताएं। भुगतान से पहले नाम और रकम जांचें।" }
];
let simpleMode = Boolean(state.preferences.simple);
function renderLessons() {
  const language = state.preferences.language === "hi" ? "hi" : "en";
  $("lessonLanguage").value = language;
  $("lessonList").innerHTML = lessons.map((lesson) => `<article class="card lesson"><div class="lesson-icon" aria-hidden="true">${lesson.icon}</div><h3>${language === "hi" ? lesson.hiTitle : lesson.title}</h3><p>${language === "hi" ? (simpleMode ? lesson.hiSimple : lesson.hi) : (simpleMode ? lesson.simple : lesson.text)}</p></article>`).join("");
}
$("lessonLanguage").addEventListener("change", (event) => {
  state.preferences.language = event.target.value === "hi" ? "hi" : "en";
  if (saveState()) renderLessons();
});

let questions = [], questionIndex = 0, answers = [];
async function startQuiz() {
  try {
    questions = await api("/api/quiz");
    questionIndex = 0; answers = []; showQuestion();
  } catch (error) {
    console.error("Could not load the quiz.", error);
    $("quizBox").innerHTML = `<p class="out bad" role="alert">The quiz could not be loaded. Please try again later.</p>`;
  }
}
function showQuestion() {
  const box = $("quizBox");
  if (questionIndex >= questions.length) { finishQuiz(); return; }
  const question = questions[questionIndex];
  box.innerHTML = `<p class="mu">Question ${questionIndex + 1} of ${questions.length}</p><h3>${escapeHtml(question.q)}</h3>` + question.options.map((option, index) => `<button class="opt" type="button" data-answer="${index}">${escapeHtml(option)}</button>`).join("");
}
$("quizBox").addEventListener("click", (event) => {
  const button = event.target.closest("[data-answer]");
  if (!button) return;
  answers.push(Number(button.dataset.answer));
  questionIndex++;
  showQuestion();
});
async function finishQuiz() {
  try {
    const result = await api("/api/quiz", { answers });
    $("quizBox").innerHTML = `<div class="big">${result.score} / ${result.total}</div><p>${result.score >= 5 ? "Excellent work. Keep building your money skills." : result.score >= 3 ? "Good start. Explore the learning guides to continue." : "Keep learning. Try the guides and take the quiz again."}</p><button class="cta" id="again" type="button">Try again</button>`;
    $("again").onclick = startQuiz;
  } catch (error) {
    console.error("Could not calculate the quiz result.", error);
    $("quizBox").innerHTML = `<p class="out bad" role="alert">Your quiz result could not be calculated. Please try again.</p>`;
  }
}

function exportCsv() {
  const rows = [["FinWise personal finance report"], ["Generated", today()], [], ["Budget history"], ["Month", "Income", "Needs", "Wants", "Savings"],
    ...state.history.map((item) => [item.month, item.income, item.needs, item.wants, item.savings]), [], ["Expenses"], ["Date", "Name", "Category", "Amount"],
    ...state.expenses.map((item) => [item.date, item.name, item.category, item.amount]), [], ["Savings goals"], ["Name", "Target", "Saved"],
    ...state.goals.map((item) => [item.name, item.target, item.saved]), [], ["Debts"], ["Name", "Balance", "Rate (% per year)", "Monthly minimum"],
    ...state.debts.map((item) => [item.name, item.balance, item.rate, item.minimum]), [], ["Reminders"], ["Name", "Due date", "Amount"],
    ...state.reminders.map((item) => [item.name, item.date, item.amount ?? ""])];
  const csv = rows.map((row) => row.map((value) => {
    let cell = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  link.href = url; link.download = `finwise-report-${today()}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("exportData").addEventListener("click", exportCsv);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "complete-reminder") {
    const reminder = state.reminders.find((item) => item.id === id);
    if (!reminder) return;
    if (reminder.repeat && reminder.repeat !== "none") {
      reminder.date = nextReminderDate(reminder.date, reminder.repeat);
      reminder.notifiedOn = "";
    } else state.reminders = state.reminders.filter((item) => item.id !== id);
    if (saveState()) renderReminders();
    return;
  }
  const collections = { "delete-expense": "expenses", "delete-goal": "goals", "delete-debt": "debts", "delete-reminder": "reminders" };
  const collection = collections[action];
  if (!collection) return;
  if (!confirm("Remove this item? This cannot be undone.")) return;
  state[collection] = state[collection].filter((item) => item.id !== id);
  if (!saveState()) return;
  if (collection === "expenses") renderExpenses();
  if (collection === "goals") renderGoals();
  if (collection === "debts") { $("debtResult").innerHTML = ""; renderDebts(); }
  if (collection === "reminders") renderReminders();
});

function applyPreferences() {
  document.body.classList.toggle("large-text", Boolean(state.preferences.largeText));
  $("largeText").setAttribute("aria-pressed", String(Boolean(state.preferences.largeText)));
  $("simpleMode").setAttribute("aria-pressed", String(simpleMode));
  $("simpleMode").classList.toggle("on", simpleMode);
}
$("largeText").addEventListener("click", () => {
  state.preferences.largeText = !state.preferences.largeText;
  if (saveState()) applyPreferences();
});
$("simpleMode").addEventListener("click", () => {
  simpleMode = !simpleMode;
  state.preferences.simple = simpleMode;
  if (saveState()) { applyPreferences(); renderLessons(); }
});

$("expenseDate").value = today();
$("reminderDate").value = today();
buildTabs(); buildForm(); renderExpenses(); renderGoals(); renderDebts(); renderEmergency(); renderReminders(); renderHistory(); renderLessons(); applyPreferences();
loadSchemes(); startQuiz(); checkDueNotifications(); window.setInterval(checkDueNotifications, 60 * 60 * 1000);
