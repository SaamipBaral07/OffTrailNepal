import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER ? process.env.DB_USER : "postgres",
  host: process.env.DB_HOST ? process.env.DB_HOST : "localhost",
  database: process.env.DB_NAME ? process.env.DB_NAME : "offtrail_nepal",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "postgres",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];

    if (!key.startsWith("--")) {
      continue;
    }

    const normalizedKey = key.slice(2).trim();
    if (!normalizedKey) {
      continue;
    }

    parsed[normalizedKey] = value;
    i += 1;
  }

  // npm can pass script arguments as positional values in some shells.
  if (Object.keys(parsed).length === 0 && args.length >= 3) {
    return {
      fullName: String(args[0] || "").trim(),
      email: String(args[1] || "").trim().toLowerCase(),
      password: String(args[2] || "").trim(),
      phone: String(args[3] || "").trim() || null,
    };
  }

  return {
    fullName: String(parsed.name || "").trim(),
    email: String(parsed.email || "").trim().toLowerCase(),
    password: String(parsed.password || "").trim(),
    phone: String(parsed.phone || "").trim() || null,
  };
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isEmailTakenAcrossUsers = async (email) => {
  const tables = ["tourists", "hosts", "guides", "admins"];

  for (const table of tables) {
    const result = await pool.query(`SELECT 1 FROM ${table} WHERE email = $1 LIMIT 1`, [email]);
    if (result.rowCount > 0) {
      return true;
    }
  }

  return false;
};

const getAdminsTableColumns = async () => {
  const result = await pool.query(
    `SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'admins'
     ORDER BY ordinal_position`
  );

  if (result.rowCount === 0) {
    throw new Error("admins table was not found in public schema");
  }

  return result.rows;
};

const run = async () => {
  const { fullName, email, password, phone } = parseArgs();

  if (!fullName || !email || !password) {
    console.error("Usage: npm run admin:create -- --name \"Admin Name\" --email admin@example.com --password \"StrongPassword123\" [--phone 98xxxxxxxx]");
    process.exitCode = 1;
    return;
  }

  if (!isValidEmail(email)) {
    console.error("Invalid email format.");
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  if (await isEmailTakenAcrossUsers(email)) {
    console.error("Email is already registered in an existing user table.");
    process.exitCode = 1;
    return;
  }

  const columns = await getAdminsTableColumns();
  const columnNames = new Set(columns.map((row) => row.column_name));

  const payload = {
    full_name: fullName,
    email,
    password: await bcrypt.hash(password, 10),
  };

  if (columnNames.has("phone") && phone) {
    payload.phone = phone;
  }

  if (columnNames.has("profile_image_path")) {
    payload.profile_image_path = null;
  }

  const requiredWithoutDefault = columns.filter(
    (row) => row.is_nullable === "NO" && row.column_default == null
  );

  for (const requiredColumn of requiredWithoutDefault) {
    const columnName = String(requiredColumn.column_name);

    if (columnName === "admin_id") {
      continue;
    }

    if (!(columnName in payload)) {
      throw new Error(
        `Cannot create admin automatically because admins.${columnName} is required and no value was provided.`
      );
    }
  }

  const insertColumns = Object.keys(payload);
  const insertValues = Object.values(payload);
  const placeholders = insertValues.map((_, index) => `$${index + 1}`);

  const result = await pool.query(
    `INSERT INTO admins (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING admin_id, full_name, email, created_at`,
    insertValues
  );

  console.log("Admin account created successfully:");
  console.log(result.rows[0]);
};

try {
  await run();
} catch (err) {
  console.error("Failed to create admin user:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
