import React from 'react';
import PropTypes from 'prop-types';
import { Utils } from 'mailspring-exports';

export default class FontSizePopover extends React.Component {
  static displayName = 'FontSizePopover';
  static propTypes = {
    onSelect: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.any, name: PropTypes.string })),
    selectedValue: PropTypes.any,
    className: PropTypes.string,
  };
  static defaultProps = {
    className: '',
  };

  constructor(props) {
    super(props);
  }

  onSelect = value => {
    if (this.props.onSelect) {
      this.props.onSelect(value);
    }
  };

  renderOptions() {
    return this.props.options.map(option => {
      let className = `option ${option.name.toLowerCase()} `;
      if (this.props.selectedValue === option.value) {
        const iconClassName = Utils.iconClassName('check-alone.svg');
        className += `selected ${iconClassName}`;
      }
      return (
        <div
          key={option.value}
          className={className}
          onClick={this.onSelect.bind(this, option.value)}
        >
          {option.name}
        </div>
      );
    });
  }

  render() {
    return (
      <div className={`font-size-popover ${this.props.className}`} tabIndex="-1">
        {this.renderOptions()}
      </div>
    );
  }
}
