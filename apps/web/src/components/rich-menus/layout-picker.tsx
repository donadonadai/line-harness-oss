'use client'

import type { RichMenuLayoutType } from '@line-crm/shared'

interface LayoutOption {
  type: RichMenuLayoutType
  label: string
  sizeType: 'large' | 'small'
  areas: number
}

const layouts: LayoutOption[] = [
  { type: 'large_full', label: '全面', sizeType: 'large', areas: 1 },
  { type: 'large_2h', label: '上下2分割', sizeType: 'large', areas: 2 },
  { type: 'large_2v', label: '左右2分割', sizeType: 'large', areas: 2 },
  { type: 'large_3col', label: '3列', sizeType: 'large', areas: 3 },
  { type: 'large_1top_2bottom', label: '上1+下2', sizeType: 'large', areas: 3 },
  { type: 'large_2top_1bottom', label: '上2+下1', sizeType: 'large', areas: 3 },
  { type: 'large_2x2', label: '2x2', sizeType: 'large', areas: 4 },
  { type: 'large_2x3', label: '2x3', sizeType: 'large', areas: 6 },
  { type: 'small_full', label: '全面', sizeType: 'small', areas: 1 },
  { type: 'small_2h', label: '左右2分割', sizeType: 'small', areas: 2 },
  { type: 'small_3col', label: '3列', sizeType: 'small', areas: 3 },
  { type: 'small_2x2', label: '2x2', sizeType: 'small', areas: 4 },
]

function LayoutPreview({ type, selected }: { type: RichMenuLayoutType; selected: boolean }) {
  const isLarge = type.startsWith('large')
  const aspect = isLarge ? 'aspect-[2500/1686]' : 'aspect-[2500/843]'

  const renderAreas = () => {
    switch (type) {
      case 'large_full':
      case 'small_full':
        return <div className="absolute inset-0 bg-gray-200 rounded-sm" />

      case 'large_2h':
        return (
          <>
            <div className="absolute top-0 left-0 right-0 bottom-1/2 bg-gray-200 rounded-sm mb-px" />
            <div className="absolute top-1/2 left-0 right-0 bottom-0 bg-gray-300 rounded-sm mt-px" />
          </>
        )

      case 'large_2v':
      case 'small_2h':
        return (
          <>
            <div className="absolute top-0 left-0 w-1/2 bottom-0 bg-gray-200 rounded-sm pr-px" />
            <div className="absolute top-0 left-1/2 right-0 bottom-0 bg-gray-300 rounded-sm pl-px" />
          </>
        )

      case 'large_3col':
      case 'small_3col':
        return (
          <>
            <div className="absolute top-0 left-0 w-1/3 bottom-0 bg-gray-200 rounded-sm" />
            <div className="absolute top-0 left-1/3 w-1/3 bottom-0 bg-gray-300 rounded-sm" style={{ margin: '0 1px' }} />
            <div className="absolute top-0 right-0 w-1/3 bottom-0 bg-gray-200 rounded-sm" />
          </>
        )

      case 'large_1top_2bottom':
        return (
          <>
            <div className="absolute top-0 left-0 right-0 bottom-1/2 bg-gray-200 rounded-sm mb-px" />
            <div className="absolute top-1/2 left-0 w-1/2 bottom-0 bg-gray-300 rounded-sm mt-px pr-px" />
            <div className="absolute top-1/2 left-1/2 right-0 bottom-0 bg-gray-200 rounded-sm mt-px" />
          </>
        )

      case 'large_2top_1bottom':
        return (
          <>
            <div className="absolute top-0 left-0 w-1/2 bottom-1/2 bg-gray-200 rounded-sm mb-px pr-px" />
            <div className="absolute top-0 left-1/2 right-0 bottom-1/2 bg-gray-300 rounded-sm mb-px" />
            <div className="absolute top-1/2 left-0 right-0 bottom-0 bg-gray-200 rounded-sm mt-px" />
          </>
        )

      case 'large_2x2':
      case 'small_2x2':
        return (
          <>
            <div className="absolute top-0 left-0 w-1/2 bottom-1/2 bg-gray-200 rounded-sm" style={{ margin: '0 1px 1px 0' }} />
            <div className="absolute top-0 left-1/2 right-0 bottom-1/2 bg-gray-300 rounded-sm" style={{ margin: '0 0 1px 0' }} />
            <div className="absolute top-1/2 left-0 w-1/2 bottom-0 bg-gray-300 rounded-sm" style={{ margin: '0 1px 0 0' }} />
            <div className="absolute top-0 left-1/2 right-0 top-1/2 bottom-0 bg-gray-200 rounded-sm" />
          </>
        )

      case 'large_2x3':
        return (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`${i % 2 === 0 ? 'bg-gray-200' : 'bg-gray-300'} rounded-sm`} />
            ))}
          </div>
        )

      default:
        return <div className="absolute inset-0 bg-gray-200 rounded-sm" />
    }
  }

  return (
    <div className={`relative w-full ${aspect} border-2 rounded-md overflow-hidden ${selected ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-300'}`}>
      {renderAreas()}
    </div>
  )
}

interface LayoutPickerProps {
  sizeType: 'large' | 'small'
  onSizeChange: (size: 'large' | 'small') => void
  selected: RichMenuLayoutType | null
  onSelect: (layout: RichMenuLayoutType) => void
}

export default function LayoutPicker({ sizeType, onSizeChange, selected, onSelect }: LayoutPickerProps) {
  const filtered = layouts.filter((l) => l.sizeType === sizeType)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onSizeChange('large')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sizeType === 'large' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          大 (2500x1686)
        </button>
        <button
          onClick={() => onSizeChange('small')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sizeType === 'small' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          小 (2500x843)
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filtered.map((layout) => (
          <button
            key={layout.type}
            onClick={() => onSelect(layout.type)}
            className={`text-left p-2 rounded-lg border transition-all ${selected === layout.type ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <LayoutPreview type={layout.type} selected={selected === layout.type} />
            <p className="mt-1.5 text-xs font-medium text-gray-700">{layout.label}</p>
            <p className="text-[10px] text-gray-400">{layout.areas}エリア</p>
          </button>
        ))}
      </div>
    </div>
  )
}
