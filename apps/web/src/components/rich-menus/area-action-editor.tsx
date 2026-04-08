'use client'

import type { RichMenuAreaConfig, RichMenuAreaActionType } from '@line-crm/shared'

const actionTypeOptions: { value: RichMenuAreaActionType; label: string }[] = [
  { value: 'url', label: 'URL を開く' },
  { value: 'user_message', label: 'メッセージ送信' },
  { value: 'keyword_reply', label: 'キーワード応答' },
  { value: 'add_tag', label: 'タグを付ける' },
  { value: 'remove_tag', label: 'タグを外す' },
  { value: 'start_scenario', label: 'シナリオ開始' },
  { value: 'send_template', label: 'テンプレート送信' },
  { value: 'switch_rich_menu', label: 'リッチメニュー切替' },
  { value: 'open_form', label: 'フォームを開く' },
  { value: 'compound', label: '複合アクション' },
]

interface AreaActionEditorProps {
  areas: RichMenuAreaConfig[]
  onChange: (areas: RichMenuAreaConfig[]) => void
}

export default function AreaActionEditor({ areas, onChange }: AreaActionEditorProps) {
  const updateArea = (index: number, updates: Partial<RichMenuAreaConfig>) => {
    const newAreas = [...areas]
    newAreas[index] = { ...newAreas[index], ...updates }
    onChange(newAreas)
  }

  return (
    <div className="space-y-4">
      {areas.map((area, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              エリア {i + 1}
            </h4>
            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {area.actionType}
            </span>
          </div>

          <div className="space-y-3">
            {/* アクション種別 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">アクション</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                value={area.actionType}
                onChange={(e) => {
                  const newType = e.target.value as RichMenuAreaActionType
                  // Reset area config when type changes
                  updateArea(i, {
                    actionType: newType,
                    label: area.label || '',
                    url: undefined,
                    text: undefined,
                    tagId: undefined,
                    formId: undefined,
                    templateId: undefined,
                    richMenuAliasId: undefined,
                    scenarioId: undefined,
                    compoundActions: undefined,
                  })
                }}
              >
                {actionTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* ラベル */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ラベル</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="タップ時の表示テキスト"
                value={area.label || ''}
                onChange={(e) => updateArea(i, { label: e.target.value })}
              />
            </div>

            {/* タイプ別の追加フィールド */}
            {area.actionType === 'url' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="https://example.com"
                  value={area.url || ''}
                  onChange={(e) => updateArea(i, { url: e.target.value })}
                />
              </div>
            )}

            {(area.actionType === 'user_message' || area.actionType === 'keyword_reply') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">テキスト</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="送信するメッセージ"
                  value={area.text || ''}
                  onChange={(e) => updateArea(i, { text: e.target.value })}
                />
              </div>
            )}

            {(area.actionType === 'add_tag' || area.actionType === 'remove_tag') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タグID</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="タグのUUID"
                  value={area.tagId || ''}
                  onChange={(e) => updateArea(i, { tagId: e.target.value })}
                />
              </div>
            )}

            {area.actionType === 'start_scenario' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">シナリオID</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="シナリオのUUID"
                  value={area.scenarioId || ''}
                  onChange={(e) => updateArea(i, { scenarioId: e.target.value })}
                />
              </div>
            )}

            {area.actionType === 'send_template' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">テンプレートID</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="テンプレートのUUID"
                  value={area.templateId || ''}
                  onChange={(e) => updateArea(i, { templateId: e.target.value })}
                />
              </div>
            )}

            {area.actionType === 'switch_rich_menu' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">リッチメニューAlias ID</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="lh-tab-xxx-1"
                  value={area.richMenuAliasId || ''}
                  onChange={(e) => updateArea(i, { richMenuAliasId: e.target.value })}
                />
              </div>
            )}

            {area.actionType === 'open_form' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">フォームID</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="フォームのUUID"
                  value={area.formId || ''}
                  onChange={(e) => updateArea(i, { formId: e.target.value })}
                />
              </div>
            )}

            {area.actionType === 'compound' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-700">
                  複合アクション(エルメアクション)は、JSONで直接編集できます。
                </p>
                <textarea
                  className="w-full mt-2 border border-yellow-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-y bg-white"
                  rows={4}
                  placeholder='[{"type":"add_tag","params":{"tagId":"..."}}]'
                  value={area.compoundActions ? JSON.stringify(area.compoundActions, null, 2) : '[]'}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      updateArea(i, { compoundActions: parsed })
                    } catch {
                      // Invalid JSON, don't update
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
