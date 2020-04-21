/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import { Actions } from 'mailspring-exports';
import { MIN_HEIGHT } from '../../lib/chat-view-left';
export default class ChatViewLeftResizeBar extends Component {
  componentDidMount() {
    const h = AppEnv.config.get(`chatPanelHeight`);
    // bug fix: the height calculation goes wrong if not wait some time
    setTimeout(() => {
      this.calcPanel(h);
    }, 500);
  }

  onDragStart(e) {
    const startY = e.clientY;
    const leftPanel = document.querySelector('.chat-left-panel-container');
    const height = leftPanel.offsetHeight;
    let distance = 0;
    const accSidebar = document.querySelector('.account-sidebar');
    const sidebarPanelHeight = accSidebar.parentNode.offsetHeight;
    const onMouseMove = e => {
      distance = startY - e.clientY;
      const sidebarNewHeight = sidebarPanelHeight - distance;
      if (sidebarNewHeight < 10) {
        return;
      }
      const chatNewHeight = height + distance;
      if (chatNewHeight < MIN_HEIGHT) {
        return;
      }
      leftPanel.style.height = chatNewHeight + 'px';
      Actions.updateChatPanelHeight(height + distance);
    };
    window.onmousemove = onMouseMove;
    window.onmouseup = () => {
      window.onmousemove = null;
      window.onmouseup = null;
      AppEnv.config.set(`chatPanelHeight`, leftPanel.offsetHeight);
    };
  }

  calcPanel(h) {
    const leftPanel = document.querySelector('.chat-left-panel-container');
    // const { devMode } = AppEnv.getLoadSettings();
    // if (devMode) {
    //   leftPanel.style.bottom = '115px';
    // }

    const accSidebar = document.querySelector('.account-sidebar');
    if (accSidebar) {
      //   const sidebarPanelHeight = accSidebar.parentNode.offsetHeight;
      // accSidebar.style.height = sidebarPanelHeight - h - BOTTOM_OFFSET + 'px';
      leftPanel.style.height = h + 'px';
      Actions.updateChatPanelHeight(h);
    }

    // set panel width
    const columnEl = document.querySelector(`[data-column='0']`);
    if (columnEl) {
      if (leftPanel) {
        leftPanel.style.width = `${columnEl.offsetWidth - 1}px`;
        leftPanel.style.visibility = 'visible';
      }
      const notifications = document.querySelector('.notifications');
      if (notifications) {
        notifications.style.width = `${columnEl.offsetWidth - 1}px`;
      }
    }
  }

  resetHeight = () => {
    this.calcPanel(300);
  };

  render() {
    return (
      <div
        onDoubleClick={this.resetHeight}
        onMouseDown={this.onDragStart}
        className="resizeBar"
      ></div>
    );
  }
}
