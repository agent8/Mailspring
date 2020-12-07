import React from 'react';
import PropTypes from 'prop-types';
import Actions from '../flux/actions';
import Menu from './menu';

class ContextMenuPopover extends React.Component {
  static propTypes = {
    menuItems: PropTypes.array,
    menuContentKey: PropTypes.string,
  };
  constructor(props) {
    super(props);
  }
  componentWillUnmount() {
    AppEnv.keymaps.resumeAllKeymaps();
  }

  _onItemClicked = item => {
    if (item.click) {
      item.click();
    }
    this._closePopover();
  };
  _closePopover = () => {
    Actions.closePopover();
  };
  render() {
    return (
      <div className="context-menu-popover-container">
        <Menu
          className="context-menu-popover"
          autoFocus={true}
          items={this.props.menuItems}
          itemKey={item => item.id || item[this.props.menuContentKey || 'label']}
          itemContent={item => item[this.props.menuContentKey || 'label']}
          onSelect={this._onItemClicked}
          onEscape={this._closePopover}
        />
      </div>
    );
  }
}

export default ContextMenuPopover;
