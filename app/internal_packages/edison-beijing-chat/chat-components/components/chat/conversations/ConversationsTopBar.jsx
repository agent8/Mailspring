import React, { PureComponent } from 'react';
import Button from '../../common/Button';
import TopBar from '../../common/TopBar';
import { NEW_CONVERSATION } from '../../../actions/chat';
import { WorkspaceStore, Actions } from 'mailspring-exports';
import { RetinaImg, BindGlobalCommands } from 'mailspring-component-kit';
import { ConversationStore } from 'chat-exports';

export default class ConversationsTopBar extends PureComponent {
  newConversation = () => {
    Actions.pushSheet(WorkspaceStore.Sheet.ChatView);
    document.querySelector('#Center').style.zIndex = 9;
    ConversationStore.setSelectedConversation(NEW_CONVERSATION);
  }
  render() {
    return (
      <TopBar
        className="conversation-top-bar"
        left={
          [
            <div key='title' className="left-title">MESSAGES</div>,
            <BindGlobalCommands
              key='bindKey'
              commands={{
                "application:new-chat": this.newConversation
              }}>
              <span />
            </BindGlobalCommands>
          ]
        }
        right={
          <Button className="button new-message" onClick={this.newConversation}>
            <RetinaImg name={'pencil.svg'}
              style={{ width: 18 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask} />
            New
          </Button>
        }
      />
    );
  }
}
