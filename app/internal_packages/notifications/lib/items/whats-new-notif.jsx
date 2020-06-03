import { React, RESTful, Constant } from 'mailspring-exports';
import { FullScreenModal, Banner } from 'mailspring-component-kit';
import { ipcRenderer } from 'electron';

const { UserReviewUrl } = Constant;
const { AppUpdateRest } = RESTful;

export default class WhatsNew extends React.Component {
  static displayName = 'WhatsNew';

  constructor() {
    super();
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

  _getUpdateInformation = async () => {
    const result = await AppUpdateRest.getUpdateInformation();
    const updateList = [];
    try {
      const data = JSON.parse(result.data);
      if (data && data.updateList && data.updateList.length) {
        updateList.push(...data.updateList);
      }
    } catch (e) {}

    this.setState({
      showUserReview: true,
      finished: updateList.length <= 0,
      pages: [...updateList, ...this.state.pages],
    });
  };

  _onCloseUserReview = () => {
    this.setState({
      showUserReview: false,
    });
  };

  _onNext = () => {
    this.setState({
      finished: true,
    });
  };

  _onClickReview = () => {
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
