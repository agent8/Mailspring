import fs from 'fs';
import {
  React,
  PropTypes,
  AccountStore,
  SendActionsStore,
  DefaultClientHelper,
  SystemStartService,
} from 'mailspring-exports';
import { ListensToFluxStore, Menu, ButtonDropdown } from 'mailspring-component-kit';
import ConfigSchemaItem from './config-schema-item';
import rimraf from 'rimraf';
import { Actions } from 'mailspring-exports';
import _ from 'underscore';
import { ipcRenderer } from 'electron';

export class DefaultMailClientItem extends React.Component {
  constructor() {
    super();
    this.state = { defaultClient: false };
    this._helper = new DefaultClientHelper();
  }

  componentDidMount() {
    this._mounted = true;
    if (this._helper.available()) {
      this._helper.isRegisteredForURLScheme('mailto', registered => {
        if (this._mounted) {
          this.setState({ defaultClient: registered });
        }
      });
    } else {
      this.state = { defaultClient: 'unknown' };
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  toggleDefaultMailClient = event => {
    if (this.state.defaultClient) {
      this._helper.resetURLScheme('mailto', err => {
        if (err) {
          AppEnv.reportError(err);
          return;
        }
        if (this._mounted) {
          this.setState({ defaultClient: false });
        }
      });
    } else {
      this._helper.registerForURLScheme('mailto', err => {
        if (err) {
          AppEnv.reportError(err);
          return;
        }
        if (this._mounted) {
          this.setState({ defaultClient: true });
        }
      });
    }
    event.target.blur();
  };

  render() {
    if (this.state.defaultClient === 'unknown') {
      return (
        <div className="item">
          <div
            style={{ marginBottom: 12 }}
            className="btn btn-small"
            onClick={() =>
              shell.openExternal('https://foundry376.zendesk.com/hc/en-us/articles/115002281851')
            }
          >
            {this.props.label}
          </div>
        </div>
      );
    }

    return (
      <div className="item">
        <input
          type="checkbox"
          id="default-client"
          checked={this.state.defaultClient}
          onChange={this.toggleDefaultMailClient}
        />
        <label htmlFor="default-client">{this.props.label}</label>
      </div>
    );
  }
}

export class LaunchSystemStartItem extends React.Component {
  constructor() {
    super();
    this.state = {
      available: false,
      launchOnStart: false,
    };
    this._service = new SystemStartService();
  }

  componentDidMount() {
    this._mounted = true;
    this._service.checkAvailability().then(available => {
      if (this._mounted) {
        this.setState({ available });
      }
      if (!available || !this._mounted) return;
      this._service.doesLaunchOnSystemStart().then(launchOnStart => {
        if (this._mounted) {
          this.setState({ launchOnStart });
        }
      });
    });
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _toggleLaunchOnStart = event => {
    if (this.state.launchOnStart) {
      this.setState({ launchOnStart: false });
      this._service.dontLaunchOnSystemStart();
    } else {
      this.setState({ launchOnStart: true });
      this._service.configureToLaunchOnSystemStart();
    }
    event.target.blur();
  };

  render() {
    if (!this.state.available) return false;
    return (
      <div className="item">
        <input
          type="checkbox"
          id="launch-on-start"
          checked={this.state.launchOnStart}
          onChange={this._toggleLaunchOnStart}
        />
        <label htmlFor="launch-on-start">{this.props.label}</label>
      </div>
    );
  }
}

function getDefaultSendAccountSchema(configSchema) {
  const accounts = AccountStore.accounts();
  // const sendActions = SendActionsStore.sendActions()
  const defaultAccountIdForSend = {
    type: 'string',
    default: 'selected-mailbox',
    enum: ['selected-mailbox'].concat(accounts.map(acc => acc.id)),
    enumLabels: ['Automatically select best account'].concat(
      accounts.map(acc => acc.me().toString())
    ),
  };

  Object.assign(configSchema.properties.sending.properties, {
    defaultAccountIdForSend,
  });
  AppEnv.config.setDefaults('core.sending.defaultAccountIdForSend', 'selected-mailbox');
  return configSchema.properties.sending.properties.defaultAccountIdForSend;
}

function DefaultSendAccount(props) {
  const { config, defaultSendAccount, label } = props;

  return (
    <ConfigSchemaItem
      config={config}
      label={label}
      configSchema={defaultSendAccount}
      keyPath="core.sending.defaultAccountIdForSend"
    />
  );
}

DefaultSendAccount.displayName = 'DefaultSendAccount';
DefaultSendAccount.propTypes = {
  config: PropTypes.object,
  defaultSendAccount: PropTypes.object,
  label: PropTypes.string,
};

export const DefaultAccountSending = ListensToFluxStore(DefaultSendAccount, {
  stores: [AccountStore, SendActionsStore],
  getStateFromStores(props) {
    const { configSchema } = props;
    return {
      defaultSendAccount: getDefaultSendAccountSchema(configSchema),
    };
  },
});

export class DownloadSelection extends React.Component {
  static displayName = 'DownloadSelection';

  constructor() {
    super();
    this.state = {
      items: [
        ['Downloads', 'Downloads'],
        ['Ask me every time', 'Ask me every time'],
        ['Choose a folder...', 'Choose a folder...'],
      ],
      fixedOptions: ['Downloads', 'Ask me every time'],
    };
  }

  _onChangeValue = ([value]) => {
    const { fixedOptions } = this.state;
    if (fixedOptions.indexOf(value) >= 0) {
      this.props.config.set(this.props.keyPath, value);
      this._dropdownComponent.toggleDropdown();
    } else {
      this._dropdownComponent.toggleDropdown();
      const openDirOption = {
        properties: ['openDirectory'],
      };
      const path = this.props.config.get(this.props.keyPath);
      if (typeof path === 'string' && fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
        openDirOption['defaultPath'] = path;
      } else {
        const userPath = AppEnv.getUserDirPath();
        if (userPath) {
          openDirOption['defaultPath'] = userPath + '/Downloads';
        }
      }
      AppEnv.showOpenDialog(openDirOption, newPaths => {
        if (newPaths && newPaths.length > 0) {
          this.props.config.set(this.props.keyPath, newPaths[0]);
        }
      });
    }
  };

  _getSelectedMenuItem = () => {
    const { fixedOptions } = this.state;
    const selected = this.props.config.get(this.props.keyPath);
    if (fixedOptions.indexOf(selected) >= 0) {
      return <span key={selected}>{selected}</span>;
    } else {
      return <span key={'chooseFolder'}>{selected}</span>;
    }
  };

  render() {
    const { items } = this.state;
    const menu = (
      <Menu
        items={items}
        itemKey={item => item}
        itemContent={([value]) => <span key={value}>{value}</span>}
        onSelect={this._onChangeValue}
      />
    );

    return (
      <div className="item">
        <label>{this.props.label}:</label>
        <ButtonDropdown
          ref={cm => {
            this._dropdownComponent = cm;
          }}
          primaryItem={this._getSelectedMenuItem()}
          menu={menu}
        />
      </div>
    );
  }
}

export class LocalData extends React.Component {
  static displayName = 'LocalData';

  constructor() {
    super();
    this.state = {};
    this.resetStarted = false;
  }

  _onResetEmailCache = () => {
    Actions.forceKillAllClients('onResetEmailCache');
  };
  _onVacuumDB = () => {
    Actions.askVacuum();
  };

  _onResetAccountsAndSettings = () => {
    if (this.resetStarted) {
      return;
    }
    this.resetStarted = true;
    AppEnv.expungeLocalAndReboot();
  };

  render() {
    return (
      <div className="item">
        <div className="btn-primary buttons-reset-data" onClick={this._onResetEmailCache}>
          Reset Email Cache
        </div>
        <div className="btn-primary buttons-reset-data" onClick={this._onResetAccountsAndSettings}>
          Reset Accounts and Settings
        </div>
        <div className="btn-primary buttons-reset-data" onClick={this._onVacuumDB}>
          Optimize Local Data
        </div>
      </div>
    );
  }
}

export class TaskDelay extends React.Component {
  static displayName = 'TaskDelay';
  static propTypes = {
    config: PropTypes.object.isRequired,
  };
  constructor(props) {
    super(props);
  }
  _renderMenuItem = ([value, label]) => {
    return <span key={value}>{label}</span>;
  };
  _onChangeValue = ([value, label]) => {
    this.props.config.set(this.props.keyPath, value);
    this.props.config.set('core.mailsync.taskDelay', value);
    const accounts = this.props.config.get('accounts');
    if (Array.isArray(accounts)) {
      accounts.forEach(account => {
        if (account && account.mailsync) {
          account.mailsync.taskDelay = value;
        }
      });
      this.props.config.set('accounts', accounts);
    }
    this._dropdownComponent.toggleDropdown();
    ipcRenderer.send('mailsync-config');
  };
  getSelectedMenuItem(items) {
    const selected = this.props.config.get(this.props.keyPath);
    for (const item of items) {
      const [value, label] = item;
      if (value === selected) {
        return this._renderMenuItem(item);
      }
    }
    return null;
  }
  render() {
    let note = this.props.configSchema.note ? (
      <div className="platform-note">{this.props.configSchema.note}</div>
    ) : null;
    const items = _.zip(this.props.configSchema.enum, this.props.configSchema.enumLabels);
    const menu = (
      <Menu
        items={items}
        itemKey={item => item}
        itemContent={this._renderMenuItem}
        onSelect={this._onChangeValue}
      />
    );
    return (
      <div className="item">
        <label htmlFor={this.props.keyPath}>{this.props.label}:</label>
        <ButtonDropdown
          ref={cm => {
            this._dropdownComponent = cm;
          }}
          primaryItem={this.getSelectedMenuItem(items)}
          menu={menu}
        />
        {note}
      </div>
    );
  }
}

export class SupportId extends React.Component {
  static displayName = 'SupportId';
  static propTypes = {
    config: PropTypes.object.isRequired,
  };
  constructor(props) {
    super(props);
    this.state = {};
    this.state.displaySupportPopup = false;
    this.timer = null;
    this.mounted = false;
  }
  componentDidMount() {
    this.mounted = true;
  }
  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.timer);
  }

  _onCopySupportId = event => {
    navigator.clipboard.writeText(this.props.config.core.support.id).then(() => {
      this.setState({ displaySupportPopup: true });
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          if (this.mounted) {
            this.setState({ displaySupportPopup: false });
          }
        }, 1600); // Same as popupFrames animation length
      }
    });
  };

  render() {
    return (
      <div className="item support">
        <div
          className="popup"
          style={{
            display: `${this.state.displaySupportPopup ? 'inline-block' : 'none'}`,
          }}
        >
          ID Copied
        </div>
        <div
          title="Click to Copy"
          className="btn-primary support-id"
          onClick={this._onCopySupportId}
        >
          {this.props.config.core.support.id}
        </div>
      </div>
    );
  }
}
