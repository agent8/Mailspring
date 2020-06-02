import { React, RESTful, Constant } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';
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
      pages: [
        {
          image: 'whatsnew-rating.png',
          title: 'Thanks for Using Email!',
          message:
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

  render() {
    const { showUserReview, finished, pages } = this.state;
    const nowPage = pages[0];
    return (
      <FullScreenModal
        visible={showUserReview}
        onCancel={this._onCloseUserReview}
        style={{ height: '500px', width: '600px' }}
        mask
        closable={finished}
      >
        <div className="focused-inbox-notif">
          <RetinaImg
            name={nowPage.image}
            mode={RetinaImg.Mode.ContentPreserve}
            style={{ width: 260, height: 200 }}
          />
          <h2>{nowPage.title}</h2>
          <p>{nowPage.message}</p>
          <div className="btn-list">
            {finished ? (
              <div className="btn modal-btn-enable" onClick={() => this._onClickReview()}>
                Leave a Review
              </div>
            ) : (
              <div className="btn modal-btn-enable" onClick={() => this._onNext()}>
                Next
              </div>
            )}
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
