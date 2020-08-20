import React from 'react';
// import './DropDown.css';

export default class DropDown extends React.Component {
  render() {
    const { props } = this;
    const className = 'dropdown-area '.concat(props.type);
    let label;
    if (props.label) {
      label = <label className="dropdown-label">{props.label}</label>;
    }
    let placeholder;
    if (props.placeholder) {
      placeholder = (
        <option className="placeholder-option" value="" disabled hidden={props.hiddenPlaceholder}>
          {props.placeholder}
        </option>
      );
    }
    return (
      <div className="dropdown-component">
        {label}
        <select
          className={className}
          name={props.name}
          value={props.value}
          onChange={props.onChange}
          defaultValue=""
        >
          {placeholder}
          {props.children}
        </select>
      </div>
    );
  }
}
