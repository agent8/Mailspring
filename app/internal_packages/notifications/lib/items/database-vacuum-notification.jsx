import { React, Actions } from 'mailspring-exports';
import { FullScreenModal, RetinaImg, LottieImg } from 'mailspring-component-kit';

export default class DatabaseVacuumNotification extends React.Component {
  static displayName = 'DatabaseVacuumNotification';

  constructor(props) {
    super(props);
    this._mounted = false;
    this.state = {
      showQuestion: false,
      isVacuuming: false,
      vacuumFinished: false,
      progress: 0,
    };
    this._lottie = null;
    this._progressTimer = null;
  }
  componentDidMount() {
    this._mounted = true;
    this._unlisten = [
      Actions.askVacuum.listen(this._onShowQuestion),
      Actions.endDBVacuum.listen(this._onVacuumFinished),
    ];
  }
  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this._progressTimer);
    this._unlisten.forEach(un => {
      un();
    });
  }
  _onLottieLoaded = lottie => {
    console.warn('lotti loaded');
    if (!this._mounted || !lottie) {
      this._lottie = null;
      return;
    }
    this._lottie = lottie;
    lottie.stop();
  };
  _onLottieComplete = () => {
    if (!this._mounted || !this._lottie) {
      return;
    }
    if (this.state.vacuumFinished) {
      if (this._lottie.totalFrames === 90) {
        //For some reason, if we set start to be none 0, when we stop, it'll show blank
        this._lottie.playSegments([0, 130], true);
      } else {
        this._lottie.goToAndStop(130, true);
      }
    }
  };
  _onChangeProgress = () => {
    if (this._progressTimer) {
      clearTimeout(this._progressTimer);
    }
    if (this.state.progress < 90) {
      this.setState({ progress: this.state.progress + 10 });
      this._progressTimer = setTimeout(this._onChangeProgress, 500);
    }
  };
  _onVacuuming = () => {
    this.setState(
      {
        showQuestion: false,
        isVacuuming: true,
        vacuumFinished: false,
      },
      () => {
        if (this._lottie) {
          this._lottie.playSegments([0, 90], true);
        }
        Actions.startDBVacuum();
        this._onChangeProgress();
      }
    );
    AppEnv.logDebug(`User started DB Vacuum`);
  };
  _onVacuumFinished = () => {
    this.setState({
      showQuestion: false,
      isVacuuming: false,
      vacuumFinished: true,
      progress: 0,
    });
    if (this._progressTimer) {
      clearTimeout(this._progressTimer);
    }
  };
  _hidePage = () => {
    this.setState({ showQuestion: false, isVacuuming: false, vacuumFinished: false, progress: 0 });
    if (this._lottie) {
      this._lottie.stop();
    }
  };

  _onShowQuestion = () => {
    this.setState({
      showQuestion: true,
      isVacuuming: false,
      vacuumFinished: false,
    });
  };
  _renderQuestion() {
    if (!this.state.showQuestion) {
      return null;
    }
    return [
      <h1 key="QuestionHeader" className="database-optimize-header">
        Optimize your local data?
      </h1>,
      <p
        key="QuestionDesc"
        className="description"
        style={{ paddingLeft: 12, paddingRight: 12, textAlign: 'center', width: 420 }}
      >
        Edison Mail will optimize your local data to improve app performance. Depending on the
        number of emails downloaded, this might take a while (several minutes).
      </p>,
      <p key="QuestionWarning" className="description warning">
        Once this process starts, it cannot be cancelled, and during this time you will not be able
        to use the Edison Mail app.
      </p>,
      <div key="QuestionBTNList" className="btn-list">
        <button key="VacuumCancel" className="btn modal-btn-disable" onClick={this._hidePage}>
          Cancel
        </button>
        <button key="VacuumProceed" className="btn modal-btn-enable" onClick={this._onVacuuming}>
          Optimize Local Data
        </button>
      </div>,
    ];
  }
  _renderVacuuming() {
    if (!this.state.isVacuuming) {
      return null;
    }
    return [
      <h1 key="VacuumingHeader" className="database-optimize-header">
        Organizing...
      </h1>,
      <p
        key="VacuumingDesc"
        className="description"
        style={{ paddingLeft: 100, paddingRight: 100, paddingBottom: 51 }}
      >
        We're optimizing your local data, please don't quit or restart the app...
      </p>,
      <label>{this.state.progress}%</label>,
      <div className="progress-border">
        <div className="progress-value" style={{ width: `${this.state.progress}%` }} />
      </div>,
    ];
  }
  _renderVacuumFinished() {
    if (!this.state.vacuumFinished) {
      return null;
    }
    return [
      <h1 key="VacuumFinishedHeader" className="database-optimize-header">
        All done!
      </h1>,
      <p
        key="VacuumFinishedDesc1"
        className="description"
        style={{ padding: 'unset', margin: 'unset' }}
      >
        Your app's performance should be in tip-top shape.
      </p>,
      <p
        key="VacuumFinishedDesc2"
        className="description"
        style={{ padding: 'unset', margin: 'unset' }}
      >
        We've reorganized your local data so that things are
      </p>,
      <p
        key="VacuumFinishedDesc3"
        className="description"
        style={{ padding: '0 40px', margin: 'unset' }}
      >
        easier to find. Your email should be running a little faster now.
      </p>,
      <div
        key="VacuumFinishedBTNList"
        className="btn-list"
        style={{ paddingTop: 79, justifyContent: 'center' }}
      >
        <button key="VacuumCancel" className="btn modal-btn-enable" onClick={this._hidePage}>
          Thanks
        </button>
      </div>,
    ];
  }

  render() {
    if (!this.state.showQuestion && !this.state.isVacuuming && !this.state.vacuumFinished) {
      return <span />;
    }
    return (
      <FullScreenModal
        visible={this.state.showQuestion || this.state.isVacuuming || this.state.vacuumFinished}
        style={{ height: '561px', width: '600px' }}
        mask
      >
        <div key="dbOptimize" className="database-optimize">
          <LottieImg
            key={'optimizeDataImage'}
            name="optimize-data"
            size={{ width: 300, height: 220 }}
            style={{ margin: 'none', paddingTop: 20 }}
            isClickToPauseDisabled={true}
            options={{
              autoplay: false,
              loop: true,
            }}
            eventListeners={[
              { eventName: 'DOMLoaded', callback: this._onLottieLoaded },
              { eventName: 'loopComplete', callback: this._onLottieComplete },
            ]}
          />
          {this._renderQuestion()}
          {this._renderVacuuming()}
          {this._renderVacuumFinished()}
        </div>
      </FullScreenModal>
    );
  }
}
