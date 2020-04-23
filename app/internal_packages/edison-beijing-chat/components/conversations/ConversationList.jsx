import React, { PureComponent } from 'react';
import { ChatActions, ConversationStore } from 'chat-exports';
import ConversationItem from './ConversationItem';
import { WorkspaceStore, Actions } from 'mailspring-exports';
export default class ConversationList extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedConversation: null,
      conversations: null,
    };
  }

  componentDidMount() {
    this._unsub = ConversationStore.listen(this._onDataChanged);
  }

  componentWillUnmount() {
    this._unsub && this._unsub();
  }

  _onDataChanged = async () => {
    console.log('_onDataChanged');
    const [selectedConversation, conversations] = await Promise.all([
      ConversationStore.getSelectedConversation(),
      ConversationStore.getConversations(),
    ]);

    conversations.sort((x, y) => {
      if (+x.lastMessageTime > +y.lastMessageTime) {
        return -1;
      } else if (+x.lastMessageTime < +y.lastMessageTime) {
        return 1;
      } else {
        if (x.name < y.name) {
          return -1;
        } else if (x.name > y.name) {
          return 1;
        } else {
          return 0;
        }
      }
    });

    this.setState({
      selectedConversation,
      conversations,
    });
  };

  render() {
    const { selectedConversation, conversations } = this.state;

    if (!conversations || conversations.length === 0) {
      return <div className="noConversations" />;
    }

    return (
      <div
        className="conversations"
        onClick={() => Actions.selectRootSheet(WorkspaceStore.Sheet.ChatView)}
      >
        {conversations.map(conv => (
          <ConversationItem
            key={conv.jid}
            conversation={conv}
            selected={selectedConversation && selectedConversation.jid === conv.jid}
            onClick={() => {
              ChatActions.selectConversation(conv.jid);
            }}
          />
        ))}
      </div>
    );
  }
}
