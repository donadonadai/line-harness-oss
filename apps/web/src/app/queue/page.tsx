'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'
import type { QueueSettings, QueueEntry } from '@line-crm/shared'

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: '待機中', color: '#d97706', bg: '#fef3c7' },
  ready: { label: '準備完了', color: '#059669', bg: '#d1fae5' },
  done: { label: '完了', color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'キャンセル', color: '#dc2626', bg: '#fee2e2' },
}

export default function QueuePage() {
  const { selectedAccountId } = useAccount()
  const [settings, setSettings] = useState<QueueSettings | null>(null)
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const filteredEntries = statusFilter === 'all'
    ? entries
    : entries.filter((e) => e.status === statusFilter)

  const waitingCount = entries.filter((e) => e.status === 'waiting').length

  if (!selectedAccountId) {
    return (
      <>
        <Header title="受付番号管理" />
        <main style={{ padding: 24 }}>
          <p style={{ color: '#6b7280' }}>アカウントを選択してください</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Header title="受付番号管理" />
      <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        {/* Settings Panel */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            style={{
              width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600,
            }}
          >
            <span>設定</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: settings?.isActive ? '#d1fae5' : '#f3f4f6',
                  color: settings?.isActive ? '#059669' : '#6b7280',
                }}
              >
                {settings?.isActive ? '有効' : '無効'}
              </span>
              <span style={{ transform: settingsOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>
                &#9660;
              </span>
            </span>
          </button>
          {settingsOpen && (
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <label style={{ fontSize: 14, fontWeight: 500 }}>受付機能</label>
                  <button
                    onClick={handleToggleActive}
                    style={{
                      padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer',
                      background: settings?.isActive ? '#fee2e2' : '#d1fae5',
                      color: settings?.isActive ? '#dc2626' : '#059669', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {settings?.isActive ? '無効にする' : '有効にする'}
                  </button>
                </div>
                <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  通知メッセージテンプレート
                </label>
                <textarea
                  value={templateDraft}
                  onChange={(e) => setTemplateDraft(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: 12, borderRadius: 6, border: '1px solid #d1d5db',
                    fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  {'使用可能な変数: {{queue_number}} {{name}} {{date}}'}
                </p>
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  style={{
                    marginTop: 12, padding: '8px 24px', borderRadius: 6, border: 'none',
                    background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Queue Summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#2563eb' }}>{entries.length}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>本日の受付</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706' }}>{waitingCount}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>待機中</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'all', label: '全て' },
            { key: 'waiting', label: '待機中' },
            { key: 'ready', label: '準備完了' },
            { key: 'done', label: '完了' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: '1px solid #d1d5db', cursor: 'pointer',
                background: statusFilter === key ? '#2563eb' : '#fff',
                color: statusFilter === key ? '#fff' : '#374151',
                fontSize: 13, fontWeight: 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Queue List */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              {statusFilter === 'all' ? '本日の受付はまだありません' : `${statusLabels[statusFilter]?.label ?? ''}の受付はありません`}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>番号</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>名前</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>ステータス</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>受付時刻</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const st = statusLabels[entry.status] ?? statusLabels.waiting
                  const time = entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 18 }}>{entry.queueNumber}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14 }}>{entry.displayName ?? '---'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{time}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {entry.status === 'waiting' && (
                          <button
                            onClick={() => handleMarkReady(entry.id)}
                            style={{
                              padding: '6px 16px', borderRadius: 6, border: 'none',
                              background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            準備完了
                          </button>
                        )}
                        {entry.status === 'ready' && (
                          <button
                            onClick={() => handleMarkDone(entry.id)}
                            style={{
                              padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db',
                              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            }}
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
          )}
        </div>
      </main>
    </>
  )
}
