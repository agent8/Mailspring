import { React, Constant } from 'mailspring-exports';
import { ipcRenderer, remote } from 'electron';
import { SlimNotification } from 'mailspring-component-kit';

export default class UpdateNotification extends React.Component {
  static displayName = 'UpdateNotification';

  constructor(props) {
    super(props);
    this.state = {
      updateIsManual: false,
      releaseVersion: '',
      currentVersion: '',
      showOnNotAvailableOrError: false,
      prevState: Constant.AutoUpdateManagerState.IdleState,
      state: Constant.AutoUpdateManagerState.IdleState,
      description: '',
      type: '',
      failedCount: 0,
    };
  }

  componentDidMount() {
    remote
      .getGlobal('application')
      .autoUpdateManager.on('state-changed', this._onUpdateStateChanged);
  }

  componentWillUnmount() {
    remote
      .getGlobal('application')
      .autoUpdateManager.removeListener('state-changed', this._onUpdateStateChanged);
  }
  _onUpdateStateChanged = state => {
    console.log(`on state ${state}`);
    const updater = remote.getGlobal('application').autoUpdateManager;
    const info = updater.getReleaseDetails();
    const extraInfo = {
      updateIsManual: info.releaseNotes === 'manual-download',
      releaseVersion: info.releaseVersion,
      currentVersion: info.currentVersion,
      showOnNotAvailableOrError: updater.showOnNotAvailableOrError,
      prevState: this.state.state,
    };
    if (
      this.state.state === state &&
      this.state.showOnNotAvailableOrError === extraInfo.showOnNotAvailableOrError
    ) {
      return;
    }

    const stateInfo = { state, onClose: this._ignoreUpdate, type: '', failedCount: 0 };
    switch (state) {
      case Constant.AutoUpdateManagerState.AvailableForDownload:
        stateInfo.description = `New EdisonMail available. Version (${extraInfo.releaseVersion}}`;
        stateInfo.actions = [{ text: 'Update', callback: this._downloadUpdate }];
        break;
      case Constant.AutoUpdateManagerState.NoUpdateAvailableState:
        if (extraInfo.showOnNotAvailableOrError) {
          stateInfo.description = `You're running the latest version of Edison Mail (${extraInfo.currentVersion})`;
          stateInfo.actions = [{ text: 'Ok', callback: this._ignoreUpdate }];
        } else {
          stateInfo.state = Constant.AutoUpdateManagerState.IdleState;
        }
        break;
      case Constant.AutoUpdateManagerState.ErrorState:
        if (extraInfo.showOnNotAvailableOrError) {
          stateInfo.description = 'There was an error checking for updates.';
          stateInfo.type = 'failed';
          stateInfo.failedCount = this.state.failedCount + 1;
          if (stateInfo.failedCount > 1) {
            stateInfo.actions = [];
          } else {
            stateInfo.actions = [{ text: 'Retry', callback: this._checkForUpdate }];
          }
        } else {
          stateInfo.state = Constant.AutoUpdateManagerState.IdleState;
        }
        break;
      case Constant.AutoUpdateManagerState.UpdateAvailableState:
        stateInfo.description =
          'An update to Edison Mail is ready. Restart the app to stay up-to-date.';
        stateInfo.actions = [{ text: 'Restart', callback: this._onUpdate }];
        break;
      default:
        stateInfo.state = Constant.AutoUpdateManagerState.IdleState;
        stateInfo.onClose = () => {};
        stateInfo.actions = [];
        stateInfo.description = '';
    }
    this.setState({ ...extraInfo, ...stateInfo });
  };
  _checkForUpdate = () => {
    ipcRenderer.send('command', 'application:check-for-update');
  };
  _onUpdate = () => {
    ipcRenderer.send('command', 'application:install-update');
  };
  _ignoreUpdate = () => {
    ipcRenderer.send('command', 'application:ignore-update');
  };
  _downloadUpdate = () => {
    ipcRenderer.send('command', 'application:start-download-update');
  };

  _onViewChangelog = () => {
    // zhansheng: TODO need replace our changelog link
    // remote.shell.openExternal('https://github.com/agent8/Mailspring/releases/latest');
  };

  render() {
    if (this.state.state === Constant.AutoUpdateManagerState.IdleState) {
      return <span />;
    }
    return (
      <SlimNotification
        type={this.state.type}
        onClose={this.state.onClose}
        description={this.state.description}
        actions={this.state.actions}
      />
    );
  }
}
