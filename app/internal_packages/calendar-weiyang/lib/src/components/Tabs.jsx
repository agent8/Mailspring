/* eslint-disable react/button-has-type */
import React, { Component } from 'react';
// import './Tabs.css';

export default class Tabs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { props, state } = this;
    return (
      <div className="tabs-container">
        <nav className="tabs-nav">
          {props.tabList.map((tab) => (
            <div key={tab} className="tab-nav-button-container">
              <button
                className={tab === props.activeTab ? 'tab-nav-button active-tab' : 'tab-nav-button'}
                onClick={(event) => {
                  props.handleChangeTab(event, tab);
                }}
              >
                {tab}
              </button>
            </div>
          ))}
        </nav>
      </div>
    );
  }
}
