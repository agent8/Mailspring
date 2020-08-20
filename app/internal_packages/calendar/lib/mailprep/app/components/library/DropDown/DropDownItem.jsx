import React from 'react';
// import './DropDown.css';

export default class DropDownItem extends React.Component {
  render() {
    const { props } = this;

    return (
      <option onClick={props.onClick} value={props.value}>
        {props.children}
      </option>
    );
  }
}
