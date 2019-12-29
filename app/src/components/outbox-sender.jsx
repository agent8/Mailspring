import React from 'react';
import PropTypes from 'prop-types';
import RetinaImg from './retina-img';
import LottieImg from './lottie-img';
import { OutboxStore, AccountStore } from 'mailspring-exports';
export default class OutboxSender extends React.Component {
  static propTypes = {
    draft: PropTypes.object.isRequired,
    lottieStyle: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = { sending: false };
    this.unlistener = null;
    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;
    this.unlistener = OutboxStore.listen(this._onOutboxStoreChange);
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this.unlistener) {
      this.unlistener();
    }
  }

  static getDerivedStateFromProps(props, state) {
    const sending = OutboxStore.draftNeedsToDisplaySending(props.draft);
    if (state.sending !== sending) {
      return { sending };
    }
    return null;
  }

  _onOutboxStoreChange = () => {
    if (this._mounted) {
      this.setState({ sending: OutboxStore.draftNeedsToDisplaySending(this.props.draft) });
    }
  };

  render() {
    const account = AccountStore.accountForId(this.props.draft);
    let accountLogo = 'account-logo-other.png';
    if (account && account.provider !== 'imap') {
      accountLogo = `account-logo-${account.provider}.png`;
    }
    const styles = {
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
    if (this.state.sending) {
      const lottieStyle = { position: 'absolute' };
      if (this.props.lottieStyle) {
        Object.assign(lottieStyle, this.props.lottieStyle);
      }
      return (
        <div className="avatar-icon" style={styles}>
          <RetinaImg
            mode={RetinaImg.Mode.ContentPreserve}
            name={accountLogo}
            style={{ width: 40, height: 40 }}
          />
          <LottieImg
            name={'loading-spinner-blue'}
            size={{ width: 50, height: 50 }}
            isClickToPauseDisabled={true}
            style={lottieStyle}
          />
        </div>
      );
    }
    return <div className="avatar-icon" style={styles}>
      <RetinaImg mode={RetinaImg.Mode.ContentPreserve}
                 name={accountLogo}
                 style={{ width: 40, height: 40 }}
      />
    </div>;
  }
}