import React, { PureComponent } from 'react';
import { Actions } from 'mailspring-exports';
export default class ChatAccountSidebarFiller extends PureComponent {
  static displayName = 'ChatAccountSidebarFiller';

  constructor(props) {
    super(props);
    this.selfNode = null;
    this.state = {
      selfHeight: 300,
      expand: 1,
    };
    this.unlisteners = [
      Actions.updateChatPanelHeight.listen(this.setHeight, this)
    ];
  }

  componentDidMount() {
    const leftPanel = document.querySelector('.chat-left-panel-container');
    if (leftPanel) {
      this.setHeight(leftPanel.offsetHeight);
    } else {
      this.setHeight(AppEnv.config.get(`chatPanelHeight`));
    }
  }
  componentWillUnmount() {
    for (let unlisten of this.unlisteners) {
      unlisten();
    }
  }
  expandFiller = expand => {
    this.setState({ expand: expand ? 1 : 0 });
  };

  setHeight = height => {
    this.setState({
      selfHeight: height
    });
  };

  render() {
    const height = this.state.selfHeight;
    return (
      <div
        className="chat-account-sidebar-filler"
        ref={ref => (this.selfNode = ref)}
        style={{ height: isFinite(height) ? height : 0 }}
      />
    );
  }
}
