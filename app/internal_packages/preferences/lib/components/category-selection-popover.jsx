import utf7 from 'utf7';
import { RetinaImg, Menu, LabelColorizer, BoldedSearchResult } from 'mailspring-component-kit';
import { Utils, React, PropTypes } from 'mailspring-exports';

export default class CategorySelectionPopover extends React.Component {
  static propTypes = {
    accountUsesLabels: PropTypes.bool,
    all: PropTypes.array,
    current: PropTypes.object,
    onSelect: PropTypes.func,
    onClosePopover: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this._categories = [];
    this.state = {
      searchValue: '',
    };
  }

  _itemsForCategories() {
    if (!this.props.all) {
      return [];
    }
    return this.props.all
      .sort((a, b) => {
        // var pathA = utf7.imap.decode(a.name || a.path).toUpperCase();
        // var pathB = utf7.imap.decode(b.name || b.path).toUpperCase();
        var pathA = (a.name || utf7.imap.decode(a.path)).toUpperCase();
        var pathB = (b.name || utf7.imap.decode(b.path)).toUpperCase();
        if (pathA < pathB) {
          return -1;
        }
        if (pathA > pathB) {
          return 1;
        }
        return 0;
      })
      .filter(c =>
        // Utils.wordSearchRegExp(this.state.searchValue).test(utf7.imap.decode(c.name || c.path))
        Utils.wordSearchRegExp(this.state.searchValue).test(c.name || utf7.imap.decode(c.path))
      )
      .map(c => {
        c.backgroundColor = LabelColorizer.backgroundColorDark(c);
        return c;
      });
  }

  _onSearchValueChange = event => {
    this.setState({ searchValue: event.target.value });
  };
  onSelect = (...args) => {
    if (this.props.onSelect) {
      this.props.onSelect(...args);
    }
  };
  _closePopover = () => {
    this.props.onClosePopover();
  };

  _renderItem = (item = { empty: true }) => {
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
      <div className="category-item">
        {icon}
        <div className="category-display-name">
          <BoldedSearchResult value={displayPath} query={this.state.searchValue || ''} />
        </div>
      </div>
    );
  };
  render() {
    const placeholder = this.props.accountUsesLabels ? 'Choose folder or label' : 'Choose folder';

    const headerComponents = [
      <input
        type="text"
        tabIndex="-1"
        key="textfield"
        className="search"
        placeholder={placeholder}
        value={this.state.searchValue}
        onChange={this._onSearchValueChange}
      />,
    ];
    return (
      <div className="category-picker-dropdown">
        <Menu
          intitialSelectionItem={this.props.current || { empty: true }}
          headerComponents={headerComponents}
          footerComponents={[]}
          items={this._itemsForCategories()}
          itemKey={item => item.id}
          itemContent={this._renderItem}
          defaultSelectedIndex={this.state.searchValue === '' ? -1 : 0}
          {...this.props}
          onSelect={this.onSelect}
          onEscape={this._closePopover}
        />
      </div>
    );
  }
}
