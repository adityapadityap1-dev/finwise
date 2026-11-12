# FinWise – Smart Financial Literacy & Budget Planner

Free, open-source website. No login, no register, no server-side database, no dependencies.
Personal expenses, goals, debts, reminders and budget history are saved in the current browser using local storage. They are not synced between devices. Clearing browser data removes them; use the CSV download to keep a copy.

## Features
- Monthly budget planner with 50/30/20 guidance, a budget breakdown graph, budget history and a savings trend graph
- FD, RD, insurance and government-scheme growth estimates
- Expense tracker with six-month spending chart
- Savings goals with contribution tracking
- Debt payoff estimates using highest-interest-first or smallest-balance-first strategies
- Emergency fund progress tracker
- One-time, monthly and yearly reminders, with optional browser notifications while the page is open
- CSV report download for personal records
- Government scheme filters, eligibility notes and side-by-side comparison
- Financial literacy lessons in English and Hindi, quiz, larger text and simplified explanations
- Animated WebThreads hero background with pointer interaction, reduced-motion support and a static fallback

## Run (VS Code terminal)
1. Install Node.js 16+ from https://nodejs.org
2. Open this folder in VS Code (File > Open Folder)
3. Open the terminal (Ctrl+`) and run `npm ci`, then `npm start`
4. Visit http://localhost:3000

## Publish and host

GitHub is for hosting the project source; GitHub Pages cannot run this app's Node.js API. To publish the source:

1. Create an empty repository on GitHub (do not add a README, license or `.gitignore`; this project already has them).
2. From this project folder, run:

   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   Replace the URL with your repository's URL. If you have not initialized Git yet, run `git init -b main` and `git add .` followed by `git commit -m "Initial commit"` first.
3. To make the app available as a live website, deploy the repository to a Node.js hosting service. Use `npm ci` as the install command and `npm start` as the start command. The server reads the hosting provider's `PORT` environment variable.

## Structure
- server.js  – HTTP server + REST API (static files served from /public)
- calc.js    – all financial formulas (budget, FD, RD, insurance, schemes)
- data.js    – government schemes, insurance guide, quiz questions
- public/    – frontend (index.html, css/style.css, js/app.js, js/web-threads.js)

## API
GET /api/schemes · GET /api/quiz · POST /api/quiz {answers:[..]}
POST /api/budget · /api/fd · /api/rd · /api/insurance · /api/scheme-calc

The budget calculator runs in the browser without the API server. Other calculators, schemes and the quiz require the server started with `npm start`.

Rates and scheme information are indicative (India), may change, and should be verified with the relevant official provider. Estimates are educational illustrations, not financial, tax, investment, insurance or legal advice. Debt payoff estimates assume fixed rates, minimum payments and no new borrowing; lender-specific fees and changing terms are not included.
