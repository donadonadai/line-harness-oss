'use client'

import { useState, useRef } from 'react'

interface ImageUploadProps {
  onUpload: (base64: string, contentType: string) => Promise<void>
  uploading: boolean
}

export default function ImageUpload({ onUpload, uploading }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError('')

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      setError('PNG または JPEG のみ対応しています')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズは10MB以下にしてください')
      return
    }

    // Read as base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      setPreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleUploadClick = async () => {
    if (!preview) return
    const contentType = preview.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png'
    await onUpload(preview, contentType)
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        {preview ? (
          <img src={preview} alt="プレビュー" className="max-h-40 mx-auto rounded-lg" />
        ) : (
          <div>
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500">クリックまたはドラッグ&ドロップ</p>
            <p className="text-xs text-gray-400 mt-1">PNG / JPEG (大: 2500x1686, 小: 2500x843)</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {preview && (
        <div className="flex gap-2">
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#06C755' }}
          >
            {uploading ? 'アップロード中...' : '画像をアップロード'}
          </button>
          <button
            onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            クリア
          </button>
        </div>
      )}
    </div>
  )
}
