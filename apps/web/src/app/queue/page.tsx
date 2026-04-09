'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'
import type { QueueSettings, QueueEntry } from '@line-crm/shared'

const LIFF_BASE_URL_FALLBACK = 'https://liff.line.me/2009554425-4IMBmLQ9'

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: '待機中', color: '#d97706', bg: '#fef3c7' },
  ready: { label: '準備完了', color: '#059669', bg: '#d1fae5' },
  done: { label: '完了', color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'キャンセル', color: '#dc2626', bg: '#fee2e2' },
}

export default function QueuePage() {
  const { selectedAccountId, selectedAccount } = useAccount()
  const [settings, setSettings] = useState<QueueSettings | null>(null)
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const liffBaseUrl = selectedAccount?.liffId
    ? `https://liff.line.me/${selectedAccount.liffId}`
    : LIFF_BASE_URL_FALLBACK

  const queueUrl = selectedAccountId
    ? `${liffBaseUrl}?page=queue&account=${selectedAccountId}`
    : ''

  // 友だち追加URL (LIFF経由 — 未友だちなら自動で友だち追加フローが走る)
  const friendAddUrl = selectedAccountId
    ? `${liffBaseUrl}?ref=queue-${selectedAccountId}`
    : ''

  const fetchData = useCallback(async () => {
    if (!selectedAccountId) return
    try {
      const [settingsRes, entriesRes] = await Promise.all([
        api.queue.getSettings(selectedAccountId),
        api.queue.entries(selectedAccountId),
      ])
      if (settingsRes.success) {
        setSettings(settingsRes.data)
        if (settingsRes.data) setTemplateDraft(settingsRes.data.notifyTemplate)
      }
      if (entriesRes.success) setEntries(entriesRes.data)
    } catch (err) {
      console.error('Queue fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (selectedAccountId) {
        api.queue.entries(selectedAccountId).then((res) => {
          if (res.success) setEntries(res.data)
        }).catch(() => {})
      }
    }, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [selectedAccountId])

  const handleSaveSettings = useCallback(async () => {
    if (!selectedAccountId) return
    setSaving(true)
    try {
      const res = await api.queue.updateSettings({
        lineAccountId: selectedAccountId,
        isActive: settings?.isActive ?? true,
        notifyTemplate: templateDraft,
      })
      if (res.success) setSettings(res.data)
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setSaving(false)
    }
  }, [selectedAccountId, settings, templateDraft])

  const handleToggleActive = useCallback(async () => {
    if (!selectedAccountId) return
    try {
      const res = await api.queue.updateSettings({
        lineAccountId: selectedAccountId,
        isActive: !(settings?.isActive ?? true),
      })
      if (res.success) setSettings(res.data)
    } catch (err) {
      console.error('Toggle active error:', err)
    }
  }, [selectedAccountId, settings])

  const handleMarkReady = useCallback(async (entryId: string) => {
    try {
      await api.queue.updateEntryStatus(entryId, 'ready')
      await fetchData()
    } catch (err) {
      console.error('Mark ready error:', err)
    }
  }, [fetchData])

  const handleMarkDone = useCallback(async (entryId: string) => {
    try {
      await api.queue.updateEntryStatus(entryId, 'done')
      await fetchData()
    } catch (err) {
      console.error('Mark done error:', err)
    }
  }, [fetchData])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>受付用QRコード</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hiragino Sans','Yu Gothic',system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}
.container{text-align:center;padding:40px}
.pharmacy-icon{font-size:48px;margin-bottom:16px}
h1{font-size:28px;font-weight:800;color:#1a1a1a;margin-bottom:8px}
.sub{font-size:16px;color:#666;margin-bottom:32px}
.qr-wrapper{display:inline-block;padding:24px;border:3px solid #06C755;border-radius:16px;margin-bottom:24px}
.steps{text-align:left;max-width:320px;margin:0 auto}
.step{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.step-num{width:28px;height:28px;border-radius:50%;background:#06C755;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0}
.step-text{font-size:15px;color:#333;line-height:1.6;padding-top:2px}
.footer{margin-top:32px;font-size:12px;color:#999}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="container">
<div class="pharmacy-icon">🏥</div>
<h1>受付はこちら</h1>
<p class="sub">QRコードを読み取って受付番号を取得してください</p>
<div class="qr-wrapper">
<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(queueUrl)}" width="250" height="250" alt="QR Code" />
</div>
<div class="steps">
<div class="step"><div class="step-num">1</div><div class="step-text">QRコードをスマートフォンで読み取り</div></div>
<div class="step"><div class="step-num">2</div><div class="step-text">LINEで友だち追加（初回のみ）</div></div>
<div class="step"><div class="step-num">3</div><div class="step-text">「受付する」ボタンをタップ</div></div>
<div class="step"><div class="step-num">4</div><div class="step-text">準備ができたらLINEでお知らせ</div></div>
</div>
<p class="footer">LINE Harness 受付システム</p>
</div>
</body>
</html>`)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const filteredEntries = statusFilter === 'all'
    ? entries
    : entries.filter((e) => e.status === statusFilter)

  const waitingCount = entries.filter((e) => e.status === 'waiting').length

  if (!selectedAccountId) {
    return (
      <>
        <Header title="受付番号管理" />
        <main className="p-6">
          <p className="text-gray-500">アカウントを選択してください</p>
        </main>
      </>
    )
  }

  return (
    <div>
      <Header
        title="受付番号管理"
        action={
          <button
            onClick={() => setShowQr(!showQr)}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            {showQr ? '一覧に戻る' : 'QRコード・URL'}
          </button>
        }
      />

      {/* ─── QR / URL Panel ────────────────────────────────────────── */}
      {showQr && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
            <h2 className="text-base font-bold text-gray-900">来局受付用リンク</h2>
            <p className="text-xs text-gray-500 mt-1">お客様がスマートフォンで読み取って受付番号を取得できます</p>
          </div>

          {!selectedAccount?.liffId && (
            <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                ⚠️ このアカウントにLIFF IDが設定されていません。QRコードはデフォルトのLIFF（L Harness）に接続されます。
                <a href="/accounts" className="ml-1 text-blue-600 underline">アカウント管理</a>でLIFF IDを設定してください。
              </p>
            </div>
          )}

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-5 rounded-xl border-2 border-green-400 shadow-sm">
                <QRCodeSVG
                  value={queueUrl}
                  size={220}
                  level="M"
                  includeMargin={false}
                  fgColor="#1a1a1a"
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">受付番号発行用QRコード</p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  印刷用ページ
                </button>
              </div>
            </div>

            {/* URLs */}
            <div className="space-y-5">
              {/* Queue URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    受付番号発行URL
                  </span>
                </label>
                <p className="text-[11px] text-gray-400 mb-2">友だち追加済みのお客様が受付番号を取得するURL</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={queueUrl}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 bg-gray-50 focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => handleCopy(queueUrl)}
                    className="shrink-0 px-3 py-2 min-h-[44px] text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                  >
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
              </div>

              {/* Friend Add URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    友だち追加URL
                  </span>
                </label>
                <p className="text-[11px] text-gray-400 mb-2">まだ友だちでないお客様向け（友だち追加→受付の流れ）</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={friendAddUrl}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 bg-gray-50 focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => handleCopy(friendAddUrl)}
                    className="shrink-0 px-3 py-2 min-h-[44px] text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    コピー
                  </button>
                </div>
              </div>

              {/* Usage guide */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2">使い方</p>
                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                  <li>QRコードを印刷して店頭に掲示、またはタブレットに表示</li>
                  <li>お客様がスマホで読み取り → LINEが開く</li>
                  <li>初回は友だち追加 → 「受付する」ボタンで番号取得</li>
                  <li>管理画面で「準備完了」→ LINEに自動通知</li>
                </ol>
              </div>

              {/* NFC hint */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-1">NFCタグにも対応</p>
                <p className="text-[11px] text-gray-500">
                  上記URLをNFCタグに書き込めば、スマホをかざすだけで受付できます。
                  NFC Writer等のアプリでURLを書き込んでください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Settings Panel ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full px-5 py-4 flex justify-between items-center bg-transparent border-none cursor-pointer text-sm font-semibold"
        >
          <span>設定</span>
          <span className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                settings?.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {settings?.isActive ? '有効' : '無効'}
            </span>
            <span className={`text-xs text-gray-400 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>
              &#9660;
            </span>
          </span>
        </button>
        {settingsOpen && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <div className="mt-4 space-y-4 max-w-lg">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">受付機能</label>
                <button
                  onClick={handleToggleActive}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    settings?.isActive
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                  }`}
                >
                  {settings?.isActive ? '無効にする' : '有効にする'}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">通知メッセージテンプレート</label>
                <textarea
                  value={templateDraft}
                  onChange={(e) => setTemplateDraft(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {'使用可能な変数: {{queue_number}} {{name}} {{date}}'}
                </p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Queue Summary ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold text-blue-600">{entries.length}</div>
          <div className="text-xs text-gray-500 mt-1">本日の受付</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold text-amber-600">{waitingCount}</div>
          <div className="text-xs text-gray-500 mt-1">待機中</div>
        </div>
      </div>

      {/* ─── Filter Tabs ───────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: '全て' },
          { key: 'waiting', label: '待機中' },
          { key: 'ready', label: '準備完了' },
          { key: 'done', label: '完了' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-1.5 min-h-[44px] rounded-full text-xs font-medium border transition-colors ${
              statusFilter === key
                ? 'text-white border-transparent'
                : 'text-gray-600 border-gray-300 bg-white hover:bg-gray-50'
            }`}
            style={statusFilter === key ? { backgroundColor: '#2563eb' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Queue List ────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">読み込み中...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            {statusFilter === 'all' ? '本日の受付はまだありません' : `${statusLabels[statusFilter]?.label ?? ''}の受付はありません`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">番号</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">名前</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">受付時刻</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((entry) => {
                  const st = statusLabels[entry.status] ?? statusLabels.waiting
                  const time = entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-lg">{entry.queueNumber}</td>
                      <td className="px-4 py-3 text-sm">{entry.displayName ?? '---'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold"
                          style={{ color: st.color, background: st.bg }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{time}</td>
                      <td className="px-4 py-3 text-right">
                        {entry.status === 'waiting' && (
                          <button
                            onClick={() => handleMarkReady(entry.id)}
                            className="px-4 py-1.5 min-h-[44px] rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: '#059669' }}
                          >
                            準備完了
                          </button>
                        )}
                        {entry.status === 'ready' && (
                          <button
                            onClick={() => handleMarkDone(entry.id)}
                            className="px-4 py-1.5 min-h-[44px] rounded-md text-xs font-medium text-gray-600 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                          >
                            完了にする
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
