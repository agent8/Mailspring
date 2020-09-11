import React from 'react';
import { AccountStore, RESTful, Actions } from 'mailspring-exports';
import { RetinaImg, Flexbox, LottieImg } from 'mailspring-component-kit';
import PropTypes from 'prop-types';

const { EdisonAccountRest } = RESTful;
const edisonAccountKey = 'edisonAccountId';
const PromptedEdisonAccountKey = 'core.workspace.promptedEdisonAccount';
const computerPlatforms = ['mac'];
const modeSwitchList = [
  {
    value: 'Free',
    title: 'Free',
    description:
      'Access smart folders, keep all your inboxes in one place, and stay synced across all of your devices.',
    imgsrc: { light: `all-your-devices.png`, dark: `all-your-devices-dark.png` },
    price: '$0.00',
  },
  {
    value: 'TrueIdentity',
    title: 'True Identity',
    description: 'Sender verification, up-to-date contacts, and reduce workflow interruptions.',
    imgsrc: { light: `paywall-contacts-nobg.png`, dark: `paywall-contacts-nobg-dark.png` },
    price: '$19.99/mo',
  },
  {
    value: 'Enterprise',
    title: 'Enterprise',
    description: 'Access business Integrations to optimize your workflow. Currently only for Mac.',
    imgsrc: { light: `enterprise-package.png`, dark: `enterprise-package-dark.png` },
    price: '$19.99/mo',
  },
];

class AccountChoosePopover extends React.Component {
  static propTypes = {
    accounts: PropTypes.array.isRequired,
    onSelect: PropTypes.func.isRequired,
  };
  constructor(props) {
    super(props);
  }

  render() {
    const { accounts, onSelect } = this.props;
    return (
      <div className="choose-sync-account-popover" tabIndex="-1">
        {accounts.map(a => {
          return (
            <div
              className="account-item"
              key={a.id}
              onClick={() => {
                Actions.closePopover();
                onSelect(a);
              }}
            >
              <Flexbox direction="row" style={{ alignItems: 'middle' }}>
                <RetinaImg
                  url={a.picture}
                  name={`account-logo-${a.provider}.png`}
                  fallback="account-logo-other.png"
                  mode={RetinaImg.Mode.ContentPreserve}
                />
                <div className="account-email" title={a.emailAddress}>
                  {a.emailAddress}
                </div>
              </Flexbox>
            </div>
          );
        })}
      </div>
    );
  }
}

