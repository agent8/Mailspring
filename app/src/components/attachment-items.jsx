import fs from 'fs';
import path from 'path';
import classnames from 'classnames';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { pickHTMLProps } from 'pick-react-known-prop';
import RetinaImg from './retina-img';
import Flexbox from './flexbox';
import Spinner from './spinner';
import { AttachmentStore, MessageStore, Utils, Constant } from 'mailspring-exports';
import Actions from '../flux/actions';
import ResizableBox from './resizable-box';

const { AttachmentDownloadState } = Constant;

const propTypes = {
  className: PropTypes.string,
  draggable: PropTypes.bool,
  focusable: PropTypes.bool,
  previewable: PropTypes.bool,
  disabled: PropTypes.bool,
  missing: PropTypes.bool,
  disableProgress: PropTypes.bool,
  fileId: PropTypes.string,
  filePath: PropTypes.string,
  accountId: PropTypes.string,
  contentType: PropTypes.string,
  download: PropTypes.shape({
    state: PropTypes.number,
    percent: PropTypes.number,
  }),
  displayName: PropTypes.string,
  displaySize: PropTypes.string,
  fileIconName: PropTypes.string,
  filePreviewPath: PropTypes.string,
  onOpenAttachment: PropTypes.func,
  onRemoveAttachment: PropTypes.func,
  onDownloadAttachment: PropTypes.func,
  onAbortDownload: PropTypes.func,
  isDownloading: PropTypes.bool,
  isImage: PropTypes.bool,
};

const defaultProps = {
  draggable: true,
  disabled: false,
  missing: false,
};

const SPACE = ' ';

function AttachmentActionIcon(props) {
  const {
    missing,
    isDownloading,
    removeIcon,
    downloadIcon,
    retinaImgMode,
    onRemoveAttachment,
    onDownloadAttachment,
    disabled,
    isIcon,
    style,
  } = props;

  const isRemovable = onRemoveAttachment != null && !disabled;
  const actionIconName = isRemovable ? removeIcon : downloadIcon;

  const onClickActionIcon = event => {
    event.stopPropagation();
    if (isRemovable && typeof onRemoveAttachment === 'function' && !missing && !isDownloading) {
      onRemoveAttachment();
      return;
    }
    if (!isRemovable && typeof onDownloadAttachment === 'function') {
      onDownloadAttachment();
    }
  };

  const fileActionIconStyle = {};
  if (actionIconName === removeIcon) {
    fileActionIconStyle.opacity = 1;
    fileActionIconStyle.transform = 'scale(0.7)';
    fileActionIconStyle.width = 'fit-content';
    fileActionIconStyle.height = 'fit-content';
  }

  return (
    <div className="file-action-icon" onClick={onClickActionIcon} style={fileActionIconStyle}>
      <RetinaImg isIcon={isIcon} style={style} name={actionIconName} mode={retinaImgMode} />
    </div>
  );
}

AttachmentActionIcon.propTypes = {
  removeIcon: PropTypes.string,
  downloadIcon: PropTypes.string,
  retinaImgMode: PropTypes.string,
  ...propTypes,
};

export class AttachmentItem extends Component {
  static displayName = 'AttachmentItem';

  static containerRequired = false;

  static propTypes = propTypes;

  static defaultProps = defaultProps;

  constructor(props) {
    super(props);
    this.state = {
      isDownloading: false,
      percent: 0,
      displaySupportPopup: false,
    };
  }

  componentDidMount() {
    this._storeUnlisten = [AttachmentStore.listen(this._onDownloadStoreChange)];
    const { fileId, filePath, previewable } = this.props;
    if (previewable) {
      AttachmentStore.refreshAttachmentsState({
        fileId: fileId,
        filePath: filePath,
      });
    }
  }

  componentWillUnmount() {
    if (this._storeUnlisten) {
      for (let un of this._storeUnlisten) {
        un();
      }
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.download) {
      const download = nextProps.download;
      this.setState({
        isDownloading: download.state === AttachmentDownloadState.downloading,
        percent: download.percent,
      });
    }
  }

  _onDownloadStoreChange = () => {
    const saveState = AttachmentStore.getSaveSuccessState(this.props.fileId);
    if (saveState !== this.state.displaySupportPopup) {
      this.setState({ displaySupportPopup: saveState });
    }
  };

  _canPreview() {
    const { filePath, previewable } = this.props;
    return previewable && process.platform === 'darwin' && fs.existsSync(filePath);
  }

  _previewAttachment() {
    const { filePath } = this.props;
    const currentWin = AppEnv.getCurrentWindow();
    currentWin.previewFile(filePath);
  }

