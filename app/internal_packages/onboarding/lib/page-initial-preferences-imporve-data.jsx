const React = require('react');
const PropTypes = require('prop-types');
const path = require('path');
const fs = require('fs');
const { RetinaImg, Flexbox, ConfigPropContainer, LottieImg } = require('mailspring-component-kit');
const { AccountStore, Utils } = require('mailspring-exports');
const OnboardingActions = require('./onboarding-actions').default;
const ConfigKey = 'core.workspace.sendUsageData';
const PromptedConfigKey = 'core.workspace.promptedSendUsageData';

// NOTE: Temporarily copied from preferences module
class AppearanceModeOption extends React.Component {
  static propTypes = {
    mode: PropTypes.string.isRequired,
    isDark: PropTypes.bool,
    active: PropTypes.bool,
    onClick: PropTypes.func,
  };

  render() {
    let classname = 'appearance-mode';

    if (this.props.active) {
      classname += ' active';
    }

    const label = {
      true: 'Share crash and usage data',
      false: 'No Thanks',
    }[this.props.mode];

    return (
      <div className={classname}>
        <div className={'imgbox'} onClick={this.props.onClick}>
          <RetinaImg
            name={`preference-data-${this.props.mode}${this.props.isDark ? '-dark' : ''}.png`}
            mode={RetinaImg.Mode.ContentPreserve}
          />
        </div>
        <div className={'label'}>{label}</div>
      </div>
    );
  }
}

class InitialPreferencesOptions extends React.Component {
  static propTypes = { config: PropTypes.object };

  constructor(props) {
    super(props);
  }

  render() {
    if (!this.props.config) {
      return false;
    }

    return (
      <div className="preferences">
        <div>
          <p>3 of 3</p>
          <h1>Share crash & usage data with app developers?</h1>
          <div className="description">
            Help the Edison development team squash bugs and improve its products and services by
            automatically sending anonymous usage data.
          </div>
          <Flexbox direction="row" style={{ alignItems: 'center', width: 578 }}>
            {[true, false].map(mode => (
              <AppearanceModeOption
                mode={mode.toString()}
                key={mode.toString()}
                active={this.props.config.get(ConfigKey) === mode}
                isDark={AppEnv.isDarkTheme()}
                onClick={() => {
                  this.props.config.set(ConfigKey, mode);
                  if (!this.props.config.get(PromptedConfigKey)) {
                    this.props.config.set(PromptedConfigKey, true);
                  }
                }}
              />
            ))}
          </Flexbox>
        </div>
      </div>
    );
  }
}

class InitialPreferencesImproveData extends React.Component {
  static displayName = 'InitialPreferencesImproveData';

  constructor(props) {
    super(props);
    this.state = { account: AccountStore.accounts()[0], submitting: false };
  }

  componentDidMount() {
    this._unlisten = AccountStore.listen(this._onAccountStoreChange);
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  _onAccountStoreChange = () => {
    this.setState({ account: AccountStore.accounts()[0] });
  };

  render() {
    if (!this.state.account) {
      return <div />;
    }
    return (
      <div className="page opaque" style={{ width: 900, height: '100%' }}>
        <div className="configure">
          <ConfigPropContainer>
            <InitialPreferencesOptions account={this.state.account} />
          </ConfigPropContainer>
        </div>
        <div className="footer">
          <button className="btn btn-large btn-continue" onClick={this._onFinished}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  _onFinished = () => {
    if (!AppEnv.config.get(PromptedConfigKey)) {
      AppEnv.config.set(PromptedConfigKey, true);
    }
    if (AppEnv.config.get(ConfigKey)) {
      AppEnv.trackingEvent('Onboarding-send-usage-data-true');
    } else {
      AppEnv.trackingEvent('Onboarding-send-usage-data-false');
    }
    if (!Utils.needGDPR()) {
      OnboardingActions.moveToPage('optin-trends-research');
      return;
    }
    OnboardingActions.moveToPage('initial-done');
  };
}

module.exports = InitialPreferencesImproveData;
