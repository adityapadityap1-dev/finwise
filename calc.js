const n = (v) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0; };

exports.budget = (b) => {
  const income = n(b.income);
  if (!income) throw new Error("Please enter your monthly income.");
  const needs = n(b.rent) + n(b.food) + n(b.transport) + n(b.bills) + n(b.insurance);
  const wants = n(b.wants);
  const savings = income - needs - wants;
  const pct = (x) => Math.round((x / income) * 100);
  return { income, needs, wants, savings, needsPct: pct(needs), wantsPct: pct(wants),
    savingsPct: pct(savings), targetSavings: Math.round(income * 0.2),
    emergencyFund: needs * 6, yearlySavings: Math.max(savings, 0) * 12 };
};

exports.fd = (b) => {
  const P = n(b.amount), r = n(b.rate) / 100, t = n(b.years);
  if (!P || !t) throw new Error("Enter amount and years.");
  const maturity = P * Math.pow(1 + r / 4, 4 * t);
  return { invested: P, maturity, interest: maturity - P };
};

exports.rd = (b) => {
  const d = n(b.monthly), r = n(b.rate) / 100, m = Math.floor(n(b.months));
  if (!d || !m) throw new Error("Enter monthly deposit and months.");
  let maturity = 0;
  for (let i = 1; i <= m; i++) maturity += d * Math.pow(1 + r / 4, (4 * (m - i + 1)) / 12);
  return { invested: d * m, maturity, interest: maturity - d * m };
};

exports.insurance = (b) => {
  const income = n(b.income), loans = n(b.loans), savings = n(b.savings), dep = n(b.dependents);
  if (!income) throw new Error("Enter your annual income.");
  return { lifeCover: Math.max(income * 12 + loans - savings, 0),
    healthCover: dep >= 4 ? 1500000 : dep >= 2 ? 1000000 : 500000 };
};

exports.scheme = (b) => {
  const P = n(b.yearly), r = n(b.rate) / 100, t = Math.floor(n(b.years));
  if (!P || !t) throw new Error("Enter yearly deposit and years.");
  let maturity = 0;
  for (let i = 0; i < t; i++) maturity = (maturity + P) * (1 + r);
  return { invested: P * t, maturity, interest: maturity - P * t };
};
