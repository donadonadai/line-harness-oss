'use client'

import { useState } from 'react'

// ─── Carousel Slide (Card) ───────────────────────────────────────────────────

export interface CarouselButton {
  label: string
  type: 'url' | 'message' | 'postback'
  value: string
}

export interface CarouselSlide {
  imageUrl: string
  title: string
  body: string
  buttons: CarouselButton[]
}

const defaultButton = (): CarouselButton => ({
  label: '',
  type: 'url',
  value: '',
})

const defaultSlide = (): CarouselSlide => ({
  imageUrl: '',
  title: '',
  body: '',
  buttons: [defaultButton()],
})

// ─── Convert to LINE Flex carousel JSON ──────────────────────────────────────

export function slidesToFlexCarousel(slides: CarouselSlide[]): object {
  return {
    type: 'carousel',
    contents: slides.map((slide) => {
      const bubble: Record<string, unknown> = {
        type: 'bubble',
        size: 'kilo',
      }

      // Hero (image)
      if (slide.imageUrl) {
        bubble.hero = {
          type: 'image',
          url: slide.imageUrl,
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover',
        }
      }

      // Body
      const bodyContents: object[] = []
      if (slide.title) {
        bodyContents.push({
          type: 'text',
          text: slide.title,
          weight: 'bold',
          size: 'md',
          wrap: true,
        })
      }
      if (slide.body) {
        bodyContents.push({
          type: 'text',
          text: slide.body,
          size: 'sm',
          color: '#666666',
          wrap: true,
          margin: slide.title ? 'md' : undefined,
        })
      }
      if (bodyContents.length > 0) {
        bubble.body = {
          type: 'box',
          layout: 'vertical',
          contents: bodyContents,
          spacing: 'sm',
          paddingAll: '13px',
        }
      }

      // Footer (buttons)
      const validButtons = slide.buttons.filter((b) => b.label && b.value)
      if (validButtons.length > 0) {
        bubble.footer = {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: validButtons.map((btn, idx) => {
            let action: object
            switch (btn.type) {
              case 'url':
                action = { type: 'uri', label: btn.label, uri: btn.value }
                break
              case 'message':
                action = { type: 'message', label: btn.label, text: btn.value }
                break
              case 'postback':
                action = { type: 'postback', label: btn.label, data: btn.value, displayText: btn.label }
                break
              default:
                action = { type: 'uri', label: btn.label, uri: btn.value }
            }
            return {
              type: 'button',
              style: idx === 0 ? 'primary' : 'secondary',
              color: idx === 0 ? '#06C755' : undefined,
              height: 'sm',
              action,
            }
          }),
          flex: 0,
          paddingAll: '13px',
        }
      }

      return bubble
    }),
  }
}

