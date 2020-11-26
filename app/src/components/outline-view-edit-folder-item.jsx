import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import RetinaImg from './retina-img';

export default class OutlineViewEditFolderItem extends PureComponent {
  static displayName = 'OutlineViewEditFolderItem';
  static propTypes = {
    containerClassName: PropTypes.string,
    inputClassName: PropTypes.string,
    onFocus: PropTypes.func,
    onBlur: PropTypes.func,
    onKeyDown: PropTypes.func,
    onChange: PropTypes.func.isRequired,
    renderCloseIcon: PropTypes.bool,
    onCloseClicked: PropTypes.func,
    folderName: PropTypes.string,
    placeHolder: PropTypes.string,
  };
  static defaultProps = {
    containerClassName: '',
    inputClassName: '',
    folderName: '',
    placeHolder: '',
    renderCloseIcon: true,
    onCloseClicked: () => {},
  };
  constructor(props) {
    super(props);
  }
  _onInputBlur = event => {
    if (this.props.onBlur) {
      this.props.onBlur(event);
    }
  };
  _onChange = event => {
    if (this.props.onChange) {
      this.props.onChange(event.target.value);
    }
  };
  _onInputKeyDown = event => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(event);
    }
  };

  _renderInput() {
    return (
      <input
        autoFocus
        type="text"
        tabIndex="1"
        className={this.props.inputClassName}
        placeholder={this.props.placeHolder}
        value={this.props.folderName}
        onBlur={this._onInputBlur}
        onKeyDown={this._onInputKeyDown}
        onChange={this._onChange}
      />
    );
  }
  _renderCloseMark() {
    if (!this.props.renderCloseIcon) {
      return null;
    }
    return (
      <div onClick={this.props.onCloseClicked}>
        <RetinaImg
          name="close.svg"
          isIcon={true}
          style={{ width: 12, height: 12, fontSize: 12 }}
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
  render() {
    return (
      <div className={this.props.containerClassName}>
        {this._renderInput()}
        {this._renderCloseMark()}
      </div>
    );
  }
}
