import React from 'react';
import PropTypes from 'prop-types';
import { Utils, Actions } from 'mailspring-exports';

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
    this._mounted = false;
    this._containerRef = null;
    this._setContainerRef = ref => (this._containerRef = ref);
  }
  componentDidMount() {
    this._mounted = true;
    document.addEventListener('click', this.onBlur);
    this._unlistenr = Actions.iframeClicked.listen(this.onCancel, this);
  }
  componentWillUnmount() {
    this._mounted = false;
    document.removeEventListener('click', this.onBlur);
    this._unlistenr();
  }
  onCancel = () => {
    if (this._mounted) {
      Actions.closePopover();
    }
  };

  onSelect = value => {
    if (this.props.onSelect) {
      this.props.onSelect(value);
    }
    Actions.closePopover();
  };
  onBlur = e => {
    if (!this._containerRef || !this._mounted) {
      return;
    }
    const rect = this._containerRef.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      this.onCancel();
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
      <div
        ref={this._setContainerRef}
        className={`font-size-popover ${this.props.className}`}
        tabIndex="-1"
      >
        {this.renderOptions()}
      </div>
    );
  }
}
