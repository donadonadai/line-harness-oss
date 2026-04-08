/**
 * リッチメニューレイアウト定義
 *
 * LINE APIの仕様:
 *   - large: 2500 x 1686 px
 *   - small: 2500 x 843 px
 *
 * 12レイアウトテンプレートのエリア座標を返す
 */

import type { RichMenuLayoutType } from '@line-crm/shared';

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDefinition {
  sizeType: 'large' | 'small';
  width: number;
  height: number;
  areas: LayoutBounds[];
  /** エリア数 */
  areaCount: number;
  /** 日本語ラベル */
  label: string;
}

const LARGE_W = 2500;
const LARGE_H = 1686;
const SMALL_W = 2500;
const SMALL_H = 843;

const HALF_LH = Math.floor(LARGE_H / 2); // 843
const THIRD_W = Math.floor(LARGE_W / 3); // 833
const HALF_W = Math.floor(LARGE_W / 2);  // 1250

const layoutDefinitions: Record<RichMenuLayoutType, LayoutDefinition> = {
  // ── Large (2500x1686) ──────────────────────────────────────────────────

  large_full: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 1,
    label: '大 - 全面',
    areas: [
      { x: 0, y: 0, width: LARGE_W, height: LARGE_H },
    ],
  },

  large_2h: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 2,
    label: '大 - 上下2分割',
    areas: [
      { x: 0, y: 0, width: LARGE_W, height: HALF_LH },
      { x: 0, y: HALF_LH, width: LARGE_W, height: LARGE_H - HALF_LH },
    ],
  },

  large_2v: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 2,
    label: '大 - 左右2分割',
    areas: [
      { x: 0, y: 0, width: HALF_W, height: LARGE_H },
      { x: HALF_W, y: 0, width: LARGE_W - HALF_W, height: LARGE_H },
    ],
  },

  large_3col: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 3,
    label: '大 - 3列',
    areas: [
      { x: 0, y: 0, width: THIRD_W, height: LARGE_H },
      { x: THIRD_W, y: 0, width: THIRD_W, height: LARGE_H },
      { x: THIRD_W * 2, y: 0, width: LARGE_W - THIRD_W * 2, height: LARGE_H },
    ],
  },

  large_1top_2bottom: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 3,
    label: '大 - 上1+下2',
    areas: [
      { x: 0, y: 0, width: LARGE_W, height: HALF_LH },
      { x: 0, y: HALF_LH, width: HALF_W, height: LARGE_H - HALF_LH },
      { x: HALF_W, y: HALF_LH, width: LARGE_W - HALF_W, height: LARGE_H - HALF_LH },
    ],
  },

  large_2top_1bottom: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 3,
    label: '大 - 上2+下1',
    areas: [
      { x: 0, y: 0, width: HALF_W, height: HALF_LH },
      { x: HALF_W, y: 0, width: LARGE_W - HALF_W, height: HALF_LH },
      { x: 0, y: HALF_LH, width: LARGE_W, height: LARGE_H - HALF_LH },
    ],
  },

  large_2x2: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 4,
    label: '大 - 2x2',
    areas: [
      { x: 0, y: 0, width: HALF_W, height: HALF_LH },
      { x: HALF_W, y: 0, width: LARGE_W - HALF_W, height: HALF_LH },
      { x: 0, y: HALF_LH, width: HALF_W, height: LARGE_H - HALF_LH },
      { x: HALF_W, y: HALF_LH, width: LARGE_W - HALF_W, height: LARGE_H - HALF_LH },
    ],
  },

  large_2x3: {
    sizeType: 'large', width: LARGE_W, height: LARGE_H, areaCount: 6,
    label: '大 - 2x3',
    areas: [
      { x: 0, y: 0, width: THIRD_W, height: HALF_LH },
      { x: THIRD_W, y: 0, width: THIRD_W, height: HALF_LH },
      { x: THIRD_W * 2, y: 0, width: LARGE_W - THIRD_W * 2, height: HALF_LH },
      { x: 0, y: HALF_LH, width: THIRD_W, height: LARGE_H - HALF_LH },
      { x: THIRD_W, y: HALF_LH, width: THIRD_W, height: LARGE_H - HALF_LH },
      { x: THIRD_W * 2, y: HALF_LH, width: LARGE_W - THIRD_W * 2, height: LARGE_H - HALF_LH },
    ],
  },

  // ── Small (2500x843) ──────────────────────────────────────────────────

  small_full: {
    sizeType: 'small', width: SMALL_W, height: SMALL_H, areaCount: 1,
    label: '小 - 全面',
    areas: [
      { x: 0, y: 0, width: SMALL_W, height: SMALL_H },
    ],
  },

  small_2h: {
    sizeType: 'small', width: SMALL_W, height: SMALL_H, areaCount: 2,
    label: '小 - 左右2分割',
    areas: [
      { x: 0, y: 0, width: HALF_W, height: SMALL_H },
      { x: HALF_W, y: 0, width: SMALL_W - HALF_W, height: SMALL_H },
    ],
  },

  small_3col: {
    sizeType: 'small', width: SMALL_W, height: SMALL_H, areaCount: 3,
    label: '小 - 3列',
    areas: [
      { x: 0, y: 0, width: THIRD_W, height: SMALL_H },
      { x: THIRD_W, y: 0, width: THIRD_W, height: SMALL_H },
      { x: THIRD_W * 2, y: 0, width: SMALL_W - THIRD_W * 2, height: SMALL_H },
    ],
  },

  small_2x2: {
    sizeType: 'small', width: SMALL_W, height: SMALL_H, areaCount: 4,
    label: '小 - 2x2',
    areas: (() => {
      const halfH = Math.floor(SMALL_H / 2);
      return [
        { x: 0, y: 0, width: HALF_W, height: halfH },
        { x: HALF_W, y: 0, width: SMALL_W - HALF_W, height: halfH },
        { x: 0, y: halfH, width: HALF_W, height: SMALL_H - halfH },
        { x: HALF_W, y: halfH, width: SMALL_W - HALF_W, height: SMALL_H - halfH },
      ];
    })(),
  },
};

export function getLayoutDefinition(layoutType: RichMenuLayoutType): LayoutDefinition {
  return layoutDefinitions[layoutType];
}

export function getLayoutBounds(layoutType: RichMenuLayoutType): LayoutBounds[] {
  return layoutDefinitions[layoutType].areas;
}

export function getAllLayouts(): Record<RichMenuLayoutType, LayoutDefinition> {
  return layoutDefinitions;
}

export function getLayoutsForSize(sizeType: 'large' | 'small'): Array<{ type: RichMenuLayoutType; def: LayoutDefinition }> {
  return Object.entries(layoutDefinitions)
    .filter(([, def]) => def.sizeType === sizeType)
    .map(([type, def]) => ({ type: type as RichMenuLayoutType, def }));
}
