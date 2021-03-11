import React from 'react';

export default class BigButton extends React.Component {
  render() {
    const { props } = this;
    let className = 'bigButton';
    if (props.variant) {
      className += ' '.concat(props.variant);
    }
    if (typeof props.children === 'string') {
      return (
        <div>
          <button
            className={className}
            onClick={props.onClick}
            type={props.type ? props.type : undefined}
          >
            {props.children}
          </button>
        </div>
      );
    }
    return null;
  }
}
