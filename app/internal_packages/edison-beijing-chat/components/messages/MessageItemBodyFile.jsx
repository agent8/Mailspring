import React, { Component } from 'react';
import path from 'path';
import fs from 'fs';
import { RetinaImg } from 'mailspring-component-kit';
import { AttachmentStore } from 'mailspring-exports';
import { remote } from 'electron';
// import { FILE_TYPE } from '../../utils/filetypes';

// function shouldDisplayFileIcon({ mediaObjectId, type }) {
//   return mediaObjectId && type === FILE_TYPE.OTHER_FILE;
// }

class MessageItemBodyFile extends Component {
  constructor(props) {
    super(props);
    this.clickFileCoordinate = this.clickFileCoordinate.bind(this);
  }

  clickFileCoordinate() {
    let filePath = this.props.msgBody.path;
    this._clickTime = (this._clickTime || 0) + 1;
    this._clickTimeout = setTimeout(() => {
      if (this._clickTimeout) {
        clearTimeout(this._clickTimeout);
        this._clickTimeout = null;
      }
      const fileHasDownload = fs.existsSync(filePath);
      if (!fileHasDownload) {
        // 下载文件
        this.downloadFile(filePath);
      } else if (this._clickTime === 2) {
        // 打开文件
        this.openFile(filePath);
      }
      this._clickTime = 0;
    }, 300);
  }

  downloadFile(filePath) {
    const msgBody = this.props.msgBody;
    if (!filePath || typeof filePath !== 'string') {
      return;
    }
    const loadConfig = {
      msgBody,
      filepath: filePath,
      type: 'download',
    };
    const { queueLoadMessage } = this.props;
    queueLoadMessage(loadConfig);
  }

  openFile(filePath) {
    remote.shell.openPath(filePath);
  }

  render() {
    const { msgBody } = this.props;

    // if (!shouldDisplayFileIcon(msgBody)) {
    //   return null;
    // }
    const filepath = msgBody.localFile || msgBody.path;
    const fileName = filepath ? path.basename(filepath) : '';
    let extName = path.extname(filepath || 'x.doc').slice(1);
    let iconName;
    let style = {};
    if (filepath) {
      let iconInfo = AttachmentStore.getExtIconName(filepath);
      iconName = iconInfo.iconName;
      style.backgroundColor = iconInfo.color;
    }
    let isVideo = AttachmentStore.isVideo(filepath);

    return (
      <div className="message-file">
        <div className="file-info" onClick={this.clickFileCoordinate}>
          <div className="file-icon">
            <RetinaImg name={iconName} style={style} isIcon mode={RetinaImg.Mode.ContentIsMask} />
          </div>
          <div>
            <div className="file-name">{fileName}</div>
            <div className="ext">{extName.toUpperCase()}</div>
          </div>
        </div>
        {isVideo && fs.existsSync(msgBody.path) && (
          <div className="video-wrapper">
            <video controls src={msgBody.path} />
          </div>
        )}
      </div>
    );
  }
}

export default MessageItemBodyFile;
