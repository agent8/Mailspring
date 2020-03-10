import { React, PropTypes, Actions } from 'mailspring-exports';
import { MultiselectDropdown } from 'mailspring-component-kit';

export default class SignatureAccountDefaultPicker extends React.Component {
  static propTypes = {
    defaults: PropTypes.object,
    signature: PropTypes.object,
    accounts: PropTypes.array,
  };

  _onToggleAccount = aliases => {
    Actions.toggleAliasesSignature(aliases);
  };

  render() {
    const { accounts, defaults, signature } = this.props;
    const aliases = [];
    accounts.forEach(account => {
      aliases.push(account.emailAddress);
      if (account.aliases && account.aliases.length) {
        aliases.push(...account.aliases);
      }
    });

    return (
      <div className="account-picker">
        <label>Use this signature as the default for:</label>

        {aliases.map(aliases => {
          const isChecked = defaults[aliases] === signature.id;
          return (
            <div key={aliases}>
              <label>
                <input
                  type="checkbox"
                  onChange={() => {
                    this._onToggleAccount(aliases);
                  }}
                  checked={isChecked}
                />
                {aliases}
              </label>
            </div>
          );
        })}
      </div>
    );
  }
}
