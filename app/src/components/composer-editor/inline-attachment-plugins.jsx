import React from 'react';
import { ImageAttachmentItem } from 'mailspring-component-kit';
import { AttachmentStore, Actions } from 'mailspring-exports';
import { isQuoteNode } from './base-block-plugins';

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

export const changes = {
  insert: (change, file) => {
    const canHoldInlineImage = (node, anchorKey) => !node.isVoid && !isQuoteNode(node) && !!node.getFirstText() && !!node.getChild(anchorKey);

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
  },
];
