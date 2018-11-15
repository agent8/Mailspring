import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import TextArea from 'react-autosize-textarea';
import Button from '../../common/Button';
import FilePlusIcon from '../../common/icons/FilePlusIcon';
import SendIcon from '../../common/icons/SendIcon';
import { theme } from '../../../utils/colors';
import { uploadFile } from '../../../utils/awss3';
import RetinaImg from '../../../../../../src/components/retina-img';

import uuid from 'uuid/v4';

const platform = require('electron-platform')
const {clipboard} = require('electron');
const plist = require('plist');

//linux is not implemented because no method was found after googling a lot
// only be tested on mac, not be tested on Windows
//https://github.com/electron/electron/issues/9035
function getClipboardFiles() {
  if (platform.isDarwin) {
    if (!clipboard.has('NSFilenamesPboardType')) {
      // this check is neccessary to prevent exception while no files is copied
      return [];
    } else {
      return plist.parse(clipboard.read('NSFilenamesPboardType'));
    }
  } else if (platform.isWin32) {
    clipboard.readBuffer('FileNameW').replace(RegExp(String.fromCharCode(0), 'g'), '');
  }
}

export default class MessagesSendBar extends PureComponent {
  static propTypes = {
    onMessageSubmitted: PropTypes.func.isRequired,
    selectedConversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,//.isRequired,
      isGroup: PropTypes.bool.isRequired
    }).isRequired,
  }

  static defaultProps = {
    selectedConversation: null
  }

  state = {
    messageBody: '',
    files: [],
  }

  fileInput = null;
  textarea = null;

  onMessageBodyKeyPressed(event) {
    const { nativeEvent } = event;
    if (nativeEvent.keyCode === 13 && !nativeEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
      return false;
    }
    return true;
  }

  onMessageBodyChanged(event) {
    const { target: { value } } = event;
    let state = Object.assign({}, this.state, { messageBody: value });
    this.setState(state);
  }

  sendMessage() {
    const { messageBody } = this.state;
    const { selectedConversation, onMessageSubmitted } = this.props;
    const atIndex = selectedConversation.jid.indexOf('@')
    let jidLocal = selectedConversation.jid.slice(0, atIndex);

    if (!selectedConversation) {
      return;
    }

    if (this.state.files.length) {
      this.state.files.map((file, index) => {
        let message;
        if (index === 0) {
          message = messageBody.trim();
        } else {
          message = 'file received';
        }
        let body = {
          type: 1,
          timeSend: new Date().getTime(),
          content: 'sending...',
          email: selectedConversation.email,
          name: selectedConversation.name,
          mediaObjectId: '',
        };
        const messageId = uuid();
        onMessageSubmitted(selectedConversation, JSON.stringify(body), messageId, true);
        uploadFile(jidLocal, null, file, (err, filename, myKey, size) => {
          if (err) {
            alert(`upload files failed, filename: ${filename}`);
            return;
          }
          body.content = message || " ";
          body.mediaObjectId = myKey;
          onMessageSubmitted(selectedConversation, JSON.stringify(body), messageId, false);
        });
      })
    } else {
      let message = messageBody.trim();
      if (message) {
        let body = {
          type: 1,
          timeSend: new Date().getTime(),
          content: message,
          email: selectedConversation.email,
          name: selectedConversation.name,
        };
        onMessageSubmitted(selectedConversation, JSON.stringify(body));//message);
      }

    }
    this.setState({ messageBody: '', files: [] });
  }
  onFileChange = event => {
    let state,
      files = [];
    // event.target.files is type FileList
    // it need be converted to Array  to use this.state.files.map(...) in jsx
    for (let file of event.target.files) {
      files.push(file.path);
    }
    state = Object.assign({}, this.state, { files });
    this.setState(state);
    event.target.value = '';
    // event.target.files = new window.FileList();
  }

  onDrop = (e) => {
    let tranFiles = e.dataTransfer.files,
      files = this.state.files.slice();
    for (let i=0; i++; i<tranFiles.length){
      files.push(tranFiles[i].path);
    }
    this.setState(Object.assign({}, this.state, { files }));
  }

  onKeyDown = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.keyCode === 86 && (e.ctrlKey || e.metaKey)) {
      let files;
        // try-catch is neccessary to prevent exception
      // while the clipboard is containing files copied from non standard system application(e.g. webstorm)
        try {
        files = getClipboardFiles();
        }
        catch(e) {
        }
      files = this.state.files.concat(files);
      this.setState(Object.assign({}, this.state, { files }));
    }
  }

  render() {
    return (
      <div className="sendBar">
        <div className="sendBarActions">
          <Button
            onTouchTap={() => {
              this.fileInput.click();
            }}
          >
            <FilePlusIcon color={theme.primaryColor} />
            <input
              style={{ display: 'none' }}
              ref={element => { this.fileInput = element; }}
              type="file"
              multiple
              onChange={this.onFileChange}
            />
          </Button>
        </div>
        <div className="messageTextField" onDrop={this.onDrop} onKeyDown={this.onKeyDown}>
          <TextArea
            className="messageTextField"
            placeholder="Write a message..."
            rows={1}
            maxRows={5}
            value={this.state.messageBody}
            onChange={this.onMessageBodyChanged.bind(this)}
            onKeyPress={this.onMessageBodyKeyPressed.bind(this)}
            ref={element => { this.textarea = element; }}
            onKeyDown={this.onKeyDown}
          />
          <div className="chat-message-filelist">
            {this.state.files.map((file, index) => {
              return <RetinaImg
                name="fileIcon.png"
                mode={RetinaImg.Mode.ContentPreserve}
                key={index}
              />;
            })}
          </div>
        </div>
        <div className="sendBarActions">
          <Button onTouchTap={this.sendMessage.bind(this)}>
            <SendIcon color={theme.primaryColor} />
          </Button>
        </div>
      </div>
    );
  }
}
