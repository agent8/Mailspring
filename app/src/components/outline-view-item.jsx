/* eslint global-require:0 */

import _ from 'underscore';
import { Utils, AccountStore, Actions } from 'mailspring-exports';
import classnames from 'classnames';
import React, { Component } from 'react';
import DisclosureTriangle from './disclosure-triangle';
import DropZone from './drop-zone';
import RetinaImg from './retina-img';
import PropTypes from 'prop-types';
import { Divider, DIVIDER_KEY, MORE_TOGGLE, ADD_FOLDER_KEY, NEW_FOLDER_KEY } from './outline-view';
import OutlineViewEditFolderItem from './outline-view-edit-folder-item';
import { DROP_DATA_TYPE } from '../constant';
import BindGlobalCommands from './bind-global-commands';
/*
 * Enum for counter styles
 * @readonly
 * @enum {string}
 */
const notFolderIds = [DIVIDER_KEY, MORE_TOGGLE, ADD_FOLDER_KEY, NEW_FOLDER_KEY];
const CounterStyles = {
  Default: 'def',
  Alt: 'alt',
  Critical: 'critical',
};

/*
 * Renders an item that may contain more arbitrarily nested items
 * This component resembles OS X's default OutlineView or Sourcelist
 *
 * An OutlineViewItem behaves like a controlled React component; it controls no
 * state internally. All of the desired state must be passed in through props.
 *
 *
 * OutlineView handles:
 * - Collapsing and uncollapsing
 * - Editing value for item
 * - Deleting item
 * - Selecting the item
 * - Displaying an associated count
 * - Dropping elements
 *
 * @param {object} props - props for OutlineViewItem
 * @param {object} props.item - props for OutlineViewItem
 * @param {string} props.item.id - Unique id for the item.
 * @param {string} props.item.name - Name to display
 * @param {string} props.item.contextMenuLabel - Label to be displayed in context menu
 * @param {string} props.item.className - Extra classes to add to the item
 * @param {string} props.item.iconName - Icon name for icon. See {@link RetinaImg} for further reference.
 * @param {array} props.item.children - Array of children of the same type to be
 * displayed.
 * @param {number} props.item.count - Count to display. If falsy, wont display a
 * count.
 * @param {CounterStyles} props.item.counterStyle - One of the possible
 * CounterStyles
 * @param {string} props.item.inputPlaceholder - Placehodler to use when editing
 * item
 * @param {boolean} props.item.collapsed - Whether the OutlineViewItem is collapsed or
 * not
 * @param {boolean} props.item.editing - Whether the OutlineViewItem is being
 * edited
 * @param {boolean} props.item.selected - Whether the OutlineViewItem is selected
 * @param {props.item.shouldAcceptDrop} props.item.shouldAcceptDrop
 * @param {props.item.onCollapseToggled} props.item.onCollapseToggled
 * @param {props.item.onInputCleared} props.item.onInputCleared
 * @param {props.item.onDrop} props.item.onDrop
 * @param {props.item.onSelect} props.item.onSelect
 * @param {props.item.onDelete} props.item.onDelete
 * @param {props.item.onEdited} props.item.onEdited
 * @class OutlineViewItem
 */
class OutlineViewItem extends Component {
  static displayName = 'OutlineViewItem';

