const RetinaImg = require('./retina-img').default;
const { React, PropTypes } = require('mailspring-exports');
const classnames = require('classnames');

class ButtonDropdown extends React.Component {
  static displayName = 'ButtonDropdown';
  static propTypes = {
    className: PropTypes.string,
    primaryTitle: PropTypes.string,
    primaryItem: PropTypes.element,
    primaryClick: PropTypes.func,
    bordered: PropTypes.bool,
    menu: PropTypes.element,
    style: PropTypes.object,
    closeOnMenuClick: PropTypes.bool,
    attachment: PropTypes.string,
    disabled: PropTypes.bool,
    disableDropdownArrow: PropTypes.bool,
  };

  static defaultProps = {
    style: {},
    attachment: 'left',
    disabled: false,
  };

  constructor(props) {
    super(props);
    this.state = { open: false };
    this._buttonRef = null;
    this._setButtonRef = el => (this._buttonRef = el);
  }

  render() {
    const classes = classnames({
      'button-dropdown': true,
      'open open-up': this.state.open === 'up',
      'open open-down': this.state.open === 'down',
      bordered: this.props.bordered !== false,
    });

    const menu = this.state.open ? this.props.menu : false;

    const style = {};
    if (this.state.open === 'up') {
      style.bottom = 0;
      style.top = 'auto';
    } else {
      style.top = 0;
      style.bottom = 'auto';
    }

    if (this.props.primaryClick) {
      return (
        <div
          ref={this._setButtonRef}
          onBlur={this._onBlur}
          tabIndex={-1}
          className={`${classes} ${this.props.className || ''}`}
          style={this.props.style}
        >
          <div
            className="primary-item"
            title={this.props.primaryTitle || ''}
            onClick={!this.props.disabled ? this.props.primaryClick : null}
          >
            {this.props.primaryItem}
          </div>
          <div className="secondary-picker" onClick={this.toggleDropdown}>
            <RetinaImg
              name={'more.svg'}
              isIcon
              style={{ width: 24, height: 24, fontSize: 24 }}
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
          <div className="secondary-items" onMouseDown={this._onMenuClick} style={style}>
            {menu}
          </div>
        </div>
      );
    } else {
      return (
        <div
          ref={this._setButtonRef}
          onBlur={this._onBlur}
          tabIndex={-1}
          className={`${classes} ${this.props.className || ''}`}
          style={this.props.style}
        >
          <div
            className="only-item"
            title={this.props.primaryTitle || ''}
            onClick={this.toggleDropdown}
          >
            {this.props.primaryItem}
            {this.props.disableDropdownArrow ? null : (
              <RetinaImg
                name={'arrow-dropdown.svg'}
                isIcon
                style={{
                  width: 24,
                  height: 24,
                  fontSize: 20,
                  lineHeight: '24px',
                  verticalAlign: 'middle',
                }}
                mode={RetinaImg.Mode.ContentIsMask}
              />
            )}
          </div>
          <div
            className={`secondary-items ${this.props.attachment}`}
            onMouseDown={this._onMenuClick}
            style={style}
          >
            {menu}
          </div>
        </div>
      );
    }
  }

  toggleDropdown = () => {
    if (this.state.open !== false) {
      this.setState({ open: false });
    } else if (!this.props.disabled) {
      const buttonBottom = this._buttonRef ? this._buttonRef.getBoundingClientRect().bottom : -200;
      if (buttonBottom + 200 > window.innerHeight) {
        this.setState({ open: 'up' });
      } else {
        this.setState({ open: 'down' });
      }
    }
  };

  _onMenuClick = () => {
    if (this.props.closeOnMenuClick) {
      this.setState({ open: false });
    }
  };

  _onBlur = event => {
    const target = event.nativeEvent.relatedTarget;
    if (target != null && this._buttonRef && this._buttonRef.contains(target)) {
      return;
    }
    this.setState({ open: false });
  };
}

module.exports = ButtonDropdown;
