import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';
import ResizableBox from './resizable-box';
import ReactDOM from 'react-dom';

function formatHeightWidthToNum(val) {
  if (typeof val === 'number') {
    return val;
  } else if (typeof val === 'string') {
    const valTmp = Number(val.replace('px', ''));
    return valTmp ? valTmp : 0;
  }
  return 0;
}

export default class ResizableImg extends Component {
  static propTypes = {
    src: PropTypes.string.isRequired,
    style: PropTypes.object,
    callback: PropTypes.func,
    lockAspectRatio: PropTypes.bool,
    disableOrientation: PropTypes.arrayOf(PropTypes.string),
  };

  constructor(props) {
    super(props);

    this.state = {
      boxHeight: 0,
      boxWidth: 0,
      imgHeight: 0,
      imgWidth: 0,
      showMask: false,
    };
  }

  componentDidMount() {
    this._mounted = true;

    const { style, src } = this.props;
    if (style && style.height && style.width) {
      this.setState({
        boxHeight: formatHeightWidthToNum(style.height),
        imgHeight: formatHeightWidthToNum(style.height),
        boxWidth: formatHeightWidthToNum(style.width),
        imgWidth: formatHeightWidthToNum(style.width),
      });
      return;
    }
    const image = new Image();
    image.src = src;
    image.onload = () => {
      if (!this._mounted) {
        return;
      }
      this.setState({
        boxHeight: formatHeightWidthToNum(image.height),
        imgHeight: formatHeightWidthToNum(image.height),
        boxWidth: formatHeightWidthToNum(image.width),
        imgWidth: formatHeightWidthToNum(image.width),
      });
    };
  }

  componentWillUnmount() {
    this._mounted = false;
  }
  _onImgSelect = () => {
    if (!this._mounted) {
      return;
    }
    const state = { showMask: true };
    if (this._imgRef) {
      const el = ReactDOM.findDOMNode(this._imgRef);
      const rect = el.getBoundingClientRect();
      state.imgHeight = rect.height;
      state.imgWidth = rect.width;
      state.boxHeight = state.imgHeight;
      state.boxWidth = state.imgWidth;
    }
    this.setState(state);
  };
  _onImageDeselect = () => {
    if (!this._mounted) {
      return;
    }
    this.setState({ showMask: false });
  };

  render() {
    const { boxHeight, boxWidth, imgHeight, imgWidth, showMask } = this.state;
    const { lockAspectRatio, callback, disableOrientation } = this.props;
    const disableOrientationTmp =
      disableOrientation || (lockAspectRatio ? ['n', 's', 'w', 'e'] : []);

    const styles = {
      zIndex: 2,
      height: imgHeight > 0 ? imgHeight : 'auto',
      width: imgWidth > 0 ? imgWidth : 'auto',
    };
    if (this.props.style && this.props.style.verticalAlign) {
      styles.verticalAlign = this.props.style.verticalAlign;
    }
    return (
      <ResizableBox
        onResize={value => {
          if (!this._mounted) {
            return;
          }
          this.setState({
            boxHeight: value.height,
            boxWidth: value.width,
          });
        }}
        onResizeComplete={value => {
          if (!this._mounted) {
            return;
          }
          this.setState(
            {
              imgHeight: value.height,
              imgWidth: value.width,
              showMask: false,
            },
            () => {
              if (callback && typeof callback === 'function') {
                callback({
                  height: this.state.imgHeight,
                  width: this.state.imgWidth,
                });
              }
            }
          );
        }}
        onMaskClicked={this._onImageDeselect}
        disabledDragPoints={disableOrientationTmp}
        showMask={showMask}
        lockAspectRatio={this.props.lockAspectRatio}
        height={boxHeight}
        width={boxWidth}
      >
        <img
          alt=""
          ref={ref => (this._imgRef = ref)}
          src={this.props.src}
          style={styles}
          onClick={this._onImgSelect}
          onBlur={this._onImageDeselect}
        />
      </ResizableBox>
    );
  }
}
