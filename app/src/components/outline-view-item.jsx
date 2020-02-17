/* eslint global-require:0 */
/* eslint jsx-a11y/tabindex-no-positive:0 */

import _ from 'underscore';
import { Utils, AccountStore } from 'mailspring-exports';
import classnames from 'classnames';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import DisclosureTriangle from './disclosure-triangle';
import DropZone from './drop-zone';
import RetinaImg from './retina-img';
import PropTypes from 'prop-types';
import { Divider, DIVIDER_KEY } from './outline-view';

/*
 * Enum for counter styles
 * @readonly
 * @enum {string}
 */
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
    item: PropTypes.shape({
      className: PropTypes.string,
      id: PropTypes.string.isRequired,
      children: PropTypes.array,
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
      bgColor: PropTypes.string,
      iconColor: PropTypes.string,
    }).isRequired,
  };

  static CounterStyles = CounterStyles;

  constructor(props) {
    super(props);
    this._expandTimeout = null;
    this.state = {
      isDropping: false,
      editing: props.item.editing || false,
    };
  }

  componentDidMount() {
    if (this._shouldShowContextMenu()) {
      ReactDOM.findDOMNode(this).addEventListener('contextmenu', this._onShowContextMenu);
    }
    this.setState({
      targetDiv: ReactDOM.findDOMNode(this.refs[`${this.props.item.id}-span`]),
    });
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    if (newProps.editing) {
      this.setState({ editing: newProps.editing });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    clearTimeout(this._expandTimeout);
    if (this._shouldShowContextMenu()) {
      ReactDOM.findDOMNode(this).removeEventListener('contextmenu', this._onShowContextMenu);
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

  _shouldShowContextMenu = () => {
    return this.props.item.onDelete != null || this.props.item.onEdited != null;
  };

  _shouldAcceptDrop = event => {
    return this._runCallback('shouldAcceptDrop', event);
  };

  _clearEditingState = event => {
    this.setState({ editing: false });
    this._runCallback('onInputCleared', event);
  };

  // Handlers

  _onDragStateChange = ({ isDropping }) => {
    this.setState({ isDropping });

    const { item } = this.props;
    if (isDropping === true && item.children.length > 0 && item.collapsed) {
      this._expandTimeout = setTimeout(this._onCollapseToggled, 650);
    } else if (isDropping === false && this._expandTimeout) {
      clearTimeout(this._expandTimeout);
      this._expandTimeout = null;
    }
  };

  _onDrop = event => {
    this._runCallback('onDrop', event);
  };

  _onCollapseToggled = () => {
    this._runCallback('onCollapseToggled');
  };

  _onClick = event => {
    event.preventDefault();
    this._runCallback('onSelect');
    if (this.props.item.selected) {
      if (!this.props.item.children.some(i => i.selected)) {
        this._onCollapseToggled();
      }
    }
  };

  _onDelete = () => {
    this._runCallback('onDelete');
  };

  _onEdited = value => {
    this._runCallback('onEdited', value);
  };

  _onEdit = () => {
    if (this.props.item.onEdited) {
      this.setState({ editing: true });
    }
  };

  _onInputFocus = event => {
    const input = event.target;
    input.selectionStart = input.selectionEnd = input.value.length;
  };

  _onInputBlur = event => {
    this._clearEditingState(event);
  };

  _onInputKeyDown = event => {
    if (event.key === 'Escape') {
      this._clearEditingState(event);
    }
    if (_.includes(['Enter', 'Return'], event.key)) {
      this._onEdited(event.target.value);
      this._clearEditingState(event);
    }
  };

  _onShowContextMenu = event => {
    event.stopPropagation();
    const item = this.props.item;
    const contextMenuLabel = item.contextMenuLabel || item.name;
    const { remote } = require('electron');
    const { Menu, MenuItem } = remote;
    const menu = new Menu();

    if (this.props.item.onEdited) {
      menu.append(
        new MenuItem({
          label: `Rename ${contextMenuLabel}`,
          click: this._onEdit,
        }),
      );
    }

    if (this.props.item.onDelete) {
      menu.append(
        new MenuItem({
          label: `Delete ${contextMenuLabel}`,
          click: this._onDelete,
        }),
      );
    }
    menu.popup({});
  };

  _formatNumber(num) {
    if (num > 99) {
      return <span className="count over-99">99</span>;
    }
    return <span className="count">{num}</span>;
    // return num && num.toString().replace(/(\d)(?=(?:\d{3})+$)/g, '$1,');
  }

  // Renderers
  _renderCount = (item = this.props.item) => {
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
    const styles = { width: 18, height: 18 };
    if (item.iconColor) {
      styles.backgroundColor = item.iconColor;
    } else if (item.bgColor) {
      styles.backgroundColor = item.bgColor;
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
          isIcon={true}
          style={styles}
          fallback={item.fallback || 'folder.svg'}
          mode={item.mode || RetinaImg.Mode.ContentIsMask}
        />
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
        <input
          autoFocus
          type="text"
          tabIndex="1"
          className="item-input"
          placeholder={placeholder}
          defaultValue={item.name}
          onBlur={this._onInputBlur}
          onFocus={this._onInputFocus}
          onKeyDown={this._onInputKeyDown}
        />
      );
    }
    return (
      <div className="name" title={item.displayName ? item.displayName : item.name}>
        {item.displayName ? item.displayName : item.name}
      </div>
    );
  }

  _renderItem(item = this.props.item, state = this.state) {
    const containerClass = classnames({
      item: true,
      selected: item.selected,
      editing: state.editing,
      [item.className]: item.className,
    });

    return (
      <DropZone
        id={item.id}
        className={containerClass}
        onDrop={this._onDrop}
        onClick={this._onClick}
        onDoubleClick={this._onEdit}
        shouldAcceptDrop={this._shouldAcceptDrop}
        onDragStateChange={this._onDragStateChange}
      >
        {this._renderCount()}
        {this._renderIcon()}
        {this._renderItemContent()}
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
          {item.children.map((child, idx) => <OutlineViewItem key={child.id === DIVIDER_KEY ? idx : child.id} provider={acc.provider} index={idx} item={child} />)}
        </section>
      );
    }
    return <span />;
  }

  render() {
    const item = this.props.item;

    if (item.id && item.id === DIVIDER_KEY) {
      return (
        <Divider key={this.props.index || 100} />
      );
    }

    const containerClasses = classnames({
      'item-container': true,
      selected: item.selected,
      dropping: this.state.isDropping,
    });
    return (
      <div className={item.classnames ? item.classnames : null}>
        <span className={containerClasses} ref={`${item.id}-span`}>
          {this._renderItem()}
          <DisclosureTriangle
            collapsed={item.collapsed}
            visible={item.children && item.children.length > 0}
            onCollapseToggled={this._onCollapseToggled}
          />
        </span>
        {this._renderChildren()}
      </div>
    );
  }
}

export default OutlineViewItem;