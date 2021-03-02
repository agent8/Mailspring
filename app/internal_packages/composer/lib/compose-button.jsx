import React from 'react';
import PropTypes from 'prop-types';
import { Actions } from 'mailspring-exports';
import { RetinaImg, LottieImg } from 'mailspring-component-kit';

const buttonTimeout = 700;
export default class ComposeButton extends React.Component {
  static displayName = 'ComposeButton';

  constructor(props) {
    super(props);
    this.state = { creatingNewDraft: false, showLoading: false, isEditingMenu: false };
    this._sendButtonClickedTimer = null;
    this._loadingButtonTimer = null;
    this._mounted = false;
    this._unlisten = [
      Actions.composedNewBlankDraft.listen(this._onNewDraftCreated, this),
      Actions.setEditingMenu.listen(this._onEditingMenu),
    ];
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this._sendButtonClickedTimer);
    clearTimeout(this._loadingButtonTimer);
    for (let unListen of this._unlisten) {
      unListen();
    }
  }

  _timoutButton = () => {
    if (!this._sendButtonClickedTimer) {
      this._sendButtonClickedTimer = setTimeout(() => {
        clearTimeout(this._loadingButtonTimer);
        if (this._mounted) {
          this.setState({ creatingNewDraft: false, showLoading: false });
        }
        this._sendButtonClickedTimer = null;
      }, buttonTimeout);
    }
  };
  _onEditingMenu = isEditing => {
    this.setState({ isEditingMenu: isEditing });
  };

  _onNewDraftCreated = () => {
    if (!this._mounted) {
      return;
    }
    clearTimeout(this._loadingButtonTimer);
    if (this._sendButtonClickedTimer) {
      return;
    }
    this._sendButtonClickedTimer = setTimeout(() => {
      if (this._mounted) {
        this.setState({ creatingNewDraft: false, showLoading: false });
      }
      this._sendButtonClickedTimer = null;
    }, buttonTimeout);
  };
  _delayShowLoading = () => {
    this._loadingButtonTimer = setTimeout(() => {
      if (this._mounted) {
        this.setState({ showLoading: true });
      }
    }, buttonTimeout);
  };

  _onNewCompose = () => {
    if (!this.state.creatingNewDraft && !this._sendButtonClickedTimer) {
      this._timoutButton();
      this._delayShowLoading();
      this.setState({ creatingNewDraft: true });
      Actions.composeNewBlankDraft();
    }
  };

  render() {
    if (this.state.isEditingMenu) {
      return null;
    }
    return (
      <div
        className="sheet-toolbar"
        style={{ position: 'unset', height: 'unset', padddingLeft: 15, paddingTop: 30 }}
      >
        <button
          className={`btn btn-toolbar item-compose ${
            this.state.creatingNewDraft ? 'btn-disabled' : ''
          }`}
          title="Compose new message"
          disabled={this.state.creatingNewDraft}
          onClick={this._onNewCompose}
        >
          {this.state.showLoading ? (
            <LottieImg
              name="loading-spinner-blue"
              size={{ width: 20, height: 20 }}
              style={{ margin: 'none' }}
            />
          ) : (
            <RetinaImg
              name="pencil.svg"
              style={{ width: 20, height: 20 }}
              isIcon={true}
              mode={RetinaImg.Mode.ContentIsMask}
            />
          )}
          <span>Compose</span>
        </button>
      </div>
    );
  }
}
