// src/db/loadEnv.ts
import { config } from "dotenv";
import path from "node:path";

// default .env.local; override with ENV_FILE if you want
const file = process.env.ENV_FILE || ".env.local";
config({ path: path.resolve(process.cwd(), file) });
