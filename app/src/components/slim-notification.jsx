import React from 'react';
import PropTypes from 'prop-types';
import RetinaImg from './retina-img';
export default class SlimNotification extends React.Component {
  static propTypes = {
    description: PropTypes.string.isRequired,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onClose: PropTypes.func,
    actions: PropTypes.arrayOf(
      PropTypes.shape({ text: PropTypes.string.isRequired, callback: PropTypes.func })
    ),
    type: PropTypes.string,
  };
  constructor(props) {
    super(props);
  }
  _renderActions() {
    const actions = [];
    if (this.props.onClose) {
      actions.push(
        <RetinaImg
          name="close_1.svg"
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this.props.onClose}
        />
      );
    }
    if (Array.isArray(this.props.actions)) {
      this.props.actions.forEach(action => {
        if (action) {
          const text = action.text || '';
          const onClick = action.callback ? action.callback : () => {};
          actions.push(
            <div className="action-text" onClick={onClick}>
              {text}
            </div>
          );
        }
      });
    }
    return actions;
  }
  _onMouseEnter = () => {
    if (this.props.onMouseEnter) {
      this.props.onMouseEnter();
    }
  };
  _onMouseLeave = () => {
    if (this.props.onMouseLeave) {
      this.props.onMouseLeave();
    }
  };
  render() {
    const className = `slim-content ${this.props.type}`;
    return (
      <div
        className={className}
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}
      >
        <div className="message">{this.props.description}</div>
        <div className="action">{this._renderActions()}</div>
      </div>
    );
  }
}
