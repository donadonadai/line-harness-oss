'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'
import LayoutPicker from '@/components/rich-menus/layout-picker'
import AreaActionEditor from '@/components/rich-menus/area-action-editor'
import ImageUpload from '@/components/rich-menus/image-upload'
import type { RichMenu, RichMenuAreaConfig, RichMenuLayoutType, RichMenuSizeType } from '@line-crm/shared'

// Layout area counts for initializing empty areas
const layoutAreaCounts: Record<RichMenuLayoutType, number> = {
  large_full: 1,
  large_2h: 2,
  large_2v: 2,
  large_3col: 3,
  large_1top_2bottom: 3,
  large_2top_1bottom: 3,
  large_2x2: 4,
  large_2x3: 6,
  small_full: 1,
  small_2h: 2,
  small_3col: 3,
  small_2x2: 4,
}

const layoutLabels: Record<RichMenuLayoutType, string> = {
  large_full: '大 - 全面',
  large_2h: '大 - 上下2分割',
  large_2v: '大 - 左右2分割',
  large_3col: '大 - 3列',
  large_1top_2bottom: '大 - 上1+下2',
  large_2top_1bottom: '大 - 上2+下1',
  large_2x2: '大 - 2x2',
  large_2x3: '大 - 2x3',
  small_full: '小 - 全面',
  small_2h: '小 - 左右2分割',
  small_3col: '小 - 3列',
  small_2x2: '小 - 2x2',
}

type WizardStep = 'info' | 'layout' | 'actions' | 'image' | 'confirm'

const defaultArea = (): RichMenuAreaConfig => ({
  actionType: 'url',
  label: '',
  url: 'https://example.com',
})

