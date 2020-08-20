import React from 'react';
// import './Tabs.css';

export default class Tab extends React.Component {
  render() {
    const { props } = this;
    return props.children;
  }
}
