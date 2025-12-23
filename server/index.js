import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT ?? 3000;

const defaultSkillTree = {
  id: "destruction_magic",
  name: "破壊魔法 (Destruction Magic)",
  nodes: [
    { id: "novice", x: 500, y: 520, name: "素人", cost: 0, reqs: [] },
    { id: "apprentice", x: 420, y: 420, name: "見習い", cost: 0, reqs: ["novice"] },
    { id: "dual_cast", x: 600, y: 450, name: "二連の唱え", cost: 0, reqs: ["novice"] },
    { id: "adept", x: 350, y: 340, name: "精鋭", cost: 0, reqs: ["apprentice"] },
    { id: "impact", x: 650, y: 360, name: "衝撃", cost: 0, reqs: ["dual_cast"] },
    { id: "expert", x: 500, y: 300, name: "熟練者", cost: 0, reqs: ["adept", "impact"] },
  ],
  connections: [
    { from: "novice", to: "apprentice" },
    { from: "novice", to: "dual_cast" },
    { from: "apprentice", to: "adept" },
    { from: "dual_cast", to: "impact" },
    { from: "adept", to: "expert" },
    { from: "impact", to: "expert" },
  ],
};

const parseJsonArray = (raw, fallback) => {
  try {
    const parsed = JSON.parse(raw ?? "null");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error("JSON配列の解析に失敗したため既定値を利用します", error);
    return fallback;
  }
};

const parseUnlocked = (raw) => {
  try {
    return JSON.parse(raw ?? "[]");
  } catch (error) {
    console.error("アンロックスキルIDの解析に失敗したため空配列に初期化しました", error);
    return [];
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeNodes = (rawNodes) => {
  if (!Array.isArray(rawNodes)) return [];

  const seen = new Set();
  return rawNodes.flatMap((node) => {
    if (!node || typeof node.id !== "string" || seen.has(node.id)) return [];

    const reqs = Array.isArray(node.reqs)
      ? Array.from(new Set(node.reqs.filter((req) => typeof req === "string")))
      : [];

    const sanitized = {
      id: node.id,
      name:
        typeof node.name === "string" && node.name.trim().length > 0
          ? node.name.trim()
          : node.id,
      x: toNumber(node.x, 0),
      y: toNumber(node.y, 0),
      cost: Math.max(0, toNumber(node.cost, 0)),
      reqs,
    };

    seen.add(sanitized.id);
    return [sanitized];
  });
};

const sanitizeConnections = (rawConnections, nodes) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const mergedConnections = Array.isArray(rawConnections) ? [...rawConnections] : [];

  nodes.forEach((node) => {
    node.reqs.forEach((req) => mergedConnections.push({ from: req, to: node.id }));
  });

  const seen = new Set();
  const result = [];

  mergedConnections.forEach((connection) => {
    if (!connection) return;
    const from = typeof connection.from === "string" ? connection.from : "";
    const to = typeof connection.to === "string" ? connection.to : "";
    const key = `${from}->${to}`;

    if (!from || !to || from === to) return;
    if (!nodeIds.has(from) || !nodeIds.has(to)) return;
    if (seen.has(key)) return;

    seen.add(key);
    result.push({ from, to });
  });

  return result;
};

const normalizeSkillTreePayload = (payload = {}) => {
  const nodes = sanitizeNodes(payload.nodes ?? defaultSkillTree.nodes);
  const connections = sanitizeConnections(payload.connections ?? defaultSkillTree.connections, nodes);
  const treeId =
    typeof payload.id === "string" && payload.id.trim().length > 0
      ? payload.id.trim()
      : defaultSkillTree.id;
  const name =
    typeof payload.name === "string" && payload.name.trim().length > 0
      ? payload.name.trim()
      : defaultSkillTree.name;

  return {
    id: treeId,
    name,
    nodes,
    connections,
  };
};

const getOrCreateStatus = async () => {
  const existing = await prisma.skillStatus.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.skillStatus.create({
    data: {
      id: 1,
    },
  });
};

const getOrCreateSkillTree = async () => {
  const existing = await prisma.skillTree.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.skillTree.create({
    data: {
      id: 1,
      treeId: defaultSkillTree.id,
      name: defaultSkillTree.name,
      nodes: JSON.stringify(defaultSkillTree.nodes),
      connections: JSON.stringify(defaultSkillTree.connections),
    },
  });
};

app.use(cors());
app.use(express.json());

app.get("/api/status", async (_req, res) => {
  try {
    const status = await getOrCreateStatus();
    res.json({
      availablePoints: status.availablePoints,
      unlockedSkillIds: parseUnlocked(status.unlockedSkillIds),
    });
  } catch (error) {
    console.error("ステータス取得に失敗しました", error);
    res.status(500).json({ error: "ステータスの取得に失敗しました" });
  }
});

app.post("/api/save", async (req, res) => {
  const { availablePoints, unlockedSkillIds } = req.body || {};
  const isValidArray =
    Array.isArray(unlockedSkillIds) && unlockedSkillIds.every((id) => typeof id === "string");

  if (typeof availablePoints !== "number" || !isValidArray) {
    return res.status(400).json({ error: "リクエストペイロードが不正です" });
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
    console.error("ステータス保存に失敗しました", error);
    res.status(500).json({ error: "ステータスの保存に失敗しました" });
  }
});

app.get("/api/skill-tree", async (_req, res) => {
  try {
    const record = await getOrCreateSkillTree();
    const nodes = parseJsonArray(record.nodes, defaultSkillTree.nodes);
    const connections = parseJsonArray(record.connections, defaultSkillTree.connections);
    const normalized = normalizeSkillTreePayload({
      id: record.treeId,
      name: record.name,
      nodes,
      connections,
    });

    res.json(normalized);
  } catch (error) {
    console.error("スキルツリー取得に失敗しました", error);
    res.status(500).json(normalizeSkillTreePayload(defaultSkillTree));
  }
});

app.post("/api/skill-tree", async (req, res) => {
  const normalized = normalizeSkillTreePayload(req.body || {});

  try {
    await prisma.skillTree.upsert({
      where: { id: 1 },
      update: {
        treeId: normalized.id,
        name: normalized.name,
        nodes: JSON.stringify(normalized.nodes),
        connections: JSON.stringify(normalized.connections),
      },
      create: {
        id: 1,
        treeId: normalized.id,
        name: normalized.name,
        nodes: JSON.stringify(normalized.nodes),
        connections: JSON.stringify(normalized.connections),
      },
    });

    res.json(normalized);
  } catch (error) {
    console.error("スキルツリー保存に失敗しました", error);
    res.status(500).json({ error: "スキルツリーの保存に失敗しました" });
  }
});

app.listen(PORT, () => {
  console.log(`SkillMap APIサーバーがポート${PORT}で待機中です`);
});
