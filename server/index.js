const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function parseUnlocked(raw) {
  try {
    return JSON.parse(raw || "[]");
  } catch (error) {
    console.error("Failed to parse unlockedSkillIds, resetting to empty array", error);
    return [];
  }
}

async function getOrCreateStatus() {
  const existing = await prisma.skillStatus.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.skillStatus.create({
    data: {
      id: 1,
    },
  });
}

app.get("/api/status", async (_req, res) => {
  try {
    const status = await getOrCreateStatus();
    res.json({
      availablePoints: status.availablePoints,
      unlockedSkillIds: parseUnlocked(status.unlockedSkillIds),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

app.post("/api/save", async (req, res) => {
  const { availablePoints, unlockedSkillIds } = req.body || {};
  const isValidArray =
    Array.isArray(unlockedSkillIds) &&
    unlockedSkillIds.every((id) => typeof id === "string");

  if (typeof availablePoints !== "number" || !isValidArray) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const updated = await prisma.skillStatus.upsert({
      where: { id: 1 },
      update: {
        availablePoints,
        unlockedSkillIds: JSON.stringify(unlockedSkillIds),
      },
      create: {
        id: 1,
        availablePoints,
        unlockedSkillIds: JSON.stringify(unlockedSkillIds),
      },
    });

    res.json({
      availablePoints: updated.availablePoints,
      unlockedSkillIds: parseUnlocked(updated.unlockedSkillIds),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save status" });
  }
});

app.listen(PORT, () => {
  console.log(`SkillMap API server listening on port ${PORT}`);
});
