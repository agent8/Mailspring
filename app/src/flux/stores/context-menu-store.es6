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
    this._disableAutoFocus = true;
    this._contextMenuOpen = false;
    this.menuContextKey = 'label';
    this._onCloseCallBack = null;
    this._openContextMenu = _.throttle(this._openPopover, 100, { leading: false });
  }
  openContextMenu = ({
    menuItems,
    mouseEvent = {},
    menuContentKey = 'label',
    iframeOffset = { x: 0, y: 0 },
    disableAutoFocus = true,
    onClose,
  } = {}) => {
    this.rect = {
      top: mouseEvent.clientY + iframeOffset.y,
      left: mouseEvent.clientX + iframeOffset.x,
    };
    this.menuContextKey = menuContentKey;
    this.menuItems = menuItems.filter((menuItem, index) => {
      if (!menuItem) {
        return false;
      } else if (menuItem && menuItem.type !== 'divider') {
        return true;
      } else if (menuItem && menuItem.type === 'divider') {
        if (index === 0 || index === menuItems.length - 1) {
          return false;
        } else if (menuItems[index + 1] && menuItems[index + 1].type === 'divider') {
          return false;
        }
        return true;
      }
      return true;
    });
    this._disableAutoFocus = disableAutoFocus;
    this._onCloseCallBack = onClose;
    this._openContextMenu();
  };
  isContextMenuOpen = () => {
    return this._contextMenuOpen;
  };
  _onClose = () => {
    this._contextMenuOpen = false;
    if (typeof this._onCloseCallBack === 'function') {
      this._onCloseCallBack();
    }
  };
  _openPopover = () => {
    Actions.openPopover(
      <ContextMenuPopover menuItems={this.menuItems} menuContentKey={this.menuContentKey} />,
      {
        popoverClassName: 'fixed-context-menu-popover-container',
        originRect: this.rect,
        direction: 'rightBottom',
        fallbackDirection: 'right',
        closeOnAppBlur: true,
        disablePointer: true,
        disableAutoFocus: this._disableAutoFocus,
        onClose: this._onClose,
      }
    );
    this._contextMenuOpen = true;
  };
}
export default new ContextMenuStore();
