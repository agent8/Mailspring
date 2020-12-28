import { Utils } from 'mailspring-exports';
import React, { Component } from 'react';
import RetinaImg from './retina-img';
import OutlineViewItem from './outline-view-item';
import PropTypes from 'prop-types';
import Actions from '../flux/actions';

/*
 * Renders a section that contains a list of {@link OutlineViewItem}s. These items can
 * be arbitrarily nested. See docs for {@link OutlineViewItem}.
 * An OutlineView behaves like a controlled React component, with callbacks for
 * collapsing and creating items, and respective props for their value. Is it up
 * to the parent component to determine the state of the OutlineView.
 *
 * This component resembles OS X's default OutlineView or Sourcelist
 *
 * OutlineView supports:
 * - Collapsing and uncollapsing
 * - Adding new items to the outline view
 *
 * @param {object} props - props for OutlineView
 * @param {string} props.title - Title to display
 * @param {string} props.iconName - Icon name to use when displaying input to
 * add a new item. See {@link RetinaImg} for further reference.
 * @param {array} props.items - Array of strings or numbers to display as {@link
 * OutlineViewItem}s
 * @param {boolean} props.collapsed - Whether the OutlineView is collapsed or
 * not
 * @param {props.onItemCreated} props.onItemCreated
 * @param {props.onCollapseToggled} props.onCollapseToggled
 * @class OutlineView
 */
class OutlineView extends Component {
  static displayName = 'OutlineView';

  /*
   * If provided, this function will be called when an item has been created.
   * @callback props.onItemCreated
   * @param {string} value - The value for the created item
   */
  /*
   * If provided, this function will be called when the user clicks the action
   * to collapse or uncollapse the OutlineView
   * @callback props.onCollapseToggled
   * @param {object} props - The entire props object for this OutlineView
   */
  static propTypes = {
    title: PropTypes.string,
    iconName: PropTypes.string,
    items: PropTypes.array,
    isEditingMenu: PropTypes.bool,
    collapsed: PropTypes.bool,
    onItemCreated: PropTypes.func,
    onCollapseToggled: PropTypes.func,
  };

  static defaultProps = {
    title: '',
    items: [],
  };

  state = {
    showCreateInput: false,
  };

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    clearTimeout(this._expandTimeout);
  }

  // Handlers

  _onCreateButtonMouseDown = () => {
    this._clickingCreateButton = true;
  };

  _onCreateButtonClicked = () => {
    this._clickingCreateButton = false;
    this.setState({ showCreateInput: !this.state.showCreateInput });
  };

  _onCollapseToggled = () => {
    if (this.props.onCollapseToggled) {
      this.props.onCollapseToggled(this.props);
    }
  };

  _onDragStateChange = ({ isDropping }) => {
    if (this.props.collapsed && !this._expandTimeout && isDropping) {
      this._expandTimeout = setTimeout(this._onCollapseToggled, 650);
    } else if (this._expandTimeout && !isDropping) {
      clearTimeout(this._expandTimeout);
      this._expandTimeout = null;
    }
  };

  _onItemCreated = (item, value) => {
    this.setState({ showCreateInput: false });
    this.props.onItemCreated(value);
  };

  _onCreateInputCleared = () => {
    if (!this._clickingCreateButton) {
      this.setState({ showCreateInput: false });
    }
  };
  // Renderers

  _renderCreateInput(props = this.props) {
    const item = {
      id: `add-item-${props.title}`,
      name: '',
      children: [],
      editing: true,
      iconName: props.iconName,
      onEdited: this._onItemCreated,
      inputPlaceholder: 'Create new item',
      onInputCleared: this._onCreateInputCleared,
    };
    return <OutlineViewItem item={item} />;
  }

  _renderCreateButton() {
    return (
      <span
        className="add-item-button"
        onMouseDown={this._onCreateButtonMouseDown}
        onMouseUp={this._onCreateButtonClicked}
      >
        <RetinaImg
          url="edisonmail://account-sidebar/assets/icon-sidebar-addcategory@2x.png"
          style={{ height: 15, width: 14 }}
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </span>
    );
  }

  _renderItems() {
    const ret = [];
    this.props.items.forEach((item, idx) => {
      if (!this.props.isEditingMenu && item.isHidden) {
        return;
      }
      if (item.name) {
        ret.push(
          <OutlineViewItem
            key={item.id}
            item={item}
            index={idx}
            isEditingMenu={this.props.isEditingMenu}
          />
        );
      } else if (item.id === ADD_FOLDER_KEY && this.props.isEditingMenu) {
        ret.push(AddFolder(item.onRequestAddFolder));
        ret.push(Divider(idx + 1));
      } else {
        if (ret.length > 0) {
          if (ret[ret.length - 1] && isNaN(ret[ret.length - 1].key)) {
            ret.push(Divider(idx));
          }
        }
      }
    });
    if (ret.length === 0) {
      ret.push(EditMenu());
      ret.push(Divider(1));
    }
    return ret;
  }

  _renderOutline(allowCreate, collapsed) {
    if (collapsed) {
      return <span />;
    }

    const showInput = allowCreate && this.state.showCreateInput;
    return (
      <div>
        {showInput ? this._renderCreateInput() : null}
        {this._renderItems()}
      </div>
    );
  }

  render() {
    const collapsed = this.props.collapsed;
    const allowCreate = this.props.onItemCreated != null && !collapsed;
    const avatarClass = AppEnv.config.get('core.appearance.sidebaricons') ? '' : 'name-only';

    return (
      <section className={`nylas-outline-view ${avatarClass}`}>
        {this._renderOutline(allowCreate, collapsed)}
      </section>
    );
  }
}

export const DIVIDER_KEY = 'divider';
export const ADD_FOLDER_KEY = 'addFolder';
export const NEW_FOLDER_KEY = 'newFolder';
export const MORE_TOGGLE = 'moreToggle';
export const Divider = key => {
  return <div key={key} className="sidebar-divider" />;
};
const EditMenu = () => {
  const onClick = e => {
    e.stopPropagation();
    e.preventDefault();
    Actions.setEditingMenu(true);
  };
  return (
    <div key="addFolder" className="item-container item name inEditMode" onClick={onClick}>
      <span className="sidebar-add-folder">Edit Menu</span>
    </div>
  );
};
export const AddFolder = onAddFolder => {
  const onClick = e => {
    e.stopPropagation();
    e.preventDefault();
    onAddFolder();
  };
  return (
    <div key="addFolder" className="item-container item name inEditMode" onClick={onClick}>
      <span className="sidebar-add-folder">New Folder...</span>
    </div>
  );
};

export default OutlineView;
