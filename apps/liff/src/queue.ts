/**
 * LIFF Queue Check-in Page — Pharmacy reception number
 *
 * Flow:
 * 1. LIFF init → get profile + account info
 * 2. Check friendship via liff.getFriendship()
 * 3. If not friend → show friend-add screen → wait for add → re-check
 * 4. Resolve friendId via /api/liff/link
 * 5. Show check-in button
 * 6. On tap → POST /api/queue/checkin → show reception number
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
  getFriendship(): Promise<{ friendFlag: boolean }>;
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
  basicId: string | null;
  queueNumber: number | null;
  submitting: boolean;
}

const state: QueueState = {
  profile: null,
  friendId: null,
  accountId: null,
  accountName: null,
  basicId: null,
  queueNumber: null,
  submitting: false,
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

function renderFriendAdd(): void {
  const { profile, accountName, basicId } = state;
  if (!profile) return;

  const friendAddUrl = basicId
    ? `https://line.me/R/ti/p/@${basicId}`
    : '#';

  getApp().innerHTML = `
    <div class="card">
      <div class="queue-icon">🏥</div>
      ${accountName ? `<h2>${escapeHtml(accountName)}</h2>` : '<h2>受付</h2>'}
      <div class="profile">
        ${profile.pictureUrl ? `<img src="${profile.pictureUrl}" alt="" />` : ''}
        <p class="name">${escapeHtml(profile.displayName)} さん</p>
      </div>
      <p class="message">受付には友だち追加が必要です</p>
      <a href="${friendAddUrl}" class="queue-checkin-btn" style="display:block;text-align:center;text-decoration:none;color:#fff;">
        友だち追加して受付する
      </a>
      <p class="message" style="font-size:12px;color:#999;margin-top:12px;">
        追加後、この画面に戻ってください
      </p>
      <button class="close-btn" data-action="recheck" style="margin-top:8px;">
        友だち追加済みの方はこちら
      </button>
    </div>
  `;

  // Re-check button
  getApp().querySelector('[data-action="recheck"]')?.addEventListener('click', () => {
    recheckAndProceed();
  });

  // Auto re-check when user returns to this screen (after adding friend)
  document.addEventListener('visibilitychange', onVisibilityChange);
}

async function onVisibilityChange(): Promise<void> {
  if (document.visibilityState !== 'visible') return;
  await recheckAndProceed();
}

async function recheckAndProceed(): Promise<void> {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  renderLoading();
  try {
    const { friendFlag } = await liff.getFriendship();
    if (friendFlag) {
      // Friend added! Now link and show check-in
      await resolveAndShowCheckin();
    } else {
      // Still not a friend
      renderFriendAdd();
    }
  } catch {
    renderFriendAdd();
  }
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
    state.submitting = false;
    recheckAndProceed();
  });
}

// ========== API ==========

async function resolveAndShowCheckin(): Promise<void> {
  renderLoading();

  // Try to resolve friendId via /api/liff/link
  let friendId: string | null = null;
  try {
    friendId = localStorage.getItem(UUID_STORAGE_KEY);
  } catch { /* silent */ }

  const rawIdToken = liff.getIDToken();
  if (rawIdToken) {
    // Retry link a few times (webhook may take a moment to create friend record)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await apiCall('/api/liff/link', {
          method: 'POST',
          body: JSON.stringify({
            idToken: rawIdToken,
            displayName: state.profile?.displayName,
            existingUuid: friendId,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { success: boolean; data?: { userId?: string } };
          if (data?.data?.userId) {
            try {
              localStorage.setItem(UUID_STORAGE_KEY, data.data.userId);
            } catch { /* silent */ }
            friendId = data.data.userId;
            break;
          }
        }
      } catch { /* silent */ }
      // Wait before retry (webhook needs time to process follow event)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  if (!friendId) {
    renderError('友だち登録の反映に少し時間がかかっています。しばらくしてからやり直してください。');
    return;
  }

  state.friendId = friendId;
  renderCheckin();
}

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

  // Fetch account name + basic ID
  try {
    const infoRes = await apiCall(`/api/queue/account-info?lineAccountId=${encodeURIComponent(accountId)}`);
    if (infoRes.ok) {
      const infoJson = await infoRes.json() as { success: boolean; data?: { name?: string; basicId?: string } };
      if (infoJson?.data?.name) state.accountName = infoJson.data.name;
      if (infoJson?.data?.basicId) state.basicId = infoJson.data.basicId;
    }
  } catch { /* silent */ }

  try {
    // Get profile and friendship status in parallel
    const [profile, friendship] = await Promise.all([
      liff.getProfile(),
      liff.getFriendship(),
    ]);
    state.profile = profile;

    if (!friendship.friendFlag) {
      // Not a friend yet → show friend-add screen
      renderFriendAdd();
      return;
    }

    // Already a friend → resolve link and show check-in
    await resolveAndShowCheckin();
  } catch (err) {
    renderError(err instanceof Error ? err.message : 'プロフィール取得に失敗しました');
  }
}
