import { React } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';
import { AccountStore, Actions } from 'mailspring-exports';

const PromptedEdisonAccountKey = 'core.workspace.promptedEdisonAccount';

export default class EdisonAccountNotif extends React.Component {
  static displayName = 'EdisonAccountNotif';

  constructor() {
    super();
    this.state = {
      show: false,
    };
  }

  componentDidMount() {
    if (AppEnv.config.get(PromptedEdisonAccountKey)) {
      return;
    }
    this._shouldShow();
  }

  _shouldShow = () => {
    const syncAccount = AccountStore.syncAccount();
    if (syncAccount || AppEnv.config.get(PromptedEdisonAccountKey) || this.state.show) {
      return;
    }
    this.setState({
      show: true,
    });
  };

  _onClose = () => {
    AppEnv.config.set(PromptedEdisonAccountKey, true);
    this.setState({
      show: false,
    });
  };

  _onClickButton = () => {
    AppEnv.config.set(PromptedEdisonAccountKey, true);
    this._onClose();
    Actions.switchPreferencesTab('Back up & Sync');
    Actions.openPreferences();
  };

  render() {
    return (
      <FullScreenModal
        visible={this.state.show}
        onCancel={this._onClose}
        style={{ height: '500px', width: '600px' }}
        mask
        closable
      >
        <div className="edison-account-notif">
          <RetinaImg
            name={`all-your-devices.png`}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ width: 200, height: 200 }}
          />
          <h2>Sync Edison Mail Across All Your Devices</h2>
          <p>
            Sync your mail on all your devices, and never lose your app settings again in an app
            update!
          </p>
          <div className="btn-list">
            <div className="btn modal-btn-enable" onClick={this._onClickButton}>
              Let’s Go
            </div>
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
