const React = require('react');
const { LottieImg } = require('mailspring-component-kit');
const { AccountStore } = require('mailspring-exports');

class InitialDonePage extends React.Component {
  static displayName = 'InitialDonePage';

  constructor(props) {
    super(props);
    this.state = { account: AccountStore.accounts()[0], submitting: false };
  }

  componentDidMount() {
    this._unlisten = AccountStore.listen(this._onAccountStoreChange);
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  _onAccountStoreChange = () => {
    this.setState({ account: AccountStore.accounts()[0] });
  };

  render() {
    if (!this.state.account) {
      return <div />;
    }
    const { submitting } = this.state;
    return (
      <div className="page opaque" style={{ width: 900, height: '100%' }}>
        <img src={`edisonmail://onboarding/assets/onboarding-done@2x.png`} alt="" />
        <h1>You're all Set!</h1>
        <h4>
          We couldn't be happier to have you using
          <br />
          Email Client for Gmail.
        </h4>
        <div className="footer">
          <button
            className={'btn btn-large ' + (submitting && 'btn-disabled')}
            onClick={this._onFinished}
          >
            Let's Go
          </button>
          {submitting && (
            <LottieImg
              name="loading-spinner-blue"
              size={{ width: 24, height: 24 }}
              style={{
                marginLeft: '-12px',
                position: 'absolute',
                bottom: '70px',
                left: '50%',
              }}
            />
          )}
        </div>
      </div>
    );
  }

  _onFinished = () => {
    if (AccountStore.accounts() && AccountStore.accounts().length === 1) {
      AppEnv.trackingEvent('NewUser-FirstUse');
    }
    AppEnv.trackingEvent('Onboarding-Done');
    this.setState({
      submitting: true,
    });
    setTimeout(() => {
      require('electron').ipcRenderer.send('account-setup-successful');
    }, 100);
  };
}

module.exports = InitialDonePage;
