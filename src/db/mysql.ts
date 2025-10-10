// src/db/mysql.ts
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

/** Dev flag */
const __DEV__ = process.env.NODE_ENV !== "production";

/** Keep a single pool instance across HMR */
declare global {
  // eslint-disable-next-line no-var
  var __MYSQL_POOL__: Pool | undefined;
}

/* --------------------------- Env helpers --------------------------- */
function readEnv() {
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
      "DB env missing. Required: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (or legacy DB_HOST, DB_USER, DB_NAME)."
    );
  }

  const CONNECTION_LIMIT = Number(process.env.DB_CONN_LIMIT || 20);
  const QUEUE_LIMIT = Number(process.env.DB_QUEUE_LIMIT || 0);
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

  if (__DEV__) {
    console.log(
      `[db] creating pool → host=${HOST}:${PORT} db=${DATABASE} as ${USER} (limit=${CONNECTION_LIMIT})`
    );
  }

  const pool = mysql.createPool({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,

    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT,
    queueLimit: QUEUE_LIMIT,

    enableKeepAlive: ENABLE_KEEP_ALIVE,
    keepAliveInitialDelay: 5_000,

    multipleStatements: false,
    namedPlaceholders: false,

    timezone: "Z",
    charset: "utf8mb4",
    supportBigNumbers: true,
    decimalNumbers: true,
    dateStrings: true,
  });

  console.log("[mysql] pool created to", HOST, "db:", DATABASE);

  return pool;
}

/* ----------------------------- Singleton --------------------------- */
export function getPool(): Pool {
  if (!global.__MYSQL_POOL__) {
    global.__MYSQL_POOL__ = createPool();
  }
  return global.__MYSQL_POOL__!;
}

/** Acquire a connection once to fail fast with a clean message (and release) */
async function assertCanConnect() {
  try {
    const cx = await getPool().getConnection();
    cx.release();
  } catch (e: any) {
    const msg =
      e?.message ||
      e?.code ||
      "DB connection failed (could not get a connection from pool)";
    if (__DEV__) console.error("[db] connection error:", e);
    throw new Error(msg);
  }
}

/* ----------------------------- Helpers ----------------------------- */
export async function query<T = RowDataPacket[]>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  // short-circuit check on first call (cheap after warm)
  await assertCanConnect();
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function execute(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  await assertCanConnect();
  const [res] = await getPool().execute<ResultSetHeader>(sql, params);
  return res;
}

/** Transaction helper */
export async function withTx<T>(fn: (cx: PoolConnection) => Promise<T>): Promise<T> {
  let cx: PoolConnection | null = null;              // <-- guard
  try {
    cx = await getPool().getConnection();            // may throw
    await cx.beginTransaction();
    const out = await fn(cx);
    await cx.commit();
    return out;
  } catch (e) {
    try { if (cx) await cx.rollback(); } catch {}
    throw e;
  } finally {
    try { if (cx) cx.release(); } catch {}           // <-- only release if present
  }
}

/* ---------------------------- Diagnostics -------------------------- */
export async function ping() {
  try {
    await assertCanConnect();
    const r = await query<{ ok: number }>("SELECT 1 AS ok");
    if (__DEV__) console.log("DB OK", r?.[0]);
  } catch (e) {
    console.error("[db] ping failed:", e);
  }
}

export async function endPool() {
  if (global.__MYSQL_POOL__) {
    await global.__MYSQL_POOL__.end();
    global.__MYSQL_POOL__ = undefined;
  }
}
