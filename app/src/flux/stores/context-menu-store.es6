import React from 'react';
import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import Actions from '../actions';
import ContextMenuPopover from '../../components/context-menu-popover';

class ContextMenuStore extends MailspringStore {
  constructor() {
    super();
    this.listenTo(Actions.openContextMenu, this.openContextMenu);
    this.rect = { top: 0, left: 0 };
    this.menuItems = [];
    this.menuContextKey = 'label';
    this._openContextMenu = _.throttle(this._openPopover, 100, { leading: false });
  }
  openContextMenu = ({
    menuItems,
    mouseEvent = {},
    menuContentKey = 'label',
    iframeOffset = { x: 0, y: 0 },
  } = {}) => {
    this.rect = {
      top: mouseEvent.clientY + iframeOffset.y,
      left: mouseEvent.clientX + iframeOffset.x,
    };
    this.menuContextKey = menuContentKey;
    this.menuItems = menuItems;
    this._openContextMenu();
  };
  _openPopover = () => {
    Actions.openPopover(
      <ContextMenuPopover menuItems={this.menuItems} menuContentKey={this.menuContentKey} />,
      {
        popoverClassName: 'fixed-context-menu-popover-container',
        originRect: this.rect,
        direction: 'rightBottom',
        fallbackDirection: 'right',
        closeOnAppBlur: false,
        disablePointer: true,
      }
    );
  };
}
export default new ContextMenuStore();
