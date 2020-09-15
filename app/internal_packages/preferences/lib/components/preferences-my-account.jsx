import React from 'react';
import { ipcRenderer } from 'electron';
import { AccountStore, RESTful, Actions } from 'mailspring-exports';
import { FullScreenModal, RetinaImg, Flexbox, LottieImg } from 'mailspring-component-kit';

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
const StartSyncStep = {
  fail: -1,
  start: 1,
  verifying: 2,
  chooseAccounts: 3,
  addAccount: 4,
};

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

class StartSyncModal extends React.Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onSelectAccount: PropTypes.func.isRequired,
  };

  constructor() {
    super();
    this.state = {
      step: StartSyncStep.start,
      mainAccountIds: [],
    };
  }

  _verifyAllAccounts = async () => {
    const accountIds = AccountStore.accountIds();
    const result = await EdisonAccountRest.checkAccounts(accountIds);
    if (result.successful) {
      const mainAccountIds = result.data;
      if (mainAccountIds.length) {
        this.setState({
          mainAccountIds,
          step: StartSyncStep.chooseAccounts,
        });
      } else {
        this.setState({
          step: StartSyncStep.addAccount,
        });
      }
    } else {
      this.setState({
        step: StartSyncStep.fail,
        message: result.message,
      });
    }
  };

  onStartSync = () => {
    this.setState({
      step: StartSyncStep.verifying,
    });
    this._verifyAllAccounts();
  };

  onChooseOtherAccount = () => {
    this.setState({
      step: StartSyncStep.addAccount,
    });
  };

  onChooseAccount = emailHost => {
    const { onSelectAccount, onClose } = this.props;
    const accounts = AccountStore.accounts();
    const chooseAccount = accounts.find(
      a => emailHost === `${a.emailAddress}:${a.settings.imap_host}`
    );
    if (chooseAccount) {
      onSelectAccount(chooseAccount);
    } else {
      ipcRenderer.send('command', 'application:add-account');
    }
    onClose();
  };

  _renderInbox() {
    return (
      <div>
        <RetinaImg
          name={`all-your-devices.png`}
          mode={RetinaImg.Mode.ContentPreserve}
          style={{ width: 280, height: 210 }}
        />
        <h2>Back up Preferences & Sync Across All Your Devices</h2>
        <p>
          Don’t lose your settings to an app update. Back up and sync your preferences across
          devices?
        </p>
        <div className="btn-list">
          <div className="btn modal-btn-disable" onClick={this.props.onClose}>
            No Thanks
          </div>
          <div className="btn modal-btn-enable" onClick={this.onStartSync}>
            Back up & Sync
          </div>
        </div>
      </div>
    );
  }

  _renderVerifying() {
    return (
      <div>
        <RetinaImg
          name={`verifying-account.png`}
          mode={RetinaImg.Mode.ContentPreserve}
          style={{ width: 280, height: 210 }}
        />
        <h2>Verifying…</h2>
        <p>
          Verifying your accounts
          <br /> This should only take a few seconds.
        </p>
        <LottieImg name="loading-spinner-blue" size={{ width: 32, height: 32 }} />
      </div>
    );
  }

  _renderChooseAccount() {
    const { mainAccountIds } = this.state;
    return (
      <div>
        <RetinaImg
          name={`welcome-back.png`}
          mode={RetinaImg.Mode.ContentPreserve}
          style={{ width: 280, height: 210 }}
        />
        <h2>Welcome Back!</h2>
        <p>Select the account you use to sync and back up your settings in Edison Mail:</p>
        <ul>
          {mainAccountIds.map(a => {
            const emailAddress = a.split(':')[0];
            return (
              <li
                key={a}
                onClick={() => {
                  this.onChooseAccount(a);
                }}
              >
                <Flexbox direction="row" style={{ alignItems: 'middle' }}>
                  <RetinaImg
                    name={`account-logo-other.png`}
                    fallback="account-logo-other.png"
                    mode={RetinaImg.Mode.ContentPreserve}
                  />
                  <div className="account-email" title={emailAddress}>
                    {emailAddress}
                  </div>
                </Flexbox>
              </li>
            );
          })}
          <li onClick={this.onChooseOtherAccount}>
            <Flexbox direction="row" style={{ alignItems: 'middle' }}>
              <RetinaImg
                name={`add.svg`}
                style={{ width: 40, height: 40, fontSize: 40, color: '#1293fd' }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
              />
              <div className="account-email">Other Account</div>
            </Flexbox>
          </li>
        </ul>
      </div>
    );
  }

  _renderAddAccount() {
    const accounts = AccountStore.accounts();

    return (
      <div>
        <RetinaImg
          name={`all-your-devices.png`}
          mode={RetinaImg.Mode.ContentPreserve}
          style={{ width: 280, height: 210 }}
        />
        <h2>Back up Preferences & Sync Across All Your Devices</h2>
        <p>Select the email you would like to use to sync your accounts, and settings:</p>
        <ul>
          {accounts.map(a => {
            return (
              <li
                key={a.id}
                onClick={() => {
                  const emailHost = `${a.emailAddress}:${a.settings.imap_host}`;
                  this.onChooseAccount(emailHost);
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
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  _renderError() {
    return <div>has some error</div>;
  }

  render() {
    const { step } = this.state;
    return (
      <div className="edison-account-modal">
        {step === StartSyncStep.start ? this._renderInbox() : null}
        {step === StartSyncStep.verifying ? this._renderVerifying() : null}
        {step === StartSyncStep.chooseAccounts ? this._renderChooseAccount() : null}
        {step === StartSyncStep.addAccount ? this._renderAddAccount() : null}
        {step === StartSyncStep.fail ? this._renderError() : null}
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
      startSyncVisible: false,
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
    this.setState({
      startSyncVisible: true,
    });
  };

  _onCloseStartSyncModal = e => {
    this.setState({
      startSyncVisible: false,
    });
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
        <FullScreenModal
          visible={this.state.startSyncVisible}
          style={{ height: '500px', width: '600px' }}
          onCancel={this._onCloseStartSyncModal}
          mask
          closable
        >
          <StartSyncModal
            onClose={this._onCloseStartSyncModal}
            onSelectAccount={this._onChooseAccount}
          />
        </FullScreenModal>
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
