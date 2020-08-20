/* eslint-disable react/button-has-type */
import React, { Component } from 'react';
// import './Tabs.css';

export default class Tabs extends React.Component {
  constructor(props) {
    super(props);
    // const tabList = React.Children.toArray(props.children).filter(
    //   (child) => child.type.displayName === 'Tab'
    // );
    // const activeTab = tabList[0].props.label;
    // this.state = {
    //   tabList,
    //   activeTab
    // };
  }

  // eslint-disable-next-line class-methods-use-this


  render() {
    const { props, state } = this;
    return (
      <div className="tabs-container">
        <nav className="tabs-nav">
          {props.tabList.map((tab) => (
            <div key={tab} className="tab-nav-button-container">
              <button
                className={
                  tab === props.activeTab
                    ? 'tab-nav-button active-tab'
                    : 'tab-nav-button'
                }
                onClick={(event) => {
                  props.handleChangeTab(event, tab);
                }}
              >
                {tab}
              </button>
            </div>
          ))}
        </nav>
        <div>
          {/* {state.tabList.map((tab) => {
            if (tab.props.label === state.activeTab) {
              return <React.Fragment key={tab.props.label}>{tab}</React.Fragment>;
            }
            // if the tab is inactive
            return undefined;
          })} */}
        </div>
      </div>
    );
  }
}
