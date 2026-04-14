import { jstNow } from './utils.js';

export interface StaffRow {
  id: string;
  login_id: string;
  password_hash: string;
  password_salt: string;
  name: string;
  role: 'admin' | 'staff';
  is_active: number;
  line_account_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Password hashing with Web Crypto API (PBKDF2) ---

async function deriveKey(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomUUID();
  const hash = await deriveKey(password, salt);
  return { hash, salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const derived = await deriveKey(password, salt);
  return derived === hash;
}

// --- CRUD ---

export async function getStaffByLoginId(
  db: D1Database,
  loginId: string,
): Promise<StaffRow | null> {
  return db
    .prepare('SELECT * FROM staff WHERE login_id = ?')
    .bind(loginId)
    .first<StaffRow>();
}

export async function getStaffById(
  db: D1Database,
  id: string,
): Promise<StaffRow | null> {
  return db
    .prepare('SELECT * FROM staff WHERE id = ?')
    .bind(id)
    .first<StaffRow>();
}

export async function listStaff(db: D1Database): Promise<StaffRow[]> {
  const result = await db
    .prepare('SELECT * FROM staff ORDER BY created_at ASC')
    .all<StaffRow>();
  return result.results;
}

export async function createStaff(
  db: D1Database,
  input: {
    loginId: string;
    password: string;
    name: string;
    role?: 'admin' | 'staff';
    lineAccountId?: string;
  },
): Promise<StaffRow> {
  const id = crypto.randomUUID();
  const now = jstNow();
  const { hash, salt } = await hashPassword(input.password);

  await db
    .prepare(
      `INSERT INTO staff (id, login_id, password_hash, password_salt, name, role, line_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.loginId,
      hash,
      salt,
      input.name,
      input.role ?? 'staff',
      input.lineAccountId ?? null,
      now,
      now,
    )
    .run();

  return (await db.prepare('SELECT * FROM staff WHERE id = ?').bind(id).first<StaffRow>())!;
}

export async function updateStaff(
  db: D1Database,
  id: string,
  input: {
    name?: string;
    role?: 'admin' | 'staff';
    password?: string;
    isActive?: boolean;
    lineAccountId?: string | null;
  },
): Promise<StaffRow | null> {
  const now = jstNow();
  const sets: string[] = ['updated_at = ?'];
  const binds: unknown[] = [now];

  if (input.name !== undefined) {
    sets.push('name = ?');
    binds.push(input.name);
  }
  if (input.role !== undefined) {
    sets.push('role = ?');
    binds.push(input.role);
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?');
    binds.push(input.isActive ? 1 : 0);
  }
  if (input.lineAccountId !== undefined) {
    sets.push('line_account_id = ?');
    binds.push(input.lineAccountId);
  }
  if (input.password) {
    const { hash, salt } = await hashPassword(input.password);
    sets.push('password_hash = ?');
    binds.push(hash);
    sets.push('password_salt = ?');
    binds.push(salt);
  }

  binds.push(id);
  await db
    .prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  return getStaffById(db, id);
}

export async function deleteStaff(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM staff WHERE id = ?').bind(id).run();
}

export async function getStaffCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as cnt FROM staff').first<{ cnt: number }>();
  return row?.cnt ?? 0;
}
