import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { EmailAvatar, ContactStore } from 'mailspring-exports';
import { Menu, InputSearch } from 'mailspring-component-kit';

class ContactSearch extends React.Component {
  static displayName = 'ContactSearch';

  static propTypes = {
    filterContacts: PropTypes.array,
    onSelectContact: PropTypes.func,
  };

  constructor() {
    super();
    this.state = {
      addContactInputValue: '',
      completions: [],
    };
  }

  componentDidMount() {
    this._mounted = true;
    if (this._inputSearch) {
      this._inputSearch.focus();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _onAddContactInputChange = value => {
    this.setState({ addContactInputValue: value }, () => this._refreshCompletions());
  };

  _onAddContactInputBlur = () => {
    this._onAddContactInputChange('');
    if (this._inputSearch) {
      this._inputSearch.clear();
    }
    if (this.props.onSelectContact && typeof this.props.onSelectContact === 'function') {
      this.props.onSelectContact();
    }
  };

  _onSelectContact = contact => {
    this._onAddContactInputChange('');
    if (this._inputSearch) {
      this._inputSearch.clear();
    }
    if (this.props.onSelectContact && typeof this.props.onSelectContact === 'function') {
      this.props.onSelectContact(contact);
    }
  };

  _refreshCompletions = () => {
    const { addContactInputValue } = this.state;
    const { filterContacts = [] } = this.props;
    const mutedContactEmails = filterContacts.map(contact => contact.email);
    const filterHasMutedContact = list => {
      return list.filter(contact => mutedContactEmails.indexOf(contact.email) < 0);
    };
    const tokensOrPromise = ContactStore.searchContacts(addContactInputValue);
    if (_.isArray(tokensOrPromise)) {
      this.setState({ completions: filterHasMutedContact(tokensOrPromise) });
    } else if (tokensOrPromise instanceof Promise) {
      tokensOrPromise.then(tokens => {
        if (!this._mounted) {
          return;
        }
        this.setState({ completions: filterHasMutedContact(tokens) });
      });
    } else {
      console.warn(
        'onRequestCompletions returned an invalid type. It must return an Array of tokens or a Promise that resolves to an array of tokens'
      );
      this.setState({ completions: [] });
    }
  };

  _renderContactItem = contact => {
    return (
      <div key={contact.id} className="contact-item">
        <EmailAvatar key="email-avatar" account={{ name: contact.name, email: contact.email }} />
        {contact.name ? <span>{contact.name}</span> : null}
        {contact.email}
      </div>
    );
  };

  _renderAddContactInput = () => {
    return (
      <div key="add-contact-to-mute-input">
        <InputSearch
          showPreIcon
          showClearIcon
          ref={el => (this._inputSearch = el)}
          onBlur={this._onAddContactInputBlur}
          placeholder="Enter a contact name or email"
          onChange={this._onAddContactInputChange}
        />
      </div>
    );
  };

  render() {
    return (
      <div className="search-contact-list">
        <Menu
          items={this.state.completions}
          itemKey={item => item.id}
          itemContent={this._renderContactItem}
          headerComponents={[this._renderAddContactInput()]}
          onBlur={this._onAddContactInputBlur}
          onSelect={this._onSelectContact}
        />
      </div>
    );
  }
}

export default ContactSearch;
