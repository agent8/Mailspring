import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';
import ResizableBox from './resizable-box';

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
    };
  }

  componentDidMount() {
    const { style, src } = this.props;
    if (style && style.height && style.width) {
      this.setState({
        boxHeight: style.height,
        imgHeight: style.height,
        boxWidth: style.width,
        imgWidth: style.width,
      });
      return;
    }
    const image = new Image();
    image.src = src;
    image.onload = () => {
      this.setState({
        boxHeight: image.height,
        imgHeight: image.height,
        boxWidth: image.width,
        imgWidth: image.width,
      });
    };
  }

  _processingValue = value => {
    const { lockAspectRatio } = this.props;
    if (!lockAspectRatio) {
      return value;
    }
    if (value.x === 0 || value.y === 0) {
      return {
        x: 0,
        y: 0,
      };
    }
    const { imgHeight, imgWidth } = this.state;
    const newValue = {
      x: value.x,
      y: (imgHeight * value.x) / imgWidth,
    };
    return newValue;
  };

  render() {
    const { boxHeight, boxWidth, imgHeight, imgWidth } = this.state;
    const { lockAspectRatio, callback, disableOrientation } = this.props;
    const disableOrientationTmp =
      disableOrientation || (lockAspectRatio ? ['n', 's', 'w', 'e'] : []);

    return (
      <ResizableBox
        onResize={value => {
          const valueTemp = this._processingValue(value);
          this.setState({
            boxHeight: ~~imgHeight + ~~valueTemp.y,
            boxWidth: ~~imgWidth + ~~valueTemp.x,
          });
        }}
        onComplateResize={value => {
          const valueTemp = this._processingValue(value);
          this.setState(
            {
              imgHeight: ~~imgHeight + ~~valueTemp.y,
              imgWidth: ~~imgWidth + ~~valueTemp.x,
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
        disableOrientation={disableOrientationTmp}
        style={{ height: boxHeight, width: boxWidth }}
      >
        <img alt="" src={this.props.src} style={{ height: imgHeight, width: imgWidth }} />
      </ResizableBox>
    );
  }
}
