import React from 'react';
import PropTypes from 'prop-types';
import CreatePageForForm from './decorators/create-page-for-form';
import FormField from './form-field';

class AccountExchangeSettingsForm extends React.Component {
  static displayName = 'AccountExchangeSettingsForm';

  static propTypes = {
    account: PropTypes.object,
    errorFieldNames: PropTypes.array,
    submitting: PropTypes.bool,
    onConnect: PropTypes.func,
    onFieldChange: PropTypes.func,
    onFieldKeyPress: PropTypes.func,
  };

  static submitLabel = () => {
    return 'Connect Account';
  };

  static titleLabel = () => {
    return 'Set up your account';
  };

  static subtitleLabel = () => {
    return 'Complete the User and Server info below to connect your account.\n Support Exchange Server 2010 SP2 or newer.';
  };

  static validateAccount = account => {
    let errorMessage = null;
    const errorFieldNames = [];
    let populated = true;
    if (!account.settings['ews_password']) {
      errorFieldNames.push('ews_password');
      errorMessage = 'Please provide a password';
      populated = false;
    } else if (!account.settings['ews_username'] && !account.settings['ews_email']) {
      errorFieldNames.push('ews_username');
      errorFieldNames.push('ews_email');
      errorMessage = 'Please provide username or email';
      populated = false;
    }
    return { errorFieldNames, errorMessage, populated };
  };

  UNSAFE_componentWillMount() {
    // auto fill username
    this.props.account.settings['ews_email'] = this.props.account.emailAddress;
    this.props.account.settings['ews_username'] = this.props.account.emailAddress;
  }

  renderUserInfo() {
    return (
      <div>
        <FormField field={`settings.ews_email`} title={'Email'} {...this.props} />
        <FormField
          field={`settings.ews_username`}
          title={'Username'}
          placeholder="User name, if needed"
          {...this.props}
        />
        <FormField
          field={`settings.ews_password`}
          title={'Password'}
          type="password"
          hideColon
          {...this.props}
        />
      </div>
    );
  }
  renderServerInfo() {
    return (
      <div>
        <FormField
          field={`settings.ews_host`}
          title={'Server Address'}
          placeholder="Optional"
          {...this.props}
        />
        <FormField
          field={`settings.ews_domain`}
          title={'Domain'}
          placeholder="Optional"
          {...this.props}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="twocol advance-settings">
        <div className="col">
          <div className="col-heading">
            <span>USER INFO</span>
          </div>
          {this.renderUserInfo()}
        </div>
        <div className="col">
          <div className="col-heading">
            <span>SERVER INFO</span>
          </div>
          {this.renderServerInfo()}
        </div>
      </div>
    );
  }
}

export default CreatePageForForm(AccountExchangeSettingsForm);
