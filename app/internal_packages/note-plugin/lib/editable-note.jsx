import React, { Component } from 'react';
import PropTypes from 'prop-types';
import NoteEditor from './note-editor';
import { RetinaImg } from 'mailspring-component-kit';
const { AccountStore, Actions, NoteStore } = require('mailspring-exports');
export default class EditableNote extends Component {
  static propTypes = {
    thread: PropTypes.object,
  };
  static displayName = 'EditableNote';
  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
  }

  componentDidMount() {
    this.unsubscribers = [];
    this.unsubscribers.push(
      Actions.noteSaved.listen(() => this.setState(this.getStateFromStore(this.props)), this)
    );
    this.setState(this.getStateFromStore(this.props));
  }

  componentWillUnmount() {
    this.unsubscribers.map(unsubscribe => unsubscribe());
  }

  getStateFromStore = props => {
    const { content, labels } = NoteStore.getNoteById(props.thread.id);
    return {
      content,
      labels,
    };
  };

  UNSAFE_componentWillReceiveProps = nextProps => {
    if (nextProps.thread || nextProps.thread.id !== this.props.thread.id) {
      this.setState({
        active: false,
      });
      this.setState(this.getStateFromStore(nextProps));
    }
  };

  toggleInput = () => {
    this.setState({
      active: !this.state.active,
    });
  };

  onKeyDown = e => {
    // ESC
    if (e.keyCode === 27) {
      this.setState({ active: false });
    }
  };

  _renderLabel() {
    const { labels = {} } = this.state;
    const labelOptions = [
      {
        value: 'red',
        label: '',
      },
      {
        value: 'yellow',
        label: '',
      },
      {
        value: 'green',
        label: '',
      },
      {
        value: 'todo',
        label: 'Todo',
      },
      {
        value: 'done',
        label: 'Done',
      },
    ];
    return labelOptions
      .filter(({ value }) => labels[value])
      .map(({ value, label }) => (
        <span key={value} className={`${value} ${label ? 'label' : 'color'}`}>
          {label}
        </span>
      ));
  }

  _renderNote = () => {
    const { content } = this.state;
    if (!content || content.trim().length === 0) {
      return null;
    }
    return (
      <div>
        <div className="note-content" onClick={() => this.setState({ active: true })}>
          <span className="note-title">Note:</span>
          {content}
          <br />
          <div className="note-labels">{this._renderLabel()}</div>
        </div>
      </div>
    );
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
      <div className="editable-note" style={{ order: -1 }}>
        {active ? (
          <NoteEditor thread={this.props.thread} onClose={() => this.setState({ active: false })} />
        ) : (
          this._renderNote()
        )}
      </div>
    );
  }
}
