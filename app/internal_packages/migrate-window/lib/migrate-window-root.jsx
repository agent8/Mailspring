import React from 'react';
import { ipcRenderer } from 'electron';
import { LottieImg } from 'mailspring-component-kit';
export default class MigrateWindowRoot extends React.PureComponent {
  static displayName = 'MigrateWindowRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = {
      migrating: true,
    };
    this.mounted = false;
    this._timer = null;
  }
  UNSAFE_componentWillMount() {
    AppEnv.setWindowTitle('Migrating ');
  }

  componentDidMount() {
    AppEnv.center();
    AppEnv.displayWindow();
    ipcRenderer.on('migrate-complete', this._onMigrateComplete);
    this.mounted = true;
  }
  componentWillUnmount() {
    this.mounted = false;
    ipcRenderer.removeListener('migrate-complete', this._onMigrateComplete);
  }

  _onMigrateComplete = (event, data) => {
    if (!this.mounted) {
      return;
    }
    this.setState({ migrating: false });
    this._timer = setTimeout(() => {
      AppEnv.close();
    }, 1000);
  };

  render() {
    return (
      <div className="page-frame migrate-window">
        <div className="migrate-description">
          We are migrating your local data <br /> Please do not close the app.
        </div>
        <div className="migrate-spinner">
          <LottieImg
            name="loading-spinner-blue"
            size={{ width: 48, height: 48 }}
            style={{ margin: 'none', display: 'block' }}
          />
        </div>
      </div>
    );
  }
}
