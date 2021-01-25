import React from 'react';
import { Utils, Message, DateUtils } from 'mailspring-exports';
import {
  InjectedComponentSet,
  ListTabular,
  InjectedComponent,
  OutboxSender,
} from 'mailspring-component-kit';
import OutboxQuickActions from './outbox-quick-actions';
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

const SenderColumn = new ListTabular.Column({
  name: 'Sender',
  resolver: draft => {
    return (
      <OutboxSender
        draft={draft}
        lottieStyle={{ left: 11, top: 10, width: 42, height: 42 }}
        avatarStyle={{ width: 35, height: 35 }}
      />
    );
  },
});

const ParticipantsColumn = new ListTabular.Column({
  name: 'Participants',
  width: 180,
  resolver: draft => {
    const list = [].concat(draft.to, draft.cc, draft.bcc);

    if (list.length > 0) {
      return (
        <div className="participants">
          <span>{list.map(p => p.displayName()).join(', ')}</span>
        </div>
      );
    } else {
      return <div className="participants no-recipients">(No Recipients)</div>;
    }
  },
});
const participants = draft => {
  const list = [].concat(draft.to, draft.cc, draft.bcc);

  if (list.length > 0) {
    return (
      <div className="participants" style={{ flex: 1 }}>
        <div className="participants-inner">
          <span>{list.map(p => p.displayName()).join(', ')}</span>
        </div>
      </div>
    );
  } else {
    return (
      <div className="participants no-recipients" style={{ flex: 1 }}>
        (No Recipients)
      </div>
    );
  }
};

const ContentsColumn = new ListTabular.Column({
  name: 'Contents',
  flex: 4,
  resolver: draft => {
    let attachments = [];
    const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
    const showAttachmentIcon = Utils.showIconForAttachments(draft.files);
    if (showAttachmentIcon) {
      attachments = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }
    return (
      <span className="details">
        <span className="subject">{subject(draft.subject)}</span>
        <span className="snippet">
          {Utils.superTrim(draft.snippet ? draft.snippet : snippet(draft.body))}
        </span>
        {attachments}
      </span>
    );
  },
});

const StatusColumn = new ListTabular.Column({
  name: 'State',
  resolver: draft => {
    return (
      <InjectedComponentSet
        inline={true}
        containersRequired={false}
        matching={{ role: 'OutboxList:DraftStatus' }}
        className="draft-list-injected-state"
        exposedProps={{ draft }}
      />
    );
  },
});

const HoverActions = new ListTabular.Column({
  name: 'HoverActions',
  resolver: draft => {
    return <OutboxQuickActions draft={draft} layout="wide" />;
  },
});

const getSnippet = function(draft) {
  if (draft.snippet) {
    return draft.snippet;
  }
  return (
    <div className="skeleton">
      <div></div>
      <div></div>
    </div>
  );
};
const OutboxDraftTimestamp = function({ draft }) {
  const timestamp = draft.date ? DateUtils.shortTimeString(draft.date) : 'No Date';
  return <span className="timestamp">{timestamp}</span>;
};

OutboxDraftTimestamp.containerRequired = false;
const cNarrow = new ListTabular.Column({
  name: 'Item',
  flex: 1,
  resolver: draft => {
    let attachment = false;
    let calendar = null;
    const hasCalendar = draft.hasCalendar;
    if (hasCalendar) {
      const calendarClassName = Utils.iconClassName('feed-calendar.svg');
      calendar = <div className={`thread-icon thread-icFon-calendar ${calendarClassName}`} />;
    }

    const showAttachmentIcon = Utils.showIconForAttachments(draft.files);
    if (showAttachmentIcon) {
      const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
      attachment = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }
    const snippet = Utils.superTrim(getSnippet(draft));
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div className="icons-column">{SenderColumn.resolver(draft)}</div>
        <div className="thread-info-column">
          <div className="participants-wrapper">
            {participants(draft)}
            {/* <span style={{ flex: 1 }} /> */}
            <InjectedComponent
              key="outbox-injected-timestamp"
              className="outbox-injected-timestamp"
              fallback={OutboxDraftTimestamp}
              exposedProps={{ draft: draft }}
              matching={{ role: 'OutboxListTimestamp' }}
            />
            <OutboxQuickActions draft={draft} layout="narrow" />
          </div>
          <div className="subject">
            <span>{subject(draft.subject)}</span>
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
  Wide: [SenderColumn, ParticipantsColumn, ContentsColumn, StatusColumn, HoverActions],
  Narrow: [cNarrow],
};
