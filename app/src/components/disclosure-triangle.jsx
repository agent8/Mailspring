import React from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';

class DisclosureTriangle extends React.Component {
  static displayName = 'DisclosureTriangle';

  static propTypes = {
    collapsed: PropTypes.bool,
    visible: PropTypes.bool,
    onCollapseToggled: PropTypes.func,
    className: PropTypes.string,
    iconName: PropTypes.string,
    isIcon: PropTypes.bool,
  };

  static defaultProps = { onCollapseToggled() {}, className: '', iconName: '' };
  _renderImage() {
    let classNames = `${this.props.className}`;
    if (this.props.visible) {
      classNames += ' visible';
    }
    let retinaClassName = '';
    if (this.props.collapsed) {
      retinaClassName = ' collapsed';
    }
    return (
      <div className={classNames} onClick={this.props.onCollapseToggled}>
        <RetinaImg
          className={retinaClassName}
          name={this.props.iconName}
          isIcon={true}
          mode={RetinaImg.Mode.ContentIsMask}
          style={{ fontSize: 14 }}
        />
      </div>
    );
  }

  render() {
    if (this.props.isIcon) {
      return this._renderImage();
    }
    let classnames = `${this.props.className} disclosure-triangle`;
    if (this.props.visible) {
      classnames += ' visible';
    }
    if (this.props.collapsed) {
      classnames += ' collapsed';
    }
    return (
      <div className={classnames} onClick={this.props.onCollapseToggled}>
        <div />
      </div>
    );
  }
}

module.exports = DisclosureTriangle;
