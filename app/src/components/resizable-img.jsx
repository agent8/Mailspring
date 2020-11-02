import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';
import ResizableBox from './resizable-box';

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
    showMask: PropTypes.bool,
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

  render() {
    const { boxHeight, boxWidth, imgHeight, imgWidth } = this.state;
    const { lockAspectRatio, callback, disableOrientation, showMask } = this.props;
    const disableOrientationTmp =
      disableOrientation || (lockAspectRatio ? ['n', 's', 'w', 'e'] : []);

    const styles = { height: imgHeight, width: imgWidth };
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
        disabledDragPoints={disableOrientationTmp}
        showMask={showMask}
        lockAspectRatio={this.props.lockAspectRatio}
        height={boxHeight}
        width={boxWidth}
      >
        <img alt="" src={this.props.src} style={styles} />
      </ResizableBox>
    );
  }
}
