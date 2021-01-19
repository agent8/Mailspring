import React from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';

class DisclosureTriangle extends React.Component {
  static displayName = 'DisclosureTriangle';

  static propTypes = {
    collapsed: PropTypes.bool,
    visible: PropTypes.bool,
    visibleOnHover: PropTypes.bool,
    onCollapseToggled: PropTypes.func,
    className: PropTypes.string,
    iconName: PropTypes.string,
    isIcon: PropTypes.bool,
    fontSize: PropTypes.number,
  };

  static defaultProps = { onCollapseToggled() {}, className: '', iconName: '' };
  _renderImage() {
    const {
      onCollapseToggled,
      className,
      visible,
      visibleOnHover,
      collapsed,
      iconName,
      fontSize,
    } = this.props;
    let classNames = `${className}`;
    if (visible) {
      classNames += ' force-visible';
    } else if (visibleOnHover) {
      classNames += ' hover-visible';
    }
    let retinaClassName = '';
    if (collapsed) {
      retinaClassName = ' collapsed';
    }
    return (
      <div className={classNames} onClick={onCollapseToggled}>
        <RetinaImg
          className={retinaClassName}
          name={iconName}
          isIcon={true}
          mode={RetinaImg.Mode.ContentIsMask}
          style={{ fontSize: fontSize ? fontSize : 14 }}
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
      classnames += ' force-visible';
    } else if (this.props.visibleOnHover) {
      classnames += ' hover-visible';
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
