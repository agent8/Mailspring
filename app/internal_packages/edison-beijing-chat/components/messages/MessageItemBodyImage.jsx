import React, { Component } from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import path from 'path';
import fs from 'fs';

import { AccountStore } from 'mailspring-exports';
import { FILE_TYPE, isImage } from '../../utils/filetypes';
import { ChatActions, MessageStore } from 'chat-exports';

class MessageItemBodyImage extends Component {
  constructor(props) {
    super(props);
    this.state = { msgImgPath: '' };
    this.onClickImage = this.onClickImage.bind(this);
    this.checkImgHasDownloaded = this.checkImgHasDownloaded.bind(this);
    this.updateDownload = this.updateDownload.bind(this);
  }

  componentDidMount() {
    setTimeout(() => {
      this.checkImgHasDownloaded();
    });
    this.setState({
      msgImgPath: this.getImageFilePath(this.props.msgBody),
    });
    this.unlistens = [
      ChatActions.updateDownload.listen(this.updateDownload),
      //   ChatActions.updateProgress.listen(this.updateProgress),
    ];
  }

  componentWillUnmount() {
    for (let unlisten of this.unlistens) {
      unlisten();
    }
  }

  updateDownload(imgId) {
    const { msgBody } = this.props;
    const { mediaObjectId, thumbObjectId } = msgBody;
    const msgImgPath = this.getImageFilePath(msgBody);
    if (imgId === mediaObjectId || imgId === thumbObjectId) {
      msgBody.downloading = false;
      this.setState({ imgId, msgImgPath });
    }
  }

  getImageFilePath = msgBody => {
    const senderInfo = this.senderContact();
    const isSendByMyself = AccountStore.isMyEmail(senderInfo.email);
    // 本地图片
    const localFile = msgBody.localFile && msgBody.localFile.replace('file://', '');
    // 原图
    const originalPath = msgBody.path && msgBody.path.replace('file://', '');
    // 缩略图
    const thumbPath = originalPath && originalPath.replace('/download/', '/download/thumbnail-');

    // 网络地址
    if (originalPath && originalPath.match(/^http/)) {
      return originalPath;
    }
    if (isSendByMyself && localFile && fs.existsSync(localFile)) {
      return localFile;
    }
    // 不是图片
    if (!isImage(msgBody.type)) {
      return originalPath;
    }
    // 有缩略图用缩略图
    if (thumbPath && fs.existsSync(thumbPath)) {
      return thumbPath;
    }
    // 没有缩略图用原图
    if (originalPath && fs.existsSync(originalPath)) {
      return originalPath;
    }
  };

  senderContact() {
    const { msg, getContactInfoByJid } = this.props;
    return getContactInfoByJid(msg.sender);
  }

  onClickImage(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.src) {
      const originalPath = decodeURI(e.target.src)
        .replace('file://', '')
        .replace('thumbnail-', '');
      this.previewAttachment(originalPath);

      if (!fs.existsSync(originalPath)) {
        this.checkImgHasDownloaded();
      }
    }
  }

  previewAttachment(filePath) {
    const currentWin = AppEnv.getCurrentWindow();
    currentWin.previewFile(filePath);
  }

  checkImgHasDownloaded() {
    const { msg, msgBody } = this.props;
    const { msgImgPath } = this.state;
    if (msgBody.mediaObjectId && !msgImgPath) {
      MessageStore.downloadAndTagImageFileInMessage(msg);
    }
  }

  render() {
    const { msgBody } = this.props;
    const { msgImgPath } = this.state;

    if (msgImgPath) {
      return (
        <div className="message-image">
          <img src={msgImgPath} onClick={this.onClickImage} alt="" />
        </div>
      );
    }

    if (msgBody.downloading) {
      return (
        <div className="loading">
          <div> Downloading...</div>
          <RetinaImg name="inline-loading-spinner.gif" mode={RetinaImg.Mode.ContentPreserve} />
        </div>
      );
    }

    if (msgBody.isUploading) {
      return (
        <div>
          Uploading {msgBody.localFile && path.basename(msgBody.localFile)}
          <RetinaImg name="inline-loading-spinner.gif" mode={RetinaImg.Mode.ContentPreserve} />
        </div>
      );
    }

    return (
      <div>
        <div>{msgBody.content}</div>
        <RetinaImg
          name="image-not-found.png"
          style={{ width: 24, height: 24 }}
          mode={RetinaImg.Mode.ContentPreserve}
        />
      </div>
    );
  }
}

export default MessageItemBodyImage;
