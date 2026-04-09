/**
 * LIFF Prescription Submission Page — Pharmacy prescription upload
 *
 * Flow:
 * 1. LIFF init -> get profile + account info
 * 2. Check friendship via liff.getFriendship()
 * 3. If not friend -> show friend-add screen -> wait for add -> re-check
 * 4. Resolve friendId via /api/liff/link
 * 5. Step 1: Image upload
 * 6. Step 2: Pickup time selection
 * 7. Step 3: Submit
 * 8. Step 4: Success screen
 *
 * Query params:
 *   ?account=xxx  -- LINE account ID (required for multi-account)
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

interface PrescriptionState {
  profile: { userId: string; displayName: string; pictureUrl?: string } | null;
  friendId: string | null;
  accountId: string | null;
  accountName: string | null;
  basicId: string | null;
  images: string[];        // base64 strings
  pickupTime: string | null;
  pickupDisplay: string | null;
  note: string;
  submitting: boolean;
  step: number; // 1=images, 2=pickup, 3=submitting, 4=success
}

const state: PrescriptionState = {
  profile: null,
  friendId: null,
  accountId: null,
  accountName: null,
  basicId: null,
  images: [],
  pickupTime: null,
  pickupDisplay: null,
  note: '',
  submitting: false,
  step: 1,
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

// ========== Image Compression ==========

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_WIDTH = 1200;
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ========== Step Dots ==========

function renderStepDots(): string {
  return `
    <div class="step-indicator">
      <div class="step-dot ${state.step >= 1 ? 'active' : ''}"></div>
      <div class="step-dot ${state.step >= 2 ? 'active' : ''}"></div>
      <div class="step-dot ${state.step >= 4 ? 'active' : ''}"></div>
    </div>
  `;
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

  getApp().innerHTML = `
    <div class="card">
      <div class="queue-icon">💊</div>
      ${accountName ? `<h2>${escapeHtml(accountName)}</h2>` : '<h2>処方せん受付</h2>'}
      <div class="profile">
        ${profile.pictureUrl ? `<img src="${profile.pictureUrl}" alt="" />` : ''}
        <p class="name">${escapeHtml(profile.displayName)} さん</p>
      </div>
      <p class="message">処方せん受付には友だち追加が必要です</p>
      <button class="queue-checkin-btn" data-action="add-friend">
        友だち追加して受付する
      </button>
      <p class="message" style="font-size:12px;color:#999;margin-top:12px;">
        追加後、この画面に戻ってください
      </p>
      <button class="close-btn" data-action="recheck" style="margin-top:8px;">
        友だち追加済みの方はこちら
      </button>
    </div>
  `;

  getApp().querySelector('[data-action="add-friend"]')?.addEventListener('click', () => {
    if (basicId) {
      const cleanId = basicId.startsWith('@') ? basicId : `@${basicId}`;
      const url = `https://line.me/R/ti/p/${cleanId}`;
      if (liff.isInClient()) {
        window.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } else {
      alert(accountName
        ? `LINEで「${accountName}」を検索して友だち追加してください`
        : 'LINEの公式アカウントを友だち追加してください');
    }
  });

  getApp().querySelector('[data-action="recheck"]')?.addEventListener('click', () => {
    recheckAndProceed();
  });

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
      await resolveAndShowForm();
    } else {
      renderFriendAdd();
    }
  } catch {
    renderFriendAdd();
  }
}

// ========== Step 1: Image Upload ==========

function renderImageUpload(): void {
  const { profile, accountName } = state;
  if (!profile) return;

  state.step = 1;
  const hasImages = state.images.length > 0;

  let previewsHtml = '';
  state.images.forEach((img, i) => {
    previewsHtml += `
      <div class="prescription-preview">
        <img src="${img}" alt="処方せん${i + 1}" />
        <button class="remove-btn" data-remove="${i}">&times;</button>
      </div>
    `;
  });

  getApp().innerHTML = `
    <div class="card">
      ${renderStepDots()}
      <div class="queue-icon">💊</div>
      ${accountName ? `<h2>${escapeHtml(accountName)}</h2>` : '<h2>処方せん受付</h2>'}
      <p class="message">処方せんの画像を撮影またはアップロードしてください</p>

      <div class="prescription-upload-area" data-action="add-image">
        <input type="file" accept="image/*" capture="environment" multiple hidden />
        <span>📷 処方せんを撮影・選択</span>
      </div>

      <div class="prescription-previews">${previewsHtml}</div>

      <button class="queue-checkin-btn" data-action="next-step" ${hasImages ? '' : 'disabled'}>
        次へ
      </button>
    </div>
  `;

  // File input handling
  const uploadArea = getApp().querySelector('[data-action="add-image"]') as HTMLElement;
  const fileInput = uploadArea?.querySelector('input[type="file"]') as HTMLInputElement;

  uploadArea?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = await compressImage(files[i]);
        state.images.push(base64);
      } catch (err) {
        console.error('Image compress error:', err);
      }
    }
    fileInput.value = '';
    renderImageUpload();
  });

  // Remove buttons
  getApp().querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((btn as HTMLElement).dataset.remove!, 10);
      state.images.splice(idx, 1);
      renderImageUpload();
    });
  });

  // Next button
  getApp().querySelector('[data-action="next-step"]')?.addEventListener('click', () => {
    if (state.images.length > 0) {
      renderPickupTime();
    }
  });
}

// ========== Step 2: Pickup Time Selection ==========

function renderPickupTime(): void {
  state.step = 2;

  // Get current JST hour
  const jstNow = new Date(Date.now() + 9 * 60 * 60000);
  const currentHour = jstNow.getUTCHours();

  // Generate time buttons from currentHour+1 to 19
  let todayButtonsHtml = '';
  const startHour = currentHour + 1;
  for (let h = startHour; h <= 19; h++) {
    const timeStr = `${h}:00`;
    const timeKey = `today_${h}`;
    const selected = state.pickupTime === timeKey ? ' selected' : '';
    todayButtonsHtml += `<button class="pickup-time-btn${selected}" data-time="${timeKey}" data-display="本日 ${timeStr}">${timeStr}</button>`;
  }

  const tomorrowSelected = state.pickupTime === 'tomorrow' ? ' selected' : '';

  getApp().innerHTML = `
    <div class="card">
      ${renderStepDots()}
      <h2>受け取り時間</h2>
      <p class="message">ご来局の目安時間を選択してください</p>

      ${todayButtonsHtml ? `
      <div class="pickup-time-section">
        <p class="pickup-label">本日</p>
        <div class="pickup-time-grid">
          ${todayButtonsHtml}
        </div>
      </div>
      ` : ''}

      <div class="pickup-time-section">
        <p class="pickup-label">明日以降</p>
        <button class="pickup-time-btn wide${tomorrowSelected}" data-time="tomorrow" data-display="明日以降に受け取り">明日以降に受け取り</button>
      </div>

      <button class="close-btn" data-action="back">戻る</button>
    </div>
  `;

  // Time button selection
  getApp().querySelectorAll('.pickup-time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      state.pickupTime = el.dataset.time!;
      state.pickupDisplay = el.dataset.display!;

      // Remove selected from all
      getApp().querySelectorAll('.pickup-time-btn').forEach((b) => b.classList.remove('selected'));
      el.classList.add('selected');

      // Proceed to submit after a short delay
      setTimeout(() => submitPrescription(), 300);
    });
  });

  // Back button
  getApp().querySelector('[data-action="back"]')?.addEventListener('click', () => {
    renderImageUpload();
  });
}

// ========== Step 3: Submitting ==========

async function submitPrescription(): Promise<void> {
  if (state.submitting || !state.friendId || !state.accountId || !state.pickupTime) return;
  state.submitting = true;
  state.step = 3;

  getApp().innerHTML = `
    <div class="card">
      <div class="loading-spinner"></div>
      <p class="message">送信中...</p>
    </div>
  `;

  try {
    const res = await apiCall('/api/prescriptions/submit', {
      method: 'POST',
      body: JSON.stringify({
        lineAccountId: state.accountId,
        friendId: state.friendId,
        images: state.images,
        pickupTime: state.pickupTime,
        pickupDisplay: state.pickupDisplay,
        note: state.note || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(err?.error || '送信に失敗しました');
    }

    const json = await res.json() as { success: boolean; data: { pickupDisplay: string } };
    if (!json.success) throw new Error('送信に失敗しました');

    renderSuccess();
  } catch (err) {
    state.submitting = false;
    renderError(err instanceof Error ? err.message : '送信に失敗しました');
  }
}

// ========== Step 4: Success ==========

function renderSuccess(): void {
  state.step = 4;
  const { accountName, pickupDisplay } = state;

  getApp().innerHTML = `
    <div class="card">
      <div class="check-icon">✓</div>
      <h2>受付完了</h2>
      ${accountName ? `<p class="account-name">${escapeHtml(accountName)}</p>` : ''}
      <p class="message">処方せんを受け付けました。</p>
      <p class="message">お薬の準備ができましたら<br>LINEでお知らせいたします。</p>
      ${pickupDisplay ? `<p style="font-size:12px;color:#999;margin-top:12px;">受け取り目安: ${escapeHtml(pickupDisplay)}</p>` : ''}
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
    renderImageUpload();
  });
}

// ========== API ==========

async function resolveAndShowForm(): Promise<void> {
  renderLoading();

  let friendId: string | null = null;
  try {
    friendId = localStorage.getItem(UUID_STORAGE_KEY);
  } catch { /* silent */ }

  const rawIdToken = liff.getIDToken();
  if (rawIdToken) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await apiCall('/api/liff/link', {
          method: 'POST',
          body: JSON.stringify({
            idToken: rawIdToken,
            displayName: state.profile?.displayName,
            existingUuid: friendId,
            lineAccountId: state.accountId,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { success: boolean; data?: { userId?: string; friendId?: string } };
          if (data?.data?.userId) {
            try {
              localStorage.setItem(UUID_STORAGE_KEY, data.data.userId);
            } catch { /* silent */ }
          }
          if (data?.data?.friendId) {
            friendId = data.data.friendId;
            break;
          }
        }
      } catch { /* silent */ }
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
  renderImageUpload();
}

// ========== Init ==========

export async function initPrescription(accountId: string | null): Promise<void> {
  renderLoading();

  if (!accountId) {
    renderError('アカウント情報が不足しています。QRコードを再度読み取ってください。');
    return;
  }
  state.accountId = accountId;

  // Fetch account name + basic ID (reuse queue account-info endpoint)
  try {
    const infoRes = await apiCall(`/api/queue/account-info?lineAccountId=${encodeURIComponent(accountId)}`);
    if (infoRes.ok) {
      const infoJson = await infoRes.json() as { success: boolean; data?: { name?: string; basicId?: string } };
      if (infoJson?.data?.name) state.accountName = infoJson.data.name;
      if (infoJson?.data?.basicId) state.basicId = infoJson.data.basicId;
    }
  } catch { /* silent */ }

  try {
    const [profile, friendship] = await Promise.all([
      liff.getProfile(),
      liff.getFriendship(),
    ]);
    state.profile = profile;

    if (!friendship.friendFlag) {
      renderFriendAdd();
      return;
    }

    await resolveAndShowForm();
  } catch (err) {
    renderError(err instanceof Error ? err.message : 'プロフィール取得に失敗しました');
  }
}
