import { React, PropTypes, Actions } from 'mailspring-exports';
import { MultiselectDropdown } from 'mailspring-component-kit';

export default class SignatureAccountDefaultPicker extends React.Component {
  static propTypes = {
    defaults: PropTypes.object,
    signature: PropTypes.object,
    accounts: PropTypes.array,
  };

  _onToggleAccount = account => {
    Actions.toggleAccount(account.emailAddress);
  };

  render() {
    const { accounts, defaults, signature } = this.props;

    return (
      <div className="account-picker">
        <label>Use this signature as the default for:</label>

        {accounts.map(account => {
          const isChecked = defaults[account.emailAddress] === signature.id;
          return (
            <div key={account.id}>
              <label>
                <input
                  type="checkbox"
                  onChange={() => {
                    this._onToggleAccount(account);
                  }}
                  checked={isChecked}
                />
                {account.emailAddress}
              </label>
            </div>
          );
        })}
      </div>
    );
  }
}
