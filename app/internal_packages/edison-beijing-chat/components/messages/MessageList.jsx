import React, { PureComponent } from 'react';
import MessageItem from './MessageItem';
import MessageItemBody from './MessageItemBody';
import Divider from '../common/Divider';
import { dateFormat, dateFormatDigit, weekDayFormat, nearDays, timeFormat } from '../../utils/time';
import { FILE_TYPE } from '../../utils/filetypes';

export default class MessageList extends PureComponent {
  renderTimeTag(msg) {
    const { content: time } = msg.body;
    return <div className="time-label-text">{timeFormat(time)}</div>;
  }

  renderDateTag(msg) {
    const { content: time } = msg.body;
    return (
      <div key={msg.id} className="day-label">
        <div className="day-label" key={msg.id}>
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

  render() {
    let lastTime = 0;
    let lastSender = '';
    let msgBody = [];
    let contents = [];
    const { messages } = this.props;
    for (let msg of messages) {
      const { type } = msg.body;
      switch (type) {
        case FILE_TYPE.DATE:
          contents.push(this.renderDateTag(msg));
          break;
        // case FILE_TYPE.TIME:
        //   content = this.renderTimeTag(msg);
        //   contents.push(content);

        //   break;
        case 'error403':
        case 'memberschange':
        case 'change-group-name':
          contents.push(this.renderSystemMsg(msg));
          break;
        default:
          let time = msg.sentTime;
          let body = (
            <MessageItemBody
              msg={msg}
              conversation={this.props.conversation}
              getContactInfoByJid={this.props.getContactInfoByJid}
              queueLoadMessage={this.props.queueLoadMessage}
              //   onEdit={() => {
              //     this.setState({ isEditing: !this.state.isEditing });
              //   }}
              key={msg.id}
            ></MessageItemBody>
          );

          if (
            time - lastTime < 5 * 60 * 1000 &&
            lastSender === msg.sender &&
            lastTime > new Date(time).setHours(0, 0, 0, 0)
          ) {
            contents.pop();
            msgBody.push(body);
          } else {
            msgBody = [body];
          }
          lastTime = time;
          lastSender = msg.sender;

          contents.push(
            <div key={msg.id} className="message-wrapper">
              <MessageItem
                conversation={this.props.conversation}
                msg={msg}
                queueLoadMessage={this.props.queueLoadMessage}
                getContactInfoByJid={this.props.getContactInfoByJid}
                messageBoby={msgBody}
                key={msg.id}
              ></MessageItem>
            </div>
          );
      }
    }
    return contents;
  }
}
