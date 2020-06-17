import { React } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';

const ConfigKey = 'core.workspace.sendUsageData';
const PromptedConfigKey = 'core.workspace.promptedSendUsageData';

export default class ImproveDataNotif extends React.Component {
  static displayName = 'ImproveDataNotif';

  constructor() {
    super();
    this.state = {
      showImproveConfigInbox: !AppEnv.config.get(PromptedConfigKey),
    };
  }

  _onFinish = enable => {
    if (!AppEnv.config.get(PromptedConfigKey)) {
      AppEnv.config.set(PromptedConfigKey, true);
    }
    AppEnv.trackingEvent('Onboarding-send-usage-data', { enable: enable });
    AppEnv.config.set(ConfigKey, enable);
    this.setState({
      showImproveConfigInbox: false,
    });
  };

  render() {
    return (
      <FullScreenModal
        visible={this.state.showImproveConfigInbox}
        style={{ height: '500px', width: '600px' }}
        mask
      >
        <div className="improve-data-notif">
          <RetinaImg
            className="logo"
            name={`preference-data-true${AppEnv.isDarkTheme() ? '-dark' : ''}.png`}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ height: 200, width: 200 }}
          />
          <h1>Share crash & usage data with app developers?</h1>
          <p className="description">
            Help the Edison development team squash bugs and improve its products and services by
            automatically sending anonymous usage data.
          </p>
          <div className="btn-list">
            <div className="btn modal-btn-disable" onClick={() => this._onFinish(false)}>
              No, Thanks
            </div>
            <div className="btn modal-btn-enable" onClick={() => this._onFinish(true)}>
              Agree
            </div>
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
