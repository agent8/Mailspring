import React from 'react';

export default class signupSyncLink extends React.Component {
  capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  render() {
    const { props } = this;
    if (props.providerInfo.length <= 0) {
      return <div />;
    }

    const renderArray = [];
    for (let i = 0; i < props.providerInfo.length; i += 1) {
      renderArray.push(
        <button
          type="button"
          className="btn btn-block btn-social"
          key={i}
          onClick={() => props.providerFunc()}
        >
          <span className="fa fa-outlook" />
          Sync {props.providerInfo[i].email} token, token expired!
        </button>
      );
    }

    return <div>{renderArray}</div>;
  }
}
