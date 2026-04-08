/**
 * リッチメニューエリア設定 → LINE APIアクション変換
 *
 * ローカルのRichMenuAreaConfigをLINE APIのRichMenuAction形式に変換する。
 * タグ付けやシナリオ開始など内部アクションはpostbackに変換し、
 * webhookで受け取って処理する。
 */

import type { RichMenuAreaConfig } from '@line-crm/shared';
import type { RichMenuAction } from '@line-crm/line-sdk';

export interface ConvertedAction {
  lineAction: RichMenuAction;
  /** postbackデータ (postback型の場合のみ) */
  postbackData?: string;
  /** ローカルで実行するアクション (postback型の場合のみ) */
  localActions?: string;
}

/**
 * エリア設定をLINE APIアクション形式に変換
 *
 * @param config - ローカルのエリア設定
 * @param localMenuId - ローカルDBのリッチメニューID
 * @param areaIndex - エリアインデックス (0始まり)
 */
export function convertAreaConfigToLineAction(
  config: RichMenuAreaConfig,
  localMenuId: string,
  areaIndex: number,
): ConvertedAction {
  switch (config.actionType) {
    case 'url':
      return {
        lineAction: {
          type: 'uri',
          uri: config.url || 'https://example.com',
          label: config.label,
        },
      };

    case 'user_message':
      return {
        lineAction: {
          type: 'message',
          text: config.text || '',
          label: config.label,
        },
      };

    case 'switch_rich_menu':
      return {
        lineAction: {
          type: 'richmenuswitch',
          richMenuAliasId: config.richMenuAliasId || '',
          data: `rm:${localMenuId}:area:${areaIndex}:switch`,
          label: config.label,
        },
      };

    case 'keyword_reply':
      // keyword_reply → message type で特定キーワードを送信 → auto_repliesで処理
      return {
        lineAction: {
          type: 'message',
          text: config.text || '',
          label: config.label,
        },
      };

    // 内部アクション系 → すべてpostbackに変換
    case 'add_tag':
    case 'remove_tag':
    case 'open_form':
    case 'send_template':
    case 'start_scenario':
    case 'compound': {
      const postbackData = `rm:${localMenuId}:area:${areaIndex}`;
      const localActions = buildLocalActions(config);

      return {
        lineAction: {
          type: 'postback',
          data: postbackData,
          displayText: config.label || undefined,
          label: config.label,
        },
        postbackData,
        localActions: JSON.stringify(localActions),
      };
    }

    default:
      // Fallback: noop postback
      return {
        lineAction: {
          type: 'postback',
          data: `rm:${localMenuId}:area:${areaIndex}:noop`,
          label: config.label,
        },
      };
  }
}

/**
 * エリア設定からローカル実行アクションを構築
 */
function buildLocalActions(config: RichMenuAreaConfig): Array<{ type: string; params: Record<string, unknown> }> {
  switch (config.actionType) {
    case 'add_tag':
      return [{ type: 'add_tag', params: { tagId: config.tagId || '' } }];

    case 'remove_tag':
      return [{ type: 'remove_tag', params: { tagId: config.tagId || '' } }];

    case 'start_scenario':
      return [{ type: 'start_scenario', params: { scenarioId: config.scenarioId || '' } }];

    case 'send_template':
      return [{ type: 'send_template', params: { templateId: config.templateId || '' } }];

    case 'open_form':
      return [{ type: 'open_form', params: { formId: config.formId || '' } }];

    case 'compound':
      return (config.compoundActions || []).map((ca) => ({
        type: ca.type,
        params: ca.params,
      }));

    default:
      return [];
  }
}

/**
 * 全エリアのアクションを一括変換
 */
export function convertAllAreasToLineActions(
  areasConfig: RichMenuAreaConfig[],
  localMenuId: string,
): {
  lineActions: ConvertedAction[];
  postbackActions: Array<{ areaIndex: number; postbackData: string; actions: string }>;
} {
  const lineActions: ConvertedAction[] = [];
  const postbackActions: Array<{ areaIndex: number; postbackData: string; actions: string }> = [];

  for (let i = 0; i < areasConfig.length; i++) {
    const result = convertAreaConfigToLineAction(areasConfig[i], localMenuId, i);
    lineActions.push(result);

    if (result.postbackData && result.localActions) {
      postbackActions.push({
        areaIndex: i,
        postbackData: result.postbackData,
        actions: result.localActions,
      });
    }
  }

  return { lineActions, postbackActions };
}
