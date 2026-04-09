import { Hono } from 'hono';
import {
  getCustomFieldDefinitions,
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  getFriendCustomFields,
  upsertFriendCustomFields,
  getFriendPrescriptionStats,
  getFriendQueueStats,
} from '@line-crm/db';
import type { Env } from '../index.js';

const customFields = new Hono<Env>();

// ========== Field Definitions ==========

// GET /api/custom-fields/definitions
customFields.get('/api/custom-fields/definitions', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId') ?? '';
    if (!lineAccountId) return c.json({ success: false, error: 'lineAccountId is required' }, 400);

    const defs = await getCustomFieldDefinitions(c.env.DB, lineAccountId);
    return c.json({
      success: true,
      data: defs.map((d) => ({
        id: d.id,
        fieldKey: d.field_key,
        name: d.name,
        fieldType: d.field_type,
        options: d.options ? JSON.parse(d.options) : null,
        sortOrder: d.sort_order,
        lineAccountId: d.line_account_id,
        createdAt: d.created_at,
      })),
    });
  } catch (err) {
    console.error('GET /api/custom-fields/definitions error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/custom-fields/definitions
customFields.post('/api/custom-fields/definitions', async (c) => {
  try {
    const body = await c.req.json<{
      fieldKey: string;
      name: string;
      fieldType?: string;
      options?: string[];
      sortOrder?: number;
      lineAccountId?: string;
    }>();
    if (!body.fieldKey || !body.name) {
      return c.json({ success: false, error: 'fieldKey and name are required' }, 400);
    }

    const def = await createCustomFieldDefinition(c.env.DB, body);
    return c.json({
      success: true,
      data: {
        id: def.id,
        fieldKey: def.field_key,
        name: def.name,
        fieldType: def.field_type,
        options: def.options ? JSON.parse(def.options) : null,
        sortOrder: def.sort_order,
        lineAccountId: def.line_account_id,
        createdAt: def.created_at,
      },
    }, 201);
  } catch (err) {
    console.error('POST /api/custom-fields/definitions error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/custom-fields/definitions/:id
customFields.delete('/api/custom-fields/definitions/:id', async (c) => {
  try {
    await deleteCustomFieldDefinition(c.env.DB, c.req.param('id'));
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/custom-fields/definitions/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ========== Friend Custom Fields ==========

// GET /api/friends/:friendId/info — combined: custom fields + prescription stats
customFields.get('/api/friends/:friendId/info', async (c) => {
  try {
    const friendId = c.req.param('friendId');

    const [fields, prescriptionStats, queueStats] = await Promise.all([
      getFriendCustomFields(c.env.DB, friendId),
      getFriendPrescriptionStats(c.env.DB, friendId),
      getFriendQueueStats(c.env.DB, friendId),
    ]);

    const customFieldsMap: Record<string, string> = {};
    for (const f of fields) {
      customFieldsMap[f.field_key] = f.value;
    }

    return c.json({
      success: true,
      data: {
        customFields: customFieldsMap,
        prescriptionStats: {
          count: prescriptionStats.count,
          lastDate: prescriptionStats.lastDate
            ? prescriptionStats.lastDate.slice(0, 10)
            : null,
        },
        queueStats: {
          count: queueStats.count,
          lastDate: queueStats.lastDate
            ? queueStats.lastDate.slice(0, 10)
            : null,
        },
      },
    });
  } catch (err) {
    console.error('GET /api/friends/:friendId/info error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/friends/:friendId/custom-fields — upsert multiple fields
customFields.put('/api/friends/:friendId/custom-fields', async (c) => {
  try {
    const friendId = c.req.param('friendId');
    const body = await c.req.json<{ fields: Record<string, string> }>();
    if (!body.fields || typeof body.fields !== 'object') {
      return c.json({ success: false, error: 'fields object is required' }, 400);
    }

    await upsertFriendCustomFields(c.env.DB, friendId, body.fields);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('PUT /api/friends/:friendId/custom-fields error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { customFields };
