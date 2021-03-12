import React, { Component } from 'react';
import PropTypes from 'prop-types';
import EmailSecurityStore from './email-security-store';
import EmailSecurityActions from './email-security-actions';
import * as A8 from 'a8';
export default class EmailSecurityStatus extends Component {
  static displayName = 'A8Status';
  static propTypes = {
    message: PropTypes.object,
    thread: PropTypes.object,
  };
  static defaultProps = {};

  constructor(props) {
    super(props);
    this.state = {
      checkEmailHeadersResult: null,
      spamCheckData: null,
      smtpCheckData: null,
      userInfo: null,
      organizationInfo: null,
      error: null,
    };
    this._unlisten = [];
    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;
    this._unlisten = [EmailSecurityStore.listen(this._onFullRefresh)];
    this._onFullRefresh();
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.message && this.props.message && prevProps.message.id !== this.props.message.id) {
      this._onFullRefresh();
    }
  }

  _onFullRefresh = () => {
    this._checkHeaders();
    // this._spamAndSMTPCheck();
    // this._fetchSenderInfo();
    this._fetchSenderEmails();
  };
  _onCheckEmailComplete = ({ id, data }) => {
    if (this._mounted && this.props.message && id === this.props.message.id) {
      this.setState({ checkEmailHeadersResult: data });
    }
  };
  _onCheckEmailFail = ({ id, data }) => {
    if (this._mounted && this.props.message && id === this.props.message.id) {
      this.setState({ checkEmailHeadersResult: null });
    }
  };
  _checkEmail = () => {
    if (this.props.message) {
      EmailSecurityActions.checkEmail({
        message: this.props.message,
        onComplete: this._onCheckEmailComplete,
        onError: this._onCheckEmailFail,
      });
    }
  };

  _checkHeaders = () => {
    if (this.props.message) {
      EmailSecurityActions.checkHeader({
        message: this.props.message,
        onComplete: this._onCheckHeadersComplete,
        onError: this._onCheckHeadersFailed,
      });
    }
  };

  _onSpamAndSMPTCheckError = () => {};
  _onSMTPProgress = ({ id, data }) => {
    if (this._mounted && this.props.message && this.props.message.id === id) {
      this.setState({ smtpCheckData: data });
    }
  };
  _onSpamProgress = ({ id, data }) => {
    if (this._mounted && this.props.message && this.props.message.id === id) {
      this.setState({ spamCheckData: data });
    }
  };
  _spamAndSMTPCheck = () => {
    if (this.props.message) {
      EmailSecurityActions.spamAndSMTPCheck({
        message: this.props.message,
        onSpamProgress: this._onSpamProgress,
        onSMTPProgress: this._onSMTPProgress,
        onError: this._onSpamAndSMPTCheckError,
      });
    }
  };
  _onCheckHeadersComplete = ({ id, data }) => {
    if (this._mounted && this.props.message && id === this.props.message.id) {
      if (data.isSuspicious) {
        this._checkEmail();
      } else {
        this.setState({ checkEmailHeadersResult: { isSuspicious: false } });
      }
    }
  };
  _onCheckHeadersFailed = ({ id, error }) => {
    if (this._mounted && this.props.message && id === this.props.message.id) {
      this.setState({ checkEmailHeadersResult: null, error });
    }
  };
  _onFetchSenderInfoFailed = ({ id, error }) => {};
  _onFetchSenderInfoDataReturned = ({ id, data }) => {
    if (this._mounted && this.props.message && this.props.message.id === id) {
      console.warn('sender info', data);
      this.setState({ userInfo: data.userInfo, organizationInfo: data.organizationInfo });
    }
  };
  _fetchSenderInfo() {
    if (this.props.message) {
      EmailSecurityActions.fetchSenderInfo({
        message: this.props.message,
        onData: this._onFetchSenderInfoDataReturned,
        onError: this._onFetchSenderInfoFailed,
      });
    }
  }
  _onFetchSenderEmailsFailed = ({ id, error }) => {};
  _onFetchSenderEmailsSuccess = ({ id, data }) => {
    if (this._mounted && this.props.message && this.props.message.id === id) {
      console.warn('sender eamils', data);
      this.setState({ emails: data });
    }
  };
  _fetchSenderEmails() {
    if (this.props.message) {
      EmailSecurityActions.fetchSenderEmails({
        message: this.props.message,
        onComplete: this._onFetchSenderEmailsSuccess,
        onError: this._onFetchSenderEmailsFailed,
      });
    }
  }
  componentWillUnmount() {
    this._mounted = false;
    this._unlisten.forEach(unlisten => {
      if (typeof unlisten === 'function') {
        unlisten();
      }
    });
  }
  renderCheckEmailHeadersResult() {
    if (this.state.checkEmailHeadersResult && !this.state.checkEmailHeadersResult.isSuspicious) {
      return 'OK';
    } else if (this.state.checkEmailHeadersResult === null) {
      return 'Checking';
    } else {
      return 'Suspicious';
    }
  }
  renderSmtpCheckResult() {
    if (!this.state.smtpCheckData) {
      return 'Checking';
    }
    let status = '';
    if (this.state.smtpCheckData.status === A8.RemoteCheckStatus.Aborted) {
      status = 'Aborted';
    } else if (this.state.smtpCheckData.status === A8.RemoteCheckStatus.Complete) {
      status = 'Complete';
    }
    const isSuspicious = this.state.smtpCheckData.isSuspicious;
    return `${status}: is suspicious ${isSuspicious}`;
  }
  renderSpamCheckResult() {
    if (!this.state.spamCheckData) {
      return 'Checking';
    }
    let status = 'Checking';
    if (this.state.spamCheckData.status === A8.RemoteCheckStatus.Aborted) {
      status = 'Aborted';
    } else if (this.state.spamCheckData.status === A8.RemoteCheckStatus.Complete) {
      status = 'Complete';
    }
    const isSuspicious = this.state.spamCheckData.isSuspicious;
    if (status === 'Checking') {
      return `${status}: ${this.state.spamCheckData.progress}/${this.state.spamCheckData.total}`;
    }
    return `${status}: is suspicious ${isSuspicious}`;
  }

  render() {
    return <div className="a8-status">{this.renderSpamCheckResult()}</div>;
  }
}
