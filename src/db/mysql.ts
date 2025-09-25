// src/db/mysql.ts
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  // Support both MYSQL_* (preferred) and legacy DB_* envs
  const HOST = process.env.MYSQL_HOST || process.env.DB_HOST;
  const PORT = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const USER = process.env.MYSQL_USER || process.env.DB_USER;
  const PASSWORD = process.env.MYSQL_PASSWORD ?? process.env.DB_PASS ?? process.env.DB_PASSWORD;
  const DATABASE = process.env.MYSQL_DATABASE || process.env.DB_NAME;

  if (!HOST || !USER || !DATABASE) {
    throw new Error(
      "Missing DB env. Required: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (or legacy DB_HOST, DB_USER, DB_NAME)."
    );
  }

  pool = mysql.createPool({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    // Helpful options for WP data
    decimalNumbers: true,
    supportBigNumbers: true,
    dateStrings: true,
  });

  return pool;
}

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

export async function withTx<T>(fn: (cx: PoolConnection) => Promise<T>) {
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
    cx.release();
  }
}

// Optional: quick test
export async function ping() {
  const r = await query<{ ok: number }[]>("SELECT 1 as ok");
  console.log("DB OK", r);
}
