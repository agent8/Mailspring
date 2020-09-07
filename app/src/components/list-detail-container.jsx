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
    this.widthKey = `${ListDetailContainer.displayName}_width`;
    this.heightKey = `${ListDetailContainer.displayName}_height`;
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

    let handle = ResizableRegion.Handle.Right;
    let sizeKey = this.widthKey;
    let listClassName = 'right-divider';
    let forceWidthMode = false;
    const Detail = this.props.detailComponent;
    const listStyles = {};
    const listOtherProps = {};
    const containersStyles = {
      height: '100%',
      display: 'flex',
      flexDirection: 'row',
    };
    const detailStyles = {};
    const splitMode = AppEnv.config.get('core.workspace.mode-split');
    // when reading pane on bottom
    if (splitMode === 'split-v') {
      containersStyles.flexDirection = 'column';
      handle = ResizableRegion.Handle.Bottom;
      sizeKey = this.heightKey;
      listClassName = 'bottom-divider';
      forceWidthMode = true;
      detailStyles.minHeight = (Detail.containerStyles && Detail.containerStyles.minHeight) || 200;
      listStyles.minHeight = (List.containerStyles && List.containerStyles.minHeight) || 150;
      if (this.state.height) {
        listOtherProps.initialHeight = this.state.height;
      }
    } else {
      detailStyles.minWidth = (Detail.containerStyles && Detail.containerStyles.minWidth) || 150;
      listStyles.minWidth = (List.containerStyles && List.containerStyles.minWidth) || 200;
      if (this.state.width) {
        listOtherProps.initialWidth = this.state.width;
      }
    }
    return (
      <div style={containersStyles}>
        <ResizableRegion
          style={{ overflow: 'hidden', ...listStyles }}
          handle={handle}
          className={listClassName}
          onResize={w => this._onColumnResize(sizeKey, w)}
          {...listOtherProps}
        >
          <div style={{ height: '100%' }}>
            <List forceWidthMode={forceWidthMode} />
          </div>
        </ResizableRegion>
        <div
          style={{ flex: 2, ...detailStyles }}
          className={this.props.isOutbox ? 'column-OutboxMessage' : 'column-MessageList'}
        >
          <Detail />
        </div>
      </div>
    );
  }
}

module.exports = ListDetailContainer;