  /*
   * If provided, this function will be called when receiving a drop. It must
   * return true if it should accept it or false otherwise.
   * @callback props.item.shouldAcceptDrop
   * @param {object} item - The current item
   * @param {object} event - The drag event
   * @return {boolean}
   */
  /*
   * If provided, this function will be called when the action to collapse or
   * uncollapse the OutlineViewItem is executed.
   * @callback props.item.onCollapseToggled
   * @param {object} item - The current item
   */
  /*
   * If provided, this function will be called when the editing input is cleared
   * via Esc key, blurring, or submiting the edit.
   * @callback props.item.onInputCleared
   * @param {object} item - The current item
   * @param {object} event - The associated event
   */
  /*
   * If provided, this function will be called when an element is dropped in the
   * item
   * @callback props.item.onDrop
   * @param {object} item - The current item
   * @param {object} event - The associated event
   */
  /*
   * If provided, this function will be called when the item is selected
   * @callback props.item.onSelect
   * @param {object} item - The current item
   */
  /*
   * If provided, this function will be called when the the delete action is
   * executed
   * @callback props.item.onDelete
   * @param {object} item - The current item
   */
  /*
   * If provided, this function will be called when the item is edited
   * @callback props.item.onEdited
   * @param {object} item - The current item
   * @param {string} value - The new value
   */
  static propTypes = {
    onToggleShowAllFolder: PropTypes.func,
    index: PropTypes.number,
    provider: PropTypes.string,
    item: PropTypes.shape({
      component: PropTypes.element,
      categoryMetaDataInfo: PropTypes.object,
      className: PropTypes.string,
      newFolderAccountId: PropTypes.string,
      id: PropTypes.string.isRequired,
      children: PropTypes.array,
      contextMenuLabel: PropTypes.string,
      name: PropTypes.string,
      iconName: PropTypes.string,
      count: PropTypes.number,
      counterStyle: PropTypes.string,
      inputPlaceholder: PropTypes.string,
      collapsed: PropTypes.bool,
      editing: PropTypes.bool,
      selected: PropTypes.bool,
      shouldAcceptDrop: PropTypes.func,
      onCollapseToggled: PropTypes.func,
      onInputCleared: PropTypes.func,
      onDrop: PropTypes.func,
      onSelect: PropTypes.func,
      onDelete: PropTypes.func,
      onEdited: PropTypes.func,
      onAllRead: PropTypes.func,
      onAddNewFolder: PropTypes.func,
      toggleHide: PropTypes.func,
      bgColor: PropTypes.string,
      iconColor: PropTypes.string,
      showAll: PropTypes.bool,
    }).isRequired,
    isEditingMenu: PropTypes.bool,
  };

  static CounterStyles = CounterStyles;

  constructor(props) {
    super(props);
    this._expandTimeout = null;
    this.state = {
      isDropping: false,
      isDragging: false,
      isHovering: false,
      editing: props.item.editing || false,
      originalText: '',
      showAllChildren: false,
      isCategoryDropping: false,
      editingFolderName: '',
      newFolderName: '',
      newFolderHidden: false,
      newFolderDisableHidden: true,
    };
    this._selfRef = null;
    this._setSelfRef = el => (this._selfRef = el);
    this._mounted = false;
  }
  checkCurrentShowAllChildren = props => {
    if (
      props.item &&
      Array.isArray(props.item.accountIds) &&
      this._mounted &&
      props.item.accountIds.length > 0 &&
      props.item.accountIds[0]
    ) {
      const accountId = props.item.accountIds[0];
      this.setState({
        showAllChildren: !AppEnv.savedState.sidebarKeysCollapsed[`${accountId}-single-moreToggle`],
      });
    }
  };

