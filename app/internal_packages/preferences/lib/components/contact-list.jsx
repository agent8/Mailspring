import React from 'react';
import PropTypes from 'prop-types';
import { EmailAvatar } from 'mailspring-exports';
import { InputSearch } from 'mailspring-component-kit';

class ContactList extends React.Component {
  static displayName = 'ContactList';

  static propTypes = {
    contacts: PropTypes.array.isRequired,
    checkmarkNote: PropTypes.string,
    handleName: PropTypes.string.isRequired,
    handleSelect: PropTypes.func.isRequired,
  };

  constructor() {
    super();
    this.state = {
      contacts: [],
      selections: [],
      searchValue: '',
      filterList: [],
    };
  }

  UNSAFE_componentWillReceiveProps(next) {
    const { contacts } = next;
    this.setState({ contacts }, () => {
      this._filterContactsBySearchValue();
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

  checkAllStatus = () => {
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

  checkStatus = id => {
    const { selections } = this.state;
    if (selections.indexOf(id) >= 0) {
      return 'selected';
    } else {
      return '';
    }
  };

  onToggleSelectAll = () => {
    const checkStatus = this.checkAllStatus();
    if (!checkStatus) {
      this._selectAll();
    } else {
      this._clearSelection();
    }
  };

  onToggleSelect = id => {
    const checkStatus = this.checkStatus(id);
    let newSelections;
    if (checkStatus) {
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

  onInputChange = value => {
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

  render() {
    const { filterList } = this.state;
    const selectAllStatus = this.checkAllStatus();
    const { checkmarkNote = 'select', handleName } = this.props;
    return (
      <div className="contact-list">
        <ul>
          <div className="header">
            <div className={`checkmark ${selectAllStatus}`} onClick={this.onToggleSelectAll}></div>
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
                onChange={this.onInputChange}
              />
            </div>
          </div>
          {filterList.map(contact => {
            const selectStatus = this.checkStatus(contact.id);

            return (
              <li key={contact.id} className={`${selectStatus}`}>
                <div
                  className={`checkmark ${selectStatus}`}
                  onClick={() => this.onToggleSelect(contact.id)}
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
