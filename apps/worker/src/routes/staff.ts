import { Hono } from 'hono';
import {
  getStaffByLoginId,
  getStaffById,
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffCount,
  verifyPassword,
} from '@line-crm/db';
import { signJwt, verifyJwt } from '../services/jwt.js';
import type { Env } from '../index.js';

const staff = new Hono<Env>();

// ========== Public Auth Endpoints ==========

// POST /api/auth/login — authenticate with loginId + password
staff.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ loginId: string; password: string }>();
    if (!body.loginId || !body.password) {
      return c.json({ success: false, error: 'loginId and password are required' }, 400);
    }

    const staffRow = await getStaffByLoginId(c.env.DB, body.loginId);
    if (!staffRow || !staffRow.is_active) {
      return c.json({ success: false, error: 'ログインIDまたはパスワードが正しくありません' }, 401);
    }

    const valid = await verifyPassword(body.password, staffRow.password_hash, staffRow.password_salt);
    if (!valid) {
      return c.json({ success: false, error: 'ログインIDまたはパスワードが正しくありません' }, 401);
    }

    const token = await signJwt(
      {
        staffId: staffRow.id,
        loginId: staffRow.login_id,
        role: staffRow.role as 'admin' | 'staff',
        name: staffRow.name,
      },
      c.env.API_KEY,
    );

    return c.json({
      success: true,
      data: {
        token,
        staff: {
          id: staffRow.id,
          loginId: staffRow.login_id,
          name: staffRow.name,
          role: staffRow.role,
        },
      },
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/auth/setup — create first admin (requires API_KEY, only when no staff exists)
staff.post('/api/auth/setup', async (c) => {
  try {
    // Require API_KEY for initial setup
    const authHeader = c.req.header('Authorization');
    if (!authHeader || authHeader !== `Bearer ${c.env.API_KEY}`) {
      return c.json({ success: false, error: 'API_KEY required for initial setup' }, 401);
    }

    const count = await getStaffCount(c.env.DB);
    if (count > 0) {
      return c.json({ success: false, error: 'Setup already completed. Use admin panel to manage staff.' }, 400);
    }

    const body = await c.req.json<{ loginId: string; password: string; name: string }>();
    if (!body.loginId || !body.password || !body.name) {
      return c.json({ success: false, error: 'loginId, password, and name are required' }, 400);
    }

    const newStaff = await createStaff(c.env.DB, {
      loginId: body.loginId,
      password: body.password,
      name: body.name,
      role: 'admin',
    });

    return c.json({
      success: true,
      data: {
        id: newStaff.id,
        loginId: newStaff.login_id,
        name: newStaff.name,
        role: newStaff.role,
      },
    }, 201);
  } catch (err) {
    console.error('POST /api/auth/setup error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/auth/me — get current staff info from JWT
staff.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice('Bearer '.length);

    // Try JWT first
    const payload = await verifyJwt(token, c.env.API_KEY);
    if (payload) {
      const staffRow = await getStaffById(c.env.DB, payload.staffId);
      if (!staffRow || !staffRow.is_active) {
        return c.json({ success: false, error: 'Staff not found' }, 401);
      }
      return c.json({
        success: true,
        data: {
          id: staffRow.id,
          loginId: staffRow.login_id,
          name: staffRow.name,
          role: staffRow.role,
          lineAccountId: staffRow.line_account_id,
        },
      });
    }

    // Fallback: legacy API_KEY → return virtual admin
    if (token === c.env.API_KEY) {
      return c.json({
        success: true,
        data: {
          id: '__api_key__',
          loginId: 'admin',
          name: '管理者',
          role: 'admin',
          lineAccountId: null,
        },
      });
    }

    return c.json({ success: false, error: 'Unauthorized' }, 401);
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/auth/check — check if staff setup is required
staff.get('/api/auth/check', async (c) => {
  try {
    const count = await getStaffCount(c.env.DB);
    return c.json({
      success: true,
      data: { staffExists: count > 0 },
    });
  } catch (err) {
    console.error('GET /api/auth/check error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ========== Protected Staff Management (admin only) ==========

// GET /api/staff — list all staff
staff.get('/api/staff', async (c) => {
  try {
    const all = await listStaff(c.env.DB);
    return c.json({
      success: true,
      data: all.map((s) => ({
        id: s.id,
        loginId: s.login_id,
        name: s.name,
        role: s.role,
        isActive: !!s.is_active,
        lineAccountId: s.line_account_id,
        createdAt: s.created_at,
      })),
    });
  } catch (err) {
    console.error('GET /api/staff error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/staff — create new staff
staff.post('/api/staff', async (c) => {
  try {
    const body = await c.req.json<{
      loginId: string;
      password: string;
      name: string;
      role?: 'admin' | 'staff';
      lineAccountId?: string;
    }>();
    if (!body.loginId || !body.password || !body.name) {
      return c.json({ success: false, error: 'loginId, password, and name are required' }, 400);
    }

    // Check for duplicate loginId
    const existing = await getStaffByLoginId(c.env.DB, body.loginId);
    if (existing) {
      return c.json({ success: false, error: 'このログインIDは既に使用されています' }, 409);
    }

    const newStaff = await createStaff(c.env.DB, body);
    return c.json({
      success: true,
      data: {
        id: newStaff.id,
        loginId: newStaff.login_id,
        name: newStaff.name,
        role: newStaff.role,
        isActive: !!newStaff.is_active,
        lineAccountId: newStaff.line_account_id,
        createdAt: newStaff.created_at,
      },
    }, 201);
  } catch (err) {
    console.error('POST /api/staff error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/staff/:id — update staff
staff.put('/api/staff/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      role?: 'admin' | 'staff';
      password?: string;
      isActive?: boolean;
      lineAccountId?: string | null;
    }>();

    const updated = await updateStaff(c.env.DB, id, body);
    if (!updated) {
      return c.json({ success: false, error: 'Staff not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: updated.id,
        loginId: updated.login_id,
        name: updated.name,
        role: updated.role,
        isActive: !!updated.is_active,
        lineAccountId: updated.line_account_id,
        createdAt: updated.created_at,
      },
    });
  } catch (err) {
    console.error('PUT /api/staff/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/staff/:id — delete staff
staff.delete('/api/staff/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteStaff(c.env.DB, id);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/staff/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { staff };
