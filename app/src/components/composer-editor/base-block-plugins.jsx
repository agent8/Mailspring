import React from 'react';
import SoftBreak from 'slate-soft-break';
import EditList from 'slate-edit-list';
import AutoReplace from 'slate-auto-replace';
const Handlers = require('./slate-edit-code/handlers');

import { BuildToggleButton } from './toolbar-component-factories';
const TABKey = 9;
function nodeIsEmpty(node) {
  if (node.text !== '') {
    return false;
  }

  let children = (node.nodes.toArray ? node.nodes.toArray() : node.nodes) || [];
  if (children.length === 0) {
    return true;
  }
  if (children.length === 1 && children[0].object === 'text') {
    return true;
  }
  return false;
}

function isBlockTypeOrWithinType(value, type) {
  if (!value.focusBlock) {
    return false;
  }
  const isMe = value.focusBlock.type === type;
  const isParent = value.document.getAncestors(value.focusBlock.key).find(b => b.type === type);

  return isMe || isParent;
}

function toggleBlockTypeWithBreakout(value, change, type) {
  const ancestors = value.document.getAncestors(value.focusBlock.key);

  let idx = ancestors.findIndex(b => b.type === type);
  if (idx === -1 && value.focusBlock.type === type) {
    idx = ancestors.size - 1;
  }

  if (idx !== -1) {
    const depth = ancestors.size - idx;
    if (depth > 0) {
      change.splitBlock(ancestors.size - idx);
      for (let x = 0; x < depth; x++) change.unwrapBlock();
    }
    change.setBlock(BLOCK_CONFIG.div.type);
  } else {
    change.setBlock(type);
  }

  return change;
}
function isStartOfDocument(value){
  if(!value){
    return false;
  }
  if(!value.document){
    return false;
  }
  const focusOffset = value.focusOffset;
  const focusText = value.focusText;
  const firstText = value.document.getFirstText();
  return focusOffset === 0 && focusText && firstText && firstText.key === focusText.key
}
function isEmptySelection(value){
  if(!value){
    return false;
  }
  if(!value.selection){
    return false;
  }
  const selectionStartKey = value.selection.startKey;
  const selectionEndKey = value.selection.endKey;
  if(!selectionEndKey || !selectionStartKey){
    return false;
  }
  if(selectionEndKey!==selectionStartKey){
    return false;
  }
  const selectionStartOffSetKey = value.selection.startOffset;
  const selectionEndOffSetKey = value.selection.endOffset;
  if(selectionEndOffSetKey !== selectionStartOffSetKey){
    return false;
  }
  return true;

}
function shouldBeRemoved(value) {
  const listTypes = ['ol_list', 'ul_list', 'code', 'blockquote'];
  const focusKey = value.focusKey;
  if (!focusKey) {
    return false;
  }
  const parentNode = value.document.getFurthestAncestor(focusKey);
  if (!parentNode) {
    return false;
  }
  return listTypes.includes(parentNode.type);
}
function toggleList(value, activated, type) {
  if (activated) {
    return EditListPlugin.changes.unwrapList(value.change());
  } else {
    let changes = EditListPlugin.changes.unwrapList(value.change());
    return EditListPlugin.changes.wrapInList(changes, type);
  }
}

