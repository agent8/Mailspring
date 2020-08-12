import utf7 from 'utf7';
import { RetinaImg, BoldedSearchResult } from 'mailspring-component-kit';
import { React, PropTypes, Actions } from 'mailspring-exports';
import CategorySelectionPopover from './category-selection-popover';

export default class CategorySelection extends React.Component {
  static propTypes = {
    accountUsesLabels: PropTypes.bool,
    all: PropTypes.array,
    current: PropTypes.object,
    onSelect: PropTypes.func,
  };

  constructor(props) {
    super(props);
  }

  onSelect = (...args) => {
    this._closePopover();
    if (this.props.onSelect) {
      this.props.onSelect(...args);
    }
  };
  _closePopover = () => {
    Actions.closePopover();
  };
  _onOpenPopover = event => {
    if (event && event.target && event.target.getBoundingClientRect) {
      const originRect = event.target.getBoundingClientRect();
      Actions.openPopover(
        <CategorySelectionPopover
          {...this.props}
          onClosePopover={this._closePopover}
          onSelect={this.onSelect}
        />,
        {
          closeOnAppBlur: false,
          originRect,
          direction: 'down',
        }
      );
    }
  };

  _renderItem = (item = { empty: true }, onClick = () => {}) => {
    let icon;
    if (item.empty) {
      icon = <div className="empty-icon" />;
      item.path = '(None)';
    } else {
      icon = (
        <RetinaImg
          name={`${item.name}.png`}
          fallback={item.isLabel() ? 'tag.png' : 'folder.png'}
          mode={RetinaImg.Mode.ContentIsMask}
        />
      );
    }

    const displayPath = item.name || utf7.imap.decode(item.path);

    return (
      <div className="category-item" onClick={onClick}>
        {icon}
        <div className="category-display-name">
          <BoldedSearchResult value={displayPath} query={''} />
        </div>
      </div>
    );
  };
  renderDisabled() {
    return (
      <div className="category-picker-dropdown readonly">
        {this._renderItem(this.props.current)}
      </div>
    );
  }

  render() {
    if (this.props.disabled) {
      return this.renderDisabled();
    }
    return (
      <div
        className="category-picker-dropdown default-display btn dropdown-menu"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {this._renderItem(this.props.current || { empty: true }, this._onOpenPopover)}
        <select style={{ border: 'none' }} />
      </div>
    );
  }
}