  _onDragStart = event => {
    const { contentType, filePath } = this.props;
    if (fs.existsSync(filePath)) {
      // Note: From trial and error, it appears that the second param /MUST/ be the
      // same as the last component of the filePath URL, or the download fails.
      const downloadURL = `${contentType}:${path.basename(filePath)}:file://${filePath}`;
      event.dataTransfer.setData('DownloadURL', downloadURL);
      event.dataTransfer.setData('text/nylas-file-url', downloadURL);
      const el = ReactDOM.findDOMNode(this._fileIconComponent);
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = window.devicePixelRatio === 2 ? rect.height / 2 : rect.height;
      const y = window.devicePixelRatio === 2 ? rect.width / 2 : rect.width;
      event.dataTransfer.setDragImage(el, x, y);
    } else {
      event.preventDefault();
    }
  };

  // Avoid double click events triggering two single click events
  _onClickCoordinate = e => {
    e.persist();
    this._clickTime = (this._clickTime || 0) + 1;
    setTimeout(() => {
      if (this._clickTime === 1) {
        // single click
        this._onClick(e);
      } else if (this._clickTime >= 2) {
        // double click
        this._onOpenAttachment(e);
      }
      this._clickTime = 0;
    }, 300);
  };

  _onClick = e => {
    if (this.state.isDownloading) {
      AttachmentStore.refreshAttachmentsState({
        fileId: this.props.fileId,
        filePath: this.props.filePath,
      });
    }
    if (this.props.isDownloading || this.props.missing) {
      MessageStore.fetchMissingAttachmentsByFileIds({
        accountId: this.props.accountId,
        fileIds: [this.props.fileId],
      });
    } else {
      if (fs.existsSync(this.props.filePath)) {
        this._onClickQuicklookIcon(e);
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  _onOpenAttachment = () => {
    if (this.state.isDownloading || this.props.isDownloading) {
      return;
    }
    if (this.props.missing && !this.state.isDownloading) {
      MessageStore.fetchMissingAttachmentsByFileIds({
        accountId: this.props.accountId,
        filedIds: [this.props.fileId],
      });
    }
    const { onOpenAttachment } = this.props;
    if (onOpenAttachment != null) {
      onOpenAttachment();
    }
  };

  _onAttachmentKeyDown = event => {
    if (event.key === SPACE) {
      if (!this._canPreview()) {
        return;
      }
      event.preventDefault();
      this._previewAttachment();
    }
    if (event.key === 'Escape') {
      const attachmentNode = ReactDOM.findDOMNode(this);
      if (attachmentNode) {
        attachmentNode.blur();
      }
    }
  };

  _onClickQuicklookIcon = event => {
    if (!this._canPreview()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._previewAttachment();
  };

  render() {
    let {
      className,
      focusable,
      draggable,
      displayName,
      displaySize,
      filePreviewPath,
      disabled,
      isImage,
      filePath,
      ...extraProps
    } = this.props;
    const classes = classnames({
      'nylas-attachment-item': true,
      'file-attachment-item': true,
      // 'has-preview': filePreviewPath,
      [className]: className,
    });
    let { iconName, color } = AttachmentStore.getExtIconName(displayName);
    if (isImage) {
      if (fs.existsSync(filePath)) {
        filePreviewPath = filePath;
      }
      iconName = 'attachment-img.svg';
    } else {
      filePreviewPath = null;
    }
    const style = draggable ? { WebkitUserDrag: 'element' } : null;
    const tabIndex = focusable ? 0 : null;

    let previewStyle = {};
    if (filePreviewPath) {
      previewStyle = {
        background: `url(file://${encodeURI(filePreviewPath)}) no-repeat center center`,
        backgroundSize: 'cover',
      };
    }

    return (
      <div
        style={style}
        className={classes}
        tabIndex={tabIndex}
        onKeyDown={focusable && !disabled ? this._onAttachmentKeyDown : null}
        draggable={draggable && !disabled}
        onClick={!disabled ? this._onClickCoordinate : null}
        onDragStart={!disabled ? this._onDragStart : null}
        {...pickHTMLProps(extraProps)}
      >
        <div className="inner">
          <Flexbox direction="row" style={{ alignItems: 'center' }}>
            <div className="file-info-wrap">
              <div className="attachment-icon">
                {filePreviewPath ? (
                  <div
                    className="file-thumbnail-preview"
                    style={previewStyle}
                    draggable={false}
                  ></div>
                ) : (
                  <RetinaImg
                    ref={cm => {
                      this._fileIconComponent = cm;
                    }}
                    style={{ color: color }}
                    className="file-icon"
                    fallback="drafts.svg"
                    name={iconName}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                  />
                )}
              </div>
              <div className="attachment-info">
                <div className="attachment-name" title={displayName}>
                  {displayName}
                </div>
                <div className="file-size">{displaySize ? `${displaySize}` : ''}</div>
              </div>
              <div className="attachment-action-bar">
                {/* {this._canPreview() ? (
                    <div className="file-action-icon">
                      <RetinaImg
                        className="quicklook-icon"
                        isIcon
                        style={{ width: 20, height: 20 }}
                        name="preview.svg"
                        mode={RetinaImg.Mode.ContentIsMask}
                        onClick={!disabled ? this._onClickQuicklookIcon : null}
                      />
                    </div>
                  ) : null} */}
                <AttachmentActionIcon
                  {...this.props}
                  isDownloading={this.state.isDownloading || this.props.isDownloading}
                  removeIcon="close.svg"
                  downloadIcon="download.svg"
                  isIcon
                  style={{ width: 20, height: 20 }}
                  retinaImgMode={RetinaImg.Mode.ContentIsMask}
                />
              </div>
            </div>
          </Flexbox>
        </div>
      </div>
    );
  }
}

export class ImageAttachmentItem extends Component {
  static displayName = 'ImageAttachmentItem';

  static propTypes = {
    imgProps: PropTypes.object,
    onHover: PropTypes.func,
    onResizeComplete: PropTypes.func,
    onShowMask: PropTypes.func,
    ...propTypes,
  };

  static defaultProps = defaultProps;

  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = {
      isDownloading: false,
      percent: 0,
      displaySupportPopup: false,
      notReady: false,
      imgHeight: 0,
      imgWidth: 0,
      resizeBoxHeight: 0,
      resizeBoxWidth: 0,
    };
    this._mounted = false;
  }

  componentDidMount() {
    this._storeUnlisten = [
      AttachmentStore.listen(this._onDownloadStoreChange),
      Actions.broadcastDraftAttachmentState.listen(this._onAttachmentStateChange, this),
    ];
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._storeUnlisten) {
      for (let un of this._storeUnlisten) {
        un();
      }
    }
  }

  _onAttachmentStateChange = ({ fileId, fileState } = {}) => {
    if (!this._mounted) {
      return;
    }
    if (!fileId || !fileState) {
      return;
    }
    console.log(`file ${fileId} state changed ${fileState}`);
    if (fileId === this.props.fileId && fileState === 1) {
      this.setState({ notReady: false });
      this._onImgLoaded({ forceReload: true });
    }
  };

  _onDownloadStoreChange = () => {
    const saveState = AttachmentStore.getSaveSuccessState(this.props.fileId);
    if (saveState !== this.state.displaySupportPopup) {
      this.setState({ displaySupportPopup: saveState });
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.download) {
      const download = nextProps.download;
      this.setState({
        isDownloading: download.state === AttachmentDownloadState.downloading,
        percent: download.percent,
      });
    }
  }

  _onOpenAttachment = () => {
    if (this.state.isDownloading || this.props.isDownloading) {
      return;
    }
    if (this.props.missing && !this.state.isDownloading) {
      MessageStore.fetchMissingAttachmentsByFileIds({
        accountId: this.props.accountId,
        filedIds: [this.props.fileId],
      });
    }
    const { onOpenAttachment } = this.props;
    if (onOpenAttachment != null) {
      onOpenAttachment();
    }
  };

  _onImageError = () => {
    if (this._mounted) {
      this.setState({ notReady: true });
    }
  };

  _onImgLoaded = ({ forceReload = false } = {}) => {
    // on load, modify our DOM just /slightly/. This causes DOM mutation listeners
    // watching the DOM to trigger. This is a good thing, because the image may
    // change dimensions. (We use this to reflow the draft body when this component
    // is within an OverlaidComponent)
    const el = ReactDOM.findDOMNode(this);
    if (el) {
      el.classList.add('loaded');
    }
    if (this._imgRef && forceReload && !this._imageReloaded) {
      const imgSrc = `${Utils.safeBrowserPath(this.props.filePath)}?forceReload=forced`;
      this._imgRef.setAttribute('src', imgSrc);
      this._imageReloaded = true;
    }
  };
  _onImageHover = event => {
    if (this.props.onHover) {
      this.props.onHover(event.target);
    }
  };
  _onImageSelect = event => {
    if (!this._mounted) {
      return;
    }
    if (this.props.resizable && !this.state.showResizeMask) {
      const state = { showResizeMask: true };
      if (this._imgRef) {
        const el = ReactDOM.findDOMNode(this._imgRef);
        const rect = el.getBoundingClientRect();
        state.imgHeight = rect.height;
        state.imgWidth = rect.width;
        state.resizeBoxHeight = state.imgHeight;
        state.resizeBoxWidth = state.imgWidth;
      }
      this.setState(state);
      if (this.props.onShowMask) {
        this.props.onShowMask(event.target);
      }
    } else if (this.props.resizable && this.state.showResizeMask) {
      this.setState({ showResizeMask: false });
    }
  };
  _onImageDeselect = () => {
    if (!this._mounted) {
      return;
    }
    if (this.props.resizable) {
      this.setState({ showResizeMask: false });
    }
  };

  renderImage() {
    const { isDownloading, filePath, draggable } = this.props;
    if (isDownloading || this.state.isDownloading) {
      return (
        <div style={{ width: '100%', height: '100px' }}>
          <Spinner visible />
        </div>
      );
    }
    let height, width;
    if (
      (this.props.resizable && this.state.imgHeight > 0 && this.state.imgWidth > 0) ||
      this.props.imgProps
    ) {
      width =
        this.state.imgWidth ||
        ((this.props.imgProps || {}).width > 0 ? this.props.imgProps.width : 'auto');
      height =
        this.state.imgHeight ||
        ((this.props.imgProps || {}).height > 0 ? this.props.imgProps.height : 'auto');
    }
    return (
      <img
        ref={ref => (this._imgRef = ref)}
        key={`${this.fileId}:${this.state.notReady}`}
        draggable={draggable}
        src={Utils.safeBrowserPath(filePath)}
        alt={`${this.state.notReady}`}
        onLoad={this._onImgLoaded}
        onError={this._onImageError}
        onClick={this._onImageSelect}
        onBlur={this._onImageDeselect}
        style={{ height, width }}
      />
    );
  }
  _renderInnerContainer() {
    const { className, displayName, disabled, ...extraProps } = this.props;
    const classes = `nylas-attachment-item image-attachment-item ${className || ''}`;
    let style = {};
    if (this.props.resizable && this.state.imgHeight > 0 && this.state.imgWidth > 0) {
      style = {
        display: 'block',
        width: this.state.imgWidth + 2,
        height: this.state.imgHeight + 2,
        maxHeight: this.state.imgHeight + 2,
        maxWidth: this.state.imgWidth + 2,
      };
    } else if (this.props.resizable) {
      style = { maxWidth: 'fit-content' };
    }
    const filePreviewStyle = {};
    if (this.props.resizable && this.state.showResizeMask) {
      filePreviewStyle.zIndex = 0;
    }
    return (
      <div
        className={classes}
        {...pickHTMLProps(extraProps)}
        onMouseUp={this._onImageHover}
        style={style}
      >
        <div>
          <AttachmentActionIcon
            {...this.props}
            removeIcon="close.svg"
            downloadIcon="download.svg"
            isDownloading={this.state.isDownloading || this.props.isDownloading}
            isIcon
            style={{ width: 20, height: 20 }}
            retinaImgMode={RetinaImg.Mode.ContentIsMask}
            onAbortDownload={null}
          />
          <div
            className="file-preview"
            style={filePreviewStyle}
            onDoubleClick={!disabled ? this._onOpenAttachment : null}
          >
            <div className="file-name-container">
              <div className="file-name" title={displayName}>
                {displayName}
              </div>
            </div>
            {this.renderImage()}
          </div>
        </div>
      </div>
    );
  }
  _onResize = ({ width, height }) => {
    if (!this._mounted) {
      return;
    }
    if (width > 0 && height > 0) {
      this.setState({ resizeBoxHeight: height, resizeBoxWidth: width });
    }
  };
  _onResizeComplete = ({ width, height }) => {
    if (!this._mounted) {
      return;
    }
    if (width > 0 && height > 0) {
      this.setState(
        {
          imgHeight: height,
          imgWidth: width,
          resizeBoxHeight: height,
          resizeBoxWidth: width,
          showResizeMask: false,
        },
        () => {
          if (!this._mounted) {
            return;
          }
          if (typeof this.props.onResizeComplete === 'function') {
            this.props.onResizeComplete({ width, height });
          }
        }
      );
    }
  };
  _renderResizableContainer() {
    return (
      <ResizableBox
        onResize={this._onResize}
        onResizeComplete={this._onResizeComplete}
        onMaskClicked={this._onImageDeselect}
        disabledDragPoints={['n', 's', 'w', 'e', 'ne', 'nw', 'sw']}
        lockAspectRatio={true}
        showMask={this.state.showResizeMask}
        height={this.state.resizeBoxHeight}
        width={this.state.resizeBoxWidth}
      >
        {this._renderInnerContainer()}
      </ResizableBox>
    );
  }
  render() {
    if (this.props.resizable) {
      return this._renderResizableContainer();
    } else {
      return this._renderInnerContainer();
    }
  }
}
