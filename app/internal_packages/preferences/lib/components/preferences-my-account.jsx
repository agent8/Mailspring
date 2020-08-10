import React from 'react';
import { AccountStore } from 'mailspring-exports';
import { RetinaImg, Flexbox } from 'mailspring-component-kit';
import PropTypes from 'prop-types';

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

export default class EdisonAccount extends React.Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
  };

  constructor() {
    super();
    this.state = {
      account: AccountStore.accounts()[0],
      accountType: 'Free',
    };
  }

  _onClickAccountType(type) {
    this.setState({ accountType: type });
  }

  renderAccount() {
    const { account } = this.state;
    return (
      <div className="config-group">
        <h6>BACK UP & SYNC</h6>
        <div className="edison-account-note">
          Use this account to sync your mail and settings across all your devices.
        </div>

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
          <div className="btn-primary">Change Sync Email</div>
          <div className="btn-danger">Log Out</div>
        </div>
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
    return (
      <div className="config-group">
        <h6>DEVICES</h6>
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
