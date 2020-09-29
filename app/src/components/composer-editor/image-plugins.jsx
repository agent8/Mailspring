import React from 'react';
import { Inline } from 'slate';
import { RetinaImg, ResizableImg } from 'mailspring-component-kit';

const IMAGE_TYPE = 'inline_resizable_image';
const maxImgSize = 50 * 1000;

function ImageNode(props) {
  const { attributes, node, targetIsHTML, editor } = props;
  const data = node.data;
  const src = data.get ? data.get('src') : data.src;
  const height = data.get ? data.get('height') : data.height;
  const width = data.get ? data.get('width') : data.width;
  const style = {};
  if (height) {
    style.height = height;
  }
  if (width) {
    style.width = width;
  }

  if (targetIsHTML) {
    return <img alt="" src={src} style={style} resizable={'true'} />;
  }

  let isSelect = false;
  const selectNow = editor.value.focusKey;
  if (selectNow) {
    const ancestorsNode = editor.value.document.getAncestors(selectNow);
    const selectNowAncestors = ancestorsNode.find(el => el.key === node.key);
    if (selectNowAncestors && selectNowAncestors.key === node.key) {
      isSelect = true;
    }
  }

  return (
    <span {...attributes}>
      <ResizableImg
        src={src}
        style={style}
        showMask={isSelect}
        callback={value => {
          editor.change(change => {
            return change.setNodeByKey(node.key, {
              data: {
                src: src,
                draggerDisable: true,
                height: value.height,
                width: value.width,
              },
            });
          });
        }}
        lockAspectRatio
      />
    </span>
  );
}

function renderNode(props) {
  if (props.node.type === IMAGE_TYPE) {
    return ImageNode(props);
  }
}

export const changes = {
  insert: (change, filePath) => {
    return change
      .insertInline({
        isVoid: true,
        type: IMAGE_TYPE,
        data: {
          draggerDisable: true,
          src: filePath,
        },
      })
      .collapseToStartOfNextText();
  },
};

const ToolbarAttachmentButton = ({ value, onChange, onAddAttachments }) => {
  const cb = filePath => {
    if (!filePath) {
      return;
    }
    const inline = Inline.create({
      isVoid: true,
      type: IMAGE_TYPE,
      data: {
        draggerDisable: true,
        src: filePath,
      },
    });

    onAddAttachments({
      path: filePath,
      inline: true,
    });

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
        AppEnv.addInlineImageDialog(cb, maxImgSize);
      }}
      className={'hide show-in-preferences'}
    >
      <RetinaImg
        name={'inline-image.svg'}
        style={{ width: 24, height: 24, fontSize: 24 }}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
      />
    </button>
  );
};

const rules = [
  {
    deserialize(el, next) {
      if (
        el.tagName.toLowerCase() === 'img' &&
        el.getAttribute('src')
        // el.getAttribute('resizable') === 'true'
      ) {
        const data = {
          src: el.getAttribute('src'),
          draggerDisable: true,
        };
        const style = el.style;
        const height = style.height || el.getAttribute('height');
        if (height) {
          data.height = height;
        }
        const width = style.width || el.getAttribute('width');
        if (width) {
          data.width = width;
        }

        return {
          object: 'inline',
          isVoid: true,
          type: IMAGE_TYPE,
          data,
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
