'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'
import type { QueueSettings } from '@line-crm/shared'

const DEFAULTS = {
  rxReceivedTitle: '処方せん受付完了',
  rxReceivedBody: '{{name}}様\n処方せんを受け付けました。\nお薬の準備ができましたらLINEでお知らせいたします。',
  rxReadyTitle: 'お薬の準備完了',
  rxReadyBody: '{{name}}様、お薬の準備ができました。\n窓口までお越しください。',
}

const VARIABLES = [
  { key: '{{name}}', desc: '友だちの表示名' },
  { key: '{{pickup}}', desc: '受取目安時間 (受付完了のみ)' },
  { key: '{{account_name}}', desc: '薬局名' },
]

export default function PrescriptionNotifyPage() {
  const { selectedAccountId } = useAccount()
  const [settings, setSettings] = useState<QueueSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [rxReceivedTitle, setRxReceivedTitle] = useState(DEFAULTS.rxReceivedTitle)
  const [rxReceivedBody, setRxReceivedBody] = useState(DEFAULTS.rxReceivedBody)
  const [rxReadyTitle, setRxReadyTitle] = useState(DEFAULTS.rxReadyTitle)
  const [rxReadyBody, setRxReadyBody] = useState(DEFAULTS.rxReadyBody)

  const loadSettings = useCallback(async () => {
    if (!selectedAccountId) return
    setLoading(true)
    try {
      const res = await api.queue.getSettings(selectedAccountId)
      if (res.success && res.data) {
        setSettings(res.data)
        setRxReceivedTitle(res.data.rxReceivedTitle || DEFAULTS.rxReceivedTitle)
        setRxReceivedBody(res.data.rxReceivedBody || DEFAULTS.rxReceivedBody)
        setRxReadyTitle(res.data.rxReadyTitle || DEFAULTS.rxReadyTitle)
        setRxReadyBody(res.data.rxReadyBody || DEFAULTS.rxReadyBody)
      }
    } catch {}
    setLoading(false)
  }, [selectedAccountId])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    if (!selectedAccountId) return
    setSaving(true)
    setSaved(false)
    try {
      await api.queue.updateSettings({
        lineAccountId: selectedAccountId,
        rxReceivedTitle,
        rxReceivedBody,
        rxReadyTitle,
        rxReadyBody,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  const handleReset = (type: 'received' | 'ready') => {
    if (type === 'received') {
      setRxReceivedTitle(DEFAULTS.rxReceivedTitle)
      setRxReceivedBody(DEFAULTS.rxReceivedBody)
    } else {
      setRxReadyTitle(DEFAULTS.rxReadyTitle)
      setRxReadyBody(DEFAULTS.rxReadyBody)
    }
  }

  // Preview helper: expand variables with sample values
  const preview = (text: string) =>
    text
      .replace(/\{\{name\}\}/g, '山田太郎')
      .replace(/\{\{pickup\}\}/g, '本日 14:00')
      .replace(/\{\{account_name\}\}/g, '金太郎薬局')

  if (!selectedAccountId) {
    return (
      <div>
        <Header title="処方せん通知テンプレート" />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">LINEアカウントを選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="処方せん通知テンプレート" />

      {/* Variables reference */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">使用可能な変数</p>
        <div className="flex flex-wrap gap-3">
          {VARIABLES.map((v) => (
            <div key={v.key} className="flex items-center gap-1.5">
              <code className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{v.key}</code>
              <span className="text-xs text-blue-600">{v.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
              <div className="space-y-3">
                <div className="h-8 bg-gray-100 rounded" />
                <div className="h-24 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Prescription Received Template */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-sm font-bold text-gray-900">受付完了メッセージ</h3>
              </div>
              <button
                onClick={() => handleReset('received')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                デフォルトに戻す
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Edit */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={rxReceivedTitle}
                      onChange={(e) => setRxReceivedTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">本文</label>
                    <textarea
                      value={rxReceivedBody}
                      onChange={(e) => setRxReceivedBody(e.target.value)}
                      rows={5}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">プレビュー</p>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-[280px] mx-auto">
                      <div className="py-3 px-4 text-center">
                        <p className="text-[10px] text-gray-400">金太郎薬局</p>
                        <p className="text-sm font-bold" style={{ color: '#06C755' }}>{preview(rxReceivedTitle)}</p>
                      </div>
                      <div className="border-t border-gray-100 px-4 py-3">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{preview(rxReceivedBody)}</p>
                        <div className="border-t border-gray-100 mt-3 pt-2">
                          <p className="text-[10px] text-gray-400 text-center">受取目安: 本日 14:00</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Prescription Ready Template */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#06C755' }} />
                <h3 className="text-sm font-bold text-gray-900">準備完了メッセージ</h3>
              </div>
              <button
                onClick={() => handleReset('ready')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                デフォルトに戻す
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Edit */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={rxReadyTitle}
                      onChange={(e) => setRxReadyTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">本文</label>
                    <textarea
                      value={rxReadyBody}
                      onChange={(e) => setRxReadyBody(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">プレビュー</p>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-[280px] mx-auto">
                      <div className="py-3 px-4 text-center">
                        <p className="text-[10px] text-gray-400">金太郎薬局</p>
                        <p className="text-sm font-bold" style={{ color: '#06C755' }}>{preview(rxReadyTitle)}</p>
                      </div>
                      <div className="border-t border-gray-100 px-4 py-3">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{preview(rxReadyBody)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#06C755' }}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存しました
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
