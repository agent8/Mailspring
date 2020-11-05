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
    onMaskClicked: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      disX: 0,
      disY: 0,
    };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
  }

  _processAspectRatio = ({ width, height, originalWidth, originalHeight } = {}) => {
    const { lockAspectRatio } = this.props;
    if (!lockAspectRatio) {
      return { width, height };
    }
    return { height, width: (originalWidth / originalHeight) * height };
  };

  renderHandleBar = Orientation => {
    const { onResize, onResizeComplete } = this.props;
    const _onMouseDown = e => {
      if (!this._mounted) {
        return;
      }
      const disX = e.screenX;
      const disY = e.screenY;
      const originalWidth = this.props.width;
      const originalHeight = this.props.height;
      let targetWidth = this.props.width;
      let targetHeight = this.props.height;

      document.onmousemove = event => {
        if (!this._mounted) {
          document.onmousemove = null;
          return;
        }
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
          onResize(
            this._processAspectRatio({
              width: targetWidth,
              height: targetHeight,
              originalWidth,
              originalHeight,
            })
          );
        }
      };
      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        if (!this._mounted) {
          return;
        }
        if (onResizeComplete && typeof onResizeComplete === 'function') {
          onResizeComplete(
            this._processAspectRatio({
              width: targetWidth,
              height: targetHeight,
              originalWidth,
              originalHeight,
            })
          );
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
  _onMaskClicked = e => {
    e.stopPropagation();
    if (!this._mounted) {
      return;
    }
    if (this.props.onMaskClicked) {
      this.props.onMaskClicked();
    }
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
      <div
        className={`resizable-box${showMask ? ` showMask` : ''}`}
        style={containerStyle}
        onClick={() => console.warn('onclick')}
      >
        {showMask ? (
          <div
            className="resizable-box-mask"
            style={maskStyle}
            contentEditable={false}
            suppressContentEditableWarning
            onKeyDown={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={this._onMaskClicked}
          >
            {this.renderHandles()}
          </div>
        ) : null}
        {children}
      </div>
    );
  }
}
