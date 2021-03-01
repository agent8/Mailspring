import React, { Component } from 'react';
import { PropTypes } from 'mailspring-exports';
import ResizableBox from './resizable-box';
import ReactDOM from 'react-dom';
import { remote } from 'electron';
const { nativeImage, clipboard } = remote;

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
    onContextMenu: PropTypes.func,
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
    this._mounted = false;
    this._imgRef = null;
    this._setImgRef = ref => (this._imgRef = ref);
    this._resizableRef = null;
    this._setResizableRef = ref => (this._resizableRef = ref);
    this._imageResizePopupOpen = false;
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
    this._imageResizePopupOpen = false;
  }
  _onCloseResizePopup = () => {
    this._imageResizePopupOpen = false;
  };
  _onResizeComplete = value => {
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
        if (this.props.callback && typeof this.props.callback === 'function') {
          this.props.callback({
            height: this.state.imgHeight,
            width: this.state.imgWidth,
          });
        }
      }
    );
  };
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

  _onCopyImage = cb => {
    if (this._imgRef) {
      let img = new Image();
      img.addEventListener(
        'load',
        () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(this._imgRef, 0, 0);
          const imageDataURL = canvas.toDataURL('image/png');
          img = nativeImage.createFromDataURL(imageDataURL);
          clipboard.writeImage(img);
          if (cb) {
            cb();
          }
        },
        false
      );
      img.src = this._imgRef.src;
    }
  };
  _onImageContextMenu = (event, onShowResizePopup) => {
    if (this.props.onContextMenu) {
      event.persist();
      if (this._imgRef && !this._imageResizePopupOpen) {
        const el = ReactDOM.findDOMNode(this._imgRef);
        const rect = el.getBoundingClientRect();
        const showPopup = () => {
          if (!onShowResizePopup && this._resizableRef) {
            onShowResizePopup = this._resizableRef.onShowResizePopup;
          }
          onShowResizePopup({
            initialHeight: Math.floor(rect.height),
            initialWidth: Math.floor(rect.width),
            y: event.clientY - rect.top,
            x: event.clientX - rect.left,
          });
          this._imageResizePopupOpen = true;
        };
        this.props.onContextMenu(event, { onShowPopup: showPopup, onCopyImage: this._onCopyImage });
      }
    }
  };

  render() {
    const { boxHeight, boxWidth, imgHeight, imgWidth, showMask } = this.state;
    const { lockAspectRatio, disableOrientation } = this.props;
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
        ref={this._setResizableRef}
        onResize={value => {
          if (!this._mounted) {
            return;
          }
          this.setState({
            boxHeight: value.height,
            boxWidth: value.width,
          });
        }}
        onResizePopupClosed={this._onCloseResizePopup}
        onResizeComplete={this._onResizeComplete}
        onMaskClicked={this._onImageDeselect}
        disabledDragPoints={disableOrientationTmp}
        showMask={showMask}
        lockAspectRatio={this.props.lockAspectRatio}
        height={boxHeight}
        width={boxWidth}
        onContextMenu={this._onImageContextMenu}
      >
        <img
          alt=""
          ref={this._setImgRef}
          src={this.props.src}
          style={styles}
          onClick={this._onImgSelect}
          onBlur={this._onImageDeselect}
          onContextMenu={this._onImageContextMenu}
        />
      </ResizableBox>
    );
  }
}
