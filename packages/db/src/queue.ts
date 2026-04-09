import { jstNow } from './utils.js';

// --- Row interfaces ---

export interface QueueSettingsRow {
  id: string;
  line_account_id: string;
  is_active: number;
  notify_template: string;
  rx_received_title: string;
  rx_received_body: string;
  rx_ready_title: string;
  rx_ready_body: string;
  created_at: string;
  updated_at: string;
}

export interface QueueEntryRow {
  id: string;
  line_account_id: string;
  friend_id: string | null;
  queue_number: number;
  queue_date: string;
  status: string;
  called_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueEntryWithFriend extends QueueEntryRow {
  display_name: string | null;
  line_user_id: string | null;
}

// --- Settings ---

export async function getQueueSettings(db: D1Database, lineAccountId: string): Promise<QueueSettingsRow | null> {
  return db.prepare(`SELECT * FROM queue_settings WHERE line_account_id = ?`).bind(lineAccountId).first<QueueSettingsRow>();
}

export async function upsertQueueSettings(
  db: D1Database,
  input: {
    lineAccountId: string;
    isActive?: boolean;
    notifyTemplate?: string;
    rxReceivedTitle?: string;
    rxReceivedBody?: string;
    rxReadyTitle?: string;
    rxReadyBody?: string;
  },
): Promise<QueueSettingsRow> {
  const existing = await getQueueSettings(db, input.lineAccountId);
  const now = jstNow();

  if (existing) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      vals.push(input.isActive ? 1 : 0);
    }
    if (input.notifyTemplate !== undefined) {
      sets.push('notify_template = ?');
      vals.push(input.notifyTemplate);
    }
    if (input.rxReceivedTitle !== undefined) {
      sets.push('rx_received_title = ?');
      vals.push(input.rxReceivedTitle);
    }
    if (input.rxReceivedBody !== undefined) {
      sets.push('rx_received_body = ?');
      vals.push(input.rxReceivedBody);
    }
    if (input.rxReadyTitle !== undefined) {
      sets.push('rx_ready_title = ?');
      vals.push(input.rxReadyTitle);
    }
    if (input.rxReadyBody !== undefined) {
      sets.push('rx_ready_body = ?');
      vals.push(input.rxReadyBody);
    }
    if (sets.length > 0) {
      sets.push('updated_at = ?');
      vals.push(now);
      vals.push(existing.id);
      await db.prepare(`UPDATE queue_settings SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    }
    return (await db.prepare(`SELECT * FROM queue_settings WHERE id = ?`).bind(existing.id).first<QueueSettingsRow>())!;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO queue_settings (id, line_account_id, is_active, notify_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      input.lineAccountId,
      input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1,
      input.notifyTemplate ?? '受付番号{{queue_number}}番の{{name}}様、お薬の準備ができました。窓口までお越しください。',
      now,
      now,
    )
    .run();
  return (await db.prepare(`SELECT * FROM queue_settings WHERE id = ?`).bind(id).first<QueueSettingsRow>())!;
}

// --- Entries ---

function jstToday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}

export async function getQueueEntriesToday(db: D1Database, lineAccountId: string): Promise<QueueEntryWithFriend[]> {
  const today = jstToday();
  const result = await db
    .prepare(
      `SELECT qe.*, f.display_name, f.line_user_id
       FROM queue_entries qe
       LEFT JOIN friends f ON qe.friend_id = f.id
       WHERE qe.line_account_id = ? AND qe.queue_date = ?
       ORDER BY qe.queue_number ASC`,
    )
    .bind(lineAccountId, today)
    .all<QueueEntryWithFriend>();
  return result.results;
}

export async function getQueueEntryById(db: D1Database, id: string): Promise<QueueEntryWithFriend | null> {
  return db
    .prepare(
      `SELECT qe.*, f.display_name, f.line_user_id
       FROM queue_entries qe
       LEFT JOIN friends f ON qe.friend_id = f.id
       WHERE qe.id = ?`,
    )
    .bind(id)
    .first<QueueEntryWithFriend>();
}

export async function createQueueEntry(
  db: D1Database,
  input: { lineAccountId: string; friendId: string },
): Promise<QueueEntryRow> {
  const id = crypto.randomUUID();
  const now = jstNow();
  const today = jstToday();

  // Get next queue number for today
  const row = await db
    .prepare(`SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num FROM queue_entries WHERE line_account_id = ? AND queue_date = ?`)
    .bind(input.lineAccountId, today)
    .first<{ next_num: number }>();
  const nextNum = row?.next_num ?? 1;

  await db
    .prepare(
      `INSERT INTO queue_entries (id, line_account_id, friend_id, queue_number, queue_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)`,
    )
    .bind(id, input.lineAccountId, input.friendId, nextNum, today, now, now)
    .run();

  return (await db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).bind(id).first<QueueEntryRow>())!;
}

export async function updateQueueEntryStatus(db: D1Database, id: string, status: string): Promise<void> {
  const now = jstNow();
  if (status === 'ready') {
    await db.prepare(`UPDATE queue_entries SET status = ?, called_at = ?, updated_at = ? WHERE id = ?`).bind(status, now, now, id).run();
  } else {
    await db.prepare(`UPDATE queue_entries SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();
  }
}
