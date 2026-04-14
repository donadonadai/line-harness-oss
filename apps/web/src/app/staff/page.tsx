'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { StaffMember } from '@/lib/api'
import Header from '@/components/layout/header'

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  // Form state
  const [formLoginId, setFormLoginId] = useState('')
  const [formName, setFormName] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'staff'>('staff')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.staff.list()
      if (res.success && res.data) setStaffList(res.data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  const resetForm = () => {
    setFormLoginId('')
    setFormName('')
    setFormPassword('')
    setFormRole('staff')
    setFormError('')
  }

  const openCreate = () => {
    resetForm()
    setEditingStaff(null)
    setShowCreateModal(true)
  }

  const openEdit = (s: StaffMember) => {
    setEditingStaff(s)
    setFormLoginId(s.loginId)
    setFormName(s.name)
    setFormPassword('')
    setFormRole(s.role)
    setFormError('')
    setShowCreateModal(true)
  }

  const handleSave = async () => {
    if (!formName) { setFormError('名前を入力してください'); return }
    if (!editingStaff && !formLoginId) { setFormError('ログインIDを入力してください'); return }
    if (!editingStaff && !formPassword) { setFormError('パスワードを入力してください'); return }

    setSaving(true)
    setFormError('')
    try {
      if (editingStaff) {
        const updateData: { name?: string; role?: 'admin' | 'staff'; password?: string } = {
          name: formName,
          role: formRole,
        }
        if (formPassword) updateData.password = formPassword
        await api.staff.update(editingStaff.id, updateData)
      } else {
        const res = await api.staff.create({
          loginId: formLoginId,
          password: formPassword,
          name: formName,
          role: formRole,
        })
        if (!res.success) {
          setFormError((res as unknown as { error?: string }).error || '作成に失敗しました')
          setSaving(false)
          return
        }
      }
      setShowCreateModal(false)
      resetForm()
      await loadStaff()
    } catch {
      setFormError('保存に失敗しました')
    }
    setSaving(false)
  }

  const handleToggleActive = async (s: StaffMember) => {
    try {
      await api.staff.update(s.id, { isActive: !s.isActive })
      await loadStaff()
    } catch {}
  }

  const handleDelete = async (s: StaffMember) => {
    if (!confirm(`「${s.name}」を削除しますか？この操作は取り消せません。`)) return
    try {
      await api.staff.delete(s.id)
      await loadStaff()
    } catch {}
  }

  return (
    <div>
      <Header title="スタッフ管理" />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          管理画面にログインできるスタッフを管理します
        </p>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#06C755' }}
        >
          + スタッフ追加
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ) : staffList.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">スタッフが登録されていません</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">名前</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">ログインID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">権限</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">ステータス</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">作成日</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: s.role === 'admin' ? '#06C755' : '#3B82F6' }}
                      >
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{s.loginId}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.role === 'admin'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {s.role === 'admin' ? '管理者' : 'スタッフ'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      s.isActive ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {s.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {s.createdAt?.slice(0, 10)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          s.isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {s.isActive ? '無効化' : '有効化'}
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingStaff ? 'スタッフ編集' : 'スタッフ追加'}
            </h2>

            <div className="space-y-4">
              {!editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
                  <input
                    type="text"
                    value={formLoginId}
                    onChange={(e) => setFormLoginId(e.target.value)}
                    placeholder="例: yamada"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例: 山田太郎"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus={!!editingStaff}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード{editingStaff && <span className="text-gray-400 font-normal">（変更する場合のみ）</span>}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingStaff ? '変更しない場合は空欄' : 'パスワードを設定'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={formRole === 'staff'}
                      onChange={() => setFormRole('staff')}
                      className="text-green-500 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">スタッフ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={formRole === 'admin'}
                      onChange={() => setFormRole('admin')}
                      className="text-green-500 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">管理者</span>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">管理者はスタッフの追加・削除が可能です</p>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600 mt-3">{formError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : editingStaff ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
