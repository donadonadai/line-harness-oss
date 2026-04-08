import { jstNow } from './utils';

// ─── Rich Menu CRUD ──────────────────────────────────────────────────────────

export interface RichMenuRow {
  id: string;
  line_rich_menu_id: string;
  line_alias_id: string | null;
  name: string;
  size_type: string;
  layout_type: string;
  chat_bar_text: string;
  is_default: number;
  tab_group_id: string | null;
  tab_order: number | null;
  tab_label: string | null;
  image_url: string | null;
  areas_config: string;
  line_account_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function getRichMenus(
  db: D1Database,
  lineAccountId?: string,
): Promise<RichMenuRow[]> {
  if (lineAccountId) {
    const { results } = await db
      .prepare('SELECT * FROM rich_menus WHERE line_account_id = ? ORDER BY created_at DESC')
      .bind(lineAccountId)
      .all<RichMenuRow>();
    return results;
  }
  const { results } = await db
    .prepare('SELECT * FROM rich_menus ORDER BY created_at DESC')
    .all<RichMenuRow>();
  return results;
}

export async function getRichMenuById(
  db: D1Database,
  id: string,
): Promise<RichMenuRow | null> {
  return db
    .prepare('SELECT * FROM rich_menus WHERE id = ?')
    .bind(id)
    .first<RichMenuRow>();
}

export interface CreateRichMenuInput {
  id: string;
  lineRichMenuId: string;
  lineAliasId?: string | null;
  name: string;
  sizeType: string;
  layoutType: string;
  chatBarText: string;
  isDefault?: boolean;
  tabGroupId?: string | null;
  tabOrder?: number | null;
  tabLabel?: string | null;
  imageUrl?: string | null;
  areasConfig: string;
  lineAccountId?: string | null;
}

export async function createRichMenu(
  db: D1Database,
  input: CreateRichMenuInput,
): Promise<RichMenuRow> {
  const now = jstNow();
  await db
    .prepare(
      `INSERT INTO rich_menus (id, line_rich_menu_id, line_alias_id, name, size_type, layout_type, chat_bar_text, is_default, tab_group_id, tab_order, tab_label, image_url, areas_config, line_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.lineRichMenuId,
      input.lineAliasId ?? null,
      input.name,
      input.sizeType,
      input.layoutType,
      input.chatBarText,
      input.isDefault ? 1 : 0,
      input.tabGroupId ?? null,
      input.tabOrder ?? null,
      input.tabLabel ?? null,
      input.imageUrl ?? null,
      input.areasConfig,
      input.lineAccountId ?? null,
      now,
      now,
    )
    .run();

  return (await getRichMenuById(db, input.id))!;
}

export async function updateRichMenu(
  db: D1Database,
  id: string,
  updates: Partial<{
    lineRichMenuId: string;
    lineAliasId: string | null;
    name: string;
    sizeType: string;
    layoutType: string;
    chatBarText: string;
    isDefault: boolean;
    tabGroupId: string | null;
    tabOrder: number | null;
    tabLabel: string | null;
    imageUrl: string | null;
    areasConfig: string;
    isActive: boolean;
  }>,
): Promise<RichMenuRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.lineRichMenuId !== undefined) { sets.push('line_rich_menu_id = ?'); values.push(updates.lineRichMenuId); }
  if (updates.lineAliasId !== undefined) { sets.push('line_alias_id = ?'); values.push(updates.lineAliasId); }
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.sizeType !== undefined) { sets.push('size_type = ?'); values.push(updates.sizeType); }
  if (updates.layoutType !== undefined) { sets.push('layout_type = ?'); values.push(updates.layoutType); }
  if (updates.chatBarText !== undefined) { sets.push('chat_bar_text = ?'); values.push(updates.chatBarText); }
  if (updates.isDefault !== undefined) { sets.push('is_default = ?'); values.push(updates.isDefault ? 1 : 0); }
  if (updates.tabGroupId !== undefined) { sets.push('tab_group_id = ?'); values.push(updates.tabGroupId); }
  if (updates.tabOrder !== undefined) { sets.push('tab_order = ?'); values.push(updates.tabOrder); }
  if (updates.tabLabel !== undefined) { sets.push('tab_label = ?'); values.push(updates.tabLabel); }
  if (updates.imageUrl !== undefined) { sets.push('image_url = ?'); values.push(updates.imageUrl); }
  if (updates.areasConfig !== undefined) { sets.push('areas_config = ?'); values.push(updates.areasConfig); }
  if (updates.isActive !== undefined) { sets.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

  if (sets.length === 0) return getRichMenuById(db, id);

  sets.push('updated_at = ?');
  values.push(jstNow());
  values.push(id);

  await db
    .prepare(`UPDATE rich_menus SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return getRichMenuById(db, id);
}

export async function deleteRichMenu(
  db: D1Database,
  id: string,
): Promise<void> {
  await db.prepare('DELETE FROM rich_menus WHERE id = ?').bind(id).run();
}

// ─── Postback Actions ────────────────────────────────────────────────────────

export interface PostbackActionRow {
  id: string;
  rich_menu_id: string;
  area_index: number;
  postback_data: string;
  actions: string;
  created_at: string;
}

export async function getPostbackActionByData(
  db: D1Database,
  postbackData: string,
): Promise<PostbackActionRow | null> {
  return db
    .prepare('SELECT * FROM rich_menu_postback_actions WHERE postback_data = ?')
    .bind(postbackData)
    .first<PostbackActionRow>();
}

export async function getPostbackActionsByMenuId(
  db: D1Database,
  richMenuId: string,
): Promise<PostbackActionRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM rich_menu_postback_actions WHERE rich_menu_id = ? ORDER BY area_index')
    .bind(richMenuId)
    .all<PostbackActionRow>();
  return results;
}

export async function upsertPostbackActions(
  db: D1Database,
  richMenuId: string,
  actions: Array<{ areaIndex: number; postbackData: string; actions: string }>,
): Promise<void> {
  // Delete existing actions for this menu
  await db
    .prepare('DELETE FROM rich_menu_postback_actions WHERE rich_menu_id = ?')
    .bind(richMenuId)
    .run();

  // Insert new actions
  for (const action of actions) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO rich_menu_postback_actions (id, rich_menu_id, area_index, postback_data, actions)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, richMenuId, action.areaIndex, action.postbackData, action.actions)
      .run();
  }
}

