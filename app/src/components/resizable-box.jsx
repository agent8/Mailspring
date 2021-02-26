import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';
import RetinaImg from './retina-img';

const allDragPoints = ['n', 's', 'w', 'e', 'ne', 'nw', 'se', 'sw'];

export default class ResizableBox extends Component {
  static propTypes = {
    disabledDragPoints: PropTypes.arrayOf(PropTypes.string),
    onContextMenu: PropTypes.func,
    onResizeComplete: PropTypes.func,
    onResizePopupClosed: PropTypes.func,
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
      showResizePopup: false,
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
    if (this.state.showResizePopup && this.props.onResizePopupClosed) {
      this.props.onResizePopupClosed();
    }
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
        const tmp = this._processAspectRatio({
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
          originalHeight,
          originalWidth,
        });
        const deltaX = tmp.width;
        const deltaY = tmp.height;
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
        if (this.props.lockAspectRatio && xSign * ySign !== 1) {
          xSign = 0;
          ySign = 0;
        }
        const scaleX = (originalWidth + xSign * deltaX) / originalWidth;
        const scaleY = (originalHeight + ySign * deltaY) / originalHeight;
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
  _onCancelPopup = () => {
    if (this._mounted) {
      this.setState({
        showResizePopup: false,
        resizePopupInitialHeight: 0,
        resizePopupInitialWidth: 0,
      });
    }
    if (this.props.onResizePopupClosed) {
      this.props.onResizePopupClosed();
    }
  };
  _onResizePopupConfirm = ({ height, width } = {}) => {
    if (this.props.onResizeComplete) {
      this.props.onResizeComplete({ height, width });
    }
    this._onCancelPopup();
  };
  onShowResizePopup = ({ initialHeight, initialWidth, top, left }) => {
    if (this._mounted) {
      this.setState({
        showResizePopup: true,
        resizePopupInitialHeight: initialHeight,
        resizePopupInitialWidth: initialWidth,
        popupPosition: { top, left },
      });
    }
  };
  _onMaskContextMenu = event => {
    event.stopPropagation();
    if (this.props.onContextMenu) {
      event.persist();
      this.props.onContextMenu(event, this.onShowResizePopup);
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
  renderResizePopup() {
    if (!this.state.showResizePopup) {
      return null;
    }
    return (
      <ResizePopup
        initialHeight={this.state.resizePopupInitialHeight}
        initialWidth={this.state.resizePopupInitialWidth}
        onCancel={this._onCancelPopup}
        onResize={this._onResizePopupConfirm}
      />
    );
  }

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
        {this.renderResizePopup()}
        {children}
      </div>
    );
  }
}

class ResizePopup extends React.PureComponent {
  static propTypes = {
    initialHeight: PropTypes.number,
    initialWidth: PropTypes.number,
    onResize: PropTypes.func,
    onCancel: PropTypes.func,
  };
  static defaultProps = {
    initialHeight: 0,
    initialWidth: 0,
  };
  constructor(props) {
    super(props);
    this.state = {
      height: this.props.initialHeight,
      width: this.props.initialWidth,
      widthHeightRatio: this.props.initialWidth / this.props.initialHeight,
      lockAspect: true,
    };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
  }

  _onResizePopupHeightChange = event => {
    event.preventDefault();
    if (this._mounted) {
      let height = parseInt(event.target.value, 10);
      if (isNaN(height)) {
        height = 0;
      } else if (height < 0) {
        height = 0;
      }
      const state = { height };
      if (this.state.lockAspect) {
        state.width = Math.round(height * this.state.widthHeightRatio);
      }
      this.setState(state);
    }
  };
  _onResizePopupWidthChange = event => {
    if (this._mounted) {
      let width = parseInt(event.target.value, 10);
      if (isNaN(width)) {
        width = 0;
      } else if (width < 0) {
        width = 0;
      }
      const state = { width };
      if (this.state.lockAspect) {
        state.height = Math.round(width / this.state.widthHeightRatio);
      }
      this.setState(state);
    }
  };
  _onResize = event => {
    if (event) {
      event.stopPropagation();
    }
    if (this.state.height === 0 || this.state.width === 0) {
      AppEnv.showMessageBox({
        title: 'Cannot resize image',
        detail: 'Image dimensions must be greater than 0.',
        buttons: ['Ok'],
        defaultId: 0,
        cancelId: 0,
      });
      return;
    }
    if (this.props.onResize) {
      this.props.onResize({ height: this.state.height, width: this.state.width });
    }
  };
  _onCancel = event => {
    event.stopPropagation();
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  };
  _onKeyUp = event => {
    if (['Enter'].includes(event.key)) {
      this._onResize();
    }
  };
  _stopClickPropagation = event => {
    event.stopPropagation();
  };
  render() {
    return (
      <div className="resize-popup" onClick={this._stopClickPropagation}>
        <div className="user-input" onClick={this._stopClickPropagation}>
          <div className="height" onClick={this._stopClickPropagation}>
            <input
              onClick={this._stopClickPropagation}
              value={this.state.height}
              onChange={this._onResizePopupHeightChange}
              onKeyUp={this._onKeyUp}
            />
          </div>
          <RetinaImg
            onClick={this._stopClickPropagation}
            style={{ height: 20, width: 20 }}
            mode={RetinaImg.Mode.ContentIsMask}
            isIcon={true}
            name={'lock.svg'}
          />
          <div className="width" onClick={this._stopClickPropagation}>
            <input
              onClick={this._stopClickPropagation}
              value={this.state.width}
              onKeyUp={this._onKeyUp}
              onChange={this._onResizePopupWidthChange}
            />
          </div>
        </div>
        <div className="user-buttons " onClick={this._stopClickPropagation}>
          <button className="btn resize-button-cancel" onClick={this._onCancel}>
            Cancel
          </button>
          <button className="btn resize-button-confirm" onClick={this._onResize}>
            Resize
          </button>
        </div>
      </div>
    );
  }
}
