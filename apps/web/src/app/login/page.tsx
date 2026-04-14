'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function LoginPage() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'loading' | 'login' | 'setup'>('loading')

  // Setup mode fields
  const [setupApiKey, setSetupApiKey] = useState('')
  const [setupName, setSetupName] = useState('')

  const router = useRouter()

  useEffect(() => {
    // Check if staff has been set up
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
    fetch(`${apiUrl}/api/auth/check`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: { staffExists: boolean } }) => {
        if (res.success && res.data?.staffExists) {
          setMode('login')
        } else {
          setMode('setup')
        }
      })
      .catch(() => setMode('login'))
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await api.auth.login(loginId, password)
      if (res.success && res.data) {
        // Clear legacy key if present
        localStorage.removeItem('lh_api_key')
        localStorage.setItem('lh_token', res.data.token)
        localStorage.setItem('lh_staff', JSON.stringify(res.data.staff))
        router.push('/')
      } else {
        setError((res as { error?: string }).error || 'ログインに失敗しました')
      }
    } catch {
      setError('ログインIDまたはパスワードが正しくありません')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await api.auth.setup(
        { loginId, password, name: setupName },
        setupApiKey,
      )
      if (res.success) {
        // Now login with the new credentials
        const loginRes = await api.auth.login(loginId, password)
        if (loginRes.success && loginRes.data) {
          localStorage.removeItem('lh_api_key')
          localStorage.setItem('lh_token', loginRes.data.token)
          localStorage.setItem('lh_staff', JSON.stringify(loginRes.data.staff))
          router.push('/')
        }
      } else {
        setError((res as { error?: string }).error || 'セットアップに失敗しました')
      }
    } catch {
      setError('セットアップに失敗しました。APIキーを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#06C755' }}>
        <div className="animate-spin w-8 h-8 border-[3px] border-white/30 border-t-white rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#06C755' }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3" style={{ backgroundColor: '#06C755' }}>
            Y
          </div>
          <h1 className="text-xl font-bold text-gray-900">YOSHIDA LINE</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'setup' ? '初期セットアップ' : '管理画面にログイン'}
          </p>
        </div>

        {mode === 'setup' ? (
          <form onSubmit={handleSetup}>
            <p className="text-xs text-gray-500 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              管理者アカウントを作成します。初回のみAPI Keyが必要です。
            </p>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={setupApiKey}
                onChange={(e) => setSetupApiKey(e.target.value)}
                placeholder="現在のAPIキーを入力"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="管理者の名前"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを設定"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading || !setupApiKey || !setupName || !loginId || !password}
              className="w-full py-3 text-white font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#06C755' }}
            >
              {loading ? 'セットアップ中...' : '管理者アカウントを作成'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="ログインIDを入力"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading || !loginId || !password}
              className="w-full py-3 text-white font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#06C755' }}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
