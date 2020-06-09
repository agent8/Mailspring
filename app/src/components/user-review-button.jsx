import { React, Constant } from 'mailspring-exports';
import { ipcRenderer } from 'electron';

const { UserReviewText, UserReviewUrl } = Constant;

function UserReviewBtn() {
  const _onClickUserReview = () => {
    ipcRenderer.send('open-url', UserReviewUrl);
  };
  return (
    <div className="user-review-button" onClick={_onClickUserReview}>
      {UserReviewText}
    </div>
  );
}

module.exports = UserReviewBtn;
