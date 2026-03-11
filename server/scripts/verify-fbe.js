import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const protoJsDir = path.resolve(__dirname, "../../proto/js");
const schemaPath = path.resolve(__dirname, "../../proto/chat.fbe");
const modelPath = path.resolve(__dirname, "../../proto/js/fbe-chat-model.js");

if (!fs.existsSync(protoJsDir)) {
  console.error(`Missing shared FBE JavaScript directory: ${protoJsDir}`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error(`Missing FBE schema: ${schemaPath}`);
  process.exit(1);
}

if (!fs.existsSync(modelPath)) {
  console.error(`Missing FBE JavaScript model: ${modelPath}`);
  process.exit(1);
}

console.log(`FBE schema found: ${schemaPath}`);
console.log(`FBE JavaScript directory found: ${protoJsDir}`);
console.log(`FBE JavaScript model found: ${modelPath}`);
