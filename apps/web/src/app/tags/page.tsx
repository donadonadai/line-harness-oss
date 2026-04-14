'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Tag } from '@line-crm/shared'
import Header from '@/components/layout/header'

type TagWithCount = Tag & { friendCount: number }

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#06C755', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#78716C', '#6B7280', '#1E293B',
]

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#3B82F6')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<'name' | 'friendCount' | 'createdAt'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const loadTags = useCallback(async () => {
    try {
      const res = await api.tags.listWithCount()
      if (res.success && res.data) {
        setTags(res.data as TagWithCount[])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadTags() }, [loadTags])

  const filteredTags = tags
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'ja')
      else if (sortBy === 'friendCount') cmp = a.friendCount - b.friendCount
      else if (sortBy === 'createdAt') cmp = (a.createdAt || '').localeCompare(b.createdAt || '')
      return sortDir === 'desc' ? -cmp : cmp
    })

  const totalFriendTagged = tags.reduce((s, t) => s + t.friendCount, 0)

  const resetForm = () => {
    setFormName('')
    setFormColor('#3B82F6')
    setFormError('')
    setEditingTag(null)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (tag: TagWithCount) => {
    setEditingTag(tag)
    setFormName(tag.name)
    setFormColor(tag.color)
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('タグ名を入力してください')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editingTag) {
        await api.tags.update(editingTag.id, { name: formName.trim(), color: formColor })
      } else {
        const res = await api.tags.create({ name: formName.trim(), color: formColor })
        if (!res.success) {
          setFormError('作成に失敗しました。同名のタグが存在する可能性があります。')
          setSaving(false)
          return
        }
      }
      setShowModal(false)
      resetForm()
      await loadTags()
    } catch {
      setFormError('保存に失敗しました')
    }
    setSaving(false)
  }

  const handleDelete = async (tag: TagWithCount) => {
    const msg = tag.friendCount > 0
      ? `「${tag.name}」を削除しますか？\nこのタグは ${tag.friendCount} 人の友だちに付いています。紐付けも全て解除されます。`
      : `「${tag.name}」を削除しますか？`
    if (!confirm(msg)) return
    try {
      await api.tags.delete(tag.id)
      await loadTags()
    } catch {}
  }

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">⇅</span>
    return <span className="text-green-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Badge text color based on background luminance
  const textColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#1a1a1a' : '#ffffff'
  }

  return (
    <div>
      <Header title="タグ管理" />

      {/* Stats + Actions Bar */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
            <div>
              <p className="text-xs text-gray-400">タグ数</p>
              <p className="text-lg font-bold text-gray-900">{tags.length}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-400">タグ付き友だち（延べ）</p>
              <p className="text-lg font-bold text-gray-900">{totalFriendTagged}</p>
            </div>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 flex items-center gap-1.5"
          style={{ backgroundColor: '#06C755' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規タグ作成
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タグを検索..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tag Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-gray-500">{search ? '該当するタグが見つかりません' : 'タグが登録されていません'}</p>
          {!search && (
            <button onClick={openCreate} className="mt-3 text-sm text-green-600 hover:underline">
              最初のタグを作成
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3">
                  <button onClick={() => toggleSort('name')} className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700">
                    タグ名 <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-6 py-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">プレビュー</span>
                </th>
                <th className="text-left px-6 py-3">
                  <button onClick={() => toggleSort('friendCount')} className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700">
                    友だち数 <SortIcon field="friendCount" />
                  </button>
                </th>
                <th className="text-left px-6 py-3">
                  <button onClick={() => toggleSort('createdAt')} className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center hover:text-gray-700">
                    作成日 <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="text-right px-6 py-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag) => (
                <tr key={tag.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">{tag.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: tag.color, color: textColor(tag.color) }}
                    >
                      {tag.name}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600 font-medium">{tag.friendCount}</span>
                      <span className="text-xs text-gray-400">人</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-gray-500">
                    {tag.createdAt?.slice(0, 10)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(tag)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(tag)}
                        className="text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {editingTag ? 'タグを編集' : '新規タグ作成'}
            </h2>

            {/* Tag Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">タグ名</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例: VIP、初回来店、要対応"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>

            {/* Color Picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">カラー</label>
              <div className="grid grid-cols-10 gap-1.5 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      formColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="#3B82F6"
                />
                <span className="text-xs text-gray-400">カスタムカラー</span>
              </div>
            </div>

            {/* Preview */}
            <div className="mb-5 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">プレビュー</p>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: formColor, color: textColor(formColor) }}
              >
                {formName || 'タグ名'}
              </span>
            </div>

            {formError && (
              <p className="text-sm text-red-600 mb-4">{formError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : editingTag ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
