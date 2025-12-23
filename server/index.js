import cors from "cors";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT ?? 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultSkillTreePath = path.resolve(__dirname, "data/default-skill-tree.json");

const builtinDefaultSkillTree = {
  id: "destruction_magic",
  name: "破壊魔法 (Destruction Magic)",
  nodes: [
    {
      id: "novice",
      x: 500,
      y: 520,
      name: "素人",
      description: "破壊魔法の基礎を学ぶ初歩の心得。",
      cost: 0,
      reqs: [],
    },
    {
      id: "apprentice",
      x: 420,
      y: 420,
      name: "見習い",
      description: "魔力の扱いに慣れ、より効率的に詠唱できる段階。",
      cost: 0,
      reqs: ["novice"],
    },
    {
      id: "dual_cast",
      x: 600,
      y: 450,
      name: "二連の唱え",
      description: "破壊魔法を二連続で詠唱し威力を高める技術。",
      cost: 0,
      reqs: ["novice"],
    },
    {
      id: "adept",
      x: 350,
      y: 340,
      name: "精鋭",
      description: "中級の破壊魔法を自在に操る熟練の域。",
      cost: 0,
      reqs: ["apprentice"],
    },
    {
      id: "impact",
      x: 650,
      y: 360,
      name: "衝撃",
      description: "魔法に衝撃を付与し敵をひるませる技。",
      cost: 0,
      reqs: ["dual_cast"],
    },
    {
      id: "expert",
      x: 500,
      y: 300,
      name: "熟練者",
      description: "破壊魔法の高度な技術を極めた達人。",
      cost: 0,
      reqs: ["adept", "impact"],
    },
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

let defaultSkillTree = builtinDefaultSkillTree;

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

    const description =
      typeof node.description === "string" ? node.description.trim() : "";

    const sanitized = {
      id: node.id,
      name:
        typeof node.name === "string" && node.name.trim().length > 0
          ? node.name.trim()
          : node.id,
      description,
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

const normalizeSkillTreePayload = (payload = {}, fallback = defaultSkillTree) => {
  const base = fallback ?? defaultSkillTree;
  const nodes = sanitizeNodes(payload.nodes ?? base.nodes);
  const connections = sanitizeConnections(payload.connections ?? base.connections, nodes);
  const treeId =
    typeof payload.id === "string" && payload.id.trim().length > 0 ? payload.id.trim() : base.id;
  const name = typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name.trim() : base.name;

  return {
    id: treeId,
    name,
    nodes,
    connections,
  };
};

const loadDefaultSkillTree = async () => {
  try {
    const raw = await fs.readFile(defaultSkillTreePath, "utf-8");
    const parsed = JSON.parse(raw);
    defaultSkillTree = normalizeSkillTreePayload(parsed, builtinDefaultSkillTree);
  } catch (error) {
    console.error("初期スキルツリーデータの読み込みに失敗したため組み込みの既定値を利用します", error);
    defaultSkillTree = builtinDefaultSkillTree;
  }
};

await loadDefaultSkillTree();

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

const fetchNormalizedSkillTree = async () => {
  const record = await getOrCreateSkillTree();
  const nodes = parseJsonArray(record.nodes, defaultSkillTree.nodes);
  const connections = parseJsonArray(record.connections, defaultSkillTree.connections);

  return normalizeSkillTreePayload(
    {
      id: record.treeId,
      name: record.name,
      nodes,
      connections,
    },
    defaultSkillTree,
  );
};

const saveSkillTreeRecord = async (normalized) => {
  return prisma.skillTree.upsert({
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
    const normalized = await fetchNormalizedSkillTree();
    res.json(normalized);
  } catch (error) {
    console.error("スキルツリー取得に失敗しました", error);
    res.status(500).json(normalizeSkillTreePayload(defaultSkillTree, defaultSkillTree));
  }
});

app.post("/api/skill-tree", async (req, res) => {
  const normalized = normalizeSkillTreePayload(req.body || {}, defaultSkillTree);

  try {
    await saveSkillTreeRecord(normalized);

    res.json(normalized);
  } catch (error) {
    console.error("スキルツリー保存に失敗しました", error);
    res.status(500).json({ error: "スキルツリーの保存に失敗しました" });
  }
});

app.get("/api/skill-tree/export", async (_req, res) => {
  try {
    const normalized = await fetchNormalizedSkillTree();
    res.setHeader("Content-Disposition", "attachment; filename=skill-tree.json");
    res.setHeader("Content-Type", "application/json");
    res.json(normalized);
  } catch (error) {
    console.error("スキルツリーのエクスポートに失敗しました", error);
    res.status(500).json({ error: "スキルツリーのエクスポートに失敗しました" });
  }
});

app.post("/api/skill-tree/import", async (req, res) => {
  const normalized = normalizeSkillTreePayload(req.body || {}, defaultSkillTree);

  try {
    await saveSkillTreeRecord(normalized);
    res.json(normalized);
  } catch (error) {
    console.error("スキルツリーのインポートに失敗しました", error);
    res.status(500).json({ error: "スキルツリーのインポートに失敗しました" });
  }
});

app.listen(PORT, () => {
  console.log(`SkillMap APIサーバーがポート${PORT}で待機中です`);
});
