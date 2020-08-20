import React, { Component } from 'react';
import Select from 'react-select';

class Conference extends Component {
  handleSelectChange = (conference) => {
    const { props } = this;
    props.onConferChanged({
      name: props.name,
      value: conference.value
    });
  };

  render() {
    const options = [
      { value: 'Hangouts', label: 'Hangouts' },
      { value: 'No Conferencing', label: 'No Conferencing' }
    ];
    const { props } = this;

    return (
      <div>
        <h5>Conferencing</h5>
        <Select value={props.conference} options={options} onChange={this.handleSelectChange} />
      </div>
    );
  }
}

export default Conference;
