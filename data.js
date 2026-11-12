exports.schemes = [
  { id: "ppf", name: "PPF – Public Provident Fund", rate: 7.1, type: "Savings", info: "15-year lock-in, ₹500 to ₹1.5 lakh per year, tax-free interest (EEE)." },
  { id: "ssy", name: "Sukanya Samriddhi Yojana", rate: 8.2, type: "Savings", info: "For a girl child under 10, up to ₹1.5 lakh per year, matures at 21 years." },
  { id: "nsc", name: "National Savings Certificate", rate: 7.7, type: "Savings", info: "5-year certificate from post offices with Section 80C deduction." },
  { id: "scss", name: "Senior Citizens Savings Scheme", rate: 8.2, type: "Savings", info: "Age 60+, up to ₹30 lakh, interest paid quarterly, 5-year term." },
  { id: "porD", name: "Post Office Recurring Deposit", rate: 6.7, type: "Savings", info: "Monthly saving at India Post, 5-year term, from ₹100." },
  { id: "kvp", name: "Kisan Vikas Patra", rate: 7.5, type: "Savings", info: "Money doubles in about 115 months, safe, no upper limit." },
  { id: "nps", name: "NPS – National Pension System", rate: null, type: "Pension", info: "Market-linked retirement account with extra tax deduction." },
  { id: "apy", name: "Atal Pension Yojana", rate: null, type: "Pension", info: "Ages 18–40, fixed pension of ₹1,000–₹5,000 a month after 60." },
  { id: "pmjjby", name: "PM Jeevan Jyoti Bima Yojana", rate: null, type: "Insurance", info: "₹2 lakh life cover for ₹436 a year, ages 18–50." },
  { id: "pmsby", name: "PM Suraksha Bima Yojana", rate: null, type: "Insurance", info: "₹2 lakh accident cover for ₹20 a year, ages 18–70." },
  { id: "pmjay", name: "Ayushman Bharat (PM-JAY)", rate: null, type: "Insurance", info: "Free health cover up to ₹5 lakh per eligible family per year." },
  { id: "pmjdy", name: "PM Jan Dhan Yojana", rate: null, type: "Inclusion", info: "Zero-balance bank account with RuPay card and accident cover." },
  { id: "pmfby", name: "PM Fasal Bima Yojana", rate: null, type: "Insurance", info: "Low-premium crop insurance for farmers." }
];

exports.quiz = [
  { q: "What savings share does the 50/30/20 rule suggest?", options: ["10%", "20%", "50%"], answer: 1 },
  { q: "Which gives fixed interest on a lump sum for a fixed period?", options: ["Fixed Deposit", "Credit card", "Overdraft"], answer: 0 },
  { q: "A Recurring Deposit is best for…", options: ["One-time lump sum", "Regular monthly saving", "Buying shares"], answer: 1 },
  { q: "Which cover protects your family if you die?", options: ["Term life insurance", "Motor insurance", "Crop insurance"], answer: 0 },
  { q: "Which scheme has tax-free interest and a 15-year lock-in?", options: ["PPF", "NSC", "KVP"], answer: 0 },
  { q: "An emergency fund should cover about…", options: ["1 week", "6 months of needs", "1 day"], answer: 1 }
];
