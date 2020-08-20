import React, { Component } from 'react';
import Select from 'react-select';
import SearchBox from './search-box';

class Attendees extends React.Component {
  state = {
    attendees: [],
    attendee: ''
  };

  componentDidUpdate(prevProps) {
    const { props } = this;
    if (props.attendees !== prevProps.attendees && props.attendees !== undefined) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        attendees: props.attendees
      });
    }
  }

  handleSelectChange = async (attendee) => {
    this.setState({ attendee });
    const { props } = this;
    props.onAttendeeChanged({
      name: props.name,
      value: attendee
    });
  };

  render() {
    const { state } = this;

    const input = state.attendees.map((attendee) => {
      const { email } = attendee;
      return (
        <li>
          <span>{email}</span>
          <button type="button" onClick={() => this.removeAttendee(email)}>
            Remove
          </button>
        </li>
      );
    });
    const options = [
      { value: 'shamsheer619@gmail.com', label: 'shamsheer619@gmail.com' },
      { value: 'sameenhaja@yahoo.com.sg', label: 'sameenhaja@yahoo.com.sg' },
      { value: 'shuhao@edison.tech', label: 'shuhao@edison.tech' }
    ];
    const defaultList = state.attendees.map((attendee) => ({
      value: attendee.email,
      label: attendee.email
    }));
    return (
      <div>
        <h5>Attendees</h5>
        <Select
          isMulti
          value={state.attendee}
          options={options}
          onChange={this.handleSelectChange}
          defaultValue={defaultList}
        />
      </div>
    );
  }
}

export default Attendees;
