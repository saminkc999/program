// netlify/functions/server.js
import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------
// 🗂️ Setup LowDB (database)
// --------------------------
const adapter = new JSONFile("db.json");
const db = new Low(adapter, {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
});

await db.read();
db.data ||= {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
};
await db.write();

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

async function recalcTotals() {
  await db.read();
  const totals = { cashapp: 0, paypal: 0, chime: 0 };
  for (const p of db.data.payments) {
    if (validMethods.includes(p.method)) {
      totals[p.method] += p.amount;
    }
  }
  db.data.totals = totals;
  await db.write();
  return totals;
}

// ==========================
// 🚏 Create a router
// ==========================
const router = express.Router();

// --------------------------
// 🎮 GAME ROUTES (on router)
// --------------------------
router.get("/games", async (_req, res) => {
  await db.read();
  res.json(db.data.games);
});

router.post("/games", async (req, res) => {
  const { name, coinsSpent = 0, coinsEarned = 0, coinsRecharged = 0 } =
    req.body;

  await db.read();
  const newGame = {
    id: Date.now(),
    name,
    coinsSpent,
    coinsEarned,
    coinsRecharged,
  };
  db.data.games.push(newGame);
  await db.write();
  res.status(201).json(newGame);
});

router.put("/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsSpent, coinsEarned, coinsRecharged } = req.body;
  await db.read();
  const game = db.data.games.find((g) => g.id === parseInt(id));
  if (!game) return res.status(404).json({ message: "Game not found" });

  game.coinsSpent = coinsSpent;
  game.coinsEarned = coinsEarned;
  game.coinsRecharged = coinsRecharged;
  await db.write();
  res.json(game);
});

router.delete("/games/:id", async (req, res) => {
  const { id } = req.params;
  await db.read();
  const index = db.data.games.findIndex((g) => g.id === parseInt(id));
  if (index === -1) return res.status(404).json({ message: "Game not found" });
  const removed = db.data.games.splice(index, 1)[0];
  await db.write();
  res.json(removed);
});

// --------------------------
// 💵 PAYMENT ROUTES (on router)
// --------------------------
router.get("/payments", async (_req, res) => {
  await db.read();
  res.json(db.data.payments);
});

router.get("/totals", async (_req, res) => {
  await db.read();
  res.json(db.data.totals);
});

router.post("/payments", async (req, res) => {
  const { amount, method, note } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0)
    return res.status(400).json({ message: "Invalid amount" });
  if (!validMethods.includes(method))
    return res.status(400).json({ message: "Invalid method" });

  await db.read();

  const payment = {
    id: nanoid(),
    amount: Math.round(amt * 100) / 100,
    method,
    note: note || null,
    createdAt: new Date().toISOString(),
  };
  db.data.payments.push(payment);
  db.data.totals[method] += payment.amount;
  await db.write();

  res.status(201).json({
    ok: true,
    payment,
    totals: db.data.totals,
  });
});

router.post("/reset", async (_req, res) => {
  await db.read();
  db.data.payments = [];
  db.data.totals = { cashapp: 0, paypal: 0, chime: 0 };
  await db.write();
  res.json({ ok: true, totals: db.data.totals });
});

router.post("/recalc", async (_req, res) => {
  const totals = await recalcTotals();
  res.json({ ok: true, totals });
});

// Health check for the router root
router.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is running ✅" });
});

// ==========================
// 🚦 Mount router for Netlify
// ==========================
// This makes Netlify route:
// /.netlify/functions/server      → router "/"
// /.netlify/functions/server/games → router "/games"
app.use("/.netlify/functions/server", router);

// --------------------------
// ✅ Export for Netlify
// --------------------------
export const handler = serverless(app);
