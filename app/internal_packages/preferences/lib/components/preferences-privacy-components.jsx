import React from 'react';
import PropTypes from 'prop-types';
import { Flexbox, RetinaImg, LottieImg, FullScreenModal } from 'mailspring-component-kit';
import {
  Actions,
  Utils,
  TaskQueue,
  SiftExpungeUserDataTask,
  SiftExportUserDataTask,
} from 'mailspring-exports';
import rimraf from 'rimraf';
import ExportDataModal from './export-data-modal';
export class Privacy extends React.Component {
  static displayName = 'PreferencesPrivacy';

  static propTypes = {
    config: PropTypes.object,
    configSchema: PropTypes.object,
  };
  constructor(props) {
    super(props);
    this.state = {
      deleteUserDataPopupOpen: false,
      deletingUserData: false,
      optOutModalVisible: false,
      exportDataModalVisible: false,
      exportingSiftData: false,
    };
    this._mounted = false;
    this._expungeUserDataTimout = null;
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._expungeUserDataTimout) {
      clearTimeout(this._expungeUserDataTimout);
    }
  }

  renderExportDataButton() {
    if (this.state.exportingSiftData) {
      return (
        <div className="btn-primary privacys-button">
          {this.renderSpinner()}
          Export My Data
        </div>
      );
    }
    return (
      <div
        className="btn-primary privacys-button"
        onClick={() => {
          this.setState({ exportDataModalVisible: true });
        }}
      >
        Export My Data
      </div>
    );
  }

  renderExportData() {
    if (Utils.needGDPR()) {
      return (
        <div className="config-group">
          <h6>EXPORT YOUR DATA</h6>
          <div className="privacys-note">
            Get a zipped archive of all your user and email related information for all your
            connected emails on Edison Mail.
          </div>
          <Flexbox>{this.renderExportDataButton()}</Flexbox>
        </div>
      );
    } else {
      return null;
    }
  }

  expungeLocalAndReboot() {
    if (this._mounted) {
      this.setState({ deletingUserData: false });
    }
    rimraf(AppEnv.getConfigDirPath(), { disableGlob: true }, err => {
      if (err) {
        return AppEnv.showErrorDialog(
          `Could not reset accounts and settings. Please delete the folder ${AppEnv.getConfigDirPath()} manually.\n\n${err.toString()}`
        );
      }
      const app = require('electron').remote.app;
      app.relaunch();
      app.quit();
    });
  }

  openDeleteUserDataConfirmationPage = () => {
    this.setState({ deleteUserDataPopupOpen: true });
    AppEnv.showMessageBox({
      title: 'Are you sure?',
      detail:
        'By deleting your data on our servers, you are also discontinuing your use of the Email application. This action cannot be undon. ',
      showInMainWindow: true,
      buttons: ['Delete', 'Cancel'],
    }).then(({ response }) => {
      if (this._mounted) {
        this.setState({ deleteUserDataPopupOpen: false });
      }
      if (response === 0) {
        this.setState({ deletingUserData: true }, () => {
          const task = new SiftExpungeUserDataTask();
          Actions.queueTask(task);
          TaskQueue.waitForPerformRemote(task)
            .then(() => {
              this.expungeLocalAndReboot();
            })
            .catch(() => {
              AppEnv.showErrorDialog({
                title: 'Delete data failed.',
                message: 'Expunging data from remote server failed, Please try again',
              });
            });
        });
      }
    });
  };

  renderDeleteUserData() {
    if (this.state.deleteUserDataPopupOpen || this.state.deletingUserData) {
      return (
        <div className="btn-danger privacys-button">{this.renderSpinner()}Delete Stored Data</div>
      );
    }
    return (
      <div className="btn-danger privacys-button" onClick={this.openDeleteUserDataConfirmationPage}>
        Delete Stored Data
      </div>
    );
  }

  toggleDataShare = value => {
    AppEnv.config.set('core.privacy.dataShare.optOut', !!value);
    Actions.dataShareOptions({ optOut: !!value });
  };

  _onCloseOptOutModal = () => {
    this.setState({ optOutModalVisible: false });
  };

  _onCloseExportDataModal = () => {
    this.setState({ exportDataModalVisible: false });
  };

  _onConfirmExportData = sendEmail => {
    this._onCloseExportDataModal();
    this.setState({ exportingSiftData: true }, () => {
      const task = new SiftExportUserDataTask({
        sendEmail: sendEmail.email,
        accountId: sendEmail.accountId,
      });
      Actions.queueTask(task);
      TaskQueue.waitForPerformRemote(task)
        .then(() => { })
        .catch(() => {
          AppEnv.showErrorDialog({
            title: 'Export data failed.',
            message: 'Export data from remote server failed, Please try again',
          });
        })
        .finally(() => {
          if (this._mounted) {
            this.setState({ exportingSiftData: false });
          }
        });
    });
  };

  renderDataShareOption() {
    if (this.state.deleteUserDataPopupOpen || this.state.deletingUserData) {
      return (
        <div className="btn-danger privacys-button">
          {this.renderSpinner()}Opt-out of Data Sharing
        </div>
      );
    }
    if (AppEnv.config.get('core.privacy.dataShare.optOut')) {
      return (
        <div className="btn-primary privacys-button" onClick={() => this.toggleDataShare(false)}>
          Opt-in to Data Sharing
        </div>
      );
    } else {
      return (
        <div
          className="btn-danger privacys-button"
          onClick={() => {
            this.setState({ optOutModalVisible: true });
          }}
        >
          Opt-out of Data Sharing
        </div>
      );
    }
  }

  renderSpinner() {
    return (
      <LottieImg
        name="loading-spinner-blue"
        size={{ width: 24, height: 24 }}
        style={{ margin: 'none' }}
      />
    );
  }

  render() {
    return (
      <div className="container-privacys">
        <Flexbox>
          <div className="config-group">
            <h6>POLICY & TERMS</h6>
            <div className="privacys-note">
              Safeguarding your privacy is important to all of us here at Edison Software. Read our
              privacy policy for important information about how we use and protect your data.
            </div>
            <div className="privacys-link">
              <a href="http://www.edison.tech/privacy.html">Privacy Policy</a>
            </div>
            <div className="privacys-link">
              <a href="http://www.edison.tech/terms.html">Terms & Conditions</a>
            </div>
          </div>
          <RetinaImg
            name={'manage-privacy.png'}
            mode=""
            style={{ width: 200, height: 200, marginTop: 20 }}
          />
        </Flexbox>
        <div className="config-group">
          <h6>MANAGE YOUR DATA</h6>
          <div className="privacys-note">
            We respect and acknowledge your right to privacy. At any time, you can discontinue use
            of this app and delete the information that is in the app and on our servers.
          </div>
          <Flexbox>
            {this.renderDeleteUserData()}
            {this.renderDataShareOption()}
          </Flexbox>
        </div>
        {this.renderExportData()}
        <FullScreenModal
          visible={this.state.optOutModalVisible}
          closable
          mask
          maskClosable
          onCancel={this._onCloseOptOutModal}
        >
          <div className="privacys-opt-out-modal preferences-modal">
            <RetinaImg
              name={`inbox-nomail-3.png`}
              mode={RetinaImg.Mode.ContentPreserve}
              style={{ width: 150, height: 150 }}
            />
            <h2>Data makes our technology work better for you.</h2>
            <p>
              We use data shared with us (that does not identify you) to invent new app features,
              and create research about national purchase trends. We never share your emails, or any
              data that can be used to track you personally for advertising.
              <br />
              <br />
              You can opt-out of data sharing at any time. Keep in mind, our data practices allow us
              to offer you this amazing Email app for free.
            </p>
            <div
              className="modal-btn-confirm"
              onClick={() => {
                this.toggleDataShare(true);
                this._onCloseOptOutModal();
              }}
            >
              No thanks, I want to opt out.
            </div>
            <div className="modal-btn-cancel" onClick={this._onCloseOptOutModal}>
              Cancel
            </div>
          </div>
        </FullScreenModal>
        <FullScreenModal
          visible={this.state.exportDataModalVisible}
          closable
          mask
          maskClosable
          onCancel={this._onCloseExportDataModal}
        >
          <ExportDataModal onConfirmCB={this._onConfirmExportData} />
        </FullScreenModal>
      </div>
    );
  }
}