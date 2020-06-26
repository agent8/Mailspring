import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Actions,
  Utils,
  AttachmentStore,
  MessageStore,
  AccountStore,
  Constant,
} from 'mailspring-exports';
import { AttachmentItem } from 'mailspring-component-kit';

const { DisableAttachmentProgressProvider } = Constant;

class MessageAttachments extends Component {
  static displayName = 'MessageAttachments';

  static containerRequired = false;

  static propTypes = {
    files: PropTypes.array,
    accountId: PropTypes.string,
    downloads: PropTypes.object,
    headerMessageId: PropTypes.string,
    filePreviewPaths: PropTypes.object,
    canRemoveAttachments: PropTypes.bool,
  };

  static defaultProps = {
    downloads: {},
    filePreviewPaths: {},
  };

  onOpenAttachment = file => {
    if (MessageStore.isAttachmentMissing(file.id)) {
      Actions.fetchAttachments({
        accountId: this.props.accountId,
        missingItems: [file.id],
        needProgress: true,
        source: 'Click',
      });
    } else {
      Actions.fetchAndOpenFile(file);
    }
  };

  onRemoveAttachment = file => {
    const { headerMessageId } = this.props;
    Actions.removeAttachment({
      headerMessageId: headerMessageId,
      file: file,
    });
  };

  onDownloadAttachment = file => {
    Actions.fetchAndSaveFile(file);
  };

  onAbortDownload = file => {
    Actions.abortFetchFile(file);
  };

  renderAttachment(AttachmentRenderer, file, isImage = false) {
    const { canRemoveAttachments, downloads, filePreviewPaths, headerMessageId } = this.props;
    const download = downloads[file.id];
    const filePath = AttachmentStore.pathForFile(file);
    const fileIconName = `file-${file.displayExtension()}.png`;
    const displayName = file.displayName();
    const displaySize = file.displayFileSize();
    const contentType = file.contentType;
    const displayFilePreview = AppEnv.config.get('core.attachments.displayFilePreview');
    const filePreviewPath = displayFilePreview ? filePreviewPaths[file.id] : null;
    const provider = AccountStore.accountForId(this.props.accountId).provider;
    const disableProgress = DisableAttachmentProgressProvider.includes(provider);

    return (
      <AttachmentRenderer
        key={file.id}
        fileId={file.id}
        focusable
        previewable
        isImage={isImage}
        filePath={filePath}
        download={download}
        isDownloading={file.isDownloading}
        disableProgress={disableProgress}
        missing={MessageStore.isAttachmentMissing(file.id)}
        contentType={contentType}
        displayName={displayName}
        displaySize={displaySize}
        fileIconName={fileIconName}
        filePreviewPath={filePreviewPath}
        accountId={this.props.accountId}
        onOpenAttachment={() => this.onOpenAttachment(file)}
        onDownloadAttachment={() => this.onDownloadAttachment(file)}
        onAbortDownload={() => this.onAbortDownload(file)}
        onRemoveAttachment={
          canRemoveAttachments ? () => this.onRemoveAttachment(headerMessageId, file) : null
        }
      />
    );
  }

  render() {
    const { files } = this.props;
    const nonImageFiles = files.filter(f => !Utils.shouldDisplayAsImage(f));
    const imageFiles = files.filter(f => Utils.shouldDisplayAsImage(f));
    return (
      <div>
        {nonImageFiles.map(file => this.renderAttachment(AttachmentItem, file))}
        {imageFiles.map(file => this.renderAttachment(AttachmentItem, file, true))}
      </div>
    );
  }
}

export default MessageAttachments;
