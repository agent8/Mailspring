import { React, RESTful } from 'mailspring-exports';
import { FullScreenModal, RetinaImg } from 'mailspring-component-kit';

const { AppUpdate } = RESTful;
export default class WhatsNew extends React.Component {
  static displayName = 'WhatsNew';

  constructor() {
    super();
    this.state = {
      showUserReview: true,
      pageIdx: 0,
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

  _onCloseUserReview = () => {
    this.setState({
      showUserReview: false,
    });
  };

  render() {
    const { showUserReview, pageIdx, pages } = this.state;
    const nowPage = pages[pageIdx];
    const nowIsLastPage = pageIdx === pages.length - 1;
    return (
      <FullScreenModal
        visible={showUserReview}
        onCancel={this._onCloseUserReview}
        style={{ height: '500px', width: '600px' }}
        mask
        closable={nowIsLastPage}
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
            {nowIsLastPage ? (
              <div className="btn modal-btn-enable" onClick={() => this._onClickButton(true)}>
                Leave a Review
              </div>
            ) : (
              <div className="btn modal-btn-enable" onClick={() => this._onClickButton(true)}>
                Next
              </div>
            )}
          </div>
        </div>
      </FullScreenModal>
    );
  }
}
