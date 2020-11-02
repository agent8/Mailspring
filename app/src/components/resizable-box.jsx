import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';

const allDragPoints = ['n', 's', 'w', 'e', 'ne', 'nw', 'se', 'sw'];

export default class ResizableBox extends Component {
  static propTypes = {
    disabledDragPoints: PropTypes.arrayOf(PropTypes.string),
    onResize: PropTypes.func,
    onResizeComplete: PropTypes.func,
    children: PropTypes.node,
    style: PropTypes.object,
    showMask: PropTypes.bool,
    height: PropTypes.number,
    width: PropTypes.number,
    lockAspectRatio: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      disX: 0,
      disY: 0,
    };
  }
  _processAspectRatio = ({ width, height } = {}) => {
    const { lockAspectRatio } = this.props;
    if (!lockAspectRatio) {
      return { width, height };
    }
    return { height, width: (this.props.width / this.props.height) * height };
  };

  renderHandleBar = Orientation => {
    const { onResize, onResizeComplete } = this.props;
    const _onMouseDown = e => {
      const disX = e.screenX;
      const disY = e.screenY;
      const originalWidth = this.props.width;
      const originalHeight = this.props.height;
      let targetWidth = this.props.width;
      let targetHeight = this.props.height;

      document.onmousemove = event => {
        const moveX = event.screenX - disX;
        const moveY = event.screenY - disY;
        const orientationList = Orientation.split('');
        orientationList.forEach(o => {
          switch (o) {
            case 'n':
              targetHeight = originalHeight - moveY;
              break;
            case 's':
              targetHeight = originalHeight + moveY;
              break;
            case 'w':
              targetWidth = originalWidth - moveX;
              break;
            case 'e':
              targetWidth = originalWidth + moveX;
              break;
            default:
          }
        });
        if (onResize && typeof onResize === 'function') {
          onResize(this._processAspectRatio({ width: targetWidth, height: targetHeight }));
        }
      };
      document.onmouseup = () => {
        document.onmousemove = null;
        if (onResizeComplete && typeof onResizeComplete === 'function') {
          onResizeComplete(this._processAspectRatio({ width: targetWidth, height: targetHeight }));
        }
      };
    };

    return (
      <div
        key={Orientation}
        className={`resizable-handle resizable-handle-${Orientation}`}
        onMouseDown={_onMouseDown}
      />
    );
  };

  renderHandles = () => {
    const { disabledDragPoints = [] } = this.props;
    const result = [];
    allDragPoints.forEach(item => {
      if (!disabledDragPoints.includes(item)) {
        result.push(this.renderHandleBar(item));
      }
    });
    return result;
  };

  render() {
    const { children, style, showMask } = this.props;
    const containerStyle = style || {};
    if (this.props.height > 0) {
      containerStyle.height = this.props.height;
    }
    if (this.props.width > 0) {
      containerStyle.width = this.props.width;
    }
    const maskStyle = {};
    if (showMask) {
      maskStyle.zIndex = 2;
    }
    return (
      <div className={`resizable-box${showMask ? ` showMask` : ''}`} style={containerStyle}>
        <div
          className="resizable-box-mask"
          style={maskStyle}
          contentEditable={false}
          suppressContentEditableWarning
          onKeyDown={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {this.renderHandles()}
        </div>
        {children}
      </div>
    );
  }
}
