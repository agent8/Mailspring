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
    return 'Complete the User and Server info below to connect your account.\n Support Exchange Server 2013 SP1 or newer.';
  };

  static validateAccount = account => {
    let errorMessage = null;
    const errorFieldNames = [];
    let populated = true;
    if (!account.settings['ews_host']) {
      errorFieldNames.push('ews_host');
      errorMessage = 'Please provide a valid Server URL';
      populated = false;
    } else if (!account.settings['ews_password']) {
      errorFieldNames.push('ews_password');
      errorMessage = 'Please provide a password';
      populated = false;
    } else if (!account.settings['ews_username']) {
      errorFieldNames.push('ews_username');
      errorMessage = 'Please provide username or email';
      populated = false;
    }
    return { errorFieldNames, errorMessage, populated };
    // if (!account.settings[`imap_username`] || !account.settings[`imap_password`]) {
    //   return { errorMessage, errorFieldNames, populated: false };
    // }
    //
    // // Note: we explicitly don't check that an SMTP username / password
    // // is provided because occasionally those gateways don't require them!
    //
    // for (const type of ['imap', 'smtp']) {
    //   if (!account.settings[`${type}_host`]) {
    //     return { errorMessage, errorFieldNames, populated: false };
    //   }
    //   if (!Number.isInteger(account.settings[`${type}_port`] / 1)) {
    //     errorMessage = 'Please provide a valid port number.';
    //     errorFieldNames.push(`${type}_port`);
    //   }
    // }
    //
    // return { errorMessage, errorFieldNames, populated: true };
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
          title={'Server URL'}
          placeholder="Enter Exchange Server address"
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
            <span>SERVER INFO</span>
          </div>
          {this.renderServerInfo()}
        </div>
        <div className="col">
          <div className="col-heading">
            <span>USER INFO</span>
          </div>
          {this.renderUserInfo()}
        </div>
      </div>
    );
  }
}

export default CreatePageForForm(AccountExchangeSettingsForm);
