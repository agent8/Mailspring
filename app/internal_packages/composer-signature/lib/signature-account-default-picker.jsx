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
    const { accounts, defaults, signature = {} } = this.props;
    const aliases = [];
    accounts.forEach(account => {
      aliases.push(...account.getAllIsMeContacts());
    });

    return (
      <div className="account-picker">
        <label>Use this signature as the default for:</label>

        {aliases.map(alias => {
          const signatureId =
            typeof alias.signatureId === 'function'
              ? alias.signatureId()
              : `local-${alias.accountId}-${alias.email}-${alias.name}`;
          const isChecked = defaults[signatureId] ? defaults[signatureId] === signature.id : false;
          return (
            <div key={alias.id}>
              <label>
                <input
                  type="checkbox"
                  onChange={() => {
                    this._onToggleAccount(alias);
                  }}
                  checked={isChecked}
                />
                {`${alias.name} <${alias.email}>`}
              </label>
            </div>
          );
        })}
      </div>
    );
  }
}
