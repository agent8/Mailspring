import React from 'react';
// import './RoundCheckbox.css';

export default class RoundCheckbox extends React.Component {
  render() {
    const { props } = this;

    return (
      <label className="roundcheckbox-container" htmlFor={props.id}>
        <input
          type='checkbox'
          value={props.value}
          id={props.id}
          name={props.name}
          onChange={props.onChange}
          checked={props.checked}
        />
        <p className="roundcheckbox-checkmark" />
        {props.label}
      </label>
    );
  }
}
