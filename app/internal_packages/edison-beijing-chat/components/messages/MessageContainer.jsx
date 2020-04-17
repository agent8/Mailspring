import React, { Component } from 'react';
import VirtualizedList from '../common/VirtualizedList/VirtualizedList';
import Divider from '../common/Divider';
import MessageItem from './MessageItem';
import { MessageStore, OnlineUserStore, ConversationStore } from 'chat-exports';
import { FILE_TYPE } from '../../utils/filetypes';
import { dateFormat, dateFormatDigit, weekDayFormat, nearDays } from '../../utils/time';
import groupByTime, { groupByDate } from '../../utils/groupByTime';
import SecurePrivate from './SecurePrivate';
import MessageImagePopup from './MessageImagePopup';
import ContactAvatar from '../common/ContactAvatar';
import { debounce } from 'underscore';

const OFFSET = 100;
const START_INDEX = 100;
class MessageContainer extends Component {
  state = {
    jid: '', // this.props.selectedConversation.jid,
    selectedConversation: null,
    clientHeight: 0,
    messages: [],
    groupedMessages: [],
    startIndex: START_INDEX,
  };
  _mounted = false;
  //   isFinished = false;
  shouldComponentUpdate = true;
  _resizeDebounce = () => debounce(this.onResize, 100);

  componentDidMount() {
    this._mounted = true;
    this.onResize();
    this.getMessages();
    // 监听是否有新消息
    this._unsub = MessageStore.listen(this.getMessages);
    window.addEventListener('resize', this._resizeDebounce);
  }
  componentWillUnmount() {
    this._mounted = false;
    this._unsub();
    window.removeEventListener('resize', this._resizeDebounce);
  }

  //   UNSAFE_componentWillReceiveProps(nextProps) {
  //     console.log('shouldComponentUpdate--receiveProps');
  //     if (nextProps.selectedConversation.jid !== this.props.selectedConversation.jid) {
  //       //   this.isFinished = false;
  //       //   this.setState({ shouldComponentUpdate: true });
  //       this.shouldComponentUpdate = true;
  //     } else {
  //       //   this.setState({ shouldComponentUpdate: false });
  //       this.shouldComponentUpdate = false;
  //     }
  //   }

  //   shouldComponentUpdate(nextProps, nextState) {
  //     console.log('shouldComponentUpdate===shouldComponentUpdate');
  //     return this.shouldComponentUpdate;
  //   }

  getMessages = async () => {
    if (!this._mounted) {
      return;
    }
    let selectedConversation = await ConversationStore.getSelectedConversation();
    if (!selectedConversation) {
      return;
    }
    let nextJid = selectedConversation.jid;
    console.log('shouldComponentUpdate--getMessages', nextJid);
    let messages = await MessageStore.getSelectedConversationMessages(nextJid);
    messages = messages.reverse();

    const { startIndex } = this.state;
    let groupedMessages = groupByTime(messages.slice(0, startIndex));
    if (!this._mounted) {
      return;
    }
    this.setState({
      //   shouldComponentUpdate: true,
      jid: nextJid,
      selectedConversation,
      messages,
      groupedMessages,
    });
    this.shouldComponentUpdate = true;
  };

  onEnd = () => {
    let { messages, startIndex } = this.state;
    // if (startIndex > messages.length) return;
    startIndex = startIndex + OFFSET;
    // if (startIndex >= messages.length && !this.isFinished) {
    //   startIndex = messages.length;
    //   messages.push({
    //     id: Date.now(),
    //     body: {
    //       content: '',
    //       type: 'SecurePrivate',
    //     },
    //   });
    //   this.isFinished = true;
    // }
    setTimeout(() => {
      console.log('shouldComponentUpdate--onEnd');

      let groupedMessages = groupByTime(messages.slice(0, startIndex));
      this.setState({
        groupedMessages,
        startIndex,
        // shouldComponentUpdate: true,
      });
      this.shouldComponentUpdate = true;
    }, 100);
  };

  onResize = () => {
    if (!this._mounted) {
      return;
    }
    console.log('shouldComponentUpdate--resize');
    const chatViewContainer = document.querySelector('.chat-view-container');
    let clientHeight = chatViewContainer.clientHeight - 68 - 92;
    this.setState({
      clientHeight,
      //   shouldComponentUpdate: clientHeight !== this.state.clientHeight,
    });
    this.shouldComponentUpdate = clientHeight !== this.state.clientHeight;
  };

  getContactInfoByJid = jid => {
    const { members, selectedConversation } = this.state;
    // const { selectedConversation } = this.props;
    if (selectedConversation.isGroup && members && members.length > 0) {
      for (const member of members) {
        const memberJid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
        if (memberJid === jid) {
          return member;
        }
      }
    }

    // get self User info
    const self = OnlineUserStore.getSelfAccountById(jid);
    if (self) {
      return {
        jid,
        name: self['name'],
        email: self['email'],
      };
    }

    const { jid: convJid, name, email } = selectedConversation;
    if (convJid === jid) {
      return { jid, name, email };
    }
    return { jid, name: '', email: '' };
  };

  getContactAvatar = member => {
    const { selectedConversation } = this.state;

    if (member) {
      const memberJid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
      return (
        <ContactAvatar
          jid={memberJid}
          name={member.name}
          conversation={selectedConversation}
          email={member.email}
          size={32}
        />
      );
    }
    return null;
  };

  calcLabel = scrollTop => {
    let messagesTopBar = document.querySelector('.messages-top-bar');

    if (messagesTopBar) {
      if (scrollTop > 0) {
        if (messagesTopBar.className.indexOf('has-shadow') === -1) {
          messagesTopBar.className += ' has-shadow';
        }
      } else {
        messagesTopBar.className = messagesTopBar.className.replace(' has-shadow', '');
      }
    }
    let dayLabels = document.querySelectorAll('.day-label');
    let lastDis = Infinity;
    for (let dayLabel of dayLabels) {
      dayLabel.className = 'day-label';
      let dis = scrollTop - Math.abs(dayLabel.offsetTop);
      //   console.log('day-label', scrollTop, dis, dayLabel.offsetTop);
      if (dayLabel.offsetTop < 0 && dis > 50 && Math.abs(dis) < lastDis) {
        dayLabel.className = 'day-label day-label-fixed';
        lastDis = dis;
      }
    }
  };

  renderDateTag(msg) {
    const { content: time } = msg.body;
    return (
      <div key={msg.id} className="day-label">
        <label>
          <Divider type="horizontal" />
          {nearDays(msg.time) ? (
            <div className="day-label-text">
              <span className="weekday">{dateFormat(time)}</span>
              <span className="date">{dateFormatDigit(time)}</span>
            </div>
          ) : (
            <div className="day-label-text">
              <span className="weekday">{weekDayFormat(time)}</span>
              <span className="date">{dateFormatDigit(time)}</span>
            </div>
          )}
        </label>
      </div>
    );
  }

  renderSystemMsg(msg) {
    return (
      <div key={msg.id} className="message-wrapper">
        <div className="message system-event">
          <span>{msg.body.content}</span>
        </div>
      </div>
    );
  }

  renderItem = msg => {
    const { type } = msg.body;
    const { selectedConversation } = this.state;
    switch (type) {
      case 'SecurePrivate':
        return <SecurePrivate />;
      case FILE_TYPE.DATE:
        return this.renderDateTag(msg);
      case 'error403':
      case 'memberschange':
      case 'change-group-name':
        return this.renderSystemMsg(msg);
      default:
        return (
          <MessageItem
            conversation={selectedConversation}
            msg={msg}
            queueLoadMessage={this.props.queueLoadMessage}
            getContactInfoByJid={this.getContactInfoByJid}
            key={msg.id}
          ></MessageItem>
        );
    }
  };

  render() {
    const { groupedMessages, jid } = this.state;
    console.log('this.shouldComponentUpdate---render', this.shouldComponentUpdate);

    // let jid = this.props.selectedConversation.jid;
    return (
      <div className="messages-wrap">
        {groupedMessages.length > 0 ? (
          <VirtualizedList
            itemAverageHeight={50}
            containerHeight={this.state.clientHeight}
            items={groupedMessages}
            groupByDate={groupByDate}
            itemKey="id"
            renderItem={this.renderItem}
            onEndReached={this.onEnd}
            reverse={true}
            cacheKey={jid}
            shouldComponentUpdate={this.shouldComponentUpdate}
            onScroll={this.calcLabel}
          />
        ) : null}
        <MessageImagePopup
          {...this.props}
          groupedMessages={groupedMessages}
          getContactInfoByJid={this.getContactInfoByJid}
          getContactAvatar={this.getContactAvatar}
        />
      </div>
    );
  }
}

export default MessageContainer;
