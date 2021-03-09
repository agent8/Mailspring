import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
import { Actions, NoteStore } from 'mailspring-exports';
import { labelOptions } from './note-labels';
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
    const { labels = [] } = this.state;
    const isChecked = !labels.includes(label);
    if (isChecked) {
      labels.push(label);
    } else {
      labels.splice(labels.indexOf(label), 1);
    }

    this.setState({ labels });
    NoteStore.setLabels(this.props.thread.id, labels);
  };

  _renderLabel() {
    const { labels = [] } = this.state;
    return labelOptions.map(({ value, label }) => (
      <span
        onClick={() => this.setLabel(value)}
        key={value}
        className={`${value} ${label ? 'label' : 'color'} ${
          labels.includes(value) ? 'checked' : ''
        }`}
      >
        <RetinaImg
          name={'check-alone.svg'}
          style={{ width: 18, height: 18, fontSize: 18 }}
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

  dateRender = (date, today) => {
    return (
      <div
        style={{
          width: 80,
          height: 80,
          borderTop: '3px solid #CCC',
          borderTopColor: date.isSame(today, 'date') ? 'blue' : '#CCC',
        }}
      >
        {date.date()}
      </div>
    );
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
          rows="7"
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
          <button className="btn">Add a reminder</button>
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
