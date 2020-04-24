/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import { Actions } from 'mailspring-exports';
import ConversationsPanel from '../components/conversations/ConversationsPanel';
import ChatViewLeftResizeBar from '../components/common/ChatViewLeftResizeBar';
import registerLoginChat from '../utils/register-login-chat';

export const BOTTOM_OFFSET = 37;
export const MIN_HEIGHT = 60;

export default class ChatViewLeft extends Component {
  static displayName = 'ChatViewLeft';

  constructor() {
    super();
    this.state = {
      height: AppEnv.config.get(`chatPanelHeight`),
    };
  }

  componentDidMount() {
    registerLoginChat();
  }

  onResize = height => {
    const leftPanel = document.querySelector('.chat-left-panel-container');
    const oldHeight = leftPanel.offsetHeight;

    const accSidebar = document.querySelector('.account-sidebar');
    const sidebarPanelHeight = accSidebar.parentNode.offsetHeight;

    const sidebarNewHeight = sidebarPanelHeight - (height - oldHeight);
    if (sidebarNewHeight < 10) {
      return;
    }

    if (height < MIN_HEIGHT) {
      return;
    }
    this.setState({ height });
    Actions.updateChatPanelHeight(height);
  };

  render() {
    return (
      <div
        className="chat-view-container chat-left-panel-container"
        style={{
          minHeight: MIN_HEIGHT + 'px',
          height: this.state.height + 'px',
          bottom: BOTTOM_OFFSET + 'px',
        }}
      >
        <div className="left-panel">
          <ChatViewLeftResizeBar onResize={this.onResize} />
          <ConversationsPanel />
        </div>
      </div>
    );
  }
}