export const BLOCK_CONFIG = {
  div: {
    type: 'div',
    tagNames: ['div', 'br', 'p'],
    render: ({ node, attributes, children, targetIsHTML }) => {
      let explicitHTMLAttributes = undefined;

      if (targetIsHTML) {
        explicitHTMLAttributes = {};
        if (node.isLeafBlock() && node.getTextDirection() === 'rtl') {
          explicitHTMLAttributes.dir = 'rtl';
        }
      }

      if (targetIsHTML && nodeIsEmpty(node)) {
        return <br {...attributes} />;
      }
      return (
        <div
          {...attributes}
          {...explicitHTMLAttributes}
          className={node.data.className || node.data.get('className')}
        >
          {children}
        </div>
      );
    },
  },
  increaseIndent: {
    type: 'increase indent',
    tagNames: ['increase-indent'],
    render: props => <strong>{props.children}</strong>,
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-increase-indent',
      isActive: value => false,
      onToggle: (value, active, event) => {
        return Handlers.onTab({ lineType: 'div' }, event, value.change());
      },
    },
  },
  decreaseIndent: {
    type: 'decrease indent',
    tagNames: ['decrease-indent'],
    render: props => <strong>{props.children}</strong>,
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-decrease-indent',
      isActive: value => false,
      onToggle: (value, active, event) => {
        return Handlers.onShiftTab({ lineType: 'div' }, event, value.change());
      },
    },
  },
  blockquote: {
    type: 'blockquote',
    tagNames: ['blockquote'],
    render: props => <blockquote {...props.attributes}>{props.children}</blockquote>,
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-quote',
      isActive: value => {
        return isBlockTypeOrWithinType(value, BLOCK_CONFIG.blockquote.type);
      },
      onToggle: (value, active) => {
        return active
          ? value.change().setBlock(BLOCK_CONFIG.div.type)
          : value.change().setBlock(BLOCK_CONFIG.blockquote.type).moveToEnd().insertBlock(BLOCK_CONFIG.div.type);
      },
    },
  },
  code: {
    type: 'code',
    tagNames: ['pre'],
    render: props => (
      <code {...props.attributes}>
        <pre
          style={{
            backgroundColor: `rgba(0, 0, 0, 0.05)`,
            padding: `0.2em 1em`,
          }}
        >
          {props.children}
        </pre>
      </code>
    ),
    button: {
      hideWhenCrowded: true,
      isActive: value => value.focusBlock && value.focusBlock.type === BLOCK_CONFIG.code.type,
      iconClass: 'fa fa-sticky-note-o',
      svgName: 'code.svg',
      onToggle: (value, active) =>
        active
          ? value.change().setBlock(BLOCK_CONFIG.div.type)
          : value.change().setBlock(BLOCK_CONFIG.code.type).moveToEnd().insertBlock(BLOCK_CONFIG.div.type),
    },
  },
  ol_list: {
    type: 'ol_list',
    tagNames: ['ol'],
    render: props => <ol {...props.attributes}>{props.children}</ol>,
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-num-list',
      isActive: value => {
        const list = EditListPlugin.utils.getCurrentList(value);
        return list && list.type === BLOCK_CONFIG.ol_list.type;
      },
      onToggle: (value, active) => toggleList(value, active, BLOCK_CONFIG.ol_list.type)
    },
  },
  ul_list: {
    type: 'ul_list',
    tagNames: ['ul'],
    render: props => <ul {...props.attributes}>{props.children}</ul>,
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-bull-list',
      isActive: value => {
        const list = EditListPlugin.utils.getCurrentList(value);
        return list && list.type === BLOCK_CONFIG.ul_list.type;
      },
      onToggle: (value, active) => toggleList(value, active, BLOCK_CONFIG.ul_list.type),
    },
  },
  list_item: {
    type: 'list_item',
    tagNames: ['li'],
    render: props => <li {...props.attributes}>{props.children}</li>,
  },
  heading_one: {
    type: 'heading_one',
    tagNames: ['h1'],
    render: props => <h1 {...props.attributes}>{props.children}</h1>,
  },
  heading_two: {
    type: 'heading_two',
    tagNames: ['h2'],
    render: props => <h2 {...props.attributes}>{props.children}</h2>,
  },
};

const EditListPlugin = new EditList({
  types: [BLOCK_CONFIG.ol_list.type, BLOCK_CONFIG.ul_list.type],
  typeItem: BLOCK_CONFIG.list_item.type,
  typeDefault: BLOCK_CONFIG.div.type,
});

function renderNode(props) {
  const config = BLOCK_CONFIG[props.node.type];
  return config && config.render(props);
}
// function renderConsecutiveSpaces(text){
//   const match = text.match(/\s{2,}/g);
//   if(!match){
//     return;
//   }
//   return <span>{text.replace(/\s{2,}/g, "\u00A0 ")}</span>;
// }

