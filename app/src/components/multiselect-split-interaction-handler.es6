/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ThreadStore } = require('mailspring-exports');
module.exports = class MultiselectSplitInteractionHandler {
  constructor(props) {
    this.props = props;
    this.onFocusItem = props.onFocusItem;
    this.onSetCursorPosition = props.onSetCursorPosition;
  }

  cssClass() {
    return 'handler-split';
  }

  shouldShowFocus() {
    return true;
  }

  shouldShowCheckmarks() {
    return false;
  }

  shouldShowKeyboardCursor() {
    return this.props.dataSource.selection.count() > 1;
  }

  onClick = item => {
    const noneSelected = this.props.dataSource.selection.ids();
    if (noneSelected) {
      this.props.onSetCursorPosition(item);
    }
    if (!item.draft) {
      ThreadStore.addRecent(item.id);
    }
    this.onFocusItem(item);
    // this.props.dataSource.selection.clear();
    // this._checkSelectionAndFocusConsistency();
  };

  onMetaClick = item => {
    this.onCheckMarkClick(item);
  };
  onCheckMarkClick = item => {
    let selectedIds = this.props.dataSource.selection.ids();
    const selected = selectedIds.includes(item.id);
    if (item.id === this.props.focusedId && !selected) {
      this.props.dataSource.selection.add(item);
      this.onFocusItem(item);
    } else {
      this.props.dataSource.selection.toggle(item);
      if (selected) {
        this.props.dataSource.selection.remove([item]);
      } else {
        this.onFocusItem(item);
      }
    }
    // selectedIds = this.props.dataSource.selection.ids();
    // if (
    //   Array.isArray(selectedIds) &&
    //   selectedIds.includes(this.props.focusedId) &&
    //   selectedIds.length > 1
    // ) {
    //   this.onFocusItem(null);
    // }
    // this._ifMoreThanOneSelectionUnfocus();
  };

  onShiftClick = item => {
    // this.props.dataSource.selection.clear();
    // this._addFocusIntoSelection();
    if (!this.props.focused) {
      this.onFocusItem(item);
    }
    this.props.dataSource.selection.expandTo(item);
  };

  onEnter = () => {};
  // This concept does not exist in split mode

  onDeselect = () => {
    const selectedIds = this.props.dataSource.selection.ids();
    const { focused } = this.props;
    this.props.dataSource.selection.clear();
    if (focused && selectedIds.includes(focused.id)) {
      this.onFocusItem(null);
    }
  };

  onSelect = (items, autoSelectFocus = true) => {
    this.props.dataSource.selection.set(items);
    if (autoSelectFocus) {
      const selectedIds = this.props.dataSource.selection.ids();
      const { focused } = this.props;
      if (focused && !selectedIds.includes(focused.id)) {
        this.props.dataSource.selection.add(focused);
      }
    }
  };

  onSelectKeyboardItem = () => {
    const { focused } = this.props;
    if (focused) {
      this.props.dataSource.selection.toggle(focused);
    }
  };

  onShift = (delta, options) => {
    if (options.select) {
      this._addFocusIntoSelection();
    }

    let action, id;
    if (this.props.dataSource.selection.count() > 0 && options.select) {
      const keyboardId = this.props.keyboardCursorId;
      id = keyboardId != null ? keyboardId : this.props.dataSource.selection.top().id;
      action = this.onSetCursorPosition;
    } else {
      id = this.props.focusedId;
      action = this.onFocusItem;
    }

    const current = this.props.dataSource.getById(id);
    let index = this.props.dataSource.indexOfId(id);
    index = Math.max(0, Math.min(index + delta, this.props.dataSource.count() - 1));
    const next = this.props.dataSource.get(index);

    action(next);
    if (options.select) {
      this.props.dataSource.selection.walk({ current, next });
    }
  };

  _addFocusIntoSelection() {
    const { focused } = this.props;
    // this.onFocusItem(null);
    this.props.dataSource.selection.add(focused);
  }

  _ifMoreThanOneSelectionUnfocus() {
    const { focused } = this.props;
    const { selection } = this.props.dataSource;
    if (focused && selection.count() > 1) {
      this.onFocusItem(null);
    }
  }

  // _checkSelectionAndFocusConsistency() {
  //   const { focused } = this.props;
  //   const { selection } = this.props.dataSource;
  //
  //   if (focused && selection.count() > 0) {
  //     console.log('focus, with selection');
  //     this.props.dataSource.selection.add(focused);
  //     this.onFocusItem(null);
  //   }
  //
  //   // if (selection.count() === 1 && !focused) {
  //   //   console.log('selection = 1 && no focuse')
  //   //   this.onFocusItem(selection.items()[0]);
  //   //   // this.props.dataSource.selection.clear();
  //   // }
  // }
};
