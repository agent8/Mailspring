import React, { Component } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { RoomStore, MessageStore, OnlineUserStore } from 'chat-exports';
import ContactAvatar from '../common/ContactAvatar';
import MessageImagePopup from './MessageImagePopup';
import MessageList from './MessageList';
import SecurePrivate from './SecurePrivate';
import { NEW_CONVERSATION } from '../../utils/constant';
import groupByTime from '../../utils/groupByTime';

const flattenMsgIds = messages =>
  messages.reduce((acc, curr) => {
    acc.add(curr.id);
    return acc;
  }, new Set());

const DISPLAY_COUNT = 50;
const AVERAGE_HEIGHT = 60;
const OFFSET = 15;
const THRESHOLD = 5;

const initState = {
  shouldScrollBottom: true,
  nowIsInBottom: true,
  progress: {
    savedFiles: [],
    downQueue: [],
    visible: false,
    percent: 0,
  },
  members: [],
  groupedMessages: [],
  messages: [],
  upperPlaceholderHeight: 0,
  startIndex: 0,
  endIndex: 0,
};

// TODO: 通用组件化
export default class Messages extends Component {
  static propTypes = {
    currentUserId: PropTypes.string.isRequired,
    referenceTime: PropTypes.number,
    selectedConversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      isGroup: PropTypes.bool.isRequired,
    }),
  };

  static defaultProps = {
    referenceTime: new Date().getTime(),
    selectedConversation: { isGroup: false },
  };

  static timer;

  constructor(props) {
    super(props);
    this.messagesTopBar = null;
    this.messagesPanel = null;
    this.messagePanelEnd = null;
    this.messagePanelStart = null;
    this.cache = {};
    this.handleScroll = _.debounce(this.handleScroll, 50);
  }

  state = {
    ...initState,
  };

  componentDidMount = async () => {
    const { selectedConversation = {} } = this.props;
    let messages = await MessageStore.getSelectedConversationMessages(selectedConversation.jid);
    this.init(messages);
    // this.getRoomMembers(selectedConversation);
    this.setIntersectionObserver();
    this.unsub = MessageStore.listen(this.handleDataChange);
  };

  UNSAFE_componentWillReceiveProps = async (nextProps, nextState) => {
    const {
      selectedConversation: { jid: currentJid },
    } = this.props;
    const {
      selectedConversation: { jid: nextJid },
    } = nextProps;

    if (currentJid === nextJid) return;

    let messages = await MessageStore.getSelectedConversationMessages(nextJid);
    let oldMessages = [];
    if (this.cache[nextJid]) {
      oldMessages = this.cache[nextJid].messages;
    } else {
      oldMessages = this.state.messages;
    }

    const currentIds = flattenMsgIds(oldMessages);
    const nextIds = flattenMsgIds(messages);
    let areNewMessages = currentIds.size < nextIds.size;

    this.setCache(currentJid);
    // 有缓存取出缓存数据，显示上次打开的位置和内容
    if (this.cache[nextJid] && !areNewMessages) {
      const { upperPlaceholderHeight, underPlaceholderHeight, scrollTop, ...state } = this.cache[
        nextJid
      ];
      this.setState(
        {
          ...state,
          shouldScrollBottom: false,
          nowIsInBottom: false,
        },
        () => {
          this.setPlaceholder(upperPlaceholderHeight, underPlaceholderHeight);
          this.messagesPanel.scrollTop = scrollTop;
          this.setIntersectionObserver();
        }
      );
    } else {
      this.init(messages);
    }
  };

  shouldComponentUpdate(nextProps, nextState) {
    return nextState.groupedMessages !== this.state.groupedMessages;
  }

  componentDidUpdate() {
    // 如果滚动条是在屏幕底部，需要自动滚动，否则当用户手动滚动到某个位置，则新消息来了不自动滚动
    if (this.state.shouldScrollBottom) {
      this.scrollToMessagesBottom();
    }
  }

  componentWillUnmount() {
    this.timer && clearTimeout(this.timer);
    this.unsub && this.unsub();
    this.intersectionObserver && this.intersectionObserver.disconnect();
  }

  setCache = currentJid => {
    this.cache[currentJid] = {
      ...this.state,
      upperPlaceholderHeight: this.messagePanelStart.offsetHeight,
      underPlaceholderHeight: this.messagePanelEnd.offsetHeight,
      scrollTop: this.messagesPanel.scrollTop,
    };
  };

  handleDataChange = messages => {
    let { startIndex, endIndex } = this.state;
    let msgCount = messages.length;
    let newMsgCount = msgCount - this.state.messages.length;
    startIndex = msgCount - DISPLAY_COUNT > 0 ? startIndex + newMsgCount : 0;
    endIndex = startIndex + DISPLAY_COUNT;
    let shouldScrollBottom = this.shouldScrollToBottom() && newMsgCount > 0;
    this.setState(
      {
        messages,
        startIndex,
        endIndex,
        groupedMessages: groupByTime(messages, startIndex, endIndex),
        shouldScrollBottom,
      },
      () => {
        this.setIntersectionObserver();
      }
    );
  };

  shouldScrollToBottom() {
    if (this.messagesPanel) {
      const scrollTop = this.messagesPanel.scrollTop;
      if (scrollTop + this.messagesPanel.offsetHeight < this.messagesPanel.scrollHeight) {
        return false;
      }
      if (scrollTop + this.messagesPanel.offsetHeight >= this.messagesPanel.scrollHeight) {
        return true;
      }
    }
    return true;
  }

  init = async messages => {
    let msgCount = messages.length;
    let delta = msgCount - DISPLAY_COUNT;
    let startIndex = delta > 0 ? delta : 0;
    let endIndex = startIndex + DISPLAY_COUNT;
    this.setState(
      {
        messages,
        groupedMessages: groupByTime(messages, startIndex, endIndex),
        startIndex,
        endIndex,
      },
      () => {
        this.scrollToMessagesBottom();
        this.setIntersectionObserver();
      }
    );
    this.setPlaceholder(startIndex * AVERAGE_HEIGHT, 0);
  };

  // TODO
  //   onLoadMore = async () => {
  //     const { jid } = this.props.selectedConversation;

  //     let messages = await MessageStore.getGroupedMessages(jid);
  //     this.setState({
  //       messages: this.state.messages.concat(messages),
  //     });
  //   };

  setIntersectionObserver = () => {
    this.resetObservation();
    const { messages, startIndex, endIndex } = this.state;
    let msgCount = messages.length;
    if (msgCount <= DISPLAY_COUNT) return;

    // let els = document.querySelectorAll('.message-wrapper');
    let els = document.querySelectorAll('.messageBody');
    let len = els.length;
    for (let i = 0; i < len; i++) {
      let el = els[i];
      if (el.id === 'anchorUp' || el.id === 'anchorDown') {
        el.id = '';
      }
      if (i === THRESHOLD && startIndex !== 0) {
        el.id = 'anchorUp';
        this.anchorUp = el;
      }
      if (i === len - THRESHOLD && endIndex !== msgCount) {
        el.id = 'anchorDown';
        this.anchorDown = el;
      }
    }
    if (!this.intersectionObserver) {
      this.intersectionObserver = new IntersectionObserver(
        _.debounce(this.intersectionObserverCallback, 20),
        {
          root: this.messagesPanel,
          threshold: 0,
        }
      );
    }

    if (this.anchorUp) {
      this.intersectionObserver.observe(this.anchorUp);
    }
    if (this.anchorDown) {
      this.intersectionObserver.observe(this.anchorDown);
    }
  };

  intersectionObserverCallback = entries => {
    for (let entry of entries) {
      if (entry.target.id === 'anchorUp' && entry.isIntersecting) {
        // console.log('entry===== handleUp', entry);
        this.handleUp();
      }

      if (entry.target.id === 'anchorDown' && entry.isIntersecting) {
        // console.log('entry===== handleDown', entry);
        this.handleDown();
      }
    }
  };

  resetObservation = () => {
    if (this.anchorUp) {
      this.intersectionObserver.unobserve(this.anchorUp);
      this.anchorUp = null;
    }
    if (this.anchorDown) {
      this.intersectionObserver.unobserve(this.anchorDown);
      this.anchorDown = null;
    }
  };

  handleUp = () => {
    let { startIndex, endIndex, messages } = this.state;
    let msgCount = messages.length;
    // if (startIndex <= 0) return;
    startIndex = startIndex - OFFSET < 0 ? 0 : startIndex - OFFSET;
    endIndex = this.calculateEndIndex(startIndex, msgCount);
    // console.log('startIndex====up ++', startIndex, endIndex);
    this.setPlaceholder(startIndex * AVERAGE_HEIGHT, (msgCount - endIndex) * AVERAGE_HEIGHT);

    this.setState(
      {
        startIndex: startIndex,
        endIndex: endIndex,
        groupedMessages: groupByTime(messages, startIndex, endIndex),
        shouldScrollBottom: false,
      },
      () => {
        this.setIntersectionObserver();
      }
    );
  };

  handleDown = () => {
    let { startIndex, endIndex, messages } = this.state;
    // console.log('startIndex====down', startIndex, endIndex);
    let msgCount = messages.length;
    // if (endIndex === msgCount) return;
    let maxStartIndex = msgCount - DISPLAY_COUNT;
    startIndex = Math.max(Math.min(startIndex + OFFSET, maxStartIndex), 0); // 向下滚动太多，或者总消息数量不足
    endIndex = this.calculateEndIndex(startIndex, msgCount);

    this.setPlaceholder(startIndex * AVERAGE_HEIGHT, (msgCount - endIndex) * AVERAGE_HEIGHT);
    this.setState(
      {
        startIndex: startIndex,
        endIndex: endIndex,
        groupedMessages: groupByTime(messages, startIndex, endIndex),
        shouldScrollBottom: false,
      },
      () => {
        this.setIntersectionObserver();
      }
    );
  };

  handleScroll = () => {
    if (!this.messagesPanel) {
      return;
    }

    const scrollTop = this.messagesPanel.scrollTop;
    const clientHeight = this.messagesPanel.clientHeight;

    let { messages } = this.state;
    let msgCount = messages.length;
    let startIndex = Math.ceil(scrollTop / AVERAGE_HEIGHT);
    let maxStartIndex = msgCount - DISPLAY_COUNT;
    startIndex = Math.max(Math.min(startIndex, maxStartIndex), 0); // 向下滚动太多超出总量，或者总消息数量不足
    let endIndex = this.calculateEndIndex(startIndex, msgCount);

    let els = document.querySelectorAll('.message-wrapper');
    if (
      els[0] &&
      els[els.length - 1] &&
      els[0].getBoundingClientRect().bottom < 0 &&
      els[els.length - 1].getBoundingClientRect().top > clientHeight
    ) {
      return;
    }

    let detla = Math.max(startIndex - OFFSET, 0);
    this.setPlaceholder(detla * AVERAGE_HEIGHT, (msgCount - endIndex) * AVERAGE_HEIGHT);

    this.setState(
      {
        startIndex,
        endIndex,
        groupedMessages: groupByTime(messages, startIndex, endIndex),
        shouldScrollBottom: false,
      },
      () => {
        this.setIntersectionObserver();
      }
    );

    if (!this.messagesTopBar) {
      this.messagesTopBar = document.querySelector('.messages-top-bar');
    }
    if (this.messagesTopBar) {
      if (scrollTop > 0) {
        if (this.messagesTopBar.className.indexOf('has-shadow') === -1) {
          this.messagesTopBar.className += ' has-shadow';
        }
      } else {
        this.messagesTopBar.className = this.messagesTopBar.className.replace(' has-shadow', '');
      }
    }
  };

  calculateEndIndex(startIndex, msgCount) {
    let endIndex = startIndex + DISPLAY_COUNT;
    endIndex = endIndex >= msgCount ? msgCount : endIndex;
    return endIndex;
  }

  scrollToMessagesBottom() {
    if (this.messagePanelEnd) {
      // this.messagePanelEnd.scrollIntoView({ behavior: 'smooth' });
      // dom render spend some time, so add a timeout here.
      this.timer = setTimeout(() => {
        this.messagePanelEnd.scrollIntoView();
        this.timer = null;
      }, 20);
    }
  }

  setPlaceholder = (upperHeight, underHeight) => {
    this.messagePanelStart.style.height = upperHeight + 'px';
    this.messagePanelEnd.style.height = underHeight + 'px';
  };

  getRoomMembers = async conv => {
    if (conv.isGroup) {
      const members = await RoomStore.getRoomMembers(conv.jid, conv.curJid);
      this.setState({ members });
    }
  };

  getContactInfoByJid = jid => {
    const { members } = this.state;
    const { selectedConversation } = this.props;
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
    if (member) {
      const memberJid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
      return (
        <ContactAvatar
          jid={memberJid}
          name={member.name}
          conversation={this.props.selectedConversation}
          email={member.email}
          size={32}
        />
      );
    }
    return null;
  };

  render() {
    const {
      selectedConversation: { jid },
    } = this.props;
    const { groupedMessages } = this.state;

    if (jid === NEW_CONVERSATION) {
      return null;
    }

    return (
      <div className="messages" tabIndex="0">
        <div
          className="messages-wrap"
          ref={element => {
            this.messagesPanel = element;
          }}
          onScroll={this.handleScroll}
        >
          <SecurePrivate />
          <div
            ref={element => {
              this.messagePanelStart = element;
            }}
          />
          <MessageList
            messages={groupedMessages}
            conversation={this.props.selectedConversation}
            queueLoadMessage={this.props.queueLoadMessage}
            getContactInfoByJid={this.getContactInfoByJid}
          ></MessageList>
          <MessageImagePopup
            {...this.props}
            groupedMessages={groupedMessages}
            getContactInfoByJid={this.getContactInfoByJid}
            getContactAvatar={this.getContactAvatar}
          />
          <div
            ref={element => {
              this.messagePanelEnd = element;
            }}
          />
        </div>
      </div>
    );
  }
}
