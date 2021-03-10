import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { AccountStore, Actions } from 'mailspring-exports';
import { LabelColorizer } from 'mailspring-component-kit';
import RetinaImg from './retina-img';

export default class AccountColorPopover extends Component {
  static propTypes = {
    accountId: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.wrapperRef = React.createRef();
    const { accountId } = this.props;
    const account = AccountStore.accountForId(accountId);
    const { color, emailAddress } = account;
    this.state = {
      color,
      emailAddress,
    };
  }

  onCheckColor = bgColor => {
    this.setState({ color: bgColor });
  };

  onSave = () => {
    Actions.updateAccount(this.props.accountId, { color: this.state.color });
    Actions.changeAccountColor();
    Actions.closePopover();
  };

  render() {
    const { accountId } = this.props;
    const { color: selectedColor, emailAddress } = this.state;
    const accountIds = AccountStore.accounts().map(account => account.id);
    const accountIndex = accountIds.findIndex(id => id === accountId) + 1;
    return (
      <div className="account-color-container" ref={this.wrapperRef} style={{ height: '230px' }}>
        <div className="header-row">
          <span className="close" onClick={() => Actions.closePopover()}>
            <RetinaImg
              name="close_1.svg"
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              style={{ width: 20, height: 20 }}
            />
          </span>
        </div>
        <div className="header-text-container">
          <div className="header-text">Account Color</div>
          <div className="header-subtext">{emailAddress}</div>
        </div>
        <div className="color-choice">
          {LabelColorizer.accountColors().map((color, idx) => {
            let className = '';
            if (selectedColor !== undefined) {
              className = selectedColor === idx ? 'checked' : '';
            } else {
              className = accountIndex === idx ? 'checked' : '';
            }

            if (color === 'transparent') {
              className += ' transparent-color';
            }
            return (
              <div
                key={color}
                className={className}
                style={{ background: color }}
                onClick={() => this.onCheckColor(idx)}
              >
                <RetinaImg
                  className="check-img check"
                  name="tagging-checkmark.png"
                  mode={RetinaImg.Mode.ContentPreserve}
                />
              </div>
            );
          })}
        </div>
        <div className="button-row">
          <button
            className="account-color-btn-cancel"
            title="Cancel"
            onClick={() => Actions.closePopover()}
          >
            <span>Cancel</span>
          </button>
          <button className="account-color-btn-save" title="Save" onClick={this.onSave}>
            <span>Save</span>
          </button>
        </div>
      </div>
    );
  }
}
