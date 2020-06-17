const React = require('react');
const { RetinaImg } = require('mailspring-component-kit');
const OnboardingActions = require('./onboarding-actions').default;
const ConfigKey = 'core.workspace.sendUsageData';
const PromptedConfigKey = 'core.workspace.promptedSendUsageData';

class InitialPreferencesImproveData extends React.Component {
  static displayName = 'InitialPreferencesImproveData';

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={`page improve-data`}>
        <RetinaImg
          className="logo"
          name={`preference-data-true${AppEnv.isDarkTheme() ? '-dark' : ''}.png`}
          mode={RetinaImg.Mode.ContentPreserve}
        />
        <h1>Share crash & usage data with app developers?</h1>
        <p className="description">
          Help the Edison development team squash bugs and improve its products and services by
          automatically sending anonymous usage data.
        </p>

        <div className="footer">
          <button
            key="no"
            className="btn btn-large btn-ghost"
            onClick={() => this._onFinish(false)}
          >
            No, Thanks
          </button>
          <button
            key="agree"
            className="btn btn-large btn-agree"
            onClick={() => this._onFinish(true)}
          >
            Agree
          </button>
        </div>
      </div>
    );
  }

  _onFinish = enable => {
    if (!AppEnv.config.get(PromptedConfigKey)) {
      AppEnv.config.set(PromptedConfigKey, true);
    }
    AppEnv.trackingEvent('Onboarding-send-usage-data', { enable: enable });
    AppEnv.config.set(ConfigKey, !!enable);

    OnboardingActions.moveToPage('initial-done');
  };
}

module.exports = InitialPreferencesImproveData;