const rules = [
  {
    deserialize(el, next) {
      const tagName = el.tagName.toLowerCase();
      let config = Object.values(BLOCK_CONFIG).find(c => c.tagNames.includes(tagName));

      // apply a few special rules:
      // block elements with monospace font are translated to <code> blocks
      if (
        ['div', 'blockquote'].includes(tagName) &&
        (el.style.fontFamily || el.style.font || '').includes('monospace')
      ) {
        config = BLOCK_CONFIG.code;
      }

      // div elements that are entirely empty and have no meaningful-looking styles applied
      // would probably just add extra whitespace
      let empty = !el.hasChildNodes();
      if (tagName === 'div' && empty) {
        const s = (el.getAttribute('style') || '').toLowerCase();
        if (!s.includes('background') && !s.includes('margin') && !s.includes('padding')) {
          return;
        }
      }

      // return block
      if (config) {
        const className = el.getAttribute('class');
        const data = className ? { className } : undefined;
        return {
          object: 'block',
          type: config.type,
          nodes: next(el.childNodes),
          data: data,
        };
      }
    },
    serialize(obj, children) {
      // if(obj.object === 'string') {
      //   return renderConsecutiveSpaces(children);
      // }
      if (obj.object !== 'block') return;
      return renderNode({ node: obj, children, targetIsHTML: true });
    },
  },
];

// support functions

export function hasBlockquote(value) {
  const nodeHasBlockquote = node => {
    if (!node.nodes) return false;
    for (const childNode of node.nodes.toArray()) {
      if (childNode.type === BLOCK_CONFIG.blockquote.type || nodeHasBlockquote(childNode)) {
        return true;
      }
    }
  };
  return nodeHasBlockquote(value.document);
}

export function hasNonTrailingBlockquote(value) {
  const nodeHasNonTrailingBlockquote = node => {
    if (!node.nodes) return false;
    let found = false;
    for (const block of node.nodes.toArray()) {
      if (block.type === BLOCK_CONFIG.blockquote.type) {
        found = true;
      } else if (found && block.text.length > 0) {
        return true;
      } else if (nodeHasNonTrailingBlockquote(block)) {
        return true;
      }
    }
  };
  return nodeHasNonTrailingBlockquote(value.document);
}

export function allNodesInBFSOrder(value) {
  const all = [];
  const collect = node => {
    if (!node.nodes) return;
    all.push(node);
    node.nodes.toArray().forEach(collect);
  };
  collect(value.document);
  return all;
}

export function isQuoteNode(n) {
  return (
    n.type === 'blockquote' ||
    (n.data && n.data.get('className') && n.data.get('className').includes('gmail_quote'))
  );
}

export function lastUnquotedNode(value) {
  const all = allNodesInBFSOrder(value);
  for (let idx = 0; idx < all.length; idx++) {
    const n = all[idx];
    if (isQuoteNode(n)) {
      return all[Math.max(0, idx - 1)];
    }
  }
  return all[0];
}

export function removeQuotedText(value) {
  const change = value.change();
  let quoteBlock = null;
  while ((quoteBlock = allNodesInBFSOrder(change.value).find(isQuoteNode))) {
    change.removeNodeByKey(quoteBlock.key);
  }
  return change;
}

export function hideQuotedTextByDefault(draft) {
  if (draft.isForwarded()) {
    return false;
  }
  if (hasNonTrailingBlockquote(draft.bodyEditorState)) {
    return false;
  }
  return true;
}

// plugins

