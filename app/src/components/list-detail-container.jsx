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

    let handle;
    let sizeKey;
    let className;
    const Detail = this.props.detailComponent;
    const styles = { height: '100%', display: 'flex' };
    const otherProps = { className: 'column-MessageList' };
    const splitMode = AppEnv.config.get('core.workspace.mode-split');
    if (splitMode === 'split-v') {
      styles.flexDirection = 'column';
      handle = ResizableRegion.Handle.Top;
      sizeKey = this.heightKey;
      otherProps.initialHeight = this.state.height;
      className = 'bottom-divider';
    } else {
      styles.flexDirection = 'row';
      handle = ResizableRegion.Handle.Left;
      sizeKey = this.widthKey;
      otherProps.initialWidth = this.state.width;
      className = 'right-divider';
    }

    return (
      <div style={styles}>
        <div style={{ flex: 1 }} className={className}>
          <List />
        </div>
        <ResizableRegion
          style={{ overflow: 'hidden' }}
          minHeight={200}
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
