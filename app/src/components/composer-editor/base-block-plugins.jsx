/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React from 'react';
import SoftBreak from 'slate-soft-break';
import EditList from 'slate-edit-list';
// import AutoReplace from 'slate-auto-replace';
import { BuildToggleButton } from './toolbar-component-factories';

const Handlers = require('./slate-edit-code/handlers');
const TABKey = 9;
export const nonPrintableKeyCode = {
  //Based on https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
  mac: [
    18, //Alt
    20, //CapsLock
    17, //Control
    91, //OSLeft
    93, //OSRight
    16, //Shift
    13, //Enter
    9, // Tab
    35, //End
    45, //Insert
    36, //Help
    34, //PageDown
    33, //PageUp
    40, //ArrowDown
    37, //ArrowLeft
    39, //ArrowRight
    38, //ArrowUp
    27, //Escape
    124, //PrintScreen
    125, //ScrollLock
    126, //Pause
    //F1-F20
    112,
    113,
    114,
    115,
    116,
    117,
    118,
    119,
    120,
    121,
    122,
    123,
    124,
    125,
    126,
    127,
    128,
    129,
    130,
    131,
    0, //Unknown key
  ],
};
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

// function toggleBlockTypeWithBreakout(value, change, type) {
//   const ancestors = value.document.getAncestors(value.focusBlock.key);

//   let idx = ancestors.findIndex(b => b.type === type);
//   if (idx === -1 && value.focusBlock.type === type) {
//     idx = ancestors.size - 1;
//   }

//   if (idx !== -1) {
//     const depth = ancestors.size - idx;
//     if (depth > 0) {
//       change.splitBlock(ancestors.size - idx);
//       for (let x = 0; x < depth; x++) change.unwrapBlock();
//     }
//     change.setBlock(BLOCK_CONFIG.div.type);
//   } else {
//     change.setBlock(type);
//   }

