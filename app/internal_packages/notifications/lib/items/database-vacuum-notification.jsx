import { React, Actions } from 'mailspring-exports';
import { FullScreenModal, RetinaImg, LottieImg } from 'mailspring-component-kit';

export default class DatabaseVacuumNotification extends React.Component {
  static displayName = 'DatabaseVacuumNotification';

  constructor() {
    super();
    this.state = {
      showQuestion: false,
      isVacuuming: false,
    };
  }
  componentDidMount() {
    this._unlisten = [
      Actions.askVacuum.listen(this._onShowQuestion),
      Actions.endDBVacuum.listen(this._onVacuumFinished),
    ];
  }
  componentWillUnmount() {
    this._unlisten.forEach(un => {
      un();
    });
  }
  _onVacuuming = () => {
    this.setState({ showQuestion: false, isVacuuming: true });
    AppEnv.logDebug(`User started DB Vacuum`);
    Actions.startDBVacuum();
  };
  _onVacuumFinished = () => {
    this.setState({ showQuestion: false, isVacuuming: false });
  };

  _onShowQuestion = () => {
    this.setState({ showQuestion: true, isVacuuming: false });
  };
  _renderQuestion() {
    if (!this.state.showQuestion) {
      return null;
    }
    return [
      <h1 key="QuestionHeader">Compact and optimize data?</h1>,
      <p key="QuestionDesc" className="description">
        Edison mail will optimize your local data to improve performance.
        <br /> During this time, you will not be able to receive/edit/send any emails. Depending on
        the number of emails downloaded, this might take some time.
        <br /> Once the process started, it cannot be canceled.
      </p>,
      <div key="QuestionBTNList" className="btn-list">
        <button
          key="VacuumCancel"
          className="btn modal-btn-disable"
          onClick={this._onVacuumFinished}
        >
          Cancel
        </button>
        <button key="VacuumProceed" className="btn modal-btn-enable" onClick={this._onVacuuming}>
          Proceed
        </button>
      </div>,
    ];
  }
  _renderVacuuming() {
    if (!this.state.isVacuuming) {
      return null;
    }
    return [
      <h1 key="VacuumingHeader">Optimizing local data</h1>,
      <p key="VacuumingDesc" className="description">
        Edison mail is optimizing your local data, please do not close or restart the app.
      </p>,
      <LottieImg name={'loading-spinner-blue'} size={{ width: 48, height: 48, marginLeft: -24 }} />,
    ];
  }

  render() {
    return (
      <FullScreenModal
        visible={this.state.showQuestion || this.state.isVacuuming}
        style={{ height: '550px', width: '600px' }}
        mask
      >
        <div key="dbOptimize" className="database-optimize">
          <RetinaImg
            className="logo"
            name={`preference-data-true${AppEnv.isDarkTheme() ? '-dark' : ''}.png`}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ height: 200, width: 200 }}
          />
          {this._renderQuestion()}
          {this._renderVacuuming()}
        </div>
      </FullScreenModal>
    );
  }
}
