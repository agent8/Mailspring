import React from 'react';
import { ImageAttachmentItem } from 'mailspring-component-kit';
import { AttachmentStore, Actions } from 'mailspring-exports';
import { isQuoteNode, isEmptySelection } from './base-block-plugins';

const IMAGE_TYPE = 'image';

function ImageNode(props) {
  const { attributes, node, editor, targetIsHTML, isSelected } = props;
  const contentId = node.data.get ? node.data.get('contentId') : node.data.contentId;

  if (targetIsHTML) {
    return <img alt="" src={`cid:${contentId}`} />;
  }

  const { draft } = editor.props.propsForPlugins;
  const file = draft.files.find(f => contentId === f.contentId);
  if (!file) {
    return <span />;
  }

  return (
    <ImageAttachmentItem
      {...attributes}
      draggable={false}
      className={`file-upload ${isSelected && 'custom-block-selected'}`}
      filePath={AttachmentStore.pathForFile(file)}
      displayName={file.filename}
      fileId={file.id}
      accountId={draft.accountId}
      onRemoveAttachment={() =>
        editor.change(change => {
          Actions.removeAttachment({
            headerMessageId: draft.headerMessageId,
            messageId: draft.id,
            accountId: draft.accountId,
            fileToRemove: file,
          });
          return change.removeNodeByKey(node.key);
        })
      }
    />
  );
}

function renderNode(props) {
  if (props.node.type === IMAGE_TYPE) {
    return ImageNode(props);
  }
}

const rules = [
  {
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === 'img' && (el.getAttribute('src') || '').startsWith('cid:')) {
        return {
          object: 'inline',
          isVoid: true,
          nodes: [],
          type: IMAGE_TYPE,
          data: {
            contentId: el
              .getAttribute('src')
              .split('cid:')
              .pop(),
          },
        };
      }
    },
    serialize(obj, children) {
      if (obj.object !== 'inline') return;
      return renderNode({ node: obj, children, targetIsHTML: true });
    },
  },
];
const nonPrintableKeyCode = {
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

const processInlineAttachment = change => {
  let contentIds = [];
  const inLines = change.value.inlines;
  if (inLines && inLines.size > 0) {
    for (let i = 0; i < inLines.size; i++) {
      const inline = inLines.get(i);
      if (inline) {
        if (inline && inline.data && inline.data.get('contentId')) {
          contentIds.push(inline.data.get('contentId'));
        }
      }
    }
  }
  contentIds.forEach(contentId => Actions.draftInlineAttachmentRemoved(contentId));
  return contentIds;
};
const processNearestInlineAttachment = (change, offSet) => {
  const contentIds = [];
  if (isEmptySelection(change.value)) {
    const focusKey = change.value.focusKey;
    const anchorOffset = change.value.anchorOffset;
    const focusText = change.value.focusText.text;
    const parentBlock = change.value.focusBlock;
    let isAtEnd = anchorOffset === 0;
    if (offSet === 1 && focusText) {
      const windowSelection = window.getSelection();
      if (windowSelection) {
        const windowAnchorOffset = windowSelection.getRangeAt(0).endOffset;
        isAtEnd = anchorOffset === focusText.length - 1 && anchorOffset === windowAnchorOffset;
      }
    }
    if (parentBlock && focusKey && isAtEnd) {
      const nodes = parentBlock.nodes;
      for (let i = 0; i < nodes.size; i++) {
        if (nodes.get(i).key === focusKey && i + offSet > 0) {
          const inlineImage = nodes.get(i + offSet);
          if (inlineImage && inlineImage.data && inlineImage.data.get('contentId')) {
            contentIds.push(inlineImage.data.get('contentId'));
            break;
          }
        }
      }
    }
  }
  contentIds.forEach(contentId => Actions.draftInlineAttachmentRemoved(contentId));
};
const onKeyDown = (event, change) => {
  if (
    event.shiftKey ||
    event.metaKey ||
    event.optionKey ||
    event.altKey ||
    event.ctrlKey ||
    ['Control', 'Meta', 'Alt', 'Shift', 'Enter', 'Backspace', 'Delete'].includes(event.key) ||
    nonPrintableKeyCode.mac.includes(event.keyCode)
  ) {
    return;
  }
  processInlineAttachment(change);
};
const onBackspace = (event, change) => {
  if (event.key !== 'Backspace') {
    return;
  }
  const contentIds = processInlineAttachment(change);
  if (contentIds.length === 0) {
    processNearestInlineAttachment(change, -1);
  }
};
const onDelete = (event, change) => {
  if (event.key !== 'Delete') {
    return;
  }
  const contentIds = processInlineAttachment(change);
  if (contentIds.length === 0) {
    processNearestInlineAttachment(change, 1);
  }
};

export const changes = {
  insert: (change, file) => {
    const canHoldInlineImage = (node, anchorKey) =>
      !node.isVoid && !isQuoteNode(node) && !!node.getFirstText() && !!node.getChild(anchorKey);

    while (!canHoldInlineImage(change.value.anchorBlock, change.value.anchorKey)) {
      change.collapseToEndOfPreviousText();
      if (!change.value.anchorBlock) {
        break;
      }
    }
    return change.insertInline({
      object: 'inline',
      isVoid: true,
      type: IMAGE_TYPE,
      data: {
        contentId: file.contentId,
      },
    });
  },
};

export default [
  {
    renderNode,
    rules,
    onKeyDown,
  },
  { onKeyDown: onBackspace },
  { onKeyDown: onDelete },
];
