import mysql from "mysql2/promise";

/**
 * MySQL connection pool for use across the app.
 * @type {mysql.Pool}
 */
const pool: mysql.Pool = mysql.createPool({
  host: process.env.NEXT_PUBLIC_DB_HOST,
  database: process.env.NEXT_PUBLIC_DB_NAME,
  user: process.env.NEXT_PUBLIC_DB_USER,
  password: process.env.NEXT_PUBLIC_DB_PASSWORD,
  connectionLimit: 2,
  maxIdle: 0,
  idleTimeout: 0,
  enableKeepAlive: false,
  waitForConnections: true,
  queueLimit: 0,
  port: 3306,
});

/**
 * Returns the MySQL connection pool.
 * @returns {Promise<mysql.Pool>} The MySQL connection pool.
 */
export async function dbConnection(): Promise<mysql.Pool> {
  return pool;
}