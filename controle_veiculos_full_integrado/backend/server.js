import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_PASS = process.env.ADMIN_PASS || "admin10917";

const dbPromise = open({
  filename: "./data.sqlite",
  driver: sqlite3.Database
});

async function init() {
  const db = await dbPromise;
  await db.exec(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    placa TEXT,
    status TEXT,
    fiscal TEXT,
    horaSaida TEXT,
    previsaoRetorno TEXT,
    fuelStatus TEXT,
    lastOccurrence INTEGER,
    lastObservation TEXT,
    reservedBy TEXT
  )`);
}
init();

function checkAdmin(req, res, next) {
  const pass = req.headers["x-admin-pass"];
  if (pass !== ADMIN_PASS) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/vehicles", async (req, res) => {
  const db = await dbPromise;
  const vehicles = await db.all("SELECT * FROM vehicles");
  res.json(vehicles);
});

app.post("/vehicles", checkAdmin, async (req, res) => {
  const db = await dbPromise;
  const { placa, fuelStatus } = req.body;
  await db.run("INSERT INTO vehicles (placa, status, fuelStatus) VALUES (?, 'Disponível', ?)", placa, fuelStatus || 'Cheio');
  res.json({ success: true });
});

app.delete("/vehicles/:id", checkAdmin, async (req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM vehicles WHERE id = ?", req.params.id);
  res.json({ success: true });
});

app.post("/vehicles/:id/checkout", async (req, res) => {
  const db = await dbPromise;
  const { fiscal, previsaoRetornoHora } = req.body;
  const v = await db.get("SELECT * FROM vehicles WHERE id = ?", req.params.id);
  if (!v) return res.status(404).json({ error: "not found" });
  const horaSaida = new Date().toISOString();
  const previsaoRetorno = new Date();
  const [hh, mm] = previsaoRetornoHora.split(":");
  previsaoRetorno.setHours(Number(hh), Number(mm), 0, 0);
  await db.run(
    "UPDATE vehicles SET status='Ocupado', fiscal=?, horaSaida=?, previsaoRetorno=?, reservedBy=NULL WHERE id=?",
    fiscal, horaSaida, previsaoRetorno.toISOString(), req.params.id
  );
  res.json({ success: true });
});

app.post("/vehicles/:id/checkin", async (req, res) => {
  const db = await dbPromise;
  const { hadOccurrence, observation, fuelStatus } = req.body;
  await db.run(
    "UPDATE vehicles SET status='Disponível', fiscal=NULL, horaSaida=NULL, previsaoRetorno=NULL, lastOccurrence=?, lastObservation=?, fuelStatus=? WHERE id=?",
    hadOccurrence ? 1 : 0, observation || '', fuelStatus || 'Cheio', req.params.id
  );
  res.json({ success: true });
});

app.post("/vehicles/:id/reserve", checkAdmin, async (req, res) => {
  const db = await dbPromise;
  const { reservedBy } = req.body;
  await db.run("UPDATE vehicles SET status='Reservado', reservedBy=? WHERE id=?", reservedBy, req.params.id);
  res.json({ success: true });
});

app.put("/vehicles/:id/reserve", checkAdmin, async (req, res) => {
  const db = await dbPromise;
  const { reservedBy } = req.body;
  await db.run("UPDATE vehicles SET reservedBy=? WHERE id=?", reservedBy, req.params.id);
  res.json({ success: true });
});

app.delete("/vehicles/:id/reserve", checkAdmin, async (req, res) => {
  const db = await dbPromise;
  await db.run("UPDATE vehicles SET status='Disponível', reservedBy=NULL WHERE id=?", req.params.id);
  res.json({ success: true });
});

app.post("/vehicles/:id/checkout-from-reserve", async (req, res) => {
  const db = await dbPromise;
  const { previsaoRetornoHora } = req.body;
  const v = await db.get("SELECT * FROM vehicles WHERE id = ?", req.params.id);
  if (!v) return res.status(404).json({ error: "not found" });
  const horaSaida = new Date().toISOString();
  const previsaoRetorno = new Date();
  const [hh, mm] = previsaoRetornoHora.split(":");
  previsaoRetorno.setHours(Number(hh), Number(mm), 0, 0);
  await db.run(
    "UPDATE vehicles SET status='Ocupado', fiscal=?, horaSaida=?, previsaoRetorno=?, reservedBy=NULL WHERE id=?",
    v.reservedBy, horaSaida, previsaoRetorno.toISOString(), req.params.id
  );
  res.json({ success: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
