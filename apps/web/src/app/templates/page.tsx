'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import CcPromptButton from '@/components/cc-prompt-button'
import CarouselBuilder, {
  slidesToFlexCarousel,
  flexCarouselToSlides,
  type CarouselSlide,
} from '@/components/carousel-builder'

interface Template {
  id: string
  name: string
  category: string
  messageType: string
  messageContent: string
  createdAt: string
  updatedAt: string
}

const messageTypeLabels: Record<string, string> = {
  text: 'テキスト',
  image: '画像',
  flex: 'Flex',
  carousel: 'カルーセル',
}

const messageTypeBadgeColor: Record<string, string> = {
  text: 'bg-gray-100 text-gray-700',
  image: 'bg-purple-100 text-purple-700',
  flex: 'bg-blue-100 text-blue-700',
  carousel: 'bg-orange-100 text-orange-700',
}

interface CreateFormState {
  name: string
  category: string
  messageType: string
  messageContent: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const defaultSlide = (): CarouselSlide => ({
  imageUrl: '',
  title: '',
  body: '',
  buttons: [{ label: '', type: 'url', value: '' }],
})

const ccPrompts = [
  {
    title: 'テンプレート作成',
    prompt: `新しいメッセージテンプレートの作成をサポートしてください。
1. 用途別（挨拶、キャンペーン、通知、フォローアップ）のテンプレート文例を提案
2. テキスト・画像・Flex・カルーセルそれぞれの効果的な使い方
3. カテゴリ分類と命名規則のベストプラクティス
手順を示してください。`,
  },
  {
    title: 'カルーセル作成サポート',
    prompt: `カルーセルメッセージの作成をサポートしてください。
1. 業種別（EC、飲食、美容、不動産等）の効果的なカルーセル構成を提案
2. 各カードの画像・タイトル・本文・ボタンの最適な組み合わせ
3. CTR向上のためのベストプラクティス
具体例を示してください。`,
  },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [form, setForm] = useState<CreateFormState>({
    name: '',
    category: '',
    messageType: 'text',
    messageContent: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([defaultSlide()])
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.templates.list(
        selectedCategory !== 'all' ? selectedCategory : undefined
      )
      if (res.success) {
        setTemplates(res.data)
      } else {
        setError(res.error)
      }
    } catch {
      setError('テンプレートの読み込みに失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    load()
  }, [load])

  const categories = Array.from(
    new Set(templates.map((t) => t.category).filter(Boolean))
  )

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFormError('テンプレート名を入力してください')
      return
    }
    if (!form.category.trim()) {
      setFormError('カテゴリを入力してください')
      return
    }

    let messageContent = form.messageContent
    let messageType = form.messageType

    if (form.messageType === 'carousel') {
      // Validate carousel slides
      const validSlides = carouselSlides.filter((s) => s.title || s.body || s.imageUrl)
      if (validSlides.length === 0) {
        setFormError('少なくとも1枚のカードにコンテンツを入力してください')
        return
      }
      // Convert to Flex carousel JSON
      const flexJson = slidesToFlexCarousel(validSlides)
      messageContent = JSON.stringify(flexJson)
      messageType = 'carousel' // Store as carousel type for UI identification
    } else if (!form.messageContent.trim()) {
      setFormError('メッセージ内容を入力してください')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const res = await api.templates.create({
        name: form.name,
        category: form.category,
        messageType,
        messageContent,
      })
      if (res.success) {
        setShowCreate(false)
        setForm({ name: '', category: '', messageType: 'text', messageContent: '' })
        setCarouselSlides([defaultSlide()])
        load()
      } else {
        setFormError(res.error)
      }
    } catch {
      setFormError('作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除してもよいですか？')) return
    try {
      await api.templates.delete(id)
      load()
    } catch {
      setError('削除に失敗しました')
    }
  }

  const handleMessageTypeChange = (newType: string) => {
    setForm({ ...form, messageType: newType, messageContent: '' })
    if (newType === 'carousel') {
      setCarouselSlides([defaultSlide()])
    }
  }

  // Get carousel preview data from a template
  const getCarouselPreview = (template: Template): CarouselSlide[] | null => {
    if (template.messageType !== 'carousel') return null
    return flexCarouselToSlides(template.messageContent)
  }

  const getContentPreview = (template: Template): string => {
    if (template.messageType === 'carousel') {
      const slides = getCarouselPreview(template)
      if (slides) {
        return `${slides.length}枚のカード: ${slides.map((s) => s.title || '(無題)').join(', ')}`
      }
    }
    return template.messageContent.slice(0, 80) + (template.messageContent.length > 80 ? '...' : '')
  }