export default function RichMenusPage() {
  const { selectedAccountId } = useAccount()
  const [menus, setMenus] = useState<RichMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('info')
  const [formName, setFormName] = useState('')
  const [formChatBarText, setFormChatBarText] = useState('メニュー')
  const [formSizeType, setFormSizeType] = useState<RichMenuSizeType>('large')
  const [formLayoutType, setFormLayoutType] = useState<RichMenuLayoutType | null>(null)
  const [formAreas, setFormAreas] = useState<RichMenuAreaConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Image upload state
  const [imageMenuId, setImageMenuId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Detail view
  const [detailMenu, setDetailMenu] = useState<RichMenu | null>(null)

  const loadMenus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.richMenus.managed.list({ accountId: selectedAccountId || undefined })
      if (res.success) {
        setMenus(res.data)
      } else {
        setError(res.error)
      }
    } catch {
      setError('リッチメニューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  useEffect(() => {
    loadMenus()
  }, [loadMenus])

  const resetWizard = () => {
    setShowWizard(false)
    setWizardStep('info')
    setFormName('')
    setFormChatBarText('メニュー')
    setFormSizeType('large')
    setFormLayoutType(null)
    setFormAreas([])
    setFormError('')
  }

  const handleLayoutSelect = (layout: RichMenuLayoutType) => {
    setFormLayoutType(layout)
    const count = layoutAreaCounts[layout]
    setFormAreas(Array.from({ length: count }, () => defaultArea()))
  }

  const handleCreate = async () => {
    if (!formName.trim()) { setFormError('メニュー名を入力してください'); return }
    if (!formLayoutType) { setFormError('レイアウトを選択してください'); return }

    setSaving(true)
    setFormError('')
    try {
      const res = await api.richMenus.managed.create({
        name: formName,
        layoutType: formLayoutType,
        sizeType: formSizeType,
        chatBarText: formChatBarText,
        areasConfig: formAreas,
        lineAccountId: selectedAccountId || undefined,
      })
      if (res.success) {
        resetWizard()
        loadMenus()
        // Offer image upload
        setImageMenuId(res.data.id)
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
    if (!confirm('このリッチメニューを削除しますか？LINE API上からも削除されます。')) return
    try {
      await api.richMenus.managed.delete(id)
      loadMenus()
    } catch {
      setError('削除に失敗しました')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.richMenus.managed.activate(id)
      loadMenus()
    } catch {
      setError('デフォルト設定に失敗しました')
    }
  }

  const handleImageUpload = async (base64: string, contentType: string) => {
    if (!imageMenuId) return
    setUploading(true)
    try {
      const res = await api.richMenus.managed.uploadImage(imageMenuId, base64, contentType)
      if (res.success) {
        setImageMenuId(null)
        loadMenus()
      } else {
        setError('画像アップロードに失敗しました')
      }
    } catch {
      setError('画像アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const wizardSteps: { key: WizardStep; label: string }[] = [
    { key: 'info', label: '基本情報' },
    { key: 'layout', label: 'レイアウト' },
    { key: 'actions', label: 'アクション' },
    { key: 'confirm', label: '確認' },
  ]

  const currentStepIndex = wizardSteps.findIndex((s) => s.key === wizardStep)

  return (
    <div>
      <Header
        title="リッチメニュー"
        action={
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            + 新規メニュー
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 underline">閉じる</button>
        </div>
      )}

      {/* Image Upload Modal */}
      {imageMenuId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImageMenuId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">リッチメニュー画像をアップロード</h3>
            <p className="text-sm text-gray-500 mb-4">
              LINE仕様に合った画像をアップロードしてください。後からアップロードすることもできます。
            </p>
            <ImageUpload onUpload={handleImageUpload} uploading={uploading} />
            <button
              onClick={() => setImageMenuId(null)}
              className="mt-4 w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              後でアップロード
            </button>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {detailMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailMenu(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{detailMenu.name}</h3>
              <button onClick={() => setDetailMenu(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">サイズ:</span> <span className="font-medium">{detailMenu.sizeType}</span></div>
                <div><span className="text-gray-500">レイアウト:</span> <span className="font-medium">{layoutLabels[detailMenu.layoutType as RichMenuLayoutType] || detailMenu.layoutType}</span></div>
                <div><span className="text-gray-500">チャットバー:</span> <span className="font-medium">{detailMenu.chatBarText}</span></div>
                <div><span className="text-gray-500">デフォルト:</span> <span className={`font-medium ${detailMenu.isDefault ? 'text-green-600' : 'text-gray-400'}`}>{detailMenu.isDefault ? 'はい' : 'いいえ'}</span></div>
              </div>
              <div className="text-xs font-mono text-gray-400 bg-gray-50 rounded-lg p-3 break-all">
                LINE Rich Menu ID: {detailMenu.lineRichMenuId}
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">エリアアクション ({detailMenu.areasConfig.length}個)</h4>
                <div className="space-y-2">
                  {detailMenu.areasConfig.map((area, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{area.actionType}</span>
                        {area.label && <span className="text-xs text-gray-600">{area.label}</span>}
                      </div>
                      {area.url && <p className="text-xs text-gray-400 mt-1 truncate">{area.url}</p>}
                      {area.text && <p className="text-xs text-gray-400 mt-1">{area.text}</p>}
                      {area.tagId && <p className="text-xs text-gray-400 mt-1 font-mono">Tag: {area.tagId}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => { setImageMenuId(detailMenu.id); setDetailMenu(null) }}
                  className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  画像アップロード
                </button>
                {!detailMenu.isDefault && (
                  <button
                    onClick={() => { handleActivate(detailMenu.id); setDetailMenu(null) }}
                    className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    デフォルトに設定
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Wizard */}
      {showWizard && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {wizardSteps.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= currentStepIndex ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`ml-1.5 text-xs font-medium ${i <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {i < wizardSteps.length - 1 && (
                  <div className={`mx-3 w-8 h-0.5 ${i < currentStepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          {wizardStep === 'info' && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メニュー名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="例: メインメニュー"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">チャットバーテキスト</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="メニュー"
                  value={formChatBarText}
                  onChange={(e) => setFormChatBarText(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">トーク画面の下部に表示されるテキスト</p>
              </div>
            </div>
          )}

          {wizardStep === 'layout' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">レイアウトを選択してください。タップ可能なエリアの配置が決まります。</p>
              <LayoutPicker
                sizeType={formSizeType}
                onSizeChange={(size) => {
                  setFormSizeType(size)
                  setFormLayoutType(null)
                  setFormAreas([])
                }}
                selected={formLayoutType}
                onSelect={handleLayoutSelect}
              />
            </div>
          )}

          {wizardStep === 'actions' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                各エリアがタップされたときのアクションを設定してください。
              </p>
              <AreaActionEditor areas={formAreas} onChange={setFormAreas} />
            </div>
          )}

          {wizardStep === 'confirm' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-semibold text-gray-800">確認</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div><span className="text-gray-500">名前:</span> <span className="font-medium">{formName}</span></div>
                <div><span className="text-gray-500">チャットバー:</span> <span className="font-medium">{formChatBarText}</span></div>
                <div><span className="text-gray-500">サイズ:</span> <span className="font-medium">{formSizeType === 'large' ? '大 (2500x1686)' : '小 (2500x843)'}</span></div>
                <div><span className="text-gray-500">レイアウト:</span> <span className="font-medium">{formLayoutType ? layoutLabels[formLayoutType] : '-'}</span></div>
                <div><span className="text-gray-500">エリア数:</span> <span className="font-medium">{formAreas.length}</span></div>
                {formAreas.map((area, i) => (
                  <div key={i} className="text-xs text-gray-400 pl-4">
                    #{i + 1}: {area.actionType} {area.label ? `(${area.label})` : ''}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                作成後にLINE APIに登録されます。画像は別途アップロードしてください。
              </p>
            </div>
          )}

          {formError && <p className="text-xs text-red-600 mt-3">{formError}</p>}

          {/* Navigation buttons */}
          <div className="flex gap-2 mt-6">
            {wizardStep !== 'info' && (
              <button
                onClick={() => {
                  const idx = wizardSteps.findIndex((s) => s.key === wizardStep)
                  if (idx > 0) setWizardStep(wizardSteps[idx - 1].key)
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                戻る
              </button>
            )}

            {wizardStep !== 'confirm' ? (
              <button
                onClick={() => {
                  setFormError('')
                  if (wizardStep === 'info' && !formName.trim()) {
                    setFormError('メニュー名を入力してください')
                    return
                  }
                  if (wizardStep === 'layout' && !formLayoutType) {
                    setFormError('レイアウトを選択してください')
                    return
                  }
                  const idx = wizardSteps.findIndex((s) => s.key === wizardStep)
                  if (idx < wizardSteps.length - 1) setWizardStep(wizardSteps[idx + 1].key)
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#06C755' }}
              >
                次へ
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '作成中...' : 'リッチメニューを作成'}
              </button>
            )}

            <button
              onClick={resetWizard}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Menu list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-20 bg-gray-100 rounded" />
              <div className="flex gap-4">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : menus.length === 0 && !showWizard ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2 0v4h4V6H6zm6 0v4h4V6h-4zM6 12v4h4v-4H6zm6 0v4h4v-4h-4z" />
          </svg>
          <p className="text-gray-500 mb-2">リッチメニューがありません</p>
          <p className="text-sm text-gray-400">「新規メニュー」から作成してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setDetailMenu(menu)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 leading-tight">{menu.name}</h3>
                {menu.isDefault && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    デフォルト
                  </span>
                )}
              </div>

              {/* Layout info */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {layoutLabels[menu.layoutType as RichMenuLayoutType] || menu.layoutType}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${menu.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {menu.isActive ? '有効' : '無効'}
                </span>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span>エリア: {menu.areasConfig.length}個</span>
                <span>バー: {menu.chatBarText}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setImageMenuId(menu.id)}
                  className="px-3 py-1 min-h-[44px] text-xs font-medium text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                >
                  画像
                </button>
                {!menu.isDefault && (
                  <button
                    onClick={() => handleActivate(menu.id)}
                    className="px-3 py-1 min-h-[44px] text-xs font-medium text-green-500 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                  >
                    デフォルト
                  </button>
                )}
                <button
                  onClick={() => handleDelete(menu.id)}
                  className="px-3 py-1 min-h-[44px] text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
