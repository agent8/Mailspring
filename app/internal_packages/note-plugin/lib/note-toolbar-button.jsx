import React, { Component } from 'react';
import PropTypes from 'prop-types';
const { RetinaImg } = require('mailspring-component-kit');
const { AccountStore, Actions } = require('mailspring-exports');
export default class NoteToolbarButton extends Component {
  static propTypes = {
    thread: PropTypes.object,
  };
  static displayName = 'NoteToolbarButton';
  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
  }
  toggleJira = () => {
    Actions.toggleJiraPlugin(!this.state.active);
    this.setState({
      active: !this.state.active,
    });
  };
  render() {
    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!this.props.thread || !isEdisonMail) {
      return null;
    }
    return (
      <div className="button-group" style={{ order: -1 }}>
        <div
          className={`btn-toolbar message-toolbar-note ${this.state.active ? 'active' : ''}`}
          key="note-plugin"
          title="note plugin"
          onClick={this.toggleJira}
        >
          <RetinaImg
            name={'attachment-doc.svg'}
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
          <div className="note-input-area">
            <textarea rows="10"></textarea>
            <div className="note-labels"></div>
            <button>Delete</button>
            <button>Save</button>
          </div>
        </div>
      </div>
    );
  }
}
