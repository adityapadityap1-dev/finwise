const http = require("http"), fs = require("fs"), path = require("path");
const calc = require("./calc"), data = require("./data");
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let s = "";
  req.on("data", (c) => { s += c; if (s.length > 1e5) { reject(new Error("Too large")); req.destroy(); } });
  req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error("Invalid JSON")); } });
});

const posts = { "/api/budget": calc.budget, "/api/fd": calc.fd, "/api/rd": calc.rd,
  "/api/insurance": calc.insurance, "/api/scheme-calc": calc.scheme };

http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (req.method === "GET" && url === "/api/schemes") return send(res, 200, data.schemes);
    if (req.method === "GET" && url === "/api/quiz")
      return send(res, 200, data.quiz.map(({ q, options }) => ({ q, options })));
    if (req.method === "POST" && url === "/api/quiz") {
      const { answers } = await readBody(req);
      const list = Array.isArray(answers) ? answers : [];
      const score = data.quiz.reduce((s, x, i) => s + (list[i] === x.answer ? 1 : 0), 0);
      return send(res, 200, { score, total: data.quiz.length, correct: data.quiz.map((x) => x.answer) });
    }
    if (req.method === "POST" && posts[url]) return send(res, 200, posts[url](await readBody(req)));
    if (url.startsWith("/api/")) return send(res, 404, { error: "Not found" });

    let file = path.normalize(path.join(PUB, url === "/" ? "index.html" : url));
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404 Not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  } catch (e) { send(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log(`FinWise running at http://localhost:${PORT}`));
