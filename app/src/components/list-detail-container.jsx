const React = require('react');
const _ = require('underscore');
const ResizableRegion = require('./resizable-region');
const WorkspaceStore = require('../flux/stores/workspace-store');
const MODE_SPLIT_KEY = 'core.workspace.mode-split';

class ListDetailContainer extends React.Component {
  static displayName = 'ListDetailContainer';

  static containerStyles = {};
  constructor(props) {
    super(props);
    this.widthKey = `${this.displayName}_width`;
    this.heightKey = `${this.displayName}_height`;
    this.state = {
      width: AppEnv.getColumnWidth(this.widthKey),
      height: AppEnv.getColumnWidth(this.heightKey),
      splitMode: AppEnv.config.get(MODE_SPLIT_KEY),
    };
  }

  componentDidMount() {
    this.disposable = AppEnv.config.onDidChange(MODE_SPLIT_KEY, () => {
      this.setState({
        splitMode: AppEnv.config.get(MODE_SPLIT_KEY),
      });
    });
  }

  componentWillUnmount() {
    this.disposable.dispose();
  }

  _onColumnResize = _.debounce((id, w) => {
    AppEnv.storeColumnWidth({ id, width: w });
  }, 200);

  render() {
    const List = this.props.listComponent;
    const layout = WorkspaceStore.layoutMode();
    if (layout === 'list') {
      return <List />;
    }

    let handle = ResizableRegion.Handle.Left;
    let sizeKey = this.widthKey;
    let listClassName = 'right-divider';
    let forceWidthMode = false;
    const Detail = this.props.detailComponent;
    let listStyles = { minWidth: 200 };
    const containersStyles = {
      height: '100%',
      display: 'flex',
      flexDirection: 'row',
    };
    const otherProps = {
      className: 'column-MessageList',
      initialWidth: this.state.width,
      minWidth: (Detail.containerStyles && Detail.containerStyles.minWidth) || 150,
    };
    const splitMode = AppEnv.config.get('core.workspace.mode-split');
    // when reading pane on bottom
    if (splitMode === 'split-v') {
      containersStyles.flexDirection = 'column';
      handle = ResizableRegion.Handle.Top;
      sizeKey = this.heightKey;
      listClassName = 'bottom-divider';
      forceWidthMode = true;
      otherProps.initialHeight = this.state.height;
      otherProps.minHeight = (Detail.containerStyles && Detail.containerStyles.minHeight) || 200;
      listStyles = { minHeight: 150 };
    }
    return (
      <div style={containersStyles}>
        <div style={{ flex: 1, ...listStyles }} className={listClassName}>
          <List forceWidthMode={forceWidthMode} />
        </div>
        <ResizableRegion
          style={{ overflow: 'hidden' }}
          handle={handle}
          onResize={w => this._onColumnResize(sizeKey, w)}
          {...otherProps}
        >
          <Detail />
        </ResizableRegion>
      </div>
    );
  }
}

module.exports = ListDetailContainer;
