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
    this.menuItems = menuItems;
    this._disableAutoFocus = disableAutoFocus;
    this._onCloseCallBack = onClose;
    this._openContextMenu();
  };
  _onClose = () => {
    if (this._onCloseCallBack) {
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
      }
    );
  };
}
export default new ContextMenuStore();
