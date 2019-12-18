import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';

const allOrientation = ['n', 's', 'w', 'e', 'ne', 'nw', 'se', 'sw'];

export default class ResizableBox extends Component {
  static propTypes = {
    disableOrientation: PropTypes.arrayOf(PropTypes.string),
    onResize: PropTypes.func,
    onComplateResize: PropTypes.func,
    children: PropTypes.node,
    style: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      disX: 0,
      disY: 0,
      showMask: false,
    };
  }

  renderHandleBar = Orientation => {
    const { onResize, onComplateResize } = this.props;
    const _onMouseDown = e => {
      const disX = e.clientX;
      const disY = e.clientY;
      const result = { x: 0, y: 0 };

      document.onmousemove = event => {
        const moveX = event.clientX - disX;
        const moveY = event.clientY - disY;
        const orientationList = Orientation.split('');
        orientationList.forEach(o => {
          switch (o) {
            case 'n':
              result.y = -moveY;
              break;
            case 's':
              result.y = moveY;
              break;
            case 'w':
              result.x = -moveX;
              break;
            case 'e':
              result.x = moveX;
              break;
            default:
          }
        });
        if (onResize && typeof onResize === 'function') {
          onResize(result);
        }
      };
      document.onmouseup = () => {
        document.onmousemove = null;
        if (onComplateResize && typeof onComplateResize === 'function') {
          onComplateResize(result);
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
    const { disableOrientation = [] } = this.props;
    const result = [];
    allOrientation.forEach(item => {
      if (!disableOrientation.includes(item)) {
        result.push(this.renderHandleBar(item));
      }
    });
    return result;
  };

  render() {
    const { children, style } = this.props;
    const { showMask } = this.state;
    return (
      <div className={`resizable-box${showMask ? ` showMask` : ''}`} style={style ? style : {}}>
        <div
          className="resizable-box-mask"
          contentEditable={true}
          suppressContentEditableWarning
          onKeyDown={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onFocus={() => {
            this.setState({ showMask: true });
          }}
          onBlur={() => {
            this.setState({ showMask: false });
          }}
        >
          {this.renderHandles()}
        </div>
        {children}
      </div>
    );
  }
}
