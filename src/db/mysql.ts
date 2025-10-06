// src/db/mysql.ts
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

/**
 * ✅ Global singleton pool (Next.js dev/hot-reload safe)
 *  - HMR হলে নতুন করে pool বানানো হবে না
 */
declare global {
  // eslint-disable-next-line no-var
  var __MYSQL_POOL__: Pool | undefined;
}

/* --------------------------- Env helpers --------------------------- */
function readEnv() {
  // Support both MYSQL_* (preferred) and legacy DB_* envs
  const HOST = process.env.MYSQL_HOST || process.env.DB_HOST;
  const PORT = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const USER = process.env.MYSQL_USER || process.env.DB_USER;
  const PASSWORD =
    process.env.MYSQL_PASSWORD ??
    process.env.DB_PASS ??
    process.env.DB_PASSWORD ??
    "";
  const DATABASE = process.env.MYSQL_DATABASE || process.env.DB_NAME;

  if (!HOST || !USER || !DATABASE) {
    throw new Error(
      "Missing DB env. Required: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (or legacy DB_HOST, DB_USER, DB_NAME)."
    );
  }

  const CONNECTION_LIMIT = Number(process.env.DB_CONN_LIMIT || 20);
  const QUEUE_LIMIT = Number(process.env.DB_QUEUE_LIMIT || 0); // 0 = unlimited
  const ENABLE_KEEP_ALIVE =
    String(process.env.DB_KEEP_ALIVE || "true").toLowerCase() !== "false";

  return {
    HOST,
    PORT,
    USER,
    PASSWORD,
    DATABASE,
    CONNECTION_LIMIT,
    QUEUE_LIMIT,
    ENABLE_KEEP_ALIVE,
  };
}

/* --------------------------- Pool factory -------------------------- */
function createPool(): Pool {
  const {
    HOST,
    PORT,
    USER,
    PASSWORD,
    DATABASE,
    CONNECTION_LIMIT,
    QUEUE_LIMIT,
    ENABLE_KEEP_ALIVE,
  } = readEnv();

  return mysql.createPool({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,

    // 🔧 Pool tuning
    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT, // e.g. 20; adjust with DB_CONN_LIMIT
    queueLimit: QUEUE_LIMIT,           // 0 = unlimited queue
    enableKeepAlive: ENABLE_KEEP_ALIVE,
    keepAliveInitialDelay: 5_000,

    // 🔒 Safety/perf
    multipleStatements: false,
    namedPlaceholders: false,

    // 🕑 We store UTC in DB; app-level BD time handled separately
    timezone: "Z",

    // 📚 Data handling
    charset: "utf8mb4",
    supportBigNumbers: true,
    decimalNumbers: true,
    dateStrings: true, // keep MySQL DATETIME as string (you already format them)
  });
}

/* ----------------------------- Singleton --------------------------- */
export function getPool(): Pool {
  if (!global.__MYSQL_POOL__) {
    global.__MYSQL_POOL__ = createPool();
  }
  return global.__MYSQL_POOL__!;
}

/* ----------------------------- Helpers ----------------------------- */
export async function query<T = RowDataPacket[]>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function execute(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  const [res] = await getPool().execute<ResultSetHeader>(sql, params);
  return res;
}

/**
 * Transaction helper
 * - Provides a single connection, ensures commit/rollback and release()
 * - Inside callback you can use `cx.query` / `cx.execute`
 */
export async function withTx<T>(fn: (cx: PoolConnection) => Promise<T>): Promise<T> {
  const cx = await getPool().getConnection();
  try {
    await cx.beginTransaction();
    const out = await fn(cx);
    await cx.commit();
    return out;
  } catch (e) {
    try { await cx.rollback(); } catch {}
    throw e;
  } finally {
    cx.release(); // 🔑 always release
  }
}

/* ---------------------------- Diagnostics -------------------------- */
export async function ping() {
  const r = await query<{ ok: number }>("SELECT 1 AS ok");
  // eslint-disable-next-line no-console
  console.log("DB OK", r?.[0]);
}

/**
 * Optional: close pool on tests/shutdown
 * (Call from jest/globalTeardown or custom script; never from API routes)
 */
export async function endPool() {
  if (global.__MYSQL_POOL__) {
    await global.__MYSQL_POOL__.end();
    global.__MYSQL_POOL__ = undefined;
  }
}
