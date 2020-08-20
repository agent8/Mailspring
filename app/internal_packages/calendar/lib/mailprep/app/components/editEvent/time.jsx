import React, { Component } from 'react';
import Select from 'react-select';
import { dropDownTime } from '../../utils/constants';
// import './time.css';

class Time extends Component {
  handleSelectChange = (time) => {
    const { props } = this;
    props.timeProps({
      name: props.name,
      value: time.value
    });
  };

  render() {
    const { props } = this;
    const currentTimeObj = {
      value: props.currentTime,
      label: props.currentTime
    };
    return (
      <div>
        <Select
          value={currentTimeObj}
          options={props.dropDownTime}
          onChange={this.handleSelectChange}
        />
      </div>
    );
  }
}

export default Time;
