import React from 'react';
import {
  PropTypes,
  Utils,
  DateUtils,
  EmailAvatar,
  AccountStore,
  FocusedPerspectiveStore,
} from 'mailspring-exports';
import { ListTabular, InjectedComponent, LabelColorizer } from 'mailspring-component-kit';
import SiftQuickActions from './sift-quick-actions';
import AccountColor from '../../account-color/lib/account-color';

function snippet(html) {
  if (!(html && typeof html === 'string')) {
    return '';
  }
  try {
    return Utils.extractTextFromHtml(html, { maxLength: 400 }).substr(0, 200);
  } catch (err) {
    return '';
  }
}

function subject(subj) {
  if ((subj || '').trim().length === 0) {
    return <span className="no-subject">(No Subject)</span>;
  }
  return Utils.extractTextFromHtml(subj);
}

const participants = message => {
  let isSent = false;
  if (Array.isArray(message.labels)) {
    isSent = message.labels.some(label => label && label.role === 'sent');
  }
  let from = message.from;
  if (Array.isArray(message.replyTo) && message.replyTo.length > 0) {
    from = message.replyTo;
  }
  const list =
    message.draft || isSent ? [].concat(message.to, message.cc, message.bcc) : [].concat(from);

  if (list.length > 0) {
    return (
      <div className="participants">
        {renderIcons(message)}
        <div className="participants-inner">
          <span>{list.map(p => p.displayName()).join(', ')}</span>
        </div>
        <AccountColor message={message} />
      </div>
    );
  } else {
    return (
      <div className="participants no-recipients">
        (No Recipients)
        <AccountColor message={message} />
      </div>
    );
  }
};

const SenderColumn = new ListTabular.Column({
  name: 'Avatar',
  // eslint-disable-next-line react/display-name
  resolver: message => {
    return <EmailAvatar key="email-avatar" mode="list" message={message} />;
  },
});

const ParticipantsColumn = new ListTabular.Column({
  name: 'Participants',
  width: 180,
  resolver: message => {
    return participants(message);
  },
});

const renderIcons = message => {
  const dotIconClassName = Utils.iconClassName('menu-unread.svg');
  if (message.starred) {
    return <div className={`thread-icon thread-icon-star ${dotIconClassName}`} />;
  } else if (message.unread) {
    return <div className={`thread-icon thread-icon-unread ${dotIconClassName}`} />;
  }
  return null;
};

const ContentsColumn = new ListTabular.Column({
  name: 'Contents',
  flex: 4,
  // eslint-disable-next-line react/display-name
  resolver: message => {
    return (
      <span className="details">
        <span className="subject">{subject(message.subject)}</span>
        <span className="snippet">
          {Utils.superTrim(message.snippet ? message.snippet : snippet(message.body))}
        </span>
      </span>
    );
  },
});

const AttachmentsColumn = new ListTabular.Column({
  name: 'Attachments',
  width: 32,
  resolver: message => {
    let attachments = [];
    const showAttachmentIcon = Utils.showIconForAttachments(message.files);
    if (showAttachmentIcon) {
      const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
      attachments = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }
    return attachments;
  },
});

const TimeColumn = new ListTabular.Column({
  name: 'Time',
  // eslint-disable-next-line react/display-name
  resolver: message => {
    return (
      <InjectedComponent
        key="sift-injected-timestamp"
        className="sift-injected-timestamp"
        fallback={SiftMessageTimestamp}
        exposedProps={{ message: message }}
        matching={{ role: 'SiftListTimestamp' }}
      />
    );
  },
});

const HoverActions = new ListTabular.Column({
  name: 'HoverActions',
  // eslint-disable-next-line react/display-name
  resolver: message => {
    return <SiftQuickActions message={message} layout="wide" />;
  },
});

const getSnippet = function(message) {
  if (message.snippet) {
    return message.snippet;
  }
  return (
    <div className="skeleton">
      <div />
      <div />
    </div>
  );
};
const SiftMessageTimestamp = function({ message }) {
  const timestamp = message.date ? DateUtils.shortTimeString(message.date) : 'No Date';
  return <span className="timestamp">{timestamp}</span>;
};
SiftMessageTimestamp.propTypes = {
  message: PropTypes.object,
};
SiftMessageTimestamp.containerRequired = false;
const cNarrow = new ListTabular.Column({
  name: 'Item',
  flex: 1,
  // eslint-disable-next-line react/display-name
  resolver: message => {
    let attachment = false;
    let calendar = null;
    const hasCalendar = message.hasCalendar;
    if (hasCalendar) {
      const calendarClassName = Utils.iconClassName('feed-calendar.svg');
      calendar = <div className={`thread-icon thread-icon-calendar ${calendarClassName}`} />;
    }

    const showAttachmentIcon = Utils.showIconForAttachments(message.files);
    if (showAttachmentIcon) {
      const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
      attachment = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }
    const snippet = Utils.superTrim(getSnippet(message));
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div className="icons-column">
          <EmailAvatar key="email-avatar" mode="list" message={message} />
        </div>
        <div className="thread-info-column">
          <div className="participants-wrapper">
            {participants(message)}
            <span style={{ flex: 1 }} />
            <InjectedComponent
              key="sift-injected-timestamp"
              className="sift-injected-timestamp"
              fallback={SiftMessageTimestamp}
              exposedProps={{ message: message }}
              matching={{ role: 'SiftListTimestamp' }}
            />
            <SiftQuickActions message={message} layout="narrow" />
          </div>
          <div className="subject">
            <span>{subject(message.subject)}</span>
            {calendar || attachment || <div className="thread-icon no-icon" />}
          </div>
          <div className="snippet-and-labels">
            <div className="snippet">{snippet ? snippet : ' '}</div>
          </div>
        </div>
      </div>
    );
  },
});

module.exports = {
  Wide: [
    SenderColumn,
    ParticipantsColumn,
    AttachmentsColumn,
    ContentsColumn,
    TimeColumn,
    HoverActions,
  ],
  Narrow: [cNarrow],
};
