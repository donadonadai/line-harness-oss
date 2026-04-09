/**
 * LIFF Queue Check-in Page — Pharmacy reception number
 *
 * Flow:
 * 1. LIFF init → get profile
 * 2. Resolve friendId via /api/liff/link (same pattern as booking.ts)
 * 3. Show check-in button
 * 4. On tap → POST /api/queue/checkin → show reception number
 *
 * Query params:
 *   ?account=xxx  — LINE account ID (required for multi-account)
 */

declare const liff: {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(opts?: { redirectUri?: string }): void;
  getProfile(): Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
  getIDToken(): string | null;
  isInClient(): boolean;
  closeWindow(): void;
};

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8787';
const UUID_STORAGE_KEY = 'lh_uuid';

interface QueueState {
  profile: { userId: string; displayName: string; pictureUrl?: string } | null;
  friendId: string | null;
  accountId: string | null;
  accountName: string | null;
  queueNumber: number | null;
  submitting: boolean;
  error: string | null;
}

const state: QueueState = {
  profile: null,
  friendId: null,
  accountId: null,
  accountName: null,
  queueNumber: null,
  submitting: false,
  error: null,
};

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function apiCall(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

function getApp(): HTMLElement {
  return document.getElementById('app')!;
}

// ========== Rendering ==========

function renderLoading(): void {
  getApp().innerHTML = `
    <div class="card">
      <div class="loading-spinner"></div>
      <p class="message">読み込み中...</p>
    </div>
  `;
}

function renderCheckin(): void {
  const { profile, accountName } = state;
  if (!profile) return;

  getApp().innerHTML = `
    <div class="card">
      <div class="queue-icon">🏥</div>
      ${accountName ? `<h2>${escapeHtml(accountName)}</h2>` : '<h2>受付</h2>'}
      <div class="profile">
        ${profile.pictureUrl ? `<img src="${profile.pictureUrl}" alt="" />` : ''}
        <p class="name">${escapeHtml(profile.displayName)} さん</p>
      </div>
      <p class="message">受付ボタンを押して番号を取得してください</p>
      <button class="queue-checkin-btn" data-action="checkin" ${state.submitting ? 'disabled' : ''}>
        ${state.submitting ? '処理中...' : '受付する'}
      </button>
    </div>
  `;

  const btn = getApp().querySelector('[data-action="checkin"]');
  btn?.addEventListener('click', () => submitCheckin());
}

function renderSuccess(): void {
  const { profile, queueNumber, accountName } = state;
  if (!profile || queueNumber === null) return;

  getApp().innerHTML = `
    <div class="card">
      ${accountName ? `<p class="account-name">${escapeHtml(accountName)}</p>` : ''}
      <div class="queue-number-display">
        <div class="queue-number-circle">
          <span class="queue-number-value">${queueNumber}</span>
        </div>
        <p class="queue-number-label">受付番号</p>
      </div>
      <div class="profile">
        ${profile.pictureUrl ? `<img src="${profile.pictureUrl}" alt="" />` : ''}
        <p class="name">${escapeHtml(profile.displayName)} さん</p>
      </div>
      <p class="message">お薬の準備ができましたら<br>LINEでお知らせいたします。</p>
      <button class="close-btn" data-action="close">閉じる</button>
    </div>
  `;

  getApp().querySelector('[data-action="close"]')?.addEventListener('click', () => {
    if (liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.close();
    }
  });
}

function renderError(message: string): void {
  getApp().innerHTML = `
    <div class="card">
      <h2 style="color: #e53e3e;">エラー</h2>
      <p class="error">${escapeHtml(message)}</p>
      <button class="close-btn" data-action="retry" style="margin-top:16px;">やり直す</button>
    </div>
  `;
  getApp().querySelector('[data-action="retry"]')?.addEventListener('click', () => {
    state.error = null;
    state.submitting = false;
    renderCheckin();
  });
}

// ========== API ==========

async function submitCheckin(): Promise<void> {
  if (state.submitting || !state.friendId || !state.accountId) return;
  state.submitting = true;
  renderCheckin();

  try {
    const res = await apiCall('/api/queue/checkin', {
      method: 'POST',
      body: JSON.stringify({
        lineAccountId: state.accountId,
        friendId: state.friendId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(err?.error || '受付に失敗しました');
    }

    const json = await res.json() as { success: boolean; data: { queueNumber: number } };
    if (!json.success) throw new Error('受付に失敗しました');

    state.queueNumber = json.data.queueNumber;
    renderSuccess();
  } catch (err) {
    state.submitting = false;
    renderError(err instanceof Error ? err.message : '受付に失敗しました');
  }
}

// ========== Init ==========

export async function initQueue(accountId: string | null): Promise<void> {
  renderLoading();

  if (!accountId) {
    renderError('アカウント情報が不足しています。QRコードを再度読み取ってください。');
    return;
  }
  state.accountId = accountId;

  // Fetch account name (best-effort)
  try {
    const infoRes = await apiCall(`/api/queue/account-info?lineAccountId=${encodeURIComponent(accountId)}`);
    if (infoRes.ok) {
      const infoJson = await infoRes.json() as { success: boolean; data?: { name?: string } };
      if (infoJson?.data?.name) {
        state.accountName = infoJson.data.name;
      }
    }
  } catch { /* silent */ }

  try {
    const profile = await liff.getProfile();
    state.profile = profile;

    // Resolve friendId via UUID linking (same pattern as booking.ts)
    try {
      state.friendId = localStorage.getItem(UUID_STORAGE_KEY);
    } catch {
      // silent
    }

    const rawIdToken = liff.getIDToken();
    if (rawIdToken) {
      try {
        const res = await apiCall('/api/liff/link', {
          method: 'POST',
          body: JSON.stringify({
            idToken: rawIdToken,
            displayName: profile.displayName,
            existingUuid: state.friendId,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { success: boolean; data?: { userId?: string } };
          if (data?.data?.userId) {
            try {
              localStorage.setItem(UUID_STORAGE_KEY, data.data.userId);
              state.friendId = data.data.userId;
            } catch { /* silent */ }
          }
        }
      } catch {
        // Silent fail — UUID linking is best-effort
      }
    }

    if (!state.friendId) {
      renderError('友だち情報が取得できませんでした。先に友だち追加を行ってください。');
      return;
    }

    renderCheckin();
  } catch (err) {
    renderError(err instanceof Error ? err.message : 'プロフィール取得に失敗しました');
  }
}
