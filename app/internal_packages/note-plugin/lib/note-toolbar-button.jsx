import React, { Component } from 'react';
import PropTypes from 'prop-types';
import NoteEditor from './note-editor';
const { RetinaImg } = require('mailspring-component-kit');
const { AccountStore } = require('mailspring-exports');
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

  UNSAFE_componentWillReceiveProps = nextProps => {
    if (nextProps.thread || nextProps.thread.id !== this.props.thread.id) {
      this.setState({
        active: false,
      });
    }
  };

  toggleInput = () => {
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
    const { active } = this.state;
    return (
      <div className="button-group message-toolbar-note" style={{ order: -1 }}>
        <div
          className={`btn-toolbar ${active ? 'active' : ''}`}
          key="note-plugin"
          title="note plugin"
          onClick={this.toggleInput}
        >
          <RetinaImg
            name={'attachment-doc.svg'}
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
        {active && (
          <NoteEditor thread={this.props.thread} onClose={() => this.setState({ active: false })} />
        )}
      </div>
    );
  }
}
