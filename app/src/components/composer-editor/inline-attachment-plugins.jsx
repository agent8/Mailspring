import React from 'react';
import { ImageAttachmentItem } from 'mailspring-component-kit';
import { AttachmentStore, Actions, Utils } from 'mailspring-exports';
import { isQuoteNode, isEmptySelection, nonPrintableKeyCode } from './base-block-plugins';

const IMAGE_TYPE = 'image';

function ImageNode(props) {
  const { attributes, node, editor, targetIsHTML, isSelected } = props;
  const contentId = node.data.get ? node.data.get('contentId') : node.data.contentId;
  if (targetIsHTML) {
    return <img alt="" src={`cid:${contentId}`} />;
  }

  const { draft } = editor.props.propsForPlugins;
  if (!draft) {
    return <span />;
  }
  const file = draft.files.find(f => contentId === f.contentId);
  const fileId = file ? file.id : node.data.get ? node.data.get('fileId') : '';
  const fileName = file ? file.name : node.data.get ? node.data.get('fileName') : '';
  const filePath = file
    ? AttachmentStore.pathForFile(file)
    : node.data.get
    ? node.data.get('filePath')
    : '';
  if (!fileId) {
    return <span />;
  }

  return (
    <ImageAttachmentItem
      {...attributes}
      draggable={false}
      className={`file-upload ${isSelected && 'custom-block-selected'}`}
      filePath={filePath}
      displayName={fileName}
      fileId={fileId}
      accountId={draft.accountId}
      onRemoveAttachment={() =>
        editor.change(change => {
          Actions.removeAttachment({
            headerMessageId: draft.headerMessageId,
            messageId: draft.id,
            accountId: draft.accountId,
            fileToRemove: { id: fileId },
          });
          return change.removeNodeByKey(node.key);
        })
      }
      onHover={node => {
        const selection = window.getSelection();
        if (
          selection &&
          node &&
          selection.type === 'Range' &&
          selection.anchorNode === selection.focusNode &&
          selection.anchorOffset === selection.focusOffset
        ) {
          AppEnv.logDebug(`extending selection for inline ${file.id}`);
          selection.extend(node);
        }
      }}
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
        const fileId = el.getAttribute('data-edison-file-id');
        const fileName = el.getAttribute('data-edison-file-name');
        const filePath = el.getAttribute('data-edison-file-path');
        if (fileId && fileName) {
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
              fileId,
              fileName: Utils.base64ToString(fileName),
              filePath: decodeURIComponent(filePath),
            },
          };
        }
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

const processInlineAttachment = change => {
  let contentIds = [];
  const inLines = change.value.inlines;
  if (inLines && inLines.size > 0) {
    for (let i = 0; i < inLines.size; i++) {
      const inline = inLines.get(i);
      if (inline) {
        if (inline && inline.data && inline.data.get('contentId')) {
          contentIds.push(inline.data.get('contentId'));
          // DC-1725 Because inlineImage have a void node with the same key
          // that is not deleted when this inline is removed
          // We manually removes it.
          change.removeNodeByKey(inline.key);
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
        isAtEnd = focusText.length === windowAnchorOffset;
      }
    }
    if (parentBlock && focusKey && isAtEnd) {
      const nodes = parentBlock.nodes;
      for (let i = 0; i < nodes.size; i++) {
        if (nodes.get(i).key === focusKey && i + offSet > 0) {
          const inlineImage = nodes.get(i + offSet);
          if (inlineImage && inlineImage.data && inlineImage.data.get('contentId')) {
            contentIds.push(inlineImage.data.get('contentId'));
            // DC-1725 Because inlineImage have a void node with the same key
            // that is not deleted when this inline is removed
            // We manually removes it.
            change.removeNodeByKey(inlineImage.key);
          }
        }
      }
    }
  }
  contentIds.forEach(contentId => Actions.draftInlineAttachmentRemoved(contentId));
  return contentIds;
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
    const haveInlineDeleted = processNearestInlineAttachment(change, -1).length > 0;
    if (haveInlineDeleted) {
      return change;
    }
  } else {
    if (isEmptySelection(change.value)) {
      return change;
    }
    return;
  }
};
const onDelete = (event, change) => {
  if (event.key !== 'Delete') {
    return;
  }
  const contentIds = processInlineAttachment(change);
  if (contentIds.length === 0) {
    const haveInlineDeleted = processNearestInlineAttachment(change, 1).length > 0;
    if (haveInlineDeleted) {
      return change;
    } else {
      return;
    }
  } else {
    if (isEmptySelection(change.value)) {
      return change;
    }
    return;
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
    return change
      .insertInline({
        object: 'inline',
        isVoid: true,
        type: IMAGE_TYPE,
        data: {
          contentId: file.contentId,
        },
      })
      .collapseToStartOfNextText();
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
