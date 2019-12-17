import React from 'react';
import { ImageAttachmentItem, RetinaImg } from 'mailspring-component-kit';
import { AttachmentStore, Actions } from 'mailspring-exports';
import { isQuoteNode } from './base-block-plugins';

const IMAGE_TYPE = 'inline-image';

function ImageNode(props) {
  const { attributes, node, editor, targetIsHTML, isSelected } = props;
  const src = node.data.get ? node.data.get('src') : node.data.src;

  if (targetIsHTML) {
    return <img alt="" src={src} />;
  }
}

function renderNode(props) {
  if (props.node.type === IMAGE_TYPE) {
    return ImageNode(props);
  }
}

const ToolbarAttachmentButton = ({ value, onChange }) => {
  const cb = paths => {
    if (paths == null) {
      return;
    }
    let pathsToOpen = paths;
    if (typeof pathsToOpen === 'string') {
      pathsToOpen = [pathsToOpen];
    }
    const inline = {
      isVoid: true,
      object: 'inline',
      type: IMAGE_TYPE,
      data: {
        src: pathsToOpen[0],
      },
    };

    setTimeout(() => {
      onChange(
        value
          .change()
          .insertInline(inline)
          .collapseToStartOfNextText()
          .focus()
      );
    }, 100);
  };

  return (
    <button
      onClick={() => {
        AppEnv.showImageSelectionDialog(cb);
      }}
      className={'hide show-in-signature'}
    >
      <RetinaImg
        name={'inline-image.svg'}
        style={{ width: 24, height: 24 }}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
      />
    </button>
  );
};

const rules = [
  {
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === 'img' && el.getAttribute('src')) {
        return {
          object: 'inline',
          isVoid: true,
          type: IMAGE_TYPE,
          data: {
            src: el.getAttribute('src'),
          },
        };
      }
    },
    serialize(obj, children) {
      if (obj.object === 'inline') {
        return renderNode({ node: obj, children, targetIsHTML: true });
      }
    },
  },
];

export default [
  {
    toolbarComponents: [ToolbarAttachmentButton],
    renderNode,
    rules,
  },
];
