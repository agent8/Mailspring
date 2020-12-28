import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { RetinaImg, LabelColorizer } from 'mailspring-component-kit';
import { Actions, TaskFactory, TaskQueue } from 'mailspring-exports';

export default class LabelPopover extends Component {
  static propTypes = {
    account: PropTypes.object.isRequired,
    onCancel: PropTypes.func,
    left: PropTypes.number,
    top: PropTypes.number,
    onActionCallback: PropTypes.func,
    isNew: PropTypes.bool,
    name: PropTypes.string,
    buttonTimeout: PropTypes.number,
    visible: PropTypes.bool,
    originalBgColor: PropTypes.number,
  };
  static defaultProps = {
    left: 490,
    top: 107,
    buttonTimeout: 700, // timeout
    isNew: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      newName: this.props.name || '',
      alsoMove: true,
      isBusy: false,
      bgColor: props.originalBgColor || 0,
    };
    this._mounted = false;
    this._buttonTimer = null;
    this._buttonTimestamp = 0;
  }

  componentDidMount() {
    this._mounted = true;
    document.body.addEventListener('click', this.onBlur);
  }

  componentWillUnmount() {
    this._mounted = false;
    document.body.removeEventListener('click', this.onBlur);
    clearTimeout(this._buttonTimer);
  }

  onCancel = () => {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  };

  onBlur = e => {
    const rect = this.container.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed) {
        return;
      }
      this.onCancel();
    }
  };

  _onBusyTimeout = () => {
    if (!this._mounted) {
      return;
    }
    if (!this._buttonTimer) {
      this._buttonTimestamp = Date.now();
      this._buttonTimer = setTimeout(() => {
        this.setState({ isBusy: false });
        this._buttonTimer = null;
      }, this.props.buttonTimeout * 2);
    }
  };
  _onActionCallback = data => {
    if (typeof this.props.onActionCallback === 'function') {
      this.props.onActionCallback(data);
    }
  };
  _onResultReturned = () => {
    if (!this._mounted) {
      return;
    }
    if (!this._buttonTimer) {
      this._buttonTimestamp = Date.now();
      this._buttonTimer = setTimeout(() => {
        this.setState({ isBusy: false });
        this._buttonTimer = null;
      }, this.props.buttonTimeout);
    } else {
      const now = Date.now();
      clearTimeout(this._buttonTimer);
      if (now - this._buttonTimestamp < this.props.buttonTimeout) {
        this._buttonTimestamp = Date.now();
        this._buttonTimer = setTimeout(() => {
          this.setState({ isBusy: false });
          this._buttonTimer = null;
        }, this.props.buttonTimeout);
      } else {
        this._buttonTimer = null;
        this.setState({ isBusy: false });
      }
    }
  };
  _onCreateCategory = () => {
    this.setState({ isBusy: true });
    let task;
    if (this.props.isNew) {
      task = TaskFactory.tasksForCreatingPath({
        name: this.state.newName,
        bgColor: this.state.bgColor,
        accountId: this.props.account.id,
      });
    } else {
      task = TaskFactory.tasksForEditingLabel({
        accountId: this.props.account.id,
        currentName: this.props.name,
        newName: this.state.newName,
        newColor: this.state.bgColor,
      });
    }
    this._onResultReturned();
    if (task) {
      Actions.queueTask(task);
      TaskQueue.waitForPerformRemote(task).then(finishedTask => {
        if (finishedTask.error) {
          AppEnv.showErrorDialog({
            title: 'Error',
            message: `Could not ${
              this.props.isNew ? 'create' : 'edit'
            } label.${finishedTask.error && finishedTask.error.debuginfo}`,
          });
          return;
        }
        this._onActionCallback({ newLabels: [finishedTask.created] });
      });
      Actions.closePopover();
    }
  };

  _onNameChange = e => {
    if (!this.state.isBusy) {
      this.setState({ newName: e.target.value });
    }
  };

  onCheckColor = bgColor => {
    this.setState({
      bgColor,
    });
  };

  renderButtons() {
    const text = this.props.isNew ? 'Create Label' : 'Edit Label';
    return (
      <div className="button-row">
        <button className="create-folder-btn-cancel" title="Cancel" onClick={this.onCancel}>
          <span>Cancel</span>
        </button>
        <button
          className="create-folder-btn-create"
          title="Create Folder"
          disabled={this.state.newName.length === 0}
          onClick={this._onCreateCategory}
        >
          {this.state.isBusy || this._buttonTimer ? (
            <RetinaImg
              name={'sending-spinner.gif'}
              style={{ width: 24 }}
              mode={RetinaImg.Mode.ContentIsMask}
            />
          ) : (
            <span>{text}</span>
          )}
        </button>
      </div>
    );
  }

  render() {
    const title = this.props.isNew ? 'New Label' : 'Edit Label';
    return (
      <div
        ref={el => (this.container = el)}
        className={`create-folder-container has-color-choice ${this.props.visible ? 'hide' : ''}`}
      >
        <div className={'header-row'}>
          <span className="close" onClick={this.onCancel}>
            <RetinaImg
              name="close_1.svg"
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              style={{ width: 20, height: 20 }}
            />
          </span>
        </div>
        <div className="header-text-container">
          <div className="header-text">{title}</div>
          <div className="header-subtext">What do you want to name it?</div>
        </div>
        <input
          className="folder-input"
          value={this.state.newName}
          placeholder={'Name'}
          disabled={this.state.isBusy}
          onChange={this._onNameChange}
        />
        <div>
          <div className="header-subtext">Pick a color for your label:</div>
          <div className="color-choice">
            {LabelColorizer.colors.map((color, idx) => {
              const className = this.state.bgColor === idx ? 'checked' : '';
              return (
                <div
                  key={color}
                  className={className}
                  style={{ background: color }}
                  onClick={() => this.onCheckColor(idx)}
                >
                  <RetinaImg
                    className="check-img check"
                    name="tagging-checkmark.png"
                    mode={RetinaImg.Mode.ContentPreserve}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {this.renderButtons()}
      </div>
    );
  }
}
