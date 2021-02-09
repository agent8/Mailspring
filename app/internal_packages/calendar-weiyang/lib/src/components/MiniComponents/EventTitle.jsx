import React from 'react';
// import './EventTitle.less';

export default class EventTitle extends React.Component {
  render() {
    const { props } = this;
    return (
      <input
        type="text"
        className="event-title"
        value={props.value}
        name={props.name}
        placeholder="Untitled Event"
        onChange={props.onChange}
      />
    );
  }
}
