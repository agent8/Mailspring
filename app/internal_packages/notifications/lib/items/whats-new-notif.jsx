import { React, RESTful, Constant } from 'mailspring-exports';
import { FullScreenModal, Banner } from 'mailspring-component-kit';
import { remote, ipcRenderer } from 'electron';

const { UserReviewUrl, UserUseAppDaysHappyLine, ServerInfoPriorityEnum } = Constant;
const { AppUpdateRest } = RESTful;
const SETTINGS_KEY = 'update.user-know-update-info-version';
const AppInstallConfigKey = 'identity.createdAt';

export default class WhatsNew extends React.Component {
  static displayName = 'WhatsNew';

  constructor() {
    super();
    this.version = remote.getGlobal('application').version;
    this.state = {
      showUserReview: false,
      finished: true,
      pageIdx: 0,
      pages: [
        {
          image: 'whatsnew-rating.png',
          title: 'Thanks for Using Email!',
          description:
            'If you have a moment to leave a review in the App Store, we would really appreciate it.',
        },
      ],
    };
  }

  componentDidMount() {
    this._getUpdateInformation();
  }

  isLessThenNowVersion = version => {
    const nowVersion = this.version.split('.');
    const configVersion = version.split('.');
    let i = 0;
    const maxI = Math.max(nowVersion.length - 1, configVersion.length - 1);
    while (nowVersion[i] === configVersion[i] && i < maxI) {
      i++;
    }
    if (!configVersion[i]) {
      return true;
    } else if (!nowVersion[i]) {
      return false;
    } else {
      return Number(configVersion[i]) < Number(nowVersion[i]);
    }
  };

  _getUpdateInformation = async () => {
    // If the user has use our app at least xxx days,
    // we think that the user has used our app in depth and happy
    const appInstallAt = AppEnv.config.get(AppInstallConfigKey);
    if (!appInstallAt) {
      return;
    }
    const sinceInstall = new Date() - new Date(appInstallAt);
    if (sinceInstall < UserUseAppDaysHappyLine * 24 * 60 * 60 * 1000) {
      return;
    }
    // if the user ever reviewed
    // We shouldn show this pop-up
    const userKnowUpdateInfoVersion = AppEnv.config.get(SETTINGS_KEY);
    if (userKnowUpdateInfoVersion) {
      return;
    }
    const result = await AppUpdateRest.getUpdateInformation();
    if (!result.data) {
      return;
    }
    const updateInfoList = [];
    try {
      const { priority, updateList } = JSON.parse(result.data);
      if (!priority || priority !== ServerInfoPriorityEnum.UpdateInfo) {
        return;
      }
      if (updateList && updateList.length) {
        updateInfoList.push(...updateList);
      }
    } catch (e) {
      console.error(e.message);
      return;
    }

    this.setState({
      showUserReview: true,
      finished: updateInfoList.length <= 0,
      pages: [...updateInfoList, ...this.state.pages],
    });
  };

  _onCloseUserReview = () => {
    this.setState({
      showUserReview: false,
    });
    AppEnv.config.set(SETTINGS_KEY, this.version);
  };

  _onNext = () => {
    this.setState({
      finished: true,
    });
  };

  _onClickReview = () => {
    this._onCloseUserReview();
    ipcRenderer.send('open-url', UserReviewUrl);
  };

  _setCurrentIndex = idx => {
    this.setState({ pageIdx: idx });
  };

  render() {
    const { showUserReview, finished, pages, pageIdx } = this.state;
    const currentPage = pages[pageIdx];

    return (
      <FullScreenModal
        visible={showUserReview}
        onCancel={this._onCloseUserReview}
        style={{ height: '500px', width: '600px' }}
        mask
        closable={finished}
      >
        <div className="whats-new-notif">
          <Banner
            afterChange={this._setCurrentIndex}
            autoplay
            dots
            data={pages.map(page => page.image)}
            height={250}
            width={500}
          />
          <div className="text-container">
            <h2>{currentPage.title}</h2>
            <p>{currentPage.description}</p>
          </div>
          <div className="footer">
            {finished ? (
              <div className="btn modal-btn-enable" onClick={() => this._onClickReview()}>
                Leave a Review
              </div>
            ) : (
              <div className="btn modal-btn-disable" onClick={() => this._onNext()}>
                Next
              </div>
            )}
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
