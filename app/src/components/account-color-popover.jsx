import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { AccountStore, Actions } from 'mailspring-exports';
import { LabelColorizer } from 'mailspring-component-kit';
import RetinaImg from './retina-img';

export default class AccountColorPopover extends Component {
  static propTypes = {
    item: PropTypes.shape({
      accountIds: PropTypes.array,
    }),
  };

  constructor(props) {
    super(props);
    this.wrapperRef = React.createRef();
    const { item } = this.props;
    let color = null;
    if (item.accountIds && item.accountIds.length === 1) {
      color = AccountStore.accountForId(item.accountIds[0]).color;
    }
    this.state = {
      color,
    };
  }

  onCheckColor = bgColor => {
    const { item } = this.props;
    if (item.accountIds && item.accountIds.length === 1) {
      Actions.updateAccount(item.accountIds[0], { color: bgColor });
      Actions.changeAccountColor();
    }

    Actions.closePopover();
  };

  render() {
    const { item } = this.props;
    const { color: selectedColor } = this.state;
    const accountIds = AccountStore.accounts().map(account => account.id);
    const accountIndex = accountIds.findIndex(account => account === item.accountIds[0]) + 1;
    return (
      <div className="account-color-popover" ref={this.wrapperRef}>
        <div className="color-choice">
          {LabelColorizer.colors.map((color, idx) => {
            let className = '';
            if (selectedColor !== undefined) {
              className = selectedColor === idx ? 'checked' : '';
            } else {
              className = accountIndex === idx ? 'checked' : '';
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
      </div>
    );
  }
}
