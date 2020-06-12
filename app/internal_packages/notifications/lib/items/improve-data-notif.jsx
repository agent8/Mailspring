import { React } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';

const ConfigKey = 'core.workspace.sendUsageData';
const PromptedConfigKey = 'core.workspace.promptedSendUsageData';

export default class ImproveDataNotif extends React.Component {
  static displayName = 'ImproveDataNotif';

  constructor() {
    super();
    this.state = {
      showImproveConfigInbox: false,
      enable: AppEnv.config.get(ConfigKey),
    };
  }
  componentDidMount = () => {
    this.setState({
      showImproveConfigInbox: !AppEnv.config.get(PromptedConfigKey),
    });
  };

  _onClickTabs = enable => {
    if (AppEnv.config.get(ConfigKey) === enable) {
      return;
    }
    AppEnv.config.set(ConfigKey, enable);
    this.setState({
      enable,
    });
  };

  _onclose = () => {
    if (!AppEnv.config.get(PromptedConfigKey)) {
      AppEnv.config.set(PromptedConfigKey, true);
    }
    if (AppEnv.config.get(ConfigKey)) {
      AppEnv.trackingEvent('Onboarding-send-usage-data', { enable: true });
    } else {
      AppEnv.config.set(ConfigKey, true);
      AppEnv.trackingEvent('Onboarding-send-usage-data', { enable: false });
      AppEnv.config.set(ConfigKey, false);
    }
    this.setState({
      showImproveConfigInbox: false,
    });
  };

  render() {
    const isDark = AppEnv.isDarkTheme();
    const { enable } = this.state;
    const tabs = {
      true: 'Share crash and usage data',
      false: 'No Thanks',
    };

    return (
      <FullScreenModal
        visible={this.state.showImproveConfigInbox}
        style={{ height: '500px', width: '600px' }}
        mask
      >
        <div className="improve-data-notif">
          <h1>Share crash & usage data with app developers?</h1>
          <p className="description">
            Help the Edison development team squash bugs and improve its products and services by
            automatically sending anonymous usage data.
          </p>
          <div className="tabs">
            {Object.keys(tabs).map(tab => {
              return (
                <div
                  className={`${enable.toString() === tab ? 'active' : ''} appearance-mode`}
                  key={tab}
                >
                  <div className={'imgbox'} onClick={() => this._onClickTabs(tab === 'true')}>
                    <RetinaImg
                      name={`preference-data-${tab}${isDark ? '-dark' : ''}.png`}
                      style={{ height: 150, width: 200 }}
                      mode={RetinaImg.Mode.ContentPreserve}
                    />
                  </div>
                  <div className={'label'}>{tabs[tab]}</div>
                </div>
              );
            })}
          </div>
          <div className="btn next-btn" onClick={this._onclose}>
            Continue
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
