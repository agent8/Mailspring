import { React } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';
import { Actions } from 'mailspring-exports';
import rimraf from 'rimraf';

export default class EdisonAccountDeletedNotif extends React.Component {
  static displayName = 'EdisonAccountDeletedNotif';

  constructor() {
    super();
    this.state = {
      show: false,
      email: '',
    };
    this._unlisten = Actions.deletedEdisonAccountOnOtherDevice.listen(
      this._onDeletedEdisonAccountOnOtherDevice,
      this
    );
  }

  componentWillUnmount() {
    this._unlisten();
  }

  _onDeletedEdisonAccountOnOtherDevice(email) {
    this.setState({ show: true, email });
  }

  _onClickButton = () => {
    this.setState({ show: false, email: '' });
    AppEnv.logDebug(`running reset accounts settings cb`);
    rimraf(AppEnv.getConfigDirPath(), { disableGlob: true }, err => {
      // if (err) {
      //   return AppEnv.showErrorDialog(
      //     `Could not reset accounts and settings. Please delete the folder ${AppEnv.getConfigDirPath()} manually.\n\n${err.toString()}`
      //   );
      // }
      const app = require('electron').remote.app;
      if (!process.mas) {
        app.relaunch();
      }
      app.quit();
    });
  };

  render() {
    return (
      <FullScreenModal visible={this.state.show} style={{ height: '500px', width: '600px' }} mask>
        <div className="edison-account-notif">
          <RetinaImg
            name={`all-your-devices.png`}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ width: 200, height: 200 }}
          />
          <h2>Your Account was Deleted on Another Device</h2>
          <p>
            The Edison Account for <b>{this.state.email}</b> was deleted on another device. Please
            restart app and create a new account to continue.
          </p>
          <div className="btn-list">
            <div className="btn modal-btn-enable" onClick={this._onClickButton}>
              OK
            </div>
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
