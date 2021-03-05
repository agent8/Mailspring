import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
const { Actions, NoteStore } = require('mailspring-exports');
export default class NoteEditor extends Component {
  static propTypes = {
    thread: PropTypes.object,
    onClose: PropTypes.func.isRequired,
  };
  static displayName = 'NoteEditor';
  constructor(props) {
    super(props);
    this.state = {
      content: '',
    };
  }

  componentDidMount() {
    this._mounted = true;
    this.setState(this.getStateFromStore(this.props));
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  UNSAFE_componentWillReceiveProps = nextProps => {
    if (nextProps.thread || nextProps.thread.id !== this.props.thread.id) {
      this.setState(this.getStateFromStore(nextProps));
    }
  };

  getStateFromStore = props => {
    const { content, labels } = NoteStore.getNoteById(props.thread.id);
    return { content, labels };
  };

  save = (e, closePopover) => {
    if (this.inputRef) {
      this.setState({ content: this.inputRef.value });
      if (this.props.thread) {
        NoteStore.saveNote(this.props.thread.id, this.inputRef.value);
      }
    }
    if (closePopover) {
      this.props.onClose();
      Actions.noteSaved();
    }
  };

  delete = () => {
    if (this.inputRef) {
      this.inputRef.value = '';
    }
    this.setState({ content: '' });
    if (this.props.thread) {
      NoteStore.deleteNote(this.props.thread.id);
    }
    Actions.noteSaved();
    this.props.onClose();
  };

  onKeyDown = e => {
    // ESC
    if (e.keyCode === 27) {
      Actions.noteSaved();
      this.props.onClose();
    }
  };

  setLabel = label => {
    const { labels = {} } = this.state;
    const isChecked = !labels[label];
    labels[label] = isChecked;
    this.setState({ labels });
    NoteStore.setLabel(this.props.thread.id, this.inputRef.value, isChecked);
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
    return labelOptions.map(({ value, label }) => (
      <span
        onClick={() => this.setLabel(value)}
        key={value}
        className={`${value} ${label ? 'label' : 'color'} ${labels[value] ? 'checked' : ''}`}
      >
        <RetinaImg
          name={'check-alone.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        {label}
      </span>
    ));
  }

  onBlur = () => {
    // setTimeout(() => {
    //   if (this._mounted) {
    //     this.props.onClose();
    //   }
    // }, 10);
  };

  render() {
    if (!this.props.thread) {
      return null;
    }
    const { content } = this.state;
    return (
      <div className="note-input-area" onBlur={this.onBlur}>
        <textarea
          autoFocus
          ref={el => (this.inputRef = el)}
          rows="8"
          onInput={this.save}
          defaultValue={content}
        ></textarea>
        <div className="button-wrapper">
          <button className="btn btn-save" onClick={e => this.save(e, true)}>
            Save
          </button>
          <button className="btn btn-close" onClick={this.props.onClose}>
            Close
          </button>
          <div className="note-labels">{this._renderLabel()}</div>
          <button className="btn btn-trash" onClick={this.delete}>
            <RetinaImg
              name={'trash.svg'}
              style={{ width: 24, height: 24, fontSize: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </button>
        </div>
      </div>
    );
  }
}
