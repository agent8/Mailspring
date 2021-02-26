import React from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';

export const UNEDITABLE_TYPE = 'uneditable';
export const UNEDITABLE_TAGS = ['table', 'center', 'edo-readonly'];

function UneditableNode(props) {
  const { attributes, node, editor, targetIsHTML, isSelected } = props;
  const __html = node.data.get ? node.data.get('html') : node.data.html;
  const tagName = node.data.get ? node.data.get('tagName') : node.data.tagName;
  const removeQuote = () => {
    editor.change(change => {
      change.removeNodeByKey(node.key);
    });
  };

  if (targetIsHTML || tagName === 'edo-readonly') {
    return <div dangerouslySetInnerHTML={{ __html }} data-edison-readonly={'true'} />;
  }
  return (
    <div
      {...attributes}
      className={`uneditable ${isSelected && 'custom-block-selected'}`}
      draggable={false}
    >
      <a
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          removeQuote();
        }}
        className="uneditable-remove"
      >
        <RetinaImg
          title="Remove HTML"
          name="image-cancel-button.png"
          mode={RetinaImg.Mode.ContentPreserve}
        />
      </a>
      <div
        dangerouslySetInnerHTML={{ __html }}
        onContextMenu={event => {
          event.preventDefault();
          const { remote } = require('electron');
          const { Menu, MenuItem, clipboard } = remote;
          const copyQuote = () => {
            clipboard.writeText(__html);
            clipboard.writeHTML(__html);
          };
          const menu = new Menu();
          menu.append(
            new MenuItem({
              label: 'Cut',
              enabled: true,
              click: () => {
                copyQuote();
                removeQuote();
              },
            })
          );
          menu.append(
            new MenuItem({
              label: 'Copy',
              enabled: true,
              click: copyQuote,
            })
          );
          menu.popup({});
        }}
      />
    </div>
  );
}
UneditableNode.propTypes = {
  node: PropTypes.object,
  isSelected: PropTypes.bool,
  targetIsHTML: PropTypes.bool,
  editor: PropTypes.object,
  attributes: PropTypes.object,
};

function renderNode(props) {
  if (props.node.type === UNEDITABLE_TYPE) {
    return UneditableNode(props);
  }
}

const rules = [
  {
    deserialize(el, next) {
      const tagName = el.tagName.toLowerCase();

      if (UNEDITABLE_TAGS.includes(tagName)) {
        let isVoid = tagName !== 'edo-readonly';
        if (
          tagName === 'edo-readonly' &&
          !AppEnv.config.get('core.composing.disableOriginalMessageEdit')
        ) {
          return;
        }
        return {
          object: 'block',
          type: UNEDITABLE_TYPE,
          data: { html: el.outerHTML, tagName },
          nodes: [],
          isVoid,
        };
      }
    },
    serialize(obj, children) {
      if (obj.object !== 'block') return;
      return renderNode({ node: obj, children, targetIsHTML: true });
    },
  },
];

export default [
  {
    renderNode,
    rules,
  },
];
