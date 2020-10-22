import { React, PropTypes, AppMessageStore, WorkspaceStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import { CSSTransitionGroup } from 'react-transition-group';

class BasicContent extends React.Component {
  static propTypes = {
    level: PropTypes.oneOf([0, 1, 2, 3]).isRequired,
    icon: PropTypes.string,
    description: PropTypes.node.isRequired,
    actions: PropTypes.arrayOf(
      PropTypes.shape({
        node: PropTypes.node.isRequired,
        onClick: PropTypes.func.isRequired,
      })
    ),
  };
  static defaultProps = {
    level: 0,
    icon: 'alert.svg',
    description: '',
    actions: [],
  };

  constructor(props) {
    super(props);
  }

  renderIcon() {
    const isIcon = this.props.icon.includes('.svg');
    return (
      <RetinaImg
        name={this.props.icon}
        fallback={'alert.svg'}
        style={{ width: 24, height: 24, fontSize: 24, marginLeft: '-6px', marginRight: '10px' }}
        isIcon={isIcon}
        mode={RetinaImg.Mode.ContentIsMask}
      />
    );
  }

  renderActions() {
    const actions = [];
    if (Array.isArray(this.props.actions)) {
      this.props.actions.forEach((action, index) => {
        if (action) {
          actions.push(
            <div
              className="app-message-action-text"
              key={index}
              onClick={() => {
                action.onClick(this.props.block);
              }}
            >
              {action.node}
            </div>
          );
        }
      });
    }
    if (this.props.block.allowClose) {
      actions.push(
        <RetinaImg
          key="close"
          name="close_1.svg"
          isIcon={true}
          style={{ width: 10, height: 10, fontSize: 10 }}
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={() => this.props.onClose()}
        />
      );
    }
    return actions;
  }

  className() {
    let levelClass = 'error';
    if (this.props.level === 1 || this.props.level === 2) {
      levelClass = 'warning';
    } else if (this.props.level === 3) {
      levelClass = 'info';
    }
    return `content ${levelClass}`;
  }

  render() {
    const { block, onMouseEnter, onMouseLeave } = this.props;
    return (
      <div className={this.className()} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {this.renderIcon()}
        <div className="message">{block.description}</div>
        <div className="actions">{this.renderActions()}</div>
      </div>
    );
  }
}

export default class AppMessageToast extends React.Component {
  static displayName = 'AppMessageToast';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this._mounted = false;
    this._timeout = [];
    this._unlisten = null;
    this.state = {
      block: null,
      blocks: [],
      style: null,
      noShow: false,
    };
  }

  componentDidMount() {
    this._mounted = true;
    const blocks = AppMessageStore.getMessages();
    const root = WorkspaceStore.rootSheet();
    this.setState({
      blocks: [...blocks.critical, ...blocks.high, ...blocks.medium, ...blocks.low],
      noShow: root && root.id === 'ChatView',
    });
    this._unlisten = [
      AppMessageStore.listen(() => {
        const blocks = AppMessageStore.getMessages();
        this.setState({
          blocks: [...blocks.critical, ...blocks.high, ...blocks.medium, ...blocks.low],
        });
      }),
      WorkspaceStore.listen(() => {
        const root = WorkspaceStore.rootSheet();
        this.setState({ noShow: root && root.id === 'ChatView' });
      }),
    ];
    this.parseContainerPositionAndWidth();
    window.addEventListener('resize', this.parseContainerPositionAndWidth);
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten.forEach(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
    }
    window.removeEventListener('resize', this.parseContainerPositionAndWidth);
  }

  _clearTimeout({ block }) {
    const timer = this._timeouts[block.id];
    if (timer) {
      clearTimeout(timer);
    }
  }

  _closeToaster = (block, remove = false) => {
    block.lingerAfterTimeout = false;
    if (remove) {
      AppMessageStore.removeBlockFromMessages({ block });
    } else {
      AppMessageStore.setBlockToHide({ block });
    }
  };

  _onMouseEnter = () => {
    // this._clearTimeout();
  };

  _onMouseLeave = () => {
    // this._ensureTimeout();
  };

  parseContainerPositionAndWidth = () => {
    if (!this._mounted) {
      return null;
    }
    const sidebar = document.querySelector('.toolbar-RootSidebar');
    if (!sidebar) {
      this.setState({ style: null });
      return;
    }
    const left = sidebar.getBoundingClientRect().width;
    let width = '100%';
    const threadList = document.querySelector('.toolbar-ThreadList');
    const siftList = document.querySelector('.toolbar-SiftList');
    const messageList = document.querySelector('.toolbar-MessageList');
    const draftList = document.querySelector('.toolbar-DraftList');
    const outboxList = document.querySelector('.toolbar-Outbox');
    const outboxMessage = document.querySelector('.column-OutboxMessage');
    const chatView = document.querySelector('.column-ChatView');
    if (chatView) {
      width = chatView.getBoundingClientRect().width;
    } else if (threadList) {
      width = 0;
      width += threadList.getBoundingClientRect().width;
      if (messageList) {
        width += messageList.getBoundingClientRect().width;
      }
    } else if (siftList) {
      width = 0;
      width += siftList.getBoundingClientRect().width;
      if (messageList) {
        width += messageList.getBoundingClientRect().width;
      }
    } else if (draftList) {
      width = draftList.getBoundingClientRect().width;
    } else if (outboxList && outboxMessage) {
      width = outboxList.getBoundingClientRect().width;
    }
    if (typeof width !== 'string') {
      width -= 28;
    }
    this.setState({ style: { width, left } });
  };

  render() {
    const { blocks, style, noShow } = this.state;
    if (!style || noShow) {
      return <span />;
    }
    return (
      <div className="app-message-toast-container" style={style}>
        <CSSTransitionGroup
          className="app-message-toast"
          transitionLeaveTimeout={150}
          transitionEnterTimeout={150}
          transitionName="app-message-toast-fade"
        >
          {blocks
            .filter(b => !b.hide)
            .map(block => {
              return (
                <BasicContent
                  key={block.id}
                  level={block.priority}
                  actions={block.actions}
                  icon={block.icon}
                  block={block}
                  onMouseEnter={this._onMouseEnter}
                  onMouseLeave={this._onMouseLeave}
                  onClose={this._closeToaster.bind(this, block)}
                />
              );
            })}
        </CSSTransitionGroup>
      </div>
    );
  }
}
