import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = Object.freeze({
  host: process.env.HOST || "0.0.0.0",
  port: Number.parseInt(process.env.PORT || "3001", 10),
  roomName: process.env.ROOM_NAME || "main",
  messagePoolLimit: Number.parseInt(process.env.MESSAGE_POOL_LIMIT || "500", 10),
  protoJsDir: path.resolve(__dirname, "../../proto/js"),
  schemaPath: path.resolve(__dirname, "../../proto/chat.fbe")
});
