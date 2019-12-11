import { React } from 'mailspring-exports';
import { ipcRenderer, remote } from 'electron';
import { Notification } from 'mailspring-component-kit';

export default class UpdateNotification extends React.Component {
  static displayName = 'UpdateNotification';

  constructor() {
    super();
    this.state = this.getStateFromStores();
    this.state.ignoreUntilReboot = false;
  }

  componentDidMount() {
    remote.getGlobal('application').autoUpdateManager.on('state-changed',this.onAutoUpdateManagerStateChange);
  }

  componentWillUnmount() {
    remote.getGlobal('application').autoUpdateManager.removeListener('state-changed',this.onAutoUpdateManagerStateChange);
  }
  onAutoUpdateManagerStateChange = ()=>{
    this.setState(this.getStateFromStores());
  };

  getStateFromStores() {
    const updater = remote.getGlobal('application').autoUpdateManager;
    const updateAvailable = updater.getState() === 'update-available';
    const info = updateAvailable ? updater.getReleaseDetails() : {};
    return {
      updateAvailable,
      updateIsManual: info.releaseNotes === 'manual-download',
      version: info.releaseVersion,
    };
  }

  _onUpdate = () => {
    ipcRenderer.send('command', 'application:install-update');
  };

  _ignoreUpdate = () => {
    this.setState({ ignoreUntilReboot: true});
  };

  _onViewChangelog = () => {
    // zhansheng: TODO need replace our changelog link
    // remote.shell.openExternal('https://github.com/agent8/Mailspring/releases/latest');
  };

  render() {
    const { updateAvailable, version, updateIsManual } = this.state;

    if (!updateAvailable || this.state.ignoreUntilReboot) {
      return <span />;
    }
    return (
      <Notification
        priority="4"
        title={`An update to EdisonMail is available ${
          version ? `(${version.replace('EdisonMail', '').trim()})` : ''
          }`}
        subtitle={updateIsManual ? 'Click to Download' : 'Restart to Install'}
        icon="volstead-upgrade.png"
        actions={[
          {
            label: 'Later',
            fn: this._ignoreUpdate
          },
          {
            label: updateIsManual ? 'Download Now' : 'Install Update',
            fn: this._onUpdate,
          },
        ]}
      />
    );
  }
}
