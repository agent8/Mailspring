import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { EmailAvatar, ContactStore } from 'mailspring-exports';
import { InputSearch, Menu } from 'mailspring-component-kit';

class ContactList extends React.Component {
  static displayName = 'ContactList';

  static propTypes = {
    contacts: PropTypes.array.isRequired,
    checkmarkNote: PropTypes.string,
    handleName: PropTypes.string.isRequired,
    handleSelect: PropTypes.func.isRequired,
    showAddContact: PropTypes.bool,
    onAddContact: PropTypes.func,
  };

  constructor() {
    super();
    this.state = {
      contacts: [],
      selections: [],
      searchValue: '',
      filterList: [],
      showAddContact: false,
      addContactInputValue: '',
      completions: [],
    };
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  UNSAFE_componentWillReceiveProps(next) {
    const { contacts, showAddContact } = next;
    this.setState({ contacts }, () => {
      this._filterContactsBySearchValue();
      if (showAddContact !== this.state.showAddContact) {
        this._onToggleAddContactShow();
      }
    });
  }

  _filterContactsBySearchValue() {
    const { searchValue, contacts, selections } = this.state;
    const filterList = contacts.filter(contact => {
      return contact.name.indexOf(searchValue) >= 0 || contact.email.indexOf(searchValue) >= 0;
    });
    const filterIdList = filterList.map(contact => contact.id);
    const newSelections = selections.filter(id => filterIdList.indexOf(id) >= 0);
    this.setState({ filterList, selections: newSelections });
  }

  _checkAllStatus = () => {
    const { filterList, selections } = this.state;
    const selectionCount = selections.length;
    const isSelectAll = filterList && filterList.length && selectionCount === filterList.length;
    if (isSelectAll) {
      return 'selected';
    } else if (selectionCount) {
      return 'some-selected';
    }
    return '';
  };

  _checkStatus = id => {
    const { selections } = this.state;
    if (selections.indexOf(id) >= 0) {
      return 'selected';
    } else {
      return '';
    }
  };

  _onToggleSelectAll = () => {
    const _checkStatus = this._checkAllStatus();
    if (!_checkStatus) {
      this._selectAll();
    } else {
      this._clearSelection();
    }
  };

  _onToggleSelect = id => {
    const _checkStatus = this._checkStatus(id);
    let newSelections;
    if (_checkStatus) {
      newSelections = this.state.selections.filter(selectionId => selectionId !== id);
    } else {
      newSelections = [id, ...this.state.selections];
    }
    this.setState({ selections: newSelections });
  };

  _selectAll() {
    const allContacts = this.state.filterList.map(contact => contact.id);
    this.setState({ selections: allContacts });
  }

  _clearSelection() {
    this.setState({ selections: [] });
  }

  _onSearchInputChange = value => {
    this.setState({ searchValue: value }, () => {
      this._filterContactsBySearchValue();
    });
  };

  _handleSelect = () => {
    const { handleSelect } = this.props;
    const { selections } = this.state;
    const contactIdEmailMapping = new Map();
    this.state.filterList.forEach(contact => {
      contactIdEmailMapping.set(contact.id, contact.email);
    });
    const selectEmails = selections.map(id => contactIdEmailMapping.get(id));
    handleSelect(selectEmails);
  };

  _handleItem = email => {
    const { handleSelect } = this.props;
    handleSelect(email);
  };

  _onToggleAddContactShow = () => {
    this.setState(
      {
        showAddContact: !this.state.showAddContact,
        addContactInputValue: '',
        completions: [],
      },
      () => {
        if (this._addContactInput) {
          this._addContactInput.focus();
        }
      }
    );
  };

  _onAddContactInputChange = value => {
    this.setState({ addContactInputValue: value }, () => this._refreshCompletions());
  };

  _onAddContactInputBlur = () => {
    if (this.props.onAddContact && typeof this.props.onAddContact === 'function') {
      this.props.onAddContact();
    }
  };

  _onSelectContact = contact => {
    if (this.props.onAddContact && typeof this.props.onAddContact === 'function') {
      this.props.onAddContact(contact.email);
    }
  };

  _refreshCompletions = () => {
    const { addContactInputValue } = this.state;
    const tokensOrPromise = ContactStore.searchContacts(addContactInputValue);
    if (_.isArray(tokensOrPromise)) {
      this.setState({ completions: tokensOrPromise });
    } else if (tokensOrPromise instanceof Promise) {
      tokensOrPromise.then(tokens => {
        if (!this._mounted) {
          return;
        }
        this.setState({ completions: tokens });
      });
    } else {
      console.warn(
        'onRequestCompletions returned an invalid type. It must return an Array of tokens or a Promise that resolves to an array of tokens'
      );
      this.setState({ completions: [] });
    }
  };

  _renderContactItem = p => {
    const CustomComponent = p.customComponent;
    if (CustomComponent) return <CustomComponent token={p} />;
    return <Menu.NameEmailItem name={p.name} email={p.email} key={p.id} />;
  };

  _renderAddContactInput = () => {
    return (
      <div key="add-contact-to-mute-input">
        <InputSearch
          ref={el => (this._addContactInput = el)}
          onBlur={this._onAddContactInputBlur}
          showClearIcon
          placeholder="Find a contact"
          onChange={this._onAddContactInputChange}
        />
      </div>
    );
  };

  render() {
    const { filterList, showAddContact } = this.state;
    const selectAllStatus = this._checkAllStatus();
    const { checkmarkNote = 'select', handleName } = this.props;
    return (
      <div className="contact-list">
        <ul>
          <div className="header">
            <div className={`checkmark ${selectAllStatus}`} onClick={this._onToggleSelectAll}></div>
            <div className="checkmark-note">{`${
              filterList && filterList.length ? filterList.length : 0
            } ${checkmarkNote}`}</div>
            <span
              className={`handleBtn${selectAllStatus ? ' show' : ''}`}
              onClick={() => this._handleSelect()}
            >
              {`${handleName} Selected`}
            </span>
            <div style={{ flex: 1 }}></div>
            <div className="search-box">
              <InputSearch
                showPreIcon
                showClearIcon
                placeholder="Find a contact"
                onChange={this._onSearchInputChange}
              />
            </div>
          </div>
          {showAddContact ? (
            <li className="add-contact-list">
              <Menu
                items={this.state.completions}
                itemKey={item => item.id}
                itemContent={this._renderContactItem}
                headerComponents={[this._renderAddContactInput()]}
                onBlur={this._onAddContactInputBlur}
                onSelect={this._onSelectContact}
              />
            </li>
          ) : null}
          {filterList.map(contact => {
            const selectStatus = this._checkStatus(contact.id);

            return (
              <li key={contact.id} className={`${selectStatus}`}>
                <div
                  className={`checkmark ${selectStatus}`}
                  onClick={() => this._onToggleSelect(contact.id)}
                ></div>
                <EmailAvatar
                  key="email-avatar"
                  account={{ name: contact.name, email: contact.email }}
                />
                {contact.name ? <span>{contact.name}</span> : null}
                {contact.email}
                <span className="handleBtn" onClick={() => this._handleItem(contact.email)}>
                  {handleName}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

export default ContactList;
