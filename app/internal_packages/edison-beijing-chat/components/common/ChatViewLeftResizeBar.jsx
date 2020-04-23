/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';

const ConfigKey = 'chatPanelHeight';
export default class ChatViewLeftResizeBar extends Component {
  onDragStart = e => {
    const startY = e.clientY;
    const leftPanel = document.querySelector('.chat-left-panel-container');
    const height = leftPanel.offsetHeight;

    const onMouseMove = e => {
      const distance = startY - e.clientY;
      const chatNewHeight = height + distance;
      if (this.props.onResize && typeof this.props.onResize === 'function') {
        this.props.onResize(chatNewHeight);
      }
    };
    window.onmousemove = onMouseMove;
    window.onmouseup = () => {
      window.onmousemove = null;
      window.onmouseup = null;
      AppEnv.config.set(ConfigKey, leftPanel.offsetHeight);
    };
  };

  resetHeight = () => {
    const chatPanelHeightSchema = AppEnv.config.getSchema(ConfigKey);
    if (chatPanelHeightSchema && typeof chatPanelHeightSchema.default === 'number') {
      if (this.props.onResize && typeof this.props.onResize === 'function') {
        this.props.onResize(chatPanelHeightSchema.default);
      }
    }
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
