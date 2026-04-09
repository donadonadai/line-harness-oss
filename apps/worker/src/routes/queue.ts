import { Hono } from 'hono';
import {
  getQueueSettings,
  upsertQueueSettings,
  getQueueEntriesToday,
  getQueueEntryById,
  createQueueEntry,
  updateQueueEntryStatus,
  getLineAccountById,
  getFriendById,
} from '@line-crm/db';
import { LineClient } from '@line-crm/line-sdk';
import { fireEvent } from '../services/event-bus.js';
import type { Env } from '../index.js';

const queue = new Hono<Env>();

function expandTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ========== Settings ==========

queue.get('/api/queue/settings', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId') ?? '';
    if (!lineAccountId) return c.json({ success: false, error: 'lineAccountId is required' }, 400);
    const settings = await getQueueSettings(c.env.DB, lineAccountId);
    if (!settings) return c.json({ success: true, data: null });
    return c.json({
      success: true,
      data: {
        id: settings.id,
        lineAccountId: settings.line_account_id,
        isActive: Boolean(settings.is_active),
        notifyTemplate: settings.notify_template,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at,
      },
    });
  } catch (err) {
    console.error('GET /api/queue/settings error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

queue.put('/api/queue/settings', async (c) => {
  try {
    const body = await c.req.json<{ lineAccountId: string; isActive?: boolean; notifyTemplate?: string }>();
    if (!body.lineAccountId) return c.json({ success: false, error: 'lineAccountId is required' }, 400);
    const settings = await upsertQueueSettings(c.env.DB, body);
    return c.json({
      success: true,
      data: {
        id: settings.id,
        lineAccountId: settings.line_account_id,
        isActive: Boolean(settings.is_active),
        notifyTemplate: settings.notify_template,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at,
      },
    });
  } catch (err) {
    console.error('PUT /api/queue/settings error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ========== Entries ==========

queue.get('/api/queue/entries', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId') ?? '';
    if (!lineAccountId) return c.json({ success: false, error: 'lineAccountId is required' }, 400);
    const entries = await getQueueEntriesToday(c.env.DB, lineAccountId);
    return c.json({
      success: true,
      data: entries.map((e) => ({
        id: e.id,
        lineAccountId: e.line_account_id,
        friendId: e.friend_id,
        queueNumber: e.queue_number,
        queueDate: e.queue_date,
        status: e.status,
        calledAt: e.called_at,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        displayName: e.display_name,
        lineUserId: e.line_user_id,
      })),
    });
  } catch (err) {
    console.error('GET /api/queue/entries error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// LIFF account info — no auth required (returns only public name)
queue.get('/api/queue/account-info', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId') ?? '';
    if (!lineAccountId) return c.json({ success: false, error: 'lineAccountId is required' }, 400);
    const account = await getLineAccountById(c.env.DB, lineAccountId);
    if (!account) return c.json({ success: false, error: 'Account not found' }, 404);
    // Fetch bot basic ID from LINE API for friend-add URL
    let basicId: string | null = null;
    try {
      const botRes = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${account.channel_access_token}` },
      });
      if (botRes.ok) {
        const botInfo = await botRes.json() as { basicId?: string };
        basicId = botInfo.basicId || null;
      }
    } catch { /* best-effort */ }
    return c.json({
      success: true,
      data: { name: account.name, liffId: account.liff_id || null, basicId },
    });
  } catch (err) {
    console.error('GET /api/queue/account-info error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// LIFF check-in — no auth required
queue.post('/api/queue/checkin', async (c) => {
  try {
    const body = await c.req.json<{ lineAccountId: string; friendId: string }>();
    if (!body.lineAccountId || !body.friendId) {
      return c.json({ success: false, error: 'lineAccountId and friendId are required' }, 400);
    }

    const entry = await createQueueEntry(c.env.DB, {
      lineAccountId: body.lineAccountId,
      friendId: body.friendId,
    });

    // Send check-in confirmation message via LINE
    const sendMessagePromise = (async () => {
      try {
        const friend = await getFriendById(c.env.DB, body.friendId);
        if (!friend?.line_user_id) return;

        // Resolve access token for this account
        let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
        const account = await getLineAccountById(c.env.DB, body.lineAccountId);
        if (account?.channel_access_token) {
          accessToken = account.channel_access_token;
        }
        const accountName = account?.name || '薬局';

        const lineClient = new LineClient(accessToken);
        const name = friend.display_name || 'お客';

        await lineClient.pushMessage(friend.line_user_id, [
          {
            type: 'flex',
            altText: `受付番号${entry.queue_number}番で受付しました`,
            contents: {
              type: 'bubble',
              size: 'kilo',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: accountName, size: 'xs', color: '#888888', align: 'center' },
                  { type: 'text', text: '受付完了', size: 'lg', weight: 'bold', color: '#06C755', align: 'center' },
                ],
                paddingBottom: 'sm',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: String(entry.queue_number),
                    size: '4xl',
                    weight: 'bold',
                    align: 'center',
                    color: '#06C755',
                  },
                  { type: 'text', text: '受付番号', size: 'sm', align: 'center', color: '#888888', margin: 'xs' },
                  { type: 'separator', margin: 'lg' },
                  {
                    type: 'text',
                    text: `${name}様、受付が完了しました。\nお薬の準備ができましたらこちらのLINEでお知らせいたします。`,
                    size: 'sm',
                    wrap: true,
                    margin: 'lg',
                    color: '#555555',
                  },
                ],
                paddingAll: 'xl',
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: '※順番が近づきましたら店内にお戻りください', size: 'xxs', color: '#aaaaaa', align: 'center', wrap: true },
                ],
                paddingAll: 'sm',
              },
            },
          },
        ]);
      } catch (msgErr) {
        console.error('Queue checkin message error:', msgErr);
      }
    })();

    // Fire event for automations
    fireEvent(
      c.env.DB,
      'queue_checkin',
      { friendId: body.friendId, eventData: { queueNumber: entry.queue_number, queueDate: entry.queue_date } },
      c.env.LINE_CHANNEL_ACCESS_TOKEN,
      body.lineAccountId,
    ).catch((err) => console.error('fireEvent queue_checkin error:', err));

    // Don't block response — send message in background
    c.executionCtx.waitUntil(sendMessagePromise);

    return c.json({
      success: true,
      data: {
        id: entry.id,
        queueNumber: entry.queue_number,
        queueDate: entry.queue_date,
        status: entry.status,
      },
    }, 201);
  } catch (err) {
    console.error('POST /api/queue/checkin error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Update status — triggers LINE notification on 'ready'
queue.put('/api/queue/entries/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ status: string }>();
    if (!body.status) return c.json({ success: false, error: 'status is required' }, 400);

    const entry = await getQueueEntryById(c.env.DB, id);
    if (!entry) return c.json({ success: false, error: 'Queue entry not found' }, 404);

    await updateQueueEntryStatus(c.env.DB, id, body.status);

    // Send LINE notification when marking as ready
    if (body.status === 'ready' && entry.friend_id && entry.line_user_id) {
      try {
        // Get queue settings for the template
        const settings = await getQueueSettings(c.env.DB, entry.line_account_id);
        const template = settings?.notify_template ?? '受付番号{{queue_number}}番の{{name}}様、お薬の準備ができました。窓口までお越しください。';

        const message = expandTemplate(template, {
          queue_number: String(entry.queue_number),
          name: entry.display_name ?? 'お客',
          date: entry.queue_date,
        });

        // Resolve access token: try DB account first, fallback to env
        let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
        const account = await getLineAccountById(c.env.DB, entry.line_account_id);
        if (account?.channel_access_token) {
          accessToken = account.channel_access_token;
        }

        const lineClient = new LineClient(accessToken);
        await lineClient.pushMessage(entry.line_user_id, [{ type: 'text', text: message }]);
      } catch (notifyErr) {
        console.error('Queue notification error:', notifyErr);
        // Best-effort: status still updated even if notification fails
      }
    }

    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('PUT /api/queue/entries/:id/status error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { queue };
