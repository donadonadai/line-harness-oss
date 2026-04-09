import { jstNow } from './utils.js';

// --- Row interfaces ---

export interface CustomFieldDefinitionRow {
  id: string;
  field_key: string;
  name: string;
  field_type: string;
  options: string | null;
  sort_order: number;
  line_account_id: string | null;
  created_at: string;
}

export interface FriendCustomFieldRow {
  id: string;
  friend_id: string;
  field_key: string;
  value: string;
  updated_at: string;
}

// --- Field Definitions CRUD ---

export async function getCustomFieldDefinitions(
  db: D1Database,
  lineAccountId: string,
): Promise<CustomFieldDefinitionRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM custom_field_definitions
       WHERE line_account_id = ? OR line_account_id IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .bind(lineAccountId)
    .all<CustomFieldDefinitionRow>();
  return result.results;
}

export async function createCustomFieldDefinition(
  db: D1Database,
  input: {
    fieldKey: string;
    name: string;
    fieldType?: string;
    options?: string[];
    sortOrder?: number;
    lineAccountId?: string;
  },
): Promise<CustomFieldDefinitionRow> {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db
    .prepare(
      `INSERT INTO custom_field_definitions (id, field_key, name, field_type, options, sort_order, line_account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.fieldKey,
      input.name,
      input.fieldType ?? 'text',
      input.options ? JSON.stringify(input.options) : null,
      input.sortOrder ?? 0,
      input.lineAccountId ?? null,
      now,
    )
    .run();
  return (await db.prepare(`SELECT * FROM custom_field_definitions WHERE id = ?`).bind(id).first<CustomFieldDefinitionRow>())!;
}

export async function deleteCustomFieldDefinition(
  db: D1Database,
  id: string,
): Promise<void> {
  const def = await db.prepare(`SELECT field_key FROM custom_field_definitions WHERE id = ?`).bind(id).first<{ field_key: string }>();
  if (def) {
    // Also delete all values for this field
    await db.prepare(`DELETE FROM friend_custom_fields WHERE field_key = ?`).bind(def.field_key).run();
  }
  await db.prepare(`DELETE FROM custom_field_definitions WHERE id = ?`).bind(id).run();
}

// --- Friend Custom Fields CRUD ---

export async function getFriendCustomFields(
  db: D1Database,
  friendId: string,
): Promise<FriendCustomFieldRow[]> {
  const result = await db
    .prepare(`SELECT * FROM friend_custom_fields WHERE friend_id = ?`)
    .bind(friendId)
    .all<FriendCustomFieldRow>();
  return result.results;
}

export async function upsertFriendCustomField(
  db: D1Database,
  friendId: string,
  fieldKey: string,
  value: string,
): Promise<void> {
  const now = jstNow();
  const existing = await db
    .prepare(`SELECT id FROM friend_custom_fields WHERE friend_id = ? AND field_key = ?`)
    .bind(friendId, fieldKey)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE friend_custom_fields SET value = ?, updated_at = ? WHERE id = ?`)
      .bind(value, now, existing.id)
      .run();
  } else {
    const id = crypto.randomUUID();
    await db
      .prepare(`INSERT INTO friend_custom_fields (id, friend_id, field_key, value, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, friendId, fieldKey, value, now)
      .run();
  }
}

export async function upsertFriendCustomFields(
  db: D1Database,
  friendId: string,
  fields: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(fields)) {
    await upsertFriendCustomField(db, friendId, key, value);
  }
}

// --- Computed queue stats ---

export async function getFriendQueueStats(
  db: D1Database,
  friendId: string,
): Promise<{ count: number; lastDate: string | null }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt, MAX(created_at) as last_date
       FROM queue_entries WHERE friend_id = ?`,
    )
    .bind(friendId)
    .first<{ cnt: number; last_date: string | null }>();
  return {
    count: row?.cnt ?? 0,
    lastDate: row?.last_date ?? null,
  };
}

// --- Computed prescription stats ---

export async function getFriendPrescriptionStats(
  db: D1Database,
  friendId: string,
): Promise<{ count: number; lastDate: string | null }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt, MAX(created_at) as last_date
       FROM prescription_submissions WHERE friend_id = ?`,
    )
    .bind(friendId)
    .first<{ cnt: number; last_date: string | null }>();
  return {
    count: row?.cnt ?? 0,
    lastDate: row?.last_date ?? null,
  };
}
