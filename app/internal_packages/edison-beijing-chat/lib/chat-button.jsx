/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import {
  Actions,
  WorkspaceStore
} from 'mailspring-exports';

export default class ChatButton extends Component {
  static displayName = 'ChatButton';
  toggleChatPanel = () => {
    Actions.selectRootSheet(WorkspaceStore.Sheet.ChatView);
  }
  render() {
    return (
      <div className="toolbar-chat" style={{ display: 'none' }}>
        <button className="btn btn-toolbar" onClick={this.toggleChatPanel}>
          <RetinaImg name="toolbar-chat.png" mode={RetinaImg.Mode.ContentIsMask} />
        </button>
      </div>
    )
  }
}