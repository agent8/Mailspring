import React from 'react';
import { CSSTransitionGroup } from 'react-transition-group';
import OnboardingStore from './onboarding-store';
import PageTopBar from './page-top-bar';

import WelcomePage from './page-welcome';
import TutorialPage from './page-tutorial';
import AuthenticatePage from './page-authenticate';
import AccountChoosePage from './page-account-choose';
import AccountSettingsPage from './page-account-settings';
import AccountSettingsPageGmail from './page-account-settings-gmail';
import AccountSettingsPageGmailCalendar from './page-account-settings-gmail-calendar';
import AccountSettingsPageIMAP from './page-account-settings-imap';
import AccountExchangeSettingsForm from './page-account-settings-exchange';
import AccountSettingsPageOffice365 from './page-account-settings-office365';
import AccountSettingsPageOutlook from './page-account-settings-outlook';
import AccountSettingsPageYahoo from './page-account-settings-yahoo';
import AccountSettingsPageJira from './page-account-settings-jira-plugin';
import AccountOnboardingSuccess from './page-account-onboarding-success';
import InitialPreferencesPage from './page-initial-preferences';
import InitialPreferencesProfilePage from './page-initial-preferences-profile';
import InitialPreferencesImproveData from './page-initial-preferences-imporve-data';
import InitialDonePage from './page-initial-done';
import LoginErrorPage from './page-login-error';
import AddAnotherAccountPage from './page-account-add-another';
import GdprTerms from './page-gdpr-terms';
import LoginPage from './page-login';
import SorryPage from './page-sorry';
import OptinTrendsResearchPage from './page-optin-trends-research';

const PageComponents = {
  login: LoginPage,
  sorry: SorryPage,
  welcome: WelcomePage,
  tutorial: TutorialPage,
  authenticate: AuthenticatePage,
  'account-choose': AccountChoosePage,
  'account-settings': AccountSettingsPage,
  'account-settings-gmail': AccountSettingsPageGmail,
  'account-settings-gmail-calendar': AccountSettingsPageGmailCalendar,
  'account-settings-office365-exchange': AccountSettingsPageOffice365,
  'account-settings-outlook': AccountSettingsPageOutlook,
  'account-settings-hotmail': AccountSettingsPageOutlook,
  'account-settings-yahoo': AccountSettingsPageYahoo,
  'account-settings-imap': AccountSettingsPageIMAP,
  'account-settings-exchange': AccountExchangeSettingsForm,
  'account-settings-jira-plugin': AccountSettingsPageJira,
  'account-onboarding-success': AccountOnboardingSuccess,
  'account-add-another': AddAnotherAccountPage,
  'initial-preferences': InitialPreferencesPage,
  'initial-preferences-profile': InitialPreferencesProfilePage,
  'imporove-data': InitialPreferencesImproveData,
  'initial-done': InitialDonePage,
  'gdpr-terms': GdprTerms,
  'login-error': LoginErrorPage,
  'optin-trends-research': OptinTrendsResearchPage,
};

export default class OnboardingRoot extends React.Component {
  static displayName = 'OnboardingRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = this._getStateFromStore();
  }

  componentDidMount() {
    this.unsubscribe = OnboardingStore.listen(this._onStateChanged, this);
    // AppEnv.center();
    AppEnv.displayWindow();
    const win = AppEnv.getCurrentWindow();
    win.setMaximizable(false);
    win.setMinimizable(false);
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  _getStateFromStore = () => {
    return {
      page: OnboardingStore.page(),
      pageDepth: OnboardingStore.pageDepth(),
      account: OnboardingStore.account(),
    };
  };

  _onStateChanged = () => {
    this.setState(this._getStateFromStore());
  };

  _allowMoveBack = () => {
    if (this.state.page === 'account-choose') {
      const pageStack = OnboardingStore._pageStack;
      if (pageStack.length >= 2) {
        const prePage = pageStack[pageStack.length - 2];
        if (prePage === 'account-add-another') {
          return true;
        }
      }
    }
    return ![
      'initial-preferences',
      'tutorial',
      'authenticate',
      'gdpr-terms',
      'account-add-another',
      'account-choose',
      'login-error',
      'account-settings-jira-plugin',
    ].includes(this.state.page);
  };

  render() {
    const Component = PageComponents[this.state.page];
    if (!Component) {
      throw new Error(`Cannot find component for page: ${this.state.page}`);
    }

    return (
      <div className="page-frame">
        <PageTopBar pageDepth={this.state.pageDepth} allowMoveBack={this._allowMoveBack()} />
        <CSSTransitionGroup
          transitionName="alpha-fade"
          transitionLeaveTimeout={150}
          transitionEnterTimeout={150}
        >
          <div key={this.state.page} className="page-container">
            <Component account={this.state.account} />
          </div>
        </CSSTransitionGroup>
      </div>
    );
  }
}
