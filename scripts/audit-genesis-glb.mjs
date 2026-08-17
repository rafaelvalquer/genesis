import crypto from "node:crypto";
import fs from "node:fs";

const GLB_PATH = "public/models/command/genesis-planeta-multibiomas1.glb";
const REQUIRED_SOURCE_NODES = ["Object_4", "Object_6"];
const FORBIDDEN_NODES = ["GenesisWorld_IceSpikes"];

function readGlbJson(file) {
  const data = fs.readFileSync(file);
  if (data.toString("utf8", 0, 4) !== "glTF") throw new Error(`${file} não é um GLB válido`);
  const jsonLength = data.readUInt32LE(12);
  if (data.toString("utf8", 16, 20) !== "JSON") throw new Error(`${file} não possui chunk JSON`);
  return {
    hash: crypto.createHash("sha1").update(data).digest("hex"),
    json: JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8").trim()),
  };
}

const { hash, json } = readGlbJson(GLB_PATH);
const nodeNames = new Set((json.nodes || []).map((node) => node.name).filter(Boolean));
const missing = REQUIRED_SOURCE_NODES.filter((name) => !nodeNames.has(name));
const forbidden = FORBIDDEN_NODES.filter((name) => nodeNames.has(name));

console.log(`Genesis GLB sha1=${hash} nodes=${nodeNames.size}`);
console.log(`source nodes=${REQUIRED_SOURCE_NODES.map((name) => `${name}:${nodeNames.has(name) ? "ok" : "missing"}`).join(" ")}`);

if (missing.length) console.error(`ERROR: nós obrigatórios ausentes: ${missing.join(", ")}`);
if (forbidden.length) console.error(`ERROR: nós legados proibidos presentes: ${forbidden.join(", ")}`);
if (missing.length || forbidden.length) process.exitCode = 1;
