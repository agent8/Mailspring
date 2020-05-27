import React from 'react';
import PropTypes from 'prop-types';
import { Utils } from 'mailspring-exports';

class DisclosureTriangle extends React.Component {
  static displayName = 'DisclosureTriangle';

  static propTypes = {
    collapsed: PropTypes.bool,
    visible: PropTypes.bool,
    onCollapseToggled: PropTypes.func,
    className: PropTypes.string,
    image: PropTypes.string,
  };

  static defaultProps = { onCollapseToggled() {}, className: '', image: '' };
  _pathFor = name => {
    if (!name || typeof name !== 'string') return null;
    let pathName = name;

    const [basename, ext] = name.split('.');
    if (this.props.active === true) {
      pathName = `${basename}-active.${ext}`;
    }
    if (this.props.selected === true) {
      pathName = `${basename}-selected.${ext}`;
    }
    if (this.props.isIcon) {
      const svgPath = Utils.iconNamed(pathName, this.props.resourcePath);
      if (svgPath) {
        return svgPath;
      }
    }
    return Utils.imageNamed(pathName, this.props.resourcePath, true);
  };
  _renderImage() {
    let classNames = this.props.className;
    if (this.props.visible) {
      classNames += ' visible';
    }
    if (this.props.collapsed) {
      classNames += ' collapsed';
    }
    const imgPath = this._pathFor(this.props.image);
    return (
      <div className={classNames} onClick={this.props.onCollapseToggled}>
        <img src={imgPath} />
      </div>
    );
  }

  render() {
    if (this.props.image) {
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
