/**
 * Compliance Highlighter Extension
 *
 * 网文合规敏感词与错别字本地检测 TipTap / ProseMirror 扩展
 */

import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { COMPLIANCE_RULES, type ComplianceMatch, type ComplianceRule } from "./compliance-rules";

export interface ComplianceHighlighterOptions {
  enabled: boolean;
  onMatchesChange?: (matches: ComplianceMatch[]) => void;
}

export interface ComplianceStorage {
  matches: ComplianceMatch[];
  enabled: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    complianceHighlighter: {
      setComplianceEnabled: (enabled: boolean) => ReturnType;
      replaceComplianceWord: (from: number, to: number, replacement: string) => ReturnType;
    };
  }
}

export const compliancePluginKey = new PluginKey<{
  decorations: DecorationSet;
  matches: ComplianceMatch[];
  enabled: boolean;
}>("complianceHighlighter");

interface TextNodePos {
  text: string;
  pos: number;
}

function processDocCompliance(doc: PMNode, rules: ComplianceRule[]): {
  decorations: DecorationSet;
  matches: ComplianceMatch[];
} {
  const decorations: Decoration[] = [];
  const matches: ComplianceMatch[] = [];

  const textNodes: TextNodePos[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      textNodes.push({ text: node.text, pos });
    }
  });

  for (const { text, pos } of textNodes) {
    for (const rule of rules) {
      // 重置正则匹配索引
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        if (!match[0]) break;
        const from = pos + match.index;
        const to = from + match[0].length;
        const word = match[0];

        matches.push({
          from,
          to,
          word,
          category: rule.category,
          message: rule.message,
          replacement: rule.replacement,
        });

        decorations.push(
          Decoration.inline(from, to, {
            class: `compliance-highlight compliance-highlight-${rule.category}`,
            "data-compliance-category": rule.category,
            "data-compliance-word": word,
            "data-compliance-msg": rule.message,
            "data-compliance-replace": rule.replacement || "",
            "data-compliance-from": String(from),
            "data-compliance-to": String(to),
          }),
        );
      }
    }
  }

  // 按起始位置排序以构建有效的 DecorationSet
  decorations.sort((a, b) => a.from - b.from);
  return {
    decorations: DecorationSet.create(doc, decorations),
    matches,
  };
}

export const ComplianceHighlighter = Extension.create<ComplianceHighlighterOptions, ComplianceStorage>({
  name: "complianceHighlighter",

  addOptions() {
    return {
      enabled: false,
      onMatchesChange: undefined,
    };
  },

  addStorage() {
    return {
      matches: [],
      enabled: false,
    };
  },

  addCommands() {
    return {
      setComplianceEnabled:
        (enabled: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(compliancePluginKey, { setEnabled: enabled });
          }
          return true;
        },

      replaceComplianceWord:
        (from: number, to: number, replacement: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.insertText(replacement, from, to);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: compliancePluginKey,
        state: {
          init(_, state) {
            const enabled = extensionThis.options.enabled;
            extensionThis.storage.enabled = enabled;
            if (!enabled) {
              return {
                decorations: DecorationSet.empty,
                matches: [],
                enabled: false,
              };
            }
            const { decorations, matches } = processDocCompliance(state.doc, COMPLIANCE_RULES);
            extensionThis.storage.matches = matches;
            extensionThis.options.onMatchesChange?.(matches);
            return { decorations, matches, enabled: true };
          },

          apply(tr: Transaction, oldState, _, newState: EditorState) {
            const meta = tr.getMeta(compliancePluginKey);
            let enabled = oldState.enabled;

            if (meta && typeof meta.setEnabled === "boolean") {
              enabled = meta.setEnabled;
              extensionThis.storage.enabled = enabled;
            }

            if (!enabled) {
              if (oldState.enabled) {
                extensionThis.storage.matches = [];
                extensionThis.options.onMatchesChange?.([]);
              }
              return {
                decorations: DecorationSet.empty,
                matches: [],
                enabled: false,
              };
            }

            if (tr.docChanged || meta) {
              const { decorations, matches } = processDocCompliance(newState.doc, COMPLIANCE_RULES);
              extensionThis.storage.matches = matches;
              extensionThis.options.onMatchesChange?.(matches);
              return { decorations, matches, enabled: true };
            }

            return {
              decorations: oldState.decorations.map(tr.mapping, tr.doc),
              matches: oldState.matches,
              enabled: true,
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
