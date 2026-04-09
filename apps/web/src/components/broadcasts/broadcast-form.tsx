'use client'

import { useState } from 'react'
import type { Tag } from '@line-crm/shared'
import { api, type ApiBroadcast } from '@/lib/api'
import CarouselBuilder, {
  slidesToFlexCarousel,
  type CarouselSlide,
} from '@/components/carousel-builder'

interface BroadcastFormProps {
  tags: Tag[]
  onSuccess: () => void
  onCancel: () => void
}

const messageTypeLabels: Record<string, string> = {
  text: 'テキスト',
  image: '画像',
  flex: 'Flexメッセージ',
  carousel: 'カルーセル',
}

interface FormState {
  title: string
  messageType: string
  messageContent: string
  targetType: ApiBroadcast['targetType']
  targetTagId: string
  scheduledAt: string
  sendNow: boolean
}

const defaultSlide = (): CarouselSlide => ({
  imageUrl: '',
  title: '',
  body: '',
  buttons: [{ label: '', type: 'url', value: '' }],
})

export default function BroadcastForm({ tags, onSuccess, onCancel }: BroadcastFormProps) {
  const [form, setForm] = useState<FormState>({
    title: '',
    messageType: 'text',
    messageContent: '',
    targetType: 'all',
    targetTagId: '',
    scheduledAt: '',
    sendNow: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([defaultSlide()])

  const handleSave = async () => {
    if (!form.title.trim()) { setError('配信タイトルを入力してください'); return }

    let messageContent = form.messageContent
    let messageType = form.messageType

    if (form.messageType === 'carousel') {
      const validSlides = carouselSlides.filter((s) => s.title || s.body || s.imageUrl)
      if (validSlides.length === 0) {
        setError('少なくとも1枚のカードにコンテンツを入力してください')
        return
      }
      messageContent = JSON.stringify(slidesToFlexCarousel(validSlides))
      messageType = 'carousel'
    } else {
      if (!messageContent.trim()) { setError('メッセージ内容を入力してください'); return }
      if (form.messageType === 'flex') {
        try { JSON.parse(messageContent) } catch { setError('FlexメッセージのJSONが無効です'); return }
      }
    }

    if (!form.sendNow && !form.scheduledAt) {
      setError('予約配信の場合は配信日時を指定してください')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await api.broadcasts.create({
        title: form.title,
        messageType: messageType as ApiBroadcast['messageType'],
        messageContent,
        targetType: form.targetType,
        targetTagId: form.targetType === 'tag' ? form.targetTagId || null : null,
        status: 'draft',
        scheduledAt: form.sendNow || !form.scheduledAt
          ? null
          : form.scheduledAt + ':00.000+09:00',
      })
      if (res.success) {
        onSuccess()
      } else {
        setError(res.error)
      }
    } catch {
      setError('作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-5">新規配信を作成</h2>

      <div className="space-y-4">
        {/* Title */}
        <div className="max-w-lg">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            配信タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="例: 3月のキャンペーン告知"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        {/* Message type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">メッセージ種別</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(messageTypeLabels).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setForm({ ...form, messageType: type, messageContent: '' })
                  if (type === 'carousel') setCarouselSlides([defaultSlide()])
                }}
                className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md border transition-colors ${
                  form.messageType === type
                    ? 'border-green-500 text-green-700 bg-green-50'
                    : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Message content */}
        {form.messageType === 'carousel' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-3">カルーセル設定</label>
            <CarouselBuilder slides={carouselSlides} onChange={setCarouselSlides} />
          </div>
        ) : (
          <div className="max-w-lg">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              メッセージ内容 <span className="text-red-500">*</span>
              {(form.messageType === 'flex' || form.messageType === 'image') && (
                <span className="ml-1 text-gray-400">(JSON形式)</span>
              )}
            </label>

            {/* Image helper */}
            {form.messageType === 'image' && (() => {
              let parsed: { originalContentUrl?: string; previewImageUrl?: string } = {}
              try { parsed = JSON.parse(form.messageContent) } catch { /* not yet valid */ }
              return (
                <div className="space-y-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">元画像URL (originalContentUrl)</label>
                    <input
                      type="url"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="https://example.com/image.png"
                      value={parsed.originalContentUrl ?? ''}
                      onChange={(e) => {
                        const orig = e.target.value
                        const prev = parsed.previewImageUrl ?? orig
                        setForm({ ...form, messageContent: JSON.stringify({ originalContentUrl: orig, previewImageUrl: prev }) })
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">プレビュー画像URL (previewImageUrl)</label>
                    <input
                      type="url"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="https://example.com/preview.png (空欄で元画像と同じ)"
                      value={parsed.previewImageUrl ?? ''}
                      onChange={(e) => {
                        const prev = e.target.value
                        setForm({ ...form, messageContent: JSON.stringify({ originalContentUrl: parsed.originalContentUrl ?? '', previewImageUrl: prev }) })
                      }}
                    />
                  </div>
                </div>
              )
            })()}

            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
              rows={form.messageType === 'flex' ? 8 : form.messageType === 'image' ? 3 : 4}
              placeholder={
                form.messageType === 'text'
                  ? '配信するメッセージを入力...'
                  : form.messageType === 'image'
                  ? '{"originalContentUrl":"...","previewImageUrl":"..."}'
                  : '{"type":"bubble","body":{...}}'
              }
              value={form.messageContent}
              onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
              style={{ fontFamily: form.messageType !== 'text' ? 'monospace' : 'inherit' }}
            />
            {form.messageType === 'image' && (
              <p className="text-xs text-gray-400 mt-1">上のURLフォームか、直接JSONを編集できます</p>
            )}
          </div>
        )}

        {/* Target */}
        <div className="max-w-lg">
          <label className="block text-xs font-medium text-gray-600 mb-2">配信対象</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, targetType: 'all', targetTagId: '' })}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md border transition-colors ${
                form.targetType === 'all'
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              全員
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, targetType: 'tag' })}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md border transition-colors ${
                form.targetType === 'tag'
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              タグで絞り込み
            </button>
          </div>
          {form.targetType === 'tag' && (
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              value={form.targetTagId}
              onChange={(e) => setForm({ ...form, targetTagId: e.target.value })}
            >
              <option value="">タグを選択...</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Schedule */}
        <div className="max-w-lg">
          <label className="block text-xs font-medium text-gray-600 mb-2">配信タイミング</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, sendNow: true, scheduledAt: '' })}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md border transition-colors ${
                form.sendNow
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              下書きとして保存
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, sendNow: false })}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md border transition-colors ${
                !form.sendNow
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              予約配信
            </button>
          </div>
          {!form.sendNow && (
            <input
              type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          )}
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#06C755' }}
          >
            {saving ? '作成中...' : '作成'}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