  componentDidMount() {
    this._mounted = true;
    if (this._selfRef) {
      this._selfRef.addEventListener('contextmenu', this._onShowContextMenu);
    }
    this.checkCurrentShowAllChildren(this.props);
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    if (newProps.editing) {
      this.setState({ editing: newProps.editing });
    }
    this.checkCurrentShowAllChildren(newProps);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this._expandTimeout);
    if (this._selfRef) {
      this._selfRef.removeEventListener('contextmenu', this._onShowContextMenu);
    }
  }

  // Helpers

  _runCallback = (method, ...args) => {
    const item = this.props.item;
    if (item[method]) {
      return item[method](item, ...args);
    }
    return undefined;
  };

  _shouldAcceptDrop = event => {
    return this._runCallback('shouldAcceptDrop', event);
  };

  _clearEditingState = event => {
    this.setState({ editing: false, originalText: '', editingFolderName: '' });
    this._runCallback('onInputCleared', event);
  };

  // Handlers

  _onDragStateChange = ({ isDropping, dataItems }) => {
    this.setState({ isDropping });
    if (dataItems) {
      for (let i = 0; i < dataItems.length; i++) {
        if (dataItems[i] && dataItems[i].type === DROP_DATA_TYPE.FOLDER_TREE_ITEM) {
          this.setState({ isCategoryDropping: isDropping });
          return;
        }
      }
    }
    const { item } = this.props;
    if (isDropping === true && item.children.length > 0 && item.collapsed) {
      this._expandTimeout = setTimeout(this._onCollapseToggled, 650);
    } else if (isDropping === false && this._expandTimeout) {
      clearTimeout(this._expandTimeout);
      this._expandTimeout = null;
    }
  };

  _onDrop = event => {
    this.setState({ isDropping: false, isCategoryDropping: false });
    this._runCallback('onDrop', event);
  };

  _onCollapseToggled = () => {
    this._runCallback('onCollapseToggled');
  };

  _onToggleShowAllFolder = showAll => {
    if (this._mounted) {
      if (this.props.item.id === 'moreToggle') {
        this._runCallback('onToggleMoreOrLess');
      } else {
        this.setState({ showAllChildren: showAll });
      }
      if (typeof this.props.onToggleShowAllFolder === 'function') {
        this.props.onToggleShowAllFolder(showAll);
      }
    }
  };

  _onClick = event => {
    event.preventDefault();
    if (this.props.isEditingMenu || this.state.editing) {
      return;
    }
    this._runCallback('onSelect');
    if (this.props.item.selected) {
      if (
        !this.props.item.children.some(i => i.selected && i.perspective && !i.perspective.isInbox())
      ) {
        this._onCollapseToggled();
      }
    }
  };

  _onDelete = () => {
    this._runCallback('onDelete');
  };
  _onAllRead = () => {
    this._runCallback('onAllRead');
  };

  _onEdited = (value, originalText) => {
    this._runCallback('onEdited', value, originalText);
  };
  _onAddNewFolder = () => {
    Actions.setEditingMenu(true);
    this._runCallback('onAddNewFolder');
  };

  _onEdit = () => {
    if (this.props.item.onEdited) {
      this.setState({
        editing: true,
        originalText: this.props.item.name,
        editingFolderName: this.props.item.name,
      });
    }
  };
  _onEditMenu = () => {
    Actions.setEditingMenu(true);
  };

  _onEditFolderInputFocus = event => {
    const input = event.target;
    input.selectionStart = input.selectionEnd = input.value.length;
  };

  _onEditFolderInputBlur = event => {
    if (this.state.originalText.length > 0 && event.target.value !== this.state.originalText) {
      const value = event.target.value;
      AppEnv.showMessageBox({
        title: 'Do you want save your edit?',
        buttons: ['Yes', 'No'],
        defaultId: 0,
      }).then(response => {
        if (response && response.response === 0) {
          this._onEdited(value, this.state.originalText);
        }
        this._clearEditingState();
      });
      return;
    }
    this._clearEditingState(event);
  };

  _onEditFolderInputKeyDown = event => {
    if (event.key === 'Escape') {
      this._clearEditingState(event);
    }
    if (_.includes(['Enter', 'Return'], event.key)) {
      this._onEdited(event.target.value, this.state.originalText);
      this._clearEditingState(event);
    }
  };
  _onEditingFolderValueChange = folderName => {
    this.setState({ editingFolderName: folderName });
  };

  _onShowContextMenu = event => {
    event.stopPropagation();
    if (this.state.editing || this.props.isEditingMenu) {
      return;
    }
    const item = this.props.item;
    const contextMenuLabel = item.contextMenuLabel || item.name;
    const menu = [];

    if (this.props.item.onAddNewFolder) {
      const commands = (AppEnv.keymaps.getBindingsForAllCommands() || {})['core:new-folder'];
      menu.push({
        label: `New Folder...`,
        click: this._onAddNewFolder,
        shortcutKey: commands.length > 0 ? commands[0] : '',
      });
    }
    if (this.props.item.onEdited) {
      menu.push({
        label: `Rename ${contextMenuLabel}`,
        click: this._onEdit,
      });
    }
    menu.push({ label: 'Edit Menu', click: this._onEditMenu });

    if (this.props.item.onDelete) {
      menu.push({
        label: `Delete ${contextMenuLabel}`,
        click: this._onDelete,
      });
    }
    if (this.props.item.onAllRead) {
      menu.push({
        label: 'Mark All as Read',
        click: this._onAllRead,
      });
    }
    if (menu.length > 0) {
      Actions.openContextMenu({ menuItems: menu, mouseEvent: event, disableAutoFocus: false });
    }
  };
  _onDropZoneMouseDown = event => {
    if (this._mounted && this.props.isEditingMenu) {
      this.setState({ isDragging: true });
    }
  };
  _onDropZoneMouseUp = event => {
    if (this._mounted) {
      this.setState({ isDragging: false });
    }
  };

  _onDragStart = event => {
    if (!this.props.item || !this.props.isEditingMenu) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    event.dataTransfer.setData(
      DROP_DATA_TYPE.FOLDER_TREE_ITEM,
      JSON.stringify(this.props.item.categoryMetaDataInfo)
    );
  };
  _onDragEnter = event => {
    if (event.dataTransfer.types.includes(DROP_DATA_TYPE.FOLDER_TREE_ITEM)) {
      const categoryData = event.dataTransfer.getData(DROP_DATA_TYPE.FOLDER_TREE_ITEM);
      try {
        const dragItem = JSON.parse(categoryData);
        this.setState({ isCategoryDropping: true, droppingItem: dragItem });
      } catch (e) {
        console.warn(e);
        console.warn(categoryData);
      }
    }
  };
  _onDragLeave = () => {
    this.setState({ isCategoryDropping: false, droppingItem: null });
  };
  _updateNewFolderData = (accountId, onEdited) => {
    if (onEdited) {
      onEdited({
        accountId,
        newFolderName: this.state.newFolderName,
        isHiddenInFolderTree: this.state.newFolderIsHidden,
      });
    }
  };
  _onNewFolderNameChange = (accountId, onEdited, folderName) => {
    this.setState(
      { newFolderName: folderName, newFolderDisableHidden: folderName.length === 0 },
      this._updateNewFolderData.bind(this, accountId, onEdited)
    );
  };
  _onNewFolderKeyDown = ({ onSave, onCancel }, event) => {
    if (event.key === 'Escape') {
      this.setState({ newFolderName: '', newFolderIsHidden: false, newFolderDisableHidden: true });
      if (onCancel) {
        onCancel();
      }
      return;
    }
    if (['Enter', 'Return'].includes(event.key)) {
      if (onSave) {
        onSave();
      }
      this.setState({ newFolderName: '', newFolderIsHidden: false, newFolderDisableHidden: true });
    }
  };
  _onEntireItemMouseEnter = () => {
    this.setState({ isHovering: true });
  };
  _onEntireItemMouseLeave = () => {
    this.setState({ isHovering: false });
  };
  _onNewFolderCommand = () => {
    if (!this.state.isHovering || this.props.isEditingMenu) {
      return;
    }
    this._onAddNewFolder();
  };

  _formatNumber(num) {
    if (num > 99) {
      return <span className="count over-99">99</span>;
    }
    return <span className="count">{num}</span>;
  }

  // Renderers
  _renderCount = (item = this.props.item) => {
    if (this.props.isEditingMenu) {
      return null;
    }
    if (!item.count || item.iconName === 'sent.svg') {
      return <span />;
    }
    const className = classnames({
      'item-count-box': true,
      'alt-count': item.counterStyle === CounterStyles.Alt,
      'critical-count': item.counterStyle === CounterStyles.Critical,
    });
    return <div className={className}>{this._formatNumber(item.count)}</div>;
  };

  _renderIcon(item = this.props.item) {
    if (this.props.isEditingMenu) {
      return null;
    }
    const styles = { width: 18, height: 18, fontSize: 18 };
    let color;
    if (item.iconColor) {
      color = item.iconColor;
    } else if (item.bgColor) {
      color = item.bgColor;
    }

    if (color && item.url) {
      styles.backgroundColor = color;
    } else if (color && !item.url) {
      styles.color = color;
    }

    if (item.iconStyles) {
      Object.assign(styles, item.iconStyles);
    }
    let classNames = item.className || '';
    return (
      <div className={`icon ${classNames}`}>
        <RetinaImg
          url={item.url}
          name={item.iconName}
          isIcon={!item.url}
          style={styles}
          fallback={item.fallback || 'folder.svg'}
          mode={item.mode || RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
  _toggleNewFolderItemHide = ({ accountId, onEdited }) => {
    if (this.state.newFolderDisableHidden) {
      return;
    }
    this.setState(
      { newFolderIsHidden: !this.state.newFolderIsHidden },
      this._updateNewFolderData.bind(this, accountId, onEdited)
    );
  };
  _onCancelNewFolder = () => {
    Actions.setEditingMenu(false);
  };
  _renderNewFolderCheckmark({ accountId, onEdited }) {
    const className = `checkmark ${!this.state.newFolderIsHidden ? 'checked' : ''} ${
      this.state.newFolderDisableHidden ? ' disabled ' : ''
    }`;
    return (
      <div
        className={className}
        onClick={this._toggleNewFolderItemHide.bind(this, { accountId, onEdited })}
      >
        <div className="inner" />
      </div>
    );
  }
  _renderNewFolderInput({ accountId, onEdited, onSave, onCancel }) {
    return (
      <div>
        <span className="item-container selected">
          {this._renderNewFolderCheckmark({ accountId, onEdited })}
          <OutlineViewEditFolderItem
            containerClassName="item inEditMode selected new-folder-edit"
            inputClassName="item-input"
            placeholder="Untitled Folder"
            folderName={this.state.newFolderName}
            onCloseClicked={this._onCancelNewFolder}
            onChange={this._onNewFolderNameChange.bind(this, accountId, onEdited)}
            onKeyDown={this._onNewFolderKeyDown.bind(this, {
              accountId,
              onEdited,
              onSave,
              onCancel,
            })}
          />
        </span>
      </div>
    );
  }

  _renderItemContent(item = this.props.item, state = this.state) {
    if (this.props.provider === 'aol' && item.name === 'Bulk Mail') {
      item.displayName = item.name = 'Spam';
    }
    if (state.editing) {
      const placeholder = item.inputPlaceholder || '';
      return (
        <OutlineViewEditFolderItem
          containerClassName="edit-folder-container"
          inputClassName="item-input"
          placeholder={placeholder}
          renderCloseIcon={false}
          folderName={this.state.editingFolderName}
          onBlur={this._onEditFolderInputBlur}
          onFocus={this._onEditFolderInputFocus}
          onKeyDown={this._onEditFolderInputKeyDown}
          onChange={this._onEditingFolderValueChange}
        />
      );
    }
    return (
      <div className="name" title={item.displayName ? item.displayName : item.name}>
        {item.displayName ? item.displayName : item.name}
      </div>
    );
  }
  _toggleItemHide = () => {
    if (this.props.item) {
      this.props.item.toggleHide(this.props.item);
    }
  };
  _renderCheckmark(item) {
    if (!item) {
      item = this.props.item;
    }
    if (!this.props.isEditingMenu) {
      return null;
    }
    const className = `checkmark ${!item.isHidden ? 'checked' : ''}`;
    return (
      <div className={className} onClick={this._toggleItemHide}>
        <div className="inner" />
      </div>
    );
  }
  _renderDrag() {
    if (!this.props.isEditingMenu) {
      return null;
    }
    return (
      <div className={`icon icon-drag`}>
        <RetinaImg
          name={'drag-handle.svg'}
          isIcon={true}
          style={{ width: 18, height: 18, fontSize: 18, position: 'relative', left: 10 }}
          fallback={'folder.svg'}
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
  _renderMoreOrLess() {
    const text = this.props.item.showAll ? 'more' : 'less';
    return (
      <div
        onClick={this._onToggleShowAllFolder.bind(this, this.props.item.showAll)}
        ref={this._setSelfRef}
        key={`moreOrLess-${text}`}
      >
        <span className="item-container">
          <div className="item more-or-less-item">
            <div className="name more-or-less">{text}</div>
            <DisclosureTriangle
              className={'more-or-less-triangle'}
              collapsed={this.props.item.collapsed}
              iconName={'down-arrow.svg'}
              isIcon={true}
              visible={true}
              onCollapseToggled={this._onToggleShowAllFolder.bind(this, this.props.item.showAll)}
            />
          </div>
        </span>
      </div>
    );
  }

  _renderItem(item = this.props.item, state = this.state) {
    const containerClass = classnames({
      item: true,
      selected: item.selected,
      editing: state.editing,
      inEditMode: this.props.isEditingMenu,
      [item.className]: item.className,
    });

    return (
      <DropZone
        id={item.id}
        className={containerClass}
        draggable={true}
        onDrop={this._onDrop}
        onDragStart={this._onDragStart}
        onDragEnter={this._onDragEnter}
        onClick={this._onClick}
        onDoubleClick={this._onEdit}
        shouldAcceptDrop={this._shouldAcceptDrop}
        onDragStateChange={this._onDragStateChange}
        onMouseDown={this._onDropZoneMouseDown}
        onMouseUp={this._onDropZoneMouseUp}
        onMouseOut={this._onDropZoneMouseUp}
      >
        {this._renderCount()}
        {this._renderIcon()}
        {this._renderItemContent()}
        {this._renderDrag()}
      </DropZone>
    );
  }

  _renderChildren(item = this.props.item) {
    let acc = {};
    if (item.accountIds && item.accountIds.length === 1) {
      acc = AccountStore.accountForId(item.accountIds[0]);
    }
    if (item.children.length > 0 && !item.collapsed) {
      return (
        <section className="item-children" key={`${item.id}-children`}>
          {item.children.map((child, idx) => {
            if (this.props.isEditingMenu && child.id === NEW_FOLDER_KEY) {
              return this._renderNewFolderInput({
                accountId: child.newFolderAccountId,
                onEdited: child.onEdited,
                onSave: child.onSave,
                onCancel: child.onCancel,
              });
            }
            if (child.id === MORE_TOGGLE && child.showAll === this.state.showAllChildren) {
              return null;
            }
            if (
              (this.state.showAllChildren || !child.hideWhenCrowded) &&
              (this.props.isEditingMenu || !child.isHidden)
            ) {
              return (
                <OutlineViewItem
                  key={notFolderIds.includes(child.id) ? idx : child.id}
                  provider={acc.provider}
                  isEditingMenu={this.props.isEditingMenu}
                  index={idx}
                  item={child}
                  onToggleShowAllFolder={this._onToggleShowAllFolder}
                />
              );
            }
            return null;
          })}
        </section>
      );
    }
    return <span />;
  }

  render() {
    const item = this.props.item;
    if (item.id && item.id === DIVIDER_KEY) {
      return Divider(this.props.index || 100);
    }

    const containerClasses = classnames({
      'item-container': true,
      selected: item.selected,
      dropping: this.state.isDropping,
      inEditMode: this.props.isEditingMenu,
      isDragging: this.state.isDragging,
    });
    if (item.component) {
      return <item.component />;
    }

    if (item.id && item.id === MORE_TOGGLE) {
      return this._renderMoreOrLess();
    }
    const commands = {};
    if (this.props.item && this.props.item.onAddNewFolder) {
      commands['core:new-folder'] = this._onNewFolderCommand;
    }
    return (
      <BindGlobalCommands commands={commands}>
        <div
          className={item.className ? item.className : null}
          ref={this._setSelfRef}
          onMouseEnter={this._onEntireItemMouseEnter}
          onMouseLeave={this._onEntireItemMouseLeave}
        >
          <span className={containerClasses}>
            {this._renderCheckmark()}
            {this._renderItem()}
            <DisclosureTriangle
              collapsed={item.collapsed}
              visible={this.props.isEditingMenu && item.children && item.children.length > 0}
              visibleOnHover={!this.state.editing && item.children && item.children.length > 0}
              onCollapseToggled={this._onCollapseToggled}
            />
          </span>
          {this._renderChildren()}
        </div>
      </BindGlobalCommands>
    );
  }
}

export default OutlineViewItem;
