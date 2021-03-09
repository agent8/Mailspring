import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { AccountStore, Actions, NoteStore } from 'mailspring-exports';

export const labelOptions = [
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
];

export default class NoteLabels extends Component {
  static propTypes = {
    thread: PropTypes.object,
  };
  static displayName = 'NoteLabels';
  constructor(props) {
    super(props);
    this.state = this.getStateFromStore(props);
  }

  componentDidMount() {
    this.unsubscribers = [];
    this.unsubscribers.push(
      Actions.noteSaved.listen(() => this.setState(this.getStateFromStore(this.props)), this)
    );
  }

  componentWillUnmount() {
    this.unsubscribers.map(unsubscribe => unsubscribe());
  }

  getStateFromStore = props => {
    const { labels } = NoteStore.getNoteById(props.thread.id);
    return {
      labels,
    };
  };

  _renderLabel() {
    const { labels } = this.state;
    if (!labels) {
      return null;
    }
    return labelOptions
      .filter(({ value }) => labels.includes(value))
      .map(({ value, label }) => (
        <span key={value} className={`${value} ${label ? 'label' : 'color'}`}>
          {label}
        </span>
      ));
  }

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

    return <div className="note-labels">{this._renderLabel()}</div>;
  }
}
