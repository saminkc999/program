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
const db = new Low(adapter);

// default structure
const defaultData = {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
};

// 🔁 one-time async init (no top-level await!)
let dbInitPromise = (async () => {
  await db.read();
  db.data ||= { ...defaultData };
  await db.write();
})();

async function ensureDb() {
  if (dbInitPromise) {
    await dbInitPromise;
    dbInitPromise = null; // allow GC, we’re initialized
  }
}

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

async function recalcTotals() {
  await ensureDb();
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
  try {
    await ensureDb();
    res.json(db.data.games);
  } catch (err) {
    console.error("GET /games error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/games", async (req, res) => {
  try {
    await ensureDb();
    const {
      name,
      coinsSpent = 0,
      coinsEarned = 0,
      coinsRecharged = 0,
    } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required" });
    }

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
  } catch (err) {
    console.error("POST /games error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/games/:id", async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const { coinsSpent, coinsEarned, coinsRecharged } = req.body || {};

    const game = db.data.games.find((g) => g.id === parseInt(id));
    if (!game) return res.status(404).json({ message: "Game not found" });

    game.coinsSpent = coinsSpent;
    game.coinsEarned = coinsEarned;
    game.coinsRecharged = coinsRecharged;
    await db.write();
    res.json(game);
  } catch (err) {
    console.error("PUT /games/:id error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/games/:id", async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const index = db.data.games.findIndex((g) => g.id === parseInt(id));
    if (index === -1)
      return res.status(404).json({ message: "Game not found" });

    const removed = db.data.games.splice(index, 1)[0];
    await db.write();
    res.json(removed);
  } catch (err) {
    console.error("DELETE /games/:id error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// --------------------------
// 💵 PAYMENT ROUTES (on router)
// --------------------------
router.get("/payments", async (_req, res) => {
  try {
    await ensureDb();
    res.json(db.data.payments);
  } catch (err) {
    console.error("GET /payments error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/totals", async (_req, res) => {
  try {
    await ensureDb();
    res.json(db.data.totals);
  } catch (err) {
    console.error("GET /totals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/payments", async (req, res) => {
  try {
    await ensureDb();
    const { amount, method, note } = req.body || {};
    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

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
  } catch (err) {
    console.error("POST /payments error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/reset", async (_req, res) => {
  try {
    await ensureDb();
    db.data.payments = [];
    db.data.totals = { cashapp: 0, paypal: 0, chime: 0 };
    await db.write();
    res.json({ ok: true, totals: db.data.totals });
  } catch (err) {
    console.error("POST /reset error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/recalc", async (_req, res) => {
  try {
    const totals = await recalcTotals();
    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /recalc error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Health check for the router root
router.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is running ✅" });
});

// ==========================
// 🚦 Mount router for Netlify
// ==========================
// This makes Netlify route:
// /.netlify/functions/server          → router "/"
// /.netlify/functions/server/games    → router "/games"
app.use("/.netlify/functions/server", router);

// --------------------------
// ✅ Export for Netlify
// --------------------------
export const handler = serverless(app);
