import { Hono } from 'hono';
import { LineClient } from '@line-crm/line-sdk';
import {
  getFriendById,
  getRichMenus,
  getRichMenuById,
  createRichMenu as dbCreateRichMenu,
  updateRichMenu as dbUpdateRichMenu,
  deleteRichMenu as dbDeleteRichMenu,
  upsertPostbackActions,
  getPostbackActionsByMenuId,
  getTabGroups,
  getTabGroupById,
  createTabGroup as dbCreateTabGroup,
  updateTabGroup as dbUpdateTabGroup,
  deleteTabGroup as dbDeleteTabGroup,
} from '@line-crm/db';
import type { RichMenuAreaConfig, RichMenuLayoutType } from '@line-crm/shared';
import { getLayoutBounds, getLayoutDefinition, getAllLayouts } from '../services/rich-menu-layouts.js';
import { convertAllAreasToLineActions } from '../services/rich-menu-actions.js';
import type { Env } from '../index.js';

const richMenus = new Hono<Env>();

// ═══════════════════════════════════════════════════════════════════════════════
// LINE API Direct Endpoints (既存)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/rich-menus — list all rich menus from LINE API
richMenus.get('/api/rich-menus', async (c) => {
  try {
    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    const result = await lineClient.getRichMenuList();
    return c.json({ success: true, data: result.richmenus ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/rich-menus error:', message);
    return c.json({ success: false, error: `Failed to fetch rich menus: ${message}` }, 500);
  }
});

// POST /api/rich-menus — create a rich menu via LINE API
richMenus.post('/api/rich-menus', async (c) => {
  try {
    const body = await c.req.json();
    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    const result = await lineClient.createRichMenu(body);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/rich-menus error:', message);
    return c.json({ success: false, error: `Failed to create rich menu: ${message}` }, 500);
  }
});

// DELETE /api/rich-menus/:id — delete a rich menu
richMenus.delete('/api/rich-menus/:id', async (c) => {
  try {
    const richMenuId = c.req.param('id');
    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.deleteRichMenu(richMenuId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('DELETE /api/rich-menus/:id error:', message);
    return c.json({ success: false, error: `Failed to delete rich menu: ${message}` }, 500);
  }
});

// POST /api/rich-menus/:id/default — set rich menu as default for all users
richMenus.post('/api/rich-menus/:id/default', async (c) => {
  try {
    const richMenuId = c.req.param('id');
    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.setDefaultRichMenu(richMenuId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/rich-menus/:id/default error:', message);
    return c.json({ success: false, error: `Failed to set default rich menu: ${message}` }, 500);
  }
});

// POST /api/friends/:friendId/rich-menu — link rich menu to a specific friend
richMenus.post('/api/friends/:friendId/rich-menu', async (c) => {
  try {
    const friendId = c.req.param('friendId');
    const body = await c.req.json<{ richMenuId: string }>();

    if (!body.richMenuId) {
      return c.json({ success: false, error: 'richMenuId is required' }, 400);
    }

    const db = c.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.linkRichMenuToUser(friend.line_user_id, body.richMenuId);

    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/friends/:friendId/rich-menu error:', message);
    return c.json({ success: false, error: `Failed to link rich menu to friend: ${message}` }, 500);
  }
});

// DELETE /api/friends/:friendId/rich-menu — unlink rich menu from a specific friend
richMenus.delete('/api/friends/:friendId/rich-menu', async (c) => {
  try {
    const friendId = c.req.param('friendId');
    const db = c.env.DB;

    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.unlinkRichMenuFromUser(friend.line_user_id);

    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('DELETE /api/friends/:friendId/rich-menu error:', message);
    return c.json({ success: false, error: `Failed to unlink rich menu from friend: ${message}` }, 500);
  }
});

// POST /api/rich-menus/:id/image — upload rich menu image (accepts base64 body or binary)
richMenus.post('/api/rich-menus/:id/image', async (c) => {
  try {
    const richMenuId = c.req.param('id');
    const contentType = c.req.header('content-type') ?? '';

    let imageData: ArrayBuffer;
    let imageContentType: 'image/png' | 'image/jpeg' = 'image/png';

    if (contentType.includes('application/json')) {
      // Accept base64 encoded image in JSON body
      const body = await c.req.json<{ image: string; contentType?: string }>();
      if (!body.image) {
        return c.json({ success: false, error: 'image (base64) is required' }, 400);
      }
      // Strip data URI prefix if present
      const base64 = body.image.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageData = bytes.buffer;
      if (body.contentType === 'image/jpeg') imageContentType = 'image/jpeg';
    } else if (contentType.includes('image/')) {
      // Accept raw binary upload
      imageData = await c.req.arrayBuffer();
      imageContentType = contentType.includes('jpeg') || contentType.includes('jpg') ? 'image/jpeg' : 'image/png';
    } else {
      return c.json({ success: false, error: 'Content-Type must be application/json (with base64) or image/png or image/jpeg' }, 400);
    }

    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.uploadRichMenuImage(richMenuId, imageData, imageContentType);

    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/rich-menus/:id/image error:', message);
    return c.json({ success: false, error: `Failed to upload rich menu image: ${message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Managed Rich Menu Endpoints (ローカルDB管理)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/rich-menus/layouts — レイアウト定義一覧
richMenus.get('/api/rich-menus/layouts', async (c) => {
  return c.json({ success: true, data: getAllLayouts() });
});

// GET /api/rich-menus/managed — ローカルDB一覧
richMenus.get('/api/rich-menus/managed', async (c) => {
  try {
    const db = c.env.DB;
    const lineAccountId = c.req.query('lineAccountId');
    const menus = await getRichMenus(db, lineAccountId || undefined);

    // Transform DB rows to camelCase
    const data = menus.map(rowToMenu);
    return c.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// GET /api/rich-menus/managed/:id — 詳細取得
richMenus.get('/api/rich-menus/managed/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const menu = await getRichMenuById(db, id);
    if (!menu) return c.json({ success: false, error: 'Not found' }, 404);

    const postbacks = await getPostbackActionsByMenuId(db, id);
    return c.json({
      success: true,
      data: {
        ...rowToMenu(menu),
        postbackActions: postbacks.map((p) => ({
          id: p.id,
          areaIndex: p.area_index,
          postbackData: p.postback_data,
          actions: JSON.parse(p.actions),
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// POST /api/rich-menus/managed — 作成 (LINE API + DB + postbackアクション)
richMenus.post('/api/rich-menus/managed', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{
      name: string;
      sizeType?: 'large' | 'small';
      layoutType: RichMenuLayoutType;
      chatBarText?: string;
      areasConfig: RichMenuAreaConfig[];
      lineAccountId?: string;
    }>();

    if (!body.name || !body.layoutType) {
      return c.json({ success: false, error: 'name and layoutType are required' }, 400);
    }

    const layoutDef = getLayoutDefinition(body.layoutType);
    if (!layoutDef) {
      return c.json({ success: false, error: 'Invalid layoutType' }, 400);
    }

    // Ensure areasConfig matches layout area count
    const areasConfig = body.areasConfig || [];
    while (areasConfig.length < layoutDef.areaCount) {
      areasConfig.push({ actionType: 'url', label: '', url: 'https://example.com' });
    }

    const localId = crypto.randomUUID();

    // Convert areas to LINE actions
    const { lineActions, postbackActions } = convertAllAreasToLineActions(areasConfig, localId);
    const layoutBounds = getLayoutBounds(body.layoutType);

    // Build LINE API RichMenuObject
    const lineMenuObject = {
      size: { width: layoutDef.width, height: layoutDef.height },
      selected: false,
      name: body.name,
      chatBarText: body.chatBarText || 'メニュー',
      areas: layoutBounds.map((bounds, i) => ({
        bounds,
        action: lineActions[i].lineAction,
      })),
    };

    // Resolve LINE access token (multi-account support)
    let lineAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (body.lineAccountId) {
      const account = await db
        .prepare('SELECT channel_access_token FROM line_accounts WHERE id = ? AND is_active = 1')
        .bind(body.lineAccountId)
        .first<{ channel_access_token: string }>();
      if (account) lineAccessToken = account.channel_access_token;
    }

    // Create on LINE API
    const lineClient = new LineClient(lineAccessToken);
    const lineResult = await lineClient.createRichMenu(lineMenuObject);

    // Save to local DB
    const dbMenu = await dbCreateRichMenu(db, {
      id: localId,
      lineRichMenuId: lineResult.richMenuId,
      name: body.name,
      sizeType: body.sizeType || layoutDef.sizeType,
      layoutType: body.layoutType,
      chatBarText: body.chatBarText || 'メニュー',
      areasConfig: JSON.stringify(areasConfig),
      lineAccountId: body.lineAccountId || null,
    });

    // Save postback actions
    if (postbackActions.length > 0) {
      await upsertPostbackActions(db, localId, postbackActions);
    }

    return c.json({ success: true, data: rowToMenu(dbMenu) }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/rich-menus/managed error:', message);
    return c.json({ success: false, error: message }, 500);
  }
});

// PUT /api/rich-menus/managed/:id — 更新 (areas変更時はLINE API再作成)
richMenus.put('/api/rich-menus/managed/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      chatBarText?: string;
      layoutType?: RichMenuLayoutType;
      areasConfig?: RichMenuAreaConfig[];
      isActive?: boolean;
    }>();

    const existing = await getRichMenuById(db, id);
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    const needsRecreate = body.layoutType || body.areasConfig;

    if (needsRecreate) {
      const layoutType = (body.layoutType || existing.layout_type) as RichMenuLayoutType;
      const layoutDef = getLayoutDefinition(layoutType);
      const areasConfig = body.areasConfig || JSON.parse(existing.areas_config);

      // Resolve LINE access token
      let lineAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (existing.line_account_id) {
        const account = await db
          .prepare('SELECT channel_access_token FROM line_accounts WHERE id = ? AND is_active = 1')
          .bind(existing.line_account_id)
          .first<{ channel_access_token: string }>();
        if (account) lineAccessToken = account.channel_access_token;
      }
      const lineClient = new LineClient(lineAccessToken);

      // Convert areas
      const { lineActions, postbackActions } = convertAllAreasToLineActions(areasConfig, id);
      const layoutBounds = getLayoutBounds(layoutType);

      // Create new LINE rich menu
      const lineMenuObject = {
        size: { width: layoutDef.width, height: layoutDef.height },
        selected: false,
        name: body.name || existing.name,
        chatBarText: body.chatBarText || existing.chat_bar_text,
        areas: layoutBounds.map((bounds, i) => ({
          bounds,
          action: lineActions[i].lineAction,
        })),
      };

      const newLineResult = await lineClient.createRichMenu(lineMenuObject);

      // If had image, we'd need to re-upload (user can re-upload via image endpoint)

      // Delete old LINE menu
      try {
        await lineClient.deleteRichMenu(existing.line_rich_menu_id);
      } catch (e) {
        console.error('Failed to delete old LINE rich menu:', e);
      }

      // If was default, re-set
      if (existing.is_default) {
        try {
          await lineClient.setDefaultRichMenu(newLineResult.richMenuId);
        } catch (e) {
          console.error('Failed to re-set default:', e);
        }
      }

      // Update alias if exists
      if (existing.line_alias_id) {
        try {
          await lineClient.updateRichMenuAlias(existing.line_alias_id, newLineResult.richMenuId);
        } catch (e) {
          console.error('Failed to update alias:', e);
        }
      }

      // Update postback actions
      await upsertPostbackActions(db, id, postbackActions);

      // Update DB
      await dbUpdateRichMenu(db, id, {
        lineRichMenuId: newLineResult.richMenuId,
        name: body.name,
        chatBarText: body.chatBarText,
        layoutType: body.layoutType,
        areasConfig: JSON.stringify(areasConfig),
        isActive: body.isActive,
      });
    } else {
      // Simple metadata update (no LINE API recreation needed)
      await dbUpdateRichMenu(db, id, {
        name: body.name,
        chatBarText: body.chatBarText,
        isActive: body.isActive,
      });
    }

    const updated = await getRichMenuById(db, id);
    return c.json({ success: true, data: updated ? rowToMenu(updated) : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PUT /api/rich-menus/managed/:id error:', message);
    return c.json({ success: false, error: message }, 500);
  }
});

// DELETE /api/rich-menus/managed/:id — 削除 (LINE API + DB + alias)
richMenus.delete('/api/rich-menus/managed/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const existing = await getRichMenuById(db, id);
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    // Resolve LINE access token
    let lineAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (existing.line_account_id) {
      const account = await db
        .prepare('SELECT channel_access_token FROM line_accounts WHERE id = ? AND is_active = 1')
        .bind(existing.line_account_id)
        .first<{ channel_access_token: string }>();
      if (account) lineAccessToken = account.channel_access_token;
    }
    const lineClient = new LineClient(lineAccessToken);

    // Delete alias first (if exists)
    if (existing.line_alias_id) {
      try {
        await lineClient.deleteRichMenuAlias(existing.line_alias_id);
      } catch (e) {
        console.error('Failed to delete alias:', e);
      }
    }

    // Delete from LINE API
    try {
      await lineClient.deleteRichMenu(existing.line_rich_menu_id);
    } catch (e) {
      console.error('Failed to delete LINE rich menu:', e);
    }

    // Delete from local DB (CASCADE will remove postback actions)
    await dbDeleteRichMenu(db, id);

    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// POST /api/rich-menus/managed/:id/image — 画像アップロード
richMenus.post('/api/rich-menus/managed/:id/image', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const existing = await getRichMenuById(db, id);
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    const contentType = c.req.header('content-type') ?? '';

    let imageData: ArrayBuffer;
    let imageContentType: 'image/png' | 'image/jpeg' = 'image/png';

    if (contentType.includes('application/json')) {
      const body = await c.req.json<{ image: string; contentType?: string }>();
      if (!body.image) {
        return c.json({ success: false, error: 'image (base64) is required' }, 400);
      }
      const base64 = body.image.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageData = bytes.buffer;
      if (body.contentType === 'image/jpeg') imageContentType = 'image/jpeg';
    } else if (contentType.includes('image/')) {
      imageData = await c.req.arrayBuffer();
      imageContentType = contentType.includes('jpeg') || contentType.includes('jpg') ? 'image/jpeg' : 'image/png';
    } else {
      return c.json({ success: false, error: 'Content-Type must be application/json (with base64) or image/png or image/jpeg' }, 400);
    }

    // Resolve LINE access token
    let lineAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (existing.line_account_id) {
      const account = await db
        .prepare('SELECT channel_access_token FROM line_accounts WHERE id = ? AND is_active = 1')
        .bind(existing.line_account_id)
        .first<{ channel_access_token: string }>();
      if (account) lineAccessToken = account.channel_access_token;
    }

    const lineClient = new LineClient(lineAccessToken);
    await lineClient.uploadRichMenuImage(existing.line_rich_menu_id, imageData, imageContentType);

    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// POST /api/rich-menus/managed/:id/activate — デフォルト設定
richMenus.post('/api/rich-menus/managed/:id/activate', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');

    const existing = await getRichMenuById(db, id);
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    // Resolve LINE access token
    let lineAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (existing.line_account_id) {
      const account = await db
        .prepare('SELECT channel_access_token FROM line_accounts WHERE id = ? AND is_active = 1')
        .bind(existing.line_account_id)
        .first<{ channel_access_token: string }>();
      if (account) lineAccessToken = account.channel_access_token;
    }

    const lineClient = new LineClient(lineAccessToken);
    await lineClient.setDefaultRichMenu(existing.line_rich_menu_id);

    // Update DB: clear other defaults for this account, set this one
    if (existing.line_account_id) {
      await db.prepare('UPDATE rich_menus SET is_default = 0 WHERE line_account_id = ?').bind(existing.line_account_id).run();
    } else {
      await db.prepare('UPDATE rich_menus SET is_default = 0 WHERE line_account_id IS NULL').run();
    }
    await dbUpdateRichMenu(db, id, { isDefault: true });

    const updated = await getRichMenuById(db, id);
    return c.json({ success: true, data: updated ? rowToMenu(updated) : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tab Group Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/rich-menu-tab-groups
richMenus.get('/api/rich-menu-tab-groups', async (c) => {
  try {
    const db = c.env.DB;
    const lineAccountId = c.req.query('lineAccountId');
    const groups = await getTabGroups(db, lineAccountId || undefined);
    const data = groups.map((g) => ({
      id: g.id,
      name: g.name,
      tabCount: g.tab_count,
      lineAccountId: g.line_account_id,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }));
    return c.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// POST /api/rich-menu-tab-groups
richMenus.post('/api/rich-menu-tab-groups', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{ name: string; tabCount?: number; lineAccountId?: string }>();
    if (!body.name) return c.json({ success: false, error: 'name is required' }, 400);
    const group = await dbCreateTabGroup(db, {
      id: crypto.randomUUID(),
      name: body.name,
      tabCount: body.tabCount || 2,
      lineAccountId: body.lineAccountId || null,
    });
    return c.json({
      success: true,
      data: { id: group.id, name: group.name, tabCount: group.tab_count, lineAccountId: group.line_account_id, createdAt: group.created_at, updatedAt: group.updated_at },
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// DELETE /api/rich-menu-tab-groups/:id
richMenus.delete('/api/rich-menu-tab-groups/:id', async (c) => {
  try {
    const db = c.env.DB;
    const id = c.req.param('id');
    await dbDeleteTabGroup(db, id);
    return c.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════════════════

function rowToMenu(row: {
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
}) {
  return {
    id: row.id,
    lineRichMenuId: row.line_rich_menu_id,
    lineAliasId: row.line_alias_id,
    name: row.name,
    sizeType: row.size_type,
    layoutType: row.layout_type,
    chatBarText: row.chat_bar_text,
    isDefault: !!row.is_default,
    tabGroupId: row.tab_group_id,
    tabOrder: row.tab_order,
    tabLabel: row.tab_label,
    imageUrl: row.image_url,
    areasConfig: JSON.parse(row.areas_config),
    lineAccountId: row.line_account_id,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { richMenus };
