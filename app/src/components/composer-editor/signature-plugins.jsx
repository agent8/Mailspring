import React from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import { BLOCK_CONFIG } from './base-block-plugins';

const SIGNATURE_TYPE = 'signature';

function SignatureNode(props) {
  const { attributes, node, editor, targetIsHTML, isSelected } = props;
  const id = node.data.get ? node.data.get('id') : node.data.id;

  if (targetIsHTML) {
    return <signature id={id}>{BLOCK_CONFIG.div.render(props)}</signature>;
  }
  return (
    <div {...attributes} className={`editable-box ${isSelected && 'custom-block-selected'}`}>
      <a
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          editor.change(change => {
            change.removeNodeByKey(node.key);
          });
        }}
        className="uneditable-remove"
      >
        <RetinaImg
          title="Remove HTML"
          name="image-cancel-button.png"
          mode={RetinaImg.Mode.ContentPreserve}
        />
      </a>
      <signature id={id}>{BLOCK_CONFIG.div.render(props)}</signature>
    </div>
  );
}

function renderNode(props) {
  if (props.node.type === SIGNATURE_TYPE) {
    return SignatureNode(props);
  }
}

const rules = [
  {
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === 'signature') {
        return {
          object: 'block',
          type: SIGNATURE_TYPE,
          data: { id: el.id },
          nodes: next(el.childNodes),
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
