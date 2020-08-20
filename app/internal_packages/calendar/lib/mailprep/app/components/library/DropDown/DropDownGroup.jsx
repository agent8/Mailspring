import React from 'react';
// import './DropDown.css';

export default class DropDownGroup extends React.Component {
  render() {
    const { props } = this;

    return <optgroup label={props.label}>{props.children}</optgroup>;
  }
}
