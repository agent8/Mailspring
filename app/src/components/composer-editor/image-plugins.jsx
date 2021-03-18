import path from 'path';
import { React, PropTypes } from 'mailspring-exports';
import { Inline } from 'slate';
import { RetinaImg, ResizableImg } from 'mailspring-component-kit';

const IMAGE_TYPE = 'inline_resizable_image';
const maxImgSize = 200 * 1000;

function ImageNode(props) {
  const { node, targetIsHTML, editor } = props;
  const data = node.data;
  const src = data.get ? data.get('src') : data.src;
  const height = data.get ? data.get('height') : data.height;
  const width = data.get ? data.get('width') : data.width;
  const href = data.get ? data.get('href') : data.href;
  const verticalAlign = data.get ? data.get('verticalAlign') : data.verticalAlign;
  const style = {};
  if (height) {
    style.height = height;
  }
  if (width) {
    style.width = width;
  }

  if (verticalAlign) {
    style.verticalAlign = verticalAlign;
  }
  if (targetIsHTML) {
    return (
      <a href={href}>
        <img alt="" href={href} src={src} style={style} resizable={'true'} />
      </a>
    );
  }

  return (
    <ResizableImg
      src={src}
      style={style}
      callback={value => {
        editor.change(change => {
          const { onForceSave } = editor.props.propsForPlugins;
          change = change.setNodeByKey(node.key, {
            data: {
              src: src,
              href: href,
              draggerDisable: true,
              height: value.height,
              width: value.width,
            },
          });
          if (onForceSave) {
            onForceSave(change.value);
          }
          return change;
        });
      }}
      onContextMenu={(event, { onShowPopup, onCopyImage } = {}) => {
        event.preventDefault();
        const { remote } = require('electron');
        const { Menu, MenuItem } = remote;
        const menu = new Menu();
        const removeImage = () => {
          editor.change(change => {
            return change.removeNodeByKey(node.key);
          });
        };
        if (onCopyImage) {
          menu.append(
            new MenuItem({
              label: 'Cut',
              enabled: true,
              click: () => {
                onCopyImage(removeImage);
              },
            })
          );
          menu.append(
            new MenuItem({
              label: 'Copy',
              enabled: true,
              click: onCopyImage,
            })
          );
        }
        menu.append(
          new MenuItem({
            label: 'Resize',
            enabled: true,
            click: onShowPopup,
          })
        );
        menu.popup({});
      }}
      lockAspectRatio
    />
  );
}

ImageNode.propTypes = {
  node: PropTypes.node,
  targetIsHTML: PropTypes.bool,
  editor: PropTypes.object,
};

function renderNode(props) {
  if (props.node.type === IMAGE_TYPE) {
    return ImageNode(props);
  }
}

export const changes = {
  insert: (change, filePath) => {
    const dirName = path.dirname(filePath);
    const fileName = encodeURIComponent(path.basename(filePath));
    if (!filePath) {
      return;
    }
    const inline = Inline.create({
      isVoid: true,
      type: IMAGE_TYPE,
      data: {
        draggerDisable: true,
        src: path.join(dirName, fileName),
      },
    });
    return change.insertInline(inline).collapseToStartOfNextText();
  },
};

const ToolbarAttachmentButton = ({ value, onChange, onAddAttachments }) => {
  const cb = filePath => {
    const dirName = path.dirname(filePath);
    const fileName = encodeURIComponent(path.basename(filePath));
    if (!filePath) {
      return;
    }
    const inline = Inline.create({
      isVoid: true,
      type: IMAGE_TYPE,
      data: {
        draggerDisable: true,
        src: path.join(dirName, fileName),
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
      title="Insert photo"
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

ToolbarAttachmentButton.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func,
  onAddAttachments: PropTypes.func,
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
        const verticalAlign = style.verticalAlign || el.getAttribute('verticalAlign');
        if (verticalAlign) {
          data.verticalAlign = verticalAlign;
        }
        const href = el.getAttribute('href');

        return {
          object: 'inline',
          isVoid: true,
          type: IMAGE_TYPE,
          data: { ...data, href: href },
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