// ─── Tab Groups ──────────────────────────────────────────────────────────────

export interface TabGroupRow {
  id: string;
  name: string;
  tab_count: number;
  line_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTabGroups(
  db: D1Database,
  lineAccountId?: string,
): Promise<TabGroupRow[]> {
  if (lineAccountId) {
    const { results } = await db
      .prepare('SELECT * FROM rich_menu_tab_groups WHERE line_account_id = ? ORDER BY created_at DESC')
      .bind(lineAccountId)
      .all<TabGroupRow>();
    return results;
  }
  const { results } = await db
    .prepare('SELECT * FROM rich_menu_tab_groups ORDER BY created_at DESC')
    .all<TabGroupRow>();
  return results;
}

export async function getTabGroupById(
  db: D1Database,
  id: string,
): Promise<TabGroupRow | null> {
  return db
    .prepare('SELECT * FROM rich_menu_tab_groups WHERE id = ?')
    .bind(id)
    .first<TabGroupRow>();
}

export async function createTabGroup(
  db: D1Database,
  input: { id: string; name: string; tabCount: number; lineAccountId?: string | null },
): Promise<TabGroupRow> {
  const now = jstNow();
  await db
    .prepare(
      `INSERT INTO rich_menu_tab_groups (id, name, tab_count, line_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.name, input.tabCount, input.lineAccountId ?? null, now, now)
    .run();
  return (await getTabGroupById(db, input.id))!;
}

export async function updateTabGroup(
  db: D1Database,
  id: string,
  updates: Partial<{ name: string; tabCount: number }>,
): Promise<TabGroupRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.tabCount !== undefined) { sets.push('tab_count = ?'); values.push(updates.tabCount); }
  if (sets.length === 0) return getTabGroupById(db, id);
  sets.push('updated_at = ?');
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE rich_menu_tab_groups SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return getTabGroupById(db, id);
}

export async function deleteTabGroup(
  db: D1Database,
  id: string,
): Promise<void> {
  await db.prepare('DELETE FROM rich_menu_tab_groups WHERE id = ?').bind(id).run();
}

// ─── Segment Rules ───────────────────────────────────────────────────────────

export interface SegmentRuleRow {
  id: string;
  name: string;
  rich_menu_id: string;
  conditions: string;
  priority: number;
  line_account_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function getSegmentRules(
  db: D1Database,
  lineAccountId?: string,
): Promise<SegmentRuleRow[]> {
  if (lineAccountId) {
    const { results } = await db
      .prepare('SELECT * FROM rich_menu_segment_rules WHERE line_account_id = ? ORDER BY priority DESC')
      .bind(lineAccountId)
      .all<SegmentRuleRow>();
    return results;
  }
  const { results } = await db
    .prepare('SELECT * FROM rich_menu_segment_rules ORDER BY priority DESC')
    .all<SegmentRuleRow>();
  return results;
}

export async function createSegmentRule(
  db: D1Database,
  input: {
    id: string;
    name: string;
    richMenuId: string;
    conditions: string;
    priority: number;
    lineAccountId?: string | null;
  },
): Promise<SegmentRuleRow> {
  const now = jstNow();
  await db
    .prepare(
      `INSERT INTO rich_menu_segment_rules (id, name, rich_menu_id, conditions, priority, line_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.name, input.richMenuId, input.conditions, input.priority, input.lineAccountId ?? null, now, now)
    .run();
  return db.prepare('SELECT * FROM rich_menu_segment_rules WHERE id = ?').bind(input.id).first<SegmentRuleRow>() as Promise<SegmentRuleRow>;
}

export async function updateSegmentRule(
  db: D1Database,
  id: string,
  updates: Partial<{ name: string; richMenuId: string; conditions: string; priority: number; isActive: boolean }>,
): Promise<SegmentRuleRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.richMenuId !== undefined) { sets.push('rich_menu_id = ?'); values.push(updates.richMenuId); }
  if (updates.conditions !== undefined) { sets.push('conditions = ?'); values.push(updates.conditions); }
  if (updates.priority !== undefined) { sets.push('priority = ?'); values.push(updates.priority); }
  if (updates.isActive !== undefined) { sets.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (sets.length === 0) return db.prepare('SELECT * FROM rich_menu_segment_rules WHERE id = ?').bind(id).first<SegmentRuleRow>();
  sets.push('updated_at = ?');
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE rich_menu_segment_rules SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return db.prepare('SELECT * FROM rich_menu_segment_rules WHERE id = ?').bind(id).first<SegmentRuleRow>();
}

export async function deleteSegmentRule(
  db: D1Database,
  id: string,
): Promise<void> {
  await db.prepare('DELETE FROM rich_menu_segment_rules WHERE id = ?').bind(id).run();
}