//   return change;
// }
function isStartOfDocument(value) {
  if (!value) {
    return false;
  }
  if (!value.document) {
    return false;
  }
  const focusOffset = value.focusOffset;
  const focusText = value.focusText;
  const firstText = value.document.getFirstText();
  return focusOffset === 0 && focusText && firstText && firstText.key === focusText.key;
}
export function isEmptySelection(value) {
  if (!value) {
    return false;
  }
  if (!value.selection) {
    return false;
  }
  const selectionStartKey = value.selection.startKey;
  const selectionEndKey = value.selection.endKey;
  if (!selectionEndKey || !selectionStartKey) {
    return false;
  }
  if (selectionEndKey !== selectionStartKey) {
    return false;
  }
  const selectionStartOffSetKey = value.selection.startOffset;
  const selectionEndOffSetKey = value.selection.endOffset;
  if (selectionEndOffSetKey !== selectionStartOffSetKey) {
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

function isMoreThanTabs(numOfTabs, value) {
  const text = value.focusText;
  //Because of an issue with built in Tab, we are hardcoding this value to 10
  //And because of said bug, the number of tab is actually 5.
  numOfTabs = 10;
  if (!isFinite(numOfTabs)) {
    return false;
  }
  if (numOfTabs <= 0) {
    return true;
  }
  if (text && text.text) {
    let i = 0;
    let count = 0;
    const textLength = text.text.length;
    //Because we use 4 spaces to represent tab
    while (i < numOfTabs * 4 && i < textLength) {
      let allSpaces = false;
      for (let k = i; k <= i + 3; k++) {
        allSpaces = text.text.charCodeAt(k) === 32;
        if (!allSpaces) {
          return false;
        }
      }
      count++;
      if (count >= numOfTabs) {
        return true;
      }
      i += 4;
    }
  }
  return false;
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
        if (!node.data) {
          return <br {...attributes} />;
        }
        const fontSize = node.data.get('fontSize');
        const fontFamily = node.data.get('fontFamily');
        if (fontSize || fontFamily) {
          return (
            <font style={{ fontFamily, fontSize }}>
              <br {...attributes} />
            </font>
          );
        }
        return <br {...attributes} />;
      }
      const fontSize = node.data.get('fontSize');
      const fontFamily = node.data.get('fontFamily');
      if (fontSize || fontFamily) {
        return (
          <div
            {...attributes}
            {...explicitHTMLAttributes}
            className={node.data.className || node.data.get('className')}
          >
            <font style={{ fontFamily, fontSize }}>{children}</font>
          </div>
        );
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
        let change = value.change();
        indentListItem(change, true);

        if (!isMoreThanTabs(10, value)) {
          return Handlers.onTab({ lineType: 'div', getIndent: () => '    ' }, event, change);
        } else {
          return change;
        }
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
        let change = value.change();
        indentListItem(change, false);
        return Handlers.onShiftTab({ lineType: 'div', getIndent: () => '    ' }, event, change);
      },
    },
  },
  blockquote: {
    type: 'blockquote',
    tagNames: ['blockquote'],
    render: props => {
      const className =
        (props &&
          props.node &&
          props.node.data &&
          (props.node.data.className || props.node.data.get('className'))) ||
        '';
      return (
        <blockquote {...props.attributes} className={className}>
          {props.children}
        </blockquote>
      );
    },
    button: {
      hideWhenCrowded: true,
      iconClass: 'dt-icon dt-icon-quote',
      isActive: value => {
        return isBlockTypeOrWithinType(value, BLOCK_CONFIG.blockquote.type);
      },
      onToggle: (value, active) => {
        return active
          ? value.change().setBlock(BLOCK_CONFIG.div.type)
          : value
              .change()
              .setBlock(BLOCK_CONFIG.blockquote.type)
              .moveToEnd()
              .insertBlock(BLOCK_CONFIG.div.type);
      },
    },
  },
  code: {
    type: 'code',
    tagNames: ['code'],
    render: props => (
      <code {...props.attributes}>
        <div
          style={{
            backgroundColor: `rgba(0, 0, 0, 0.05)`,
            padding: `0.2em 1em`,
          }}
        >
          {props.children}
        </div>
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
          : value
              .change()
              .setBlock(BLOCK_CONFIG.code.type)
              .moveToEnd()
              .insertBlock(BLOCK_CONFIG.div.type),
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
      onToggle: (value, active) => toggleList(value, active, BLOCK_CONFIG.ol_list.type),
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
    render: props => {
      const style = {};
      if (props.node && props.node.data && props.node.data.size > 0) {
        style.fontSize = props.node.data.get('fontSize');
        style.fontFamily = props.node.data.get('fontFamily');
        style.color = props.node.data.get('color');
        const marginLeft = props.node.data.marginLeft || props.node.data.get('marginLeft');
        if (marginLeft) {
          style.marginLeft = marginLeft;
        }
      }
      return (
        <li {...props.attributes} style={style}>
          {props.children}
        </li>
      );
    },
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
  edo_readonly: {
    type: 'edo_readonly',
    tagNames: ['edo-readonly'],
    render: props => {
      if (props.targetIsHTML) {
        return <edo-readonly {...props.attributes}>{props.children}</edo-readonly>;
      } else {
        return BLOCK_CONFIG.div.render(props);
      }
    },
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

const INDENT = 2;
const INDENT_UNIT = 'em';
const MAX_INDENT = 10;
const indentListItem = (change, isIndent = true) => {
  if (
    isBlockTypeOrWithinType(change.value, BLOCK_CONFIG.ol_list.type) ||
    isBlockTypeOrWithinType(change.value, BLOCK_CONFIG.ul_list.type)
  ) {
    for (const text of change.value.texts) {
      const list_item = change.value.document
        .getAncestors(text.key)
        .find(b => b.type === BLOCK_CONFIG.list_item.type);
      if (list_item) {
        change = calcListItemIndent(change, list_item, isIndent);
      }
    }
  }
  return change;
};
const calcListItemIndent = (change, item, isIndent = true) => {
  let indent = 0;
  const marginLeft = item.data.get('marginLeft');
  if (marginLeft && marginLeft.includes(INDENT_UNIT)) {
    indent = parseInt(marginLeft.replace(INDENT_UNIT, ''));
  }
  if (isIndent) {
    indent += INDENT;
  } else {
    indent -= INDENT;
  }
  if (indent > MAX_INDENT) {
    indent = MAX_INDENT;
  } else if (indent < 0) {
    indent = 0;
  }
  var d = item.data.set('marginLeft', indent + INDENT_UNIT);
  change.setNodeByKey(item.key, {
    data: d,
  });
  return change;
};

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
        let data = className ? { className } : undefined;
        if (config.type === BLOCK_CONFIG.list_item.type) {
          if (el.style) {
            if (!data) {
              data = {};
            }
            if (el.style.font) {
              data.fontFamil = el.style.fontFamily;
            }
            if (el.style.color) {
              data.color = el.style.color;
            }
            if (el.style.fontSize) {
              data.fontSize = el.style.fontSize;
            }
            if (el.style.marginLeft) {
              data.marginLeft = el.style.marginLeft;
            }
          }
        }
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
  if (
    draft.replyType === 1 && // replyType - new: 0, reply: 1, forward: 2
    AppEnv.config.get('core.composing.includeOriginalEmailInReply') &&
    AppEnv.config.get('core.composing.showOriginalEmailInReply')
  ) {
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
          if (!isMoreThanTabs(10, value)) {
            return Handlers.onTab({ lineType: 'div' }, event, value.change());
          }
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
          change.setBlock(BLOCK_CONFIG.div.type);
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
      event.preventDefault();
      indentListItem(change, !(event.shiftKey || event.metaKey || event.optionKey));

      if (event.shiftKey || event.metaKey || event.optionKey) {
        return Handlers.onShiftTab({ lineType: 'div' }, event, change);
      }
      if (!isMoreThanTabs(10, change.value)) {
        return Handlers.onTab({ lineType: 'div' }, event, change);
      }
      return;
    },
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
  // AutoReplace({
  //   onlyIn: [BLOCK_CONFIG.div.type, BLOCK_CONFIG.div.type],
  //   trigger: ' ',
  //   before: /^([1]{1}[.]{1})$/,
  //   transform: (transform, e, matches) => {
  //     EditListPlugin.changes.wrapInList(transform, BLOCK_CONFIG.ol_list.type);
  //   },
  // }),
];