export function flexCarouselToSlides(json: string): CarouselSlide[] | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed.type !== 'carousel' || !Array.isArray(parsed.contents)) return null

    return parsed.contents.map((bubble: Record<string, unknown>): CarouselSlide => {
      const hero = bubble.hero as Record<string, unknown> | undefined
      const body = bubble.body as Record<string, unknown> | undefined
      const footer = bubble.footer as Record<string, unknown> | undefined

      const imageUrl = (hero?.url as string) || ''
      let title = ''
      let bodyText = ''

      if (body) {
        const contents = (body.contents as Array<Record<string, unknown>>) || []
        for (const c of contents) {
          if (c.type === 'text' && c.weight === 'bold') {
            title = (c.text as string) || ''
          } else if (c.type === 'text') {
            bodyText = (c.text as string) || ''
          }
        }
      }

      const buttons: CarouselButton[] = []
      if (footer) {
        const contents = (footer.contents as Array<Record<string, unknown>>) || []
        for (const c of contents) {
          if (c.type === 'button') {
            const action = c.action as Record<string, unknown> | undefined
            if (action) {
              const label = (action.label as string) || ''
              if (action.type === 'uri') {
                buttons.push({ label, type: 'url', value: (action.uri as string) || '' })
              } else if (action.type === 'message') {
                buttons.push({ label, type: 'message', value: (action.text as string) || '' })
              } else if (action.type === 'postback') {
                buttons.push({ label, type: 'postback', value: (action.data as string) || '' })
              }
            }
          }
        }
      }

      return {
        imageUrl,
        title,
        body: bodyText,
        buttons: buttons.length > 0 ? buttons : [defaultButton()],
      }
    })
  } catch {
    return null
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CarouselBuilderProps {
  slides: CarouselSlide[]
  onChange: (slides: CarouselSlide[]) => void
}

export default function CarouselBuilder({ slides, onChange }: CarouselBuilderProps) {
  const [activeSlide, setActiveSlide] = useState(0)

  const updateSlide = (index: number, updates: Partial<CarouselSlide>) => {
    const next = [...slides]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  const addSlide = () => {
    if (slides.length >= 12) return // LINE limit
    const next = [...slides, defaultSlide()]
    onChange(next)
    setActiveSlide(next.length - 1)
  }

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return
    const next = slides.filter((_, i) => i !== index)
    onChange(next)
    if (activeSlide >= next.length) setActiveSlide(next.length - 1)
  }

  const duplicateSlide = (index: number) => {
    if (slides.length >= 12) return
    const next = [...slides]
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(slides[index])))
    onChange(next)
    setActiveSlide(index + 1)
  }

  const moveSlide = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= slides.length) return
    const next = [...slides]
    ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
    onChange(next)
    setActiveSlide(newIndex)
  }

  const updateButton = (slideIndex: number, btnIndex: number, updates: Partial<CarouselButton>) => {
    const next = [...slides]
    const buttons = [...next[slideIndex].buttons]
    buttons[btnIndex] = { ...buttons[btnIndex], ...updates }
    next[slideIndex] = { ...next[slideIndex], buttons }
    onChange(next)
  }

  const addButton = (slideIndex: number) => {
    const slide = slides[slideIndex]
    if (slide.buttons.length >= 3) return // LINE limit per bubble
    const next = [...slides]
    next[slideIndex] = { ...slide, buttons: [...slide.buttons, defaultButton()] }
    onChange(next)
  }

  const removeButton = (slideIndex: number, btnIndex: number) => {
    const slide = slides[slideIndex]
    if (slide.buttons.length <= 0) return
    const next = [...slides]
    next[slideIndex] = { ...slide, buttons: slide.buttons.filter((_, i) => i !== btnIndex) }
    onChange(next)
  }

  const current = slides[activeSlide]
  if (!current) return null

  return (
    <div className="space-y-4">
      {/* Slide tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => setActiveSlide(i)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              i === activeSlide
                ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {slide.title || `カード ${i + 1}`}
          </button>
        ))}
        <button
          onClick={addSlide}
          disabled={slides.length >= 12}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
        >
          + 追加
        </button>
      </div>

      <div className="flex gap-6">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          {/* Slide controls */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-gray-700">
              カード {activeSlide + 1} / {slides.length}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => moveSlide(activeSlide, -1)}
              disabled={activeSlide === 0}
              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              title="左に移動"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => moveSlide(activeSlide, 1)}
              disabled={activeSlide === slides.length - 1}
              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              title="右に移動"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => duplicateSlide(activeSlide)}
              disabled={slides.length >= 12}
              className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30"
              title="複製"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => removeSlide(activeSlide)}
              disabled={slides.length <= 1}
              className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
              title="削除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Image */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">画像URL</label>
              <input
                type="url"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="https://example.com/image.jpg"
                value={current.imageUrl}
                onChange={(e) => updateSlide(activeSlide, { imageUrl: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 mt-1">HTTPS必須 / JPEG・PNG / 推奨: 1024x670px (20:13)</p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="カードのタイトル"
                value={current.title}
                onChange={(e) => updateSlide(activeSlide, { title: e.target.value })}
                maxLength={40}
              />
              <p className="text-[10px] text-gray-400 mt-1">{current.title.length}/40文字</p>
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">本文</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={3}
                placeholder="カードの説明文"
                value={current.body}
                onChange={(e) => updateSlide(activeSlide, { body: e.target.value })}
                maxLength={160}
              />
              <p className="text-[10px] text-gray-400 mt-1">{current.body.length}/160文字</p>
            </div>

            {/* Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">ボタン</label>
                <button
                  onClick={() => addButton(activeSlide)}
                  disabled={current.buttons.length >= 3}
                  className="text-[11px] text-green-600 hover:text-green-700 disabled:opacity-40"
                >
                  + ボタン追加
                </button>
              </div>
              <div className="space-y-3">
                {current.buttons.map((btn, bi) => (
                  <div key={bi} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-gray-400">#{bi + 1}</span>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={btn.type}
                        onChange={(e) => updateButton(activeSlide, bi, { type: e.target.value as CarouselButton['type'] })}
                      >
                        <option value="url">URLを開く</option>
                        <option value="message">メッセージ送信</option>
                        <option value="postback">ポストバック</option>
                      </select>
                      <div className="flex-1" />
                      <button
                        onClick={() => removeButton(activeSlide, bi)}
                        className="text-gray-400 hover:text-red-500"
                        title="削除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="ボタンラベル"
                        value={btn.label}
                        onChange={(e) => updateButton(activeSlide, bi, { label: e.target.value })}
                        maxLength={20}
                      />
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder={btn.type === 'url' ? 'https://...' : btn.type === 'message' ? '送信テキスト' : 'postbackデータ'}
                        value={btn.value}
                        onChange={(e) => updateButton(activeSlide, bi, { value: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="hidden lg:block w-72 shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">プレビュー</p>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`shrink-0 w-56 bg-white rounded-xl shadow-md border overflow-hidden snap-start cursor-pointer transition-all ${
                  i === activeSlide ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-200'
                }`}
                onClick={() => setActiveSlide(i)}
              >
                {/* Image */}
                {slide.imageUrl ? (
                  <div className="aspect-[20/13] bg-gray-100 overflow-hidden">
                    <img
                      src={slide.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                ) : (
                  <div className="aspect-[20/13] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Content */}
                <div className="p-3">
                  {slide.title && (
                    <p className="text-xs font-bold text-gray-900 line-clamp-1">{slide.title}</p>
                  )}
                  {slide.body && (
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{slide.body}</p>
                  )}
                </div>

                {/* Buttons */}
                {slide.buttons.filter((b) => b.label).length > 0 && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {slide.buttons.filter((b) => b.label).map((btn, bi) => (
                      <div
                        key={bi}
                        className={`text-center text-[10px] font-medium py-1.5 rounded-md ${
                          bi === 0
                            ? 'text-white'
                            : 'text-green-700 bg-green-50 border border-green-200'
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
          <p className="text-[10px] text-gray-400 mt-2">
            {slides.length}/12 カード (LINE上では横スクロールで表示)
          </p>
        </div>
      </div>
    </div>
  )
}
