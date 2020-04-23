import React from 'react';
import PropTypes from 'prop-types';
import CreatePageForForm from './decorators/create-page-for-form';
import FormField from './form-field';

const StandardIMAPPorts = [143, 993];
const StandardSMTPPorts = [25, 465, 587];

class AccountIMAPSettingsForm extends React.Component {
  static displayName = 'AccountIMAPSettingsForm';

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
    return 'Complete the IMAP and SMTP settings below to connect your account.';
  };

  static validateAccount = account => {
    let errorMessage = null;
    const errorFieldNames = [];

    if (!account.settings[`imap_username`] || !account.settings[`imap_password`]) {
      return { errorMessage, errorFieldNames, populated: false };
    }

    // Note: we explicitly don't check that an SMTP username / password
    // is provided because occasionally those gateways don't require them!

    for (const type of ['imap', 'smtp']) {
      if (!account.settings[`${type}_host`]) {
        return { errorMessage, errorFieldNames, populated: false };
      }
      if (!Number.isInteger(account.settings[`${type}_port`] / 1)) {
        errorMessage = 'Please provide a valid port number.';
        errorFieldNames.push(`${type}_port`);
      }
    }

    return { errorMessage, errorFieldNames, populated: true };
  };

  renderPortDropdown(protocol) {
    if (!['imap', 'smtp'].includes(protocol)) {
      throw new Error(`Can't render port dropdown for protocol '${protocol}'`);
    }
    const { account: { settings }, submitting, onFieldKeyPress, onFieldChange } = this.props;
    const field = `${protocol}_port`;
    // set default port
    if (!settings[field] && field === 'imap_port') {
      settings.imap_port = 993;
    }
    if (!settings[field] && field === 'smtp_port') {
      settings.smtp_port = 587;
    }
    const values = protocol === 'imap' ? StandardIMAPPorts : StandardSMTPPorts;
    const isStandard = values.includes(settings[field] / 1);
    const customValue = isStandard ? '0' : settings[field];

    // When you change the port, automatically switch the security setting to
    // the standard for that port. Lots of people don't update that field and
    // are getting confused.
    const onPortChange = event => {
      const data = { target: { value: event.target.value, id: event.target.id } };
      setTimeout(() => onFieldChange(data), 0);
      if (event.target.value / 1 === 143 && settings.imap_security !== 'none') {
        onFieldChange({ target: { value: 'none', id: 'settings.imap_security' } });
      }
      if (event.target.value / 1 === 993 && settings.imap_security !== 'SSL / TLS') {
        onFieldChange({ target: { value: 'SSL / TLS', id: 'settings.imap_security' } });
      }
      if (event.target.value / 1 === 25 && settings.smtp_security !== 'none') {
        onFieldChange({ target: { value: 'none', id: 'settings.smtp_security' } });
      }
      if (event.target.value / 1 === 587 && settings.smtp_security !== 'STARTTLS') {
        onFieldChange({ target: { value: 'STARTTLS', id: 'settings.smtp_security' } });
      }
    };
    return (
      <div>
        <label htmlFor={`settings.${field}`}>Port Number</label>
        <div className="dropdown-wrapper">
          <select
            id={`settings.${field}`}
            tabIndex={0}
            value={settings[field]}
            disabled={submitting}
            onChange={onPortChange}
          >
            {values.map(v => (
              <option value={v} key={v}>
                {v}
              </option>
            ))}
            <option value={customValue} key="custom">
              Custom
          </option>
          </select>
        </div>
        {!isStandard && (
          <input
            style={{
              width: 80,
              marginLeft: 6,
              height: 23,
            }}
            id={`settings.${field}`}
            tabIndex={0}
            value={settings[field]}
            disabled={submitting}
            onKeyPress={onFieldKeyPress}
            onChange={onFieldChange}
          />
        )}
      </div>
    );
  }

  renderSecurityDropdown(protocol) {
    const { account: { settings }, submitting, onFieldKeyPress, onFieldChange } = this.props;

    return (
      <div>
        <label htmlFor={`settings.${protocol}_security`}>Security</label>
        <div className="dropdown-wrapper">
          <select
            id={`settings.${protocol}_security`}
            tabIndex={0}
            value={settings[`${protocol}_security`]}
            disabled={submitting}
            onKeyPress={onFieldKeyPress}
            onChange={onFieldChange}
          >
            <option value="SSL / TLS" key="SSL / TLS">
              SSL / TLS
            </option>
            <option value="STARTTLS" key="STARTTLS">
              STARTTLS
            </option>
            <option value="none" key="none">
              None
            </option>
          </select>
        </div>
      </div>
    );
  }

  renderSecurityCheckbox(protocol) {
    const { account: { settings }, submitting, onFieldKeyPress, onFieldChange } = this.props;

    return (
      <div>
        <div style={{ paddingBottom: '13px' }}>
          <input
            type="checkbox"
            id={`settings.${protocol}_allow_insecure_ssl`}
            disabled={submitting}
            checked={settings[`${protocol}_allow_insecure_ssl`] || false}
            onKeyPress={onFieldKeyPress}
            onChange={onFieldChange}
          />
          <label htmlFor={`settings.${protocol}_allow_insecure_ssl"`} className="checkbox">
            Allow insecure SSL
          </label>
        </div>
      </div>
    );
  }

  UNSAFE_componentWillMount() {
    // auto fill username
    this.props.account.settings['imap_username'] = this.props.account.emailAddress;
    this.props.account.settings['smtp_username'] = this.props.account.emailAddress;
  }

  renderFieldsForType(type) {
    return (
      <div>
        <FormField field={`settings.${type}_host`} title={'Server'} hideColon {...this.props} />
        <div style={{ textAlign: 'left' }}>
          <div className="settings-flex-row">
            {this.renderPortDropdown(type)}
            {this.renderSecurityDropdown(type)}
          </div>
          {this.renderSecurityCheckbox(type)}
        </div>
        <FormField field={`settings.${type}_username`} title={'Username'} hideColon {...this.props} />
        <FormField
          field={`settings.${type}_password`}
          title={'Password'}
          type="password"
          hideColon
          {...this.props}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="twocol advance-settings">
        <div className="col">
          <div className="col-heading"><span>INCOMING MAIL SERVER (IMAP)</span></div>
          {this.renderFieldsForType('imap')}
        </div>
        <div className="col">
          <div className="col-heading"><span>OUTGOING MAIL SERVER (SMTP)</span></div>
          {this.renderFieldsForType('smtp')}
        </div>
      </div>
    );
  }
}

export default CreatePageForForm(AccountIMAPSettingsForm);