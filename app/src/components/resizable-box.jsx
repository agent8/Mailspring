import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';

const allDragPoints = ['n', 's', 'w', 'e', 'ne', 'nw', 'se', 'sw'];

export default class ResizableBox extends Component {
  static propTypes = {
    disabledDragPoints: PropTypes.arrayOf(PropTypes.string),
    onContextMenu: PropTypes.func,
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
      transform: '',
    };
    this._maskRef = null;
    this._setMaskRef = ref => (this._maskRef = ref);
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
    const { onResizeComplete } = this.props;
    const _onMouseDown = e => {
      if (!this._mounted) {
        return;
      }
      if (!this._maskRef) {
        return;
      }
      this._resizing = true;
      const startX = e.screenX;
      const startY = e.screenY;
      const originalWidth = this.props.width;
      const originalHeight = this.props.height;
      let oppositeX = startX + originalWidth;
      let oppositeY = startY + originalHeight;
      if (Orientation.includes('e')) {
        oppositeX = startX - originalWidth;
      }
      if (Orientation.includes('s')) {
        oppositeY = startY - originalHeight;
      }
      let targetWidth = this.props.width;
      let targetHeight = this.props.height;

      document.onmousemove = event => {
        if (!this._mounted) {
          document.onmousemove = null;
          return;
        }
        const currentX = event.screenX;
        const currentY = event.screenY;
        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(currentY - startY);
        let xSign = 1;
        if (currentX > startX) {
          if (Orientation.includes('w')) {
            xSign = -1;
            if (currentX >= oppositeX) {
              xSign = 0;
            }
          }
        } else {
          if (Orientation.includes('e')) {
            xSign = -1;
            if (currentX <= oppositeX) {
              xSign = 0;
            }
          }
        }
        let ySign = 1;
        if (currentY > startY) {
          if (Orientation.includes('n')) {
            ySign = -1;
            if (currentY >= oppositeY) {
              ySign = 0;
            }
          }
        } else {
          if (Orientation.includes('s')) {
            ySign = -1;
            if (currentY <= oppositeY) {
              ySign = 0;
            }
          }
        }
        if (!Orientation.includes('n') && !Orientation.includes('s')) {
          ySign = 0;
        }
        if (!Orientation.includes('e') && !Orientation.includes('w')) {
          xSign = 0;
        }
        const tmp = this._processAspectRatio({
          width: (originalWidth + xSign * deltaX) / originalWidth,
          height: (originalHeight + ySign * deltaY) / originalHeight,
          originalHeight,
          originalWidth,
        });
        const scaleX = tmp.width;
        const scaleY = tmp.height;
        targetWidth = scaleX * originalWidth;
        targetHeight = scaleY * originalHeight;
        let translateX = (xSign * deltaX) / 2;
        if (Orientation.includes('w')) {
          translateX = -1 * translateX;
        }
        let translateY = (ySign * deltaY) / 2;
        if (Orientation.includes('n')) {
          translateY = -1 * translateY;
        }
        const transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
        this.setState({ transform });
        // if (onResize && typeof onResize === 'function') {
        //   onResize(
        //     this._processAspectRatio({
        //       width: targetWidth,
        //       height: targetHeight,
        //       originalWidth,
        //       originalHeight,
        //     })
        //   );
        // }
      };
      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        this._resizing = false;
        if (!this._mounted) {
          return;
        }
        this.setState({ transform: '' });
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
  _onMaskContextMenu = event => {
    event.stopPropagation();
    if (this.props.onContextMenu) {
      event.persist();
      this.props.onContextMenu(event);
    }
    return;
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
    const containerStyle = Object.assign({}, style);
    if (this.props.height > 0) {
      containerStyle.height = this.props.height;
    }
    if (this.props.width > 0) {
      containerStyle.width = this.props.width;
    }
    const maskStyle = { transform: this.state.transform };
    if (showMask) {
      maskStyle.zIndex = 1;
    }
    return (
      <div
        className={`resizable-box${showMask ? ` showMask` : ''}`}
        style={containerStyle}
        onClick={() => console.warn('onclick')}
      >
        {showMask ? (
          <div
            ref={this._setMaskRef}
            className="resizable-box-mask"
            style={maskStyle}
            contentEditable={false}
            suppressContentEditableWarning
            onKeyDown={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={this._onMaskClicked}
            onContextMenu={this._onMaskContextMenu}
          >
            {this.renderHandles()}
          </div>
        ) : null}
        {children}
      </div>
    );
  }
}
