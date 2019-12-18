import React from 'react';
import { Inline } from 'slate';
import { RetinaImg, ResizableImg } from 'mailspring-component-kit';

const IMAGE_TYPE = 'inline_resizable_image';

function ImageNode(props) {
  const { node, targetIsHTML, editor } = props;
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
  return (
    <ResizableImg
      src={src}
      style={style}
      callback={value => {
        editor.change(change => {
          const inline = Inline.create({
            isVoid: true,
            type: IMAGE_TYPE,
            data: {
              src: src,
              height: value.height,
              width: value.width,
            },
          });
          return change
            .removeNodeByKey(node.key)
            .insertInline(inline)
            .collapseToStartOfNextText()
            .focus();
        });
      }}
      lockAspectRatio
    />
  );
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
    let pathsTmp = paths;
    if (typeof pathsTmp === 'string') {
      pathsTmp = [pathsTmp];
    }
    const inline = Inline.create({
      isVoid: true,
      type: IMAGE_TYPE,
      data: {
        src: pathsTmp[0],
      },
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
      if (
        el.tagName.toLowerCase() === 'img' &&
        el.getAttribute('src') &&
        el.getAttribute('resizable') === 'true'
      ) {
        const data = {
          src: el.getAttribute('src'),
        };
        const style = el.style;
        if (style.height) {
          data.height = ~~`${style.height}`.replace('px', '');
        }
        if (style.width) {
          data.width = ~~`${style.width}`.replace('px', '');
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
