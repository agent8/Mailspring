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

const { AttachmentDownloadState } = Constant;

const propTypes = {
  className: PropTypes.string,
  draggable: PropTypes.bool,
  focusable: PropTypes.bool,
  previewable: PropTypes.bool,
  disabled: PropTypes.bool,
  missing: PropTypes.bool,
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
};

const defaultProps = {
  draggable: true,
  disabled: false,
  missing: false,
};

const SPACE = ' ';

function ProgressBar(props) {
  const { isDownloading, percent } = props;

  if (!isDownloading) {
    return <span />;
  }

  const downloadProgressStyle = {
    width: `${Math.min(Math.max(percent, 2.5), 97.5)}%`,
  };
  return (
    <span className={`progress-bar-wrap state-downloading`}>
      <span className="progress-background" />
      <span className="progress-foreground " style={downloadProgressStyle} />
    </span>
  );
}

ProgressBar.propTypes = propTypes;

function AttachmentActionIcon(props) {
  const {
    missing,
    isDownloading,
    removeIcon,
    downloadIcon,
    retinaImgMode,
    onAbortDownload,
    onRemoveAttachment,
    onDownloadAttachment,
    disabled,
    isIcon,
    style,
  } = props;

  const isRemovable = onRemoveAttachment != null && !disabled;
  const actionIconName = isRemovable ? removeIcon : downloadIcon;

  const onClickActionIcon = event => {
    if (missing || isDownloading) {
      return;
    }
    event.stopPropagation(); // Prevent 'onOpenAttachment'
    if (isRemovable) {
      onRemoveAttachment();
    } else if (onDownloadAttachment != null) {
      onDownloadAttachment();
    }
  };

  const fileActionIconStyle = {};
  if (actionIconName === removeIcon) {
    fileActionIconStyle.opacity = 1;
    fileActionIconStyle.transform = 'scale(0.7)';
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
      fileIconName,
      filePreviewPath,
      disabled,
      isImage,
      filePath,
      contentType,
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
    const { devicePixelRatio } = window;

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
          <div
            className="popup"
            style={{
              display: `${this.state.displaySupportPopup ? 'inline-block' : 'none'}`,
            }}
          >
            Download Success
          </div>
          <ProgressBar isDownloading={this.state.isDownloading} percent={this.state.percent} />
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
                <div className="attachment-action-bar">
                  {this._canPreview() ? (
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
                  ) : null}
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

  renderImage() {
    const { isDownloading, filePath, draggable } = this.props;
    if (isDownloading || this.state.isDownloading) {
      return (
        <div style={{ width: '100%', height: '100px' }}>
          <Spinner visible />
        </div>
      );
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
      />
    );
  }

  render() {
    const { className, displayName, disabled, ...extraProps } = this.props;
    const classes = `nylas-attachment-item image-attachment-item ${className || ''}`;
    return (
      <div className={classes} {...pickHTMLProps(extraProps)} onMouseUp={this._onImageHover}>
        <div>
          <div
            className="popup"
            style={{
              display: `${this.state.displaySupportPopup ? 'inline-block' : 'none'}`,
            }}
          >
            Download Success
          </div>
          <ProgressBar isDownloading={this.state.isDownloading} percent={this.state.percent} />
          <AttachmentActionIcon
            {...this.props}
            removeIcon="image-cancel-button.png"
            downloadIcon="image-download-button.png"
            isDownloading={this.state.isDownloading || this.props.isDownloading}
            retinaImgMode={RetinaImg.Mode.ContentPreserve}
            onAbortDownload={null}
          />
          <div className="file-preview" onDoubleClick={!disabled ? this._onOpenAttachment : null}>
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
}
