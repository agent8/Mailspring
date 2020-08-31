import React from 'react';
import { Utils } from 'mailspring-exports';

export default class FontFacePopover extends React.Component {
  static displayName = 'FontFacePopover';

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
          style={{ fontFamily: option.value }}
          onClick={this.onSelect.bind(this, option.value)}
        >
          {option.name}
        </div>
      );
    });
  }

  render() {
    return (
      <div className="font-face-popover" tabIndex="-1">
        {this.renderOptions()}
      </div>
    );
  }
}
