import React from 'react';
import DatePicker from 'react-datepicker';

export default class Input extends React.Component {
  render() {
    const { props } = this;
    const className = 'input-area '.concat(props.type);
    let label;
    if (props.label) {
      label = <label className="input-label">{props.label}</label>;
    }
    if (props.type === 'textarea') {
      return (
        <div className="input-component">
          {label}
          <textarea
            className={className}
            value={props.value}
            name={props.name}
            placeholder={props.placeholder}
            onChange={props.onChange}
          />
        </div>
      );
    }
    if (props.type === 'select') {
      return (
        <div className="input-component">
          {label}
          <select
            className={className}
            name={props.name}
            value={props.value}
            onChange={props.onChange}
          >
            {props.children}
          </select>
        </div>
      );
    }
    if (props.type === 'text') {
      return (
        <div className="input-component">
          {label}
          <input
            type={props.type}
            className={className}
            required={props.type === 'datetime-local'}
            value={props.value}
            name={props.name}
            placeholder={props.placeholder}
            onKeyDown={props.name === 'guest' ? props.onKeyDown : null}
            onChange={props.onChange}
          />
        </div>
      )
    }
    return (
      <div className="input-component">
        {label}
        <DatePicker
          formatWeekDay={nameOfDay => nameOfDay.substr(0, 1)}
          className={className}
          selected={props.value}
          onChange={props.onChange}
          showTimeInput
          dateFormat={`MMM dd, yyyy ${props.type === 'datetime-local' ? 'h:mm aa' : ''}`}
        />
      </div>
    );
  }
}