export default [
  // Base implementation of BLOCK_CONFIG block types,
  // the "block" toolbar section, and serialization
  {
    toolbarComponents: Object.values(BLOCK_CONFIG)
      .filter(config => config.button)
      .map(BuildToggleButton),
    renderNode,
    commands: {
      'contenteditable:quote': (event, value) => {
        const { isActive, onToggle } = BLOCK_CONFIG.blockquote.button;
        return onToggle(value, isActive(value));
      },
      'contenteditable:numbered-list': (event, value) => {
        const { isActive, onToggle } = BLOCK_CONFIG.ol_list.button;
        return onToggle(value, isActive(value));
      },
      'contenteditable:bulleted-list': (event, value) => {
        const { isActive, onToggle } = BLOCK_CONFIG.ul_list.button;
        return onToggle(value, isActive(value));
      },
      'contenteditable:indent': (event, value) => {
        const focusBlock = value.focusBlock;
        if (focusBlock && focusBlock.type === BLOCK_CONFIG.div.type) {
          return Handlers.onTab({ lineType: 'div' }, event, value.change());
        }
      },
      'contenteditable:outdent': (event, value) => {
        const focusBlock = value.focusBlock;
        if (focusBlock && focusBlock.type === BLOCK_CONFIG.div.type) {
          return Handlers.onShiftTab({ lineType: 'div' }, event, value.change());
        }
      },
    },
    rules,
  },

  // Return creates soft newlines in code blocks
  SoftBreak({
    onlyIn: [BLOCK_CONFIG.code.type, BLOCK_CONFIG.blockquote.type],
  }),

  {
    onKeyDown: function onKeyDown(event, change) {
      if (event.key !== 'Backspace' || event.shiftKey || event.metaKey || event.optionKey) {
        return;
      }
      // const { focusText, focusOffset, document } = change.value;
      // const firstText = document.getFirstText();
      if (isStartOfDocument(change.value)) {
        if (shouldBeRemoved(change.value)) {
          return;
        }
        if (isEmptySelection(change.value)) {
          return true;
        }
        event.preventDefault();
        return;
        // Pressing backspace when you're at the top of the document should not delete down
        // return true;
      }
    },
  },

  // Return breaks you out of blockquotes completely
  {
    onKeyDown: function onKeyDown(event, change) {
      if (event.shiftKey) {
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      if (!isBlockTypeOrWithinType(change.value, BLOCK_CONFIG.blockquote.type)) {
        return;
      }
      // toggleBlockTypeWithBreakout(change.value, change, BLOCK_CONFIG.blockquote.type);
      // event.preventDefault(); // since this inserts a newline
      return;
    },
  },

  // Normal Tab
  {
    onKeyDown: function onKeyDown(event, change) {
      if (event.keyCode !== TABKey) {
        return;
      }
      const startOffset = change.value.startOffset;
      if (startOffset === 0) {
        if (isBlockTypeOrWithinType(change.value, BLOCK_CONFIG.ol_list.type)) {
          return;
        }
        if (isBlockTypeOrWithinType(change.value, BLOCK_CONFIG.ul_list.type)) {
          return;
        }
      }
      event.preventDefault();
      if (event.shiftKey || event.metaKey || event.optionKey) {
        return Handlers.onShiftTab({ lineType: 'div' }, event, change);
      }
      return Handlers.onTab({ lineType: 'div' }, event, change);
    }
  },

  // Tabbing in / out in lists, enter to start new list item
  EditListPlugin,

  // "1. " and "- " start new lists
  // AutoReplace({
  //   onlyIn: [BLOCK_CONFIG.div.type, BLOCK_CONFIG.div.type],
  //   trigger: ' ',
  //   before: /^([-]{1})$/,
  //   transform: (transform, e, matches) => {
  //     EditListPlugin.changes.wrapInList(transform, BLOCK_CONFIG.ul_list.type);
  //   },
  // }),
  // "1. " start new lists
  AutoReplace({
    onlyIn: [BLOCK_CONFIG.div.type, BLOCK_CONFIG.div.type],
    trigger: ' ',
    before: /^([1]{1}[.]{1})$/,
    transform: (transform, e, matches) => {
      EditListPlugin.changes.wrapInList(transform, BLOCK_CONFIG.ol_list.type);
    },
  }),
];
