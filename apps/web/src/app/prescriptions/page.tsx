'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { PrescriptionSubmission } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  received: { label: '受付済み', color: '#d97706', bg: '#fef3c7' },
  preparing: { label: '準備中', color: '#2563eb', bg: '#dbeafe' },
  ready: { label: '準備完了', color: '#059669', bg: '#d1fae5' },
  done: { label: '受渡完了', color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'キャンセル', color: '#dc2626', bg: '#fee2e2' },
}

const LIFF_BASE_URL_FALLBACK = 'https://liff.line.me/2009554425-4IMBmLQ9'

export default function PrescriptionsPage() {
  const { selectedAccountId, selectedAccount } = useAccount()
  const [submissions, setSubmissions] = useState<PrescriptionSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const accountLiffId = selectedAccount?.liffId
  const liffBaseUrl = accountLiffId
    ? `https://liff.line.me/${accountLiffId}`
    : LIFF_BASE_URL_FALLBACK

  const prescriptionUrl = selectedAccountId
    ? `${liffBaseUrl}?page=prescription&account=${selectedAccountId}${accountLiffId ? `&liffId=${accountLiffId}` : ''}`
    : ''

  const fetchData = useCallback(async () => {
    if (!selectedAccountId) return
    try {
      const res = await api.prescriptions.list(selectedAccountId)
      if (res.success) setSubmissions(res.data)
    } catch (err) {
      console.error('Failed to load prescriptions:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  useEffect(() => {
    setLoading(true)
    setSelectedId(null)
    fetchData()
  }, [fetchData])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(fetchData, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.prescriptions.updateStatus(id, newStatus)
      await fetchData()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const filteredSubmissions = statusFilter === 'all'
    ? submissions
    : submissions.filter(s => s.status === statusFilter)

  const selected = submissions.find(s => s.id === selectedId)

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ja-JP', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(prescriptionUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!selectedAccountId) {
    return (
      <div>
        <Header title="処方せん管理" />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">LINEアカウントを選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="処方せん管理" />

      {/* Prescription URL section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">処方せん受付URL</span>
            {!accountLiffId && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">LIFF ID未設定</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQr(!showQr)}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              {showQr ? 'QR非表示' : 'QR表示'}
            </button>
            <button
              onClick={copyUrl}
              disabled={!prescriptionUrl}
              className="text-xs px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: copied ? '#059669' : '#06C755' }}
            >
              {copied ? 'コピー済み' : 'URLコピー'}
            </button>
          </div>
        </div>
        {prescriptionUrl && (
          <p className="mt-2 text-xs text-gray-400 font-mono truncate">{prescriptionUrl}</p>
        )}
        {showQr && prescriptionUrl && (
          <div className="mt-3 flex justify-center">
            <div className="p-3 bg-white border border-gray-200 rounded-lg inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(prescriptionUrl)}`}
                alt="QR Code"
                width={200}
                height={200}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'all', label: `全て (${submissions.length})` },
          { key: 'received', label: `受付済み (${submissions.filter(s => s.status === 'received').length})` },
          { key: 'preparing', label: `準備中 (${submissions.filter(s => s.status === 'preparing').length})` },
          { key: 'ready', label: `準備完了 (${submissions.filter(s => s.status === 'ready').length})` },
          { key: 'done', label: `受渡完了 (${submissions.filter(s => s.status === 'done').length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === tab.key
                ? 'text-white'
                : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
            }`}
            style={statusFilter === tab.key ? { backgroundColor: '#06C755' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left: Submission list */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-4 py-4 border-b border-gray-100 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-24" />
                      <div className="h-2 bg-gray-100 rounded w-32" />
                    </div>
                    <div className="h-5 bg-gray-100 rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500">
                {submissions.length === 0 ? '本日の処方せん受付はありません' : 'この条件に該当する受付はありません'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {filteredSubmissions.map((sub) => {
                const status = statusConfig[sub.status] || statusConfig.received
                const isSelected = selectedId === sub.id
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedId(isSelected ? null : sub.id)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium shrink-0">
                        {sub.displayName?.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {sub.displayName || '不明'}
                          </p>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ color: status.color, backgroundColor: status.bg }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-gray-400">
                            {formatDate(sub.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500">
                            受取: {sub.pickupDisplay}
                          </p>
                          <p className="text-xs text-gray-400">
                            画像 {sub.images.length}枚
                          </p>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selected && (
          <div className="w-96 shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-4">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">処方せん詳細</h3>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Patient info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                    {selected.displayName?.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selected.displayName || '不明'}</p>
                    <p className="text-xs text-gray-400">{formatDate(selected.createdAt)} 受付</p>
                  </div>
                </div>
              </div>

              {/* Pickup time */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1">受取目安</p>
                <p className="text-sm text-gray-900 font-medium">{selected.pickupDisplay}</p>
              </div>

              {/* Images */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">処方せん画像 ({selected.images.length}枚)</p>
                <div className="grid grid-cols-2 gap-2">
                  {selected.images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setImageModal(img)}
                    >
                      <img
                        src={img}
                        alt={`処方せん ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status control */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">ステータス変更</p>
                <div className="grid grid-cols-2 gap-2">
                  {selected.status === 'received' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(selected.id, 'preparing')}
                        className="px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        準備中にする
                      </button>
                      <button
                        onClick={() => handleStatusChange(selected.id, 'ready')}
                        className="px-3 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                        style={{ backgroundColor: '#06C755' }}
                      >
                        準備完了
                      </button>
                    </>
                  )}
                  {selected.status === 'preparing' && (
                    <button
                      onClick={() => handleStatusChange(selected.id, 'ready')}
                      className="col-span-2 px-3 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                      style={{ backgroundColor: '#06C755' }}
                    >
                      準備完了 (LINEで通知)
                    </button>
                  )}
                  {selected.status === 'ready' && (
                    <button
                      onClick={() => handleStatusChange(selected.id, 'done')}
                      className="col-span-2 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
                    >
                      受渡完了にする
                    </button>
                  )}
                  {(selected.status === 'received' || selected.status === 'preparing') && (
                    <button
                      onClick={() => handleStatusChange(selected.id, 'cancelled')}
                      className="col-span-2 px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  )}
                  {(selected.status === 'done' || selected.status === 'cancelled') && (
                    <p className="col-span-2 text-xs text-gray-400 text-center py-2">
                      この受付は{selected.status === 'done' ? '完了' : 'キャンセル'}済みです
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={imageModal}
              alt="処方せん拡大"
              className="max-w-full max-h-[80vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