export default class EdisonAccount extends React.Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
  };

  constructor() {
    super();
    const syncAccount = AccountStore.syncAccount();
    this.state = {
      account: syncAccount,
      otherAccounts: AccountStore.accounts().filter(
        account => !syncAccount || syncAccount.id !== account.id
      ),
      accountType: 'Free',
      devices: [],
      loginLoading: false,
      logoutLoading: false,
    };
    this.supportId = AppEnv.config.get('core.support.id');
    this._getDevices();
  }

  componentDidMount() {
    this._mounted = true;
    this.disposable = AppEnv.config.onDidChange(edisonAccountKey, () => {
      if (this._mounted) {
        const syncAccount = AccountStore.syncAccount();
        this.setState(
          {
            account: syncAccount,
            otherAccounts: AccountStore.accounts().filter(
              account => !syncAccount || syncAccount.id !== account.id
            ),
          },
          () => {
            this._getDevices();
          }
        );
      }
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disposable.dispose();
  }

  _getDevices = async () => {
    const { account } = this.state;
    if (!account || !account.id) {
      return;
    }
    const devicesResult = await EdisonAccountRest.devicesList(account.id);
    if (devicesResult.successful) {
      const devices = devicesResult.data;
      if (this._mounted) {
        this.setState({ devices });
      }
    }
  };

  _onChooseAccount = async newAccount => {
    const { account: oldAccount } = this.state;
    if (this._mounted) {
      this.setState({
        loginLoading: true,
      });
    }
    if (oldAccount && oldAccount.id) {
      await EdisonAccountRest.logoutDevice(oldAccount.id, this.supportId);
    }
    const registerResult = await EdisonAccountRest.register(newAccount.id);
    if (this._mounted) {
      this.setState({
        loginLoading: false,
      });
    }
    if (!registerResult.successful) {
      AppEnv.reportError(new Error(`Register edison account fail: ${registerResult.message}`));
    }
  };

  _startBackUpAndSync = e => {
    if (!AppEnv.config.get(PromptedEdisonAccountKey)) {
      AppEnv.config.set(PromptedEdisonAccountKey, true);
    }
    const { otherAccounts } = this.state;
    if (otherAccounts.length === 1) {
      this._onChooseAccount(otherAccounts[0]);
    } else {
      this._chooseAccountPopup(e);
    }
  };

  _chooseAccountPopup = e => {
    if (!AppEnv.config.get(PromptedEdisonAccountKey)) {
      AppEnv.config.set(PromptedEdisonAccountKey, true);
    }
    const { otherAccounts } = this.state;
    if (!otherAccounts.length) {
      return;
    }
    Actions.openPopover(
      <AccountChoosePopover accounts={otherAccounts} onSelect={this._onChooseAccount} />,
      {
        originRect: e.target.getBoundingClientRect(),
        direction: 'down',
        closeOnAppBlur: true,
      }
    );
  };

  _logout = async deviceId => {
    if (!AppEnv.config.get(PromptedEdisonAccountKey)) {
      AppEnv.config.set(PromptedEdisonAccountKey, true);
    }
    const { account } = this.state;
    if (!account || !account.id) {
      return;
    }
    if (deviceId === this.supportId && this._mounted) {
      this.setState({
        logoutLoading: true,
      });
    }
    const logoutResult = await EdisonAccountRest.logoutDevice(account.id, deviceId);
    if (deviceId === this.supportId && this._mounted) {
      this.setState({
        logoutLoading: false,
      });
    }
    if (!logoutResult.successful) {
      AppEnv.reportError(new Error(`Logout edison account fail: ${logoutResult.message}`));
    } else {
      this._getDevices();
    }
  };

  _onClickAccountType(type) {
    this.setState({ accountType: type });
  }

  renderSpinner(show) {
    if (!show) {
      return null;
    }
    return (
      <LottieImg
        name="loading-spinner-blue"
        size={{ width: 24, height: 24 }}
        style={{ margin: '0 5px 0 0', display: 'inline-block', verticalAlign: 'middle' }}
      />
    );
  }

  renderAccount() {
    const { account, otherAccounts, loginLoading, logoutLoading } = this.state;

    return (
      <div className="config-group">
        <h6>BACK UP & SYNC</h6>
        <div className="edison-account-note">
          Use this account to sync your mail and settings across all your devices.
        </div>

        {account ? (
          <div>
            <div className="edison-account">
              <Flexbox direction="row" style={{ alignItems: 'middle' }}>
                <RetinaImg
                  url={account.picture}
                  name={`account-logo-${account.provider}.png`}
                  fallback="account-logo-other.png"
                  mode={RetinaImg.Mode.ContentPreserve}
                />
                <div className="account-email" title={account.emailAddress}>
                  {account.emailAddress}
                </div>
              </Flexbox>
            </div>
            <div className="edison-account-button">
              {otherAccounts.length ? (
                <div className="btn-primary" onClick={this._chooseAccountPopup}>
                  {this.renderSpinner(loginLoading)}
                  Change Sync Email
                </div>
              ) : null}
              <div className="btn-danger" onClick={() => this._logout(this.supportId)}>
                {this.renderSpinner(logoutLoading)}
                Stop Back up & Sync
              </div>
            </div>
          </div>
        ) : (
          <div className="edison-account-button">
            <div className="btn-primary choose-account" onClick={this._startBackUpAndSync}>
              {this.renderSpinner(loginLoading)}
              Start Back up & Sync
            </div>
          </div>
        )}
      </div>
    );
  }

  renderAccountType() {
    const { accountType } = this.state;
    return (
      <div className="config-group">
        <h6>ACCOUNT TYPE</h6>
        <div className={`account-types`}>
          <Flexbox direction="row" style={{ alignItems: 'center' }} className="item">
            {modeSwitchList.map(modeInfo => {
              const active = accountType === modeInfo.value;
              const classname = `account-type-item${active ? ' active' : ''}`;
              const mode = this.props.config.get('core.theme') === 'ui-dark' ? 'dark' : 'light';
              return (
                <div
                  key={modeInfo.value}
                  className={classname}
                  onClick={() => this._onClickAccountType(modeInfo.value)}
                >
                  <RetinaImg name={modeInfo.imgsrc[mode]} mode="" />
                  <div className="title">{modeInfo.title}</div>
                  <div className="description">{modeInfo.description}</div>
                  <div className="price">{modeInfo.price}</div>
                  <RetinaImg
                    name={active ? 'check.svg' : 'check-empty.svg'}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                    style={{ width: 32, height: 32, fontSize: 32, verticalAlign: 'middle' }}
                    className={`check-icon ${active ? 'checked' : 'empty'}`}
                  />
                </div>
              );
            })}
          </Flexbox>
        </div>
      </div>
    );
  }

  renderDevices() {
    const { account, devices } = this.state;
    if (!account) {
      return null;
    }
    return (
      <div className="devices-list">
        <div className="config-group">
          <h6>DEVICES</h6>
        </div>
        <ul>
          {devices.map(device => {
            const imgName = computerPlatforms.includes(device.platform)
              ? 'device-computer.png'
              : 'device-phone.png';
            return (
              <li key={device.id}>
                <RetinaImg
                  name={imgName}
                  mode={RetinaImg.Mode.ContentIsMask}
                  style={{ height: 24, width: 24 }}
                />
                <div className="devices-name">{`${device.platform}-${device.name}`}</div>
                <div className="remove-btn" onClick={() => this._logout(device.id)}>
                  Remove
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  render() {
    return (
      <div>
        <div className="container-edison-account">
          {this.renderAccount()}
          {/* {this.renderAccountType()} */}
          {this.renderDevices()}
        </div>
      </div>
    );
  }
}
