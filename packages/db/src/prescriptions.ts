import { jstNow } from './utils.js';

// --- Row interfaces ---

export interface PrescriptionSubmissionRow {
  id: string;
  friend_id: string;
  line_account_id: string;
  images: string;
  pickup_time: string;
  pickup_display: string;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionSubmissionWithFriend extends PrescriptionSubmissionRow {
  display_name: string | null;
  line_user_id: string | null;
}

// --- Helpers ---

function jstToday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}

// --- CRUD ---

export async function createPrescriptionSubmission(
  db: D1Database,
  input: {
    lineAccountId: string;
    friendId: string;
    images: string[];
    pickupTime: string;
    pickupDisplay: string;
    note?: string;
  },
): Promise<PrescriptionSubmissionRow> {
  const id = crypto.randomUUID();
  const now = jstNow();

  await db
    .prepare(
      `INSERT INTO prescription_submissions (id, friend_id, line_account_id, images, pickup_time, pickup_display, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)`,
    )
    .bind(
      id,
      input.friendId,
      input.lineAccountId,
      JSON.stringify(input.images),
      input.pickupTime,
      input.pickupDisplay,
      input.note ?? null,
      now,
      now,
    )
    .run();

  return (await db.prepare(`SELECT * FROM prescription_submissions WHERE id = ?`).bind(id).first<PrescriptionSubmissionRow>())!;
}

export async function getPrescriptionSubmissions(
  db: D1Database,
  lineAccountId: string,
): Promise<PrescriptionSubmissionWithFriend[]> {
  const today = jstToday();
  const result = await db
    .prepare(
      `SELECT ps.*, f.display_name, f.line_user_id
       FROM prescription_submissions ps
       LEFT JOIN friends f ON ps.friend_id = f.id
       WHERE ps.line_account_id = ? AND ps.created_at >= ?
       ORDER BY ps.created_at DESC`,
    )
    .bind(lineAccountId, today + 'T00:00:00')
    .all<PrescriptionSubmissionWithFriend>();
  return result.results;
}

export async function getPrescriptionSubmissionById(
  db: D1Database,
  id: string,
): Promise<PrescriptionSubmissionWithFriend | null> {
  return db
    .prepare(
      `SELECT ps.*, f.display_name, f.line_user_id
       FROM prescription_submissions ps
       LEFT JOIN friends f ON ps.friend_id = f.id
       WHERE ps.id = ?`,
    )
    .bind(id)
    .first<PrescriptionSubmissionWithFriend>();
}

export async function updatePrescriptionStatus(
  db: D1Database,
  id: string,
  status: string,
): Promise<void> {
  const now = jstNow();
  await db
    .prepare(`UPDATE prescription_submissions SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();
}

export async function getPendingPrescriptionCount(
  db: D1Database,
  lineAccountId: string,
): Promise<number> {
  const today = jstToday();
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM prescription_submissions
       WHERE line_account_id = ? AND status IN ('received', 'preparing') AND created_at >= ?`,
    )
    .bind(lineAccountId, today + 'T00:00:00')
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function getPrescriptionsByFriendId(
  db: D1Database,
  friendId: string,
): Promise<PrescriptionSubmissionRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM prescription_submissions WHERE friend_id = ? ORDER BY created_at DESC`,
    )
    .bind(friendId)
    .all<PrescriptionSubmissionRow>();
  return result.results;
}