  return (
    <div>
      <Header
        title="テンプレート管理"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            + 新規テンプレート
          </button>
        }
      />

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Category filter */}
      {!loading && categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full transition-colors ${
              selectedCategory === 'all'
                ? 'text-white'
                : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={selectedCategory === 'all' ? { backgroundColor: '#06C755' } : undefined}
          >
            全て
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'text-white'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
              style={selectedCategory === cat ? { backgroundColor: '#06C755' } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">新規テンプレートを作成</h2>
          <div className="space-y-4">
            <div className="max-w-lg space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">テンプレート名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="例: ウェルカムメッセージ"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="例: 挨拶、キャンペーン、通知"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>

              {/* Message type selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">メッセージタイプ</label>
                <div className="flex flex-wrap gap-2">
                  {['text', 'image', 'flex', 'carousel'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleMessageTypeChange(type)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        form.messageType === type
                          ? 'border-green-500 text-green-700 bg-green-50'
                          : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                      }`}
                    >
                      {messageTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content editors by type */}
            {form.messageType === 'carousel' ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-3">カルーセル設定</label>
                <CarouselBuilder
                  slides={carouselSlides}
                  onChange={setCarouselSlides}
                />
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
                        <label className="block text-xs text-gray-500 mb-1">元画像URL</label>
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
                        <label className="block text-xs text-gray-500 mb-1">プレビュー画像URL</label>
                        <input
                          type="url"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="空欄で元画像と同じ"
                          value={parsed.previewImageUrl ?? ''}
                          onChange={(e) => {
                            setForm({ ...form, messageContent: JSON.stringify({ originalContentUrl: parsed.originalContentUrl ?? '', previewImageUrl: e.target.value }) })
                          }}
                        />
                      </div>
                    </div>
                  )
                })()}

                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                  rows={form.messageType === 'flex' ? 8 : 4}
                  placeholder={
                    form.messageType === 'text'
                      ? 'メッセージ内容を入力してください'
                      : form.messageType === 'image'
                      ? '{"originalContentUrl":"...","previewImageUrl":"..."}'
                      : '{"type":"bubble","body":{...}}'
                  }
                  value={form.messageContent}
                  onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
                  style={{ fontFamily: form.messageType !== 'text' ? 'monospace' : 'inherit' }}
                />
              </div>
            )}

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setFormError('') }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{previewTemplate.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${messageTypeBadgeColor[previewTemplate.messageType] || 'bg-gray-100 text-gray-700'}`}>
                    {messageTypeLabels[previewTemplate.messageType] || previewTemplate.messageType}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {previewTemplate.category}
                  </span>
                </div>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Carousel preview */}
            {previewTemplate.messageType === 'carousel' && (() => {
              const slides = getCarouselPreview(previewTemplate)
              if (!slides) return <p className="text-sm text-gray-500">プレビューを表示できません</p>
              return (
                <div>
                  <p className="text-xs text-gray-500 mb-3">LINE上では横スクロールで表示されます</p>
                  <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
                    {slides.map((slide, i) => (
                      <div key={i} className="shrink-0 w-64 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden snap-start">
                        {slide.imageUrl ? (
                          <div className="aspect-[20/13] bg-gray-100 overflow-hidden">
                            <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          </div>
                        ) : (
                          <div className="aspect-[20/13] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="p-3">
                          {slide.title && <p className="text-sm font-bold text-gray-900">{slide.title}</p>}
                          {slide.body && <p className="text-xs text-gray-500 mt-1">{slide.body}</p>}
                        </div>
                        {slide.buttons.filter((b) => b.label).length > 0 && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {slide.buttons.filter((b) => b.label).map((btn, bi) => (
                              <div
                                key={bi}
                                className={`text-center text-xs font-medium py-2 rounded-lg ${
                                  bi === 0 ? 'text-white' : 'text-green-700 bg-green-50 border border-green-200'
                                }`}
                                style={bi === 0 ? { backgroundColor: '#06C755' } : undefined}
                              >
                                {btn.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Text preview */}
            {previewTemplate.messageType === 'text' && (
              <div className="bg-green-50 rounded-2xl rounded-tl-none p-4 max-w-sm">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewTemplate.messageContent}</p>
              </div>
            )}

            {/* Flex/Image raw JSON */}
            {(previewTemplate.messageType === 'flex' || previewTemplate.messageType === 'image') && (
              <div>
                <p className="text-xs text-gray-500 mb-2">JSON データ</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-700 overflow-x-auto max-h-96">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(previewTemplate.messageContent), null, 2)
                    } catch {
                      return previewTemplate.messageContent
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-gray-100 flex items-center gap-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-48" />
                <div className="h-2 bg-gray-100 rounded w-32" />
              </div>
              <div className="h-5 bg-gray-100 rounded-full w-16" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 && !showCreate ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">テンプレートがありません。「新規テンプレート」から作成してください。</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  テンプレート名
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  カテゴリ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  タイプ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  作成日時
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setPreviewTemplate(template)}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                        {getContentPreview(template)}
                      </p>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {template.category}
                    </span>
                  </td>

                  {/* Message Type */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${messageTypeBadgeColor[template.messageType] || 'bg-gray-100 text-gray-700'}`}>
                      {messageTypeLabels[template.messageType] || template.messageType}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(template.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-1 min-h-[44px] text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <CcPromptButton prompts={ccPrompts} />
    </div>
  )
}
