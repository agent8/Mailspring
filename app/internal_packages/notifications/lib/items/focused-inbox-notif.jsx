import { React } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';
import { FocusedPerspectiveStore } from 'mailspring-exports';

const PromptedFocusedInboxKey = 'core.workspace.promptedFocusedInbox';
const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';

export default class FocusedInboxNotif extends React.Component {
  static displayName = 'FocusedInboxNotif';

  constructor() {
    super();
    this.state = {
      showEnableFocusedInbox: false,
    };
  }

  componentDidMount() {
    if (AppEnv.config.get(PromptedFocusedInboxKey)) {
      return;
    }
    this._shouldShowEnableFocusedInbox();
    this._unlisten = FocusedPerspectiveStore.listen(this._shouldShowEnableFocusedInbox);
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  _shouldShowEnableFocusedInbox = () => {
    const focusedPerspective = FocusedPerspectiveStore.currentSidebar();

    if (
      AppEnv.config.get(PromptedFocusedInboxKey) ||
      !focusedPerspective ||
      !focusedPerspective.isInbox() ||
      this.state.showEnableFocusedInbox
    ) {
      return;
    }
    this.setState({
      showEnableFocusedInbox: true,
    });
  };

  _onCloseEnableFocusedInboxModal = () => {
    AppEnv.config.set(PromptedFocusedInboxKey, true);
    this.setState({
      showEnableFocusedInbox: false,
    });
  };

  _onClickButton = enable => {
    AppEnv.config.set(EnableFocusedInboxKey, enable);
    this._onCloseEnableFocusedInboxModal();
  };

  render() {
    return (
      <FullScreenModal
        visible={this.state.showEnableFocusedInbox}
        onCancel={this._onCloseEnableFocusedInboxModal}
        style={{ height: '500px', width: '600px' }}
        mask
        closable
      >
        <div className="focused-inbox-notif">
          <RetinaImg
            name={`focused-inbox.png`}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ width: 200, height: 200 }}
          />
          <h2>Save Time with Focused Inbox</h2>
          <p>
            Do more, faster. Enable Focused Inbox and Edison Mail will identify the important emails
            that require your attention and set aside everything else in an "Other" folder.
          </p>
          <div className="btn-list">
            <div className="btn modal-btn-disable" onClick={() => this._onClickButton(false)}>
              No Thanks
            </div>
            <div className="btn modal-btn-enable" onClick={() => this._onClickButton(true)}>
              Enable Focused Inbox
            </div>
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
