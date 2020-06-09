import React from 'react';
import { RetinaImg } from 'mailspring-component-kit';

export const CodeBlockPlugin = onClick => {
  const ToolbarAttachmentButton = () => {
    return (
      <button onClick={onClick} className={'hide show-in-signature'}>
        <RetinaImg
          name={'code-block.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    );
  };
  return [
    {
      toolbarComponents: [ToolbarAttachmentButton],
    },
  ];
};
