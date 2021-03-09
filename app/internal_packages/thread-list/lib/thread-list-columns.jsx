import React from 'react';
import {
  ListTabular,
  MailLabelSet,
  InjectedComponent,
  InjectedComponentSet,
} from 'mailspring-component-kit';
import { Utils, DateUtils, EmailAvatar, PropTypes } from 'mailspring-exports';

import QuickActions from './quick-actions';
let draftStore = null;
let focusedPerspectiveStore = null;
let searchStore = null;
const FocusedPerspectiveStore = () => {
  focusedPerspectiveStore =
    focusedPerspectiveStore || require('mailspring-exports').FocusedPerspectiveStore;
  return focusedPerspectiveStore;
};
const DraftStore = () => {
  draftStore = draftStore || require('mailspring-exports').DraftStore;
  return draftStore;
};
const SearchStore = () => {
  searchStore = searchStore || require('mailspring-exports').SearchStore;
  return searchStore;
};
const ThreadListParticipants = require('./thread-list-participants');

const snippetProcessSearch = snippet => {
  const currentPerspective = FocusedPerspectiveStore().current();
  if (!currentPerspective || !currentPerspective.isSearchMailbox) {
    return snippet;
  }
  const searchTerm = SearchStore().getSearchText();
  if (searchTerm.length === 0) {
    return snippet;
  }
  const { startIndex = -1, endIndex = -1 } = Utils.findKeywordIndex(snippet, searchTerm);
  if (startIndex === -1) {
    return snippet;
  }
  let actualStart = Math.max(0, startIndex - 30);
  return (
    <React.Fragment>
      {snippet.slice(actualStart, startIndex)}
      <search-match>{snippet.slice(startIndex, endIndex + 1)}</search-match>
      {snippet.slice(endIndex + 1)}
    </React.Fragment>
  );
};

const processSubject = subject => {
  const currentPerspective = FocusedPerspectiveStore().current();
  if (!currentPerspective || !currentPerspective.isSearchMailbox) {
    return subject;
  }
  const searchTerm = SearchStore().getSearchText();
  if (searchTerm.length === 0) {
    return subject;
  }
  const { startIndex = -1, endIndex = -1 } = Utils.findKeywordIndex(subject, searchTerm);
  if (startIndex === -1) {
    return subject;
  }
  return (
    <React.Fragment>
      {subject.slice(0, startIndex)}
      <search-match>{subject.slice(startIndex, endIndex + 1)}</search-match>
      {subject.slice(endIndex + 1)}
    </React.Fragment>
  );
};

// Get and format either last sent or last received timestamp depending on thread-list being viewed
const ThreadListTimestamp = function({ thread }) {
  // let rawTimestamp = FocusedPerspectiveStore.current().isSent()
  //   ? thread.lastMessageSentTimestamp
  //   : thread.lastMessageReceivedTimestamp;
  const rawTimestamp = thread.lastMessageTimestamp;
  // if (!rawTimestamp) {
  //   rawTimestamp = thread.lastMessageSentTimestamp;
  // }
  const timestamp = rawTimestamp ? DateUtils.shortTimeStringForThreadList(rawTimestamp) : 'No Date';
  return <span className="timestamp">{timestamp}</span>;
};

ThreadListTimestamp.containerRequired = false;
ThreadListTimestamp.propTypes = {
  thread: PropTypes.object,
};

const subject = function(subj) {
  if ((subj || '').trim().length === 0) {
    return <span className="no-subject">(No Subject)</span>;
  } else if (subj.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g).length > 1) {
    const subjComponents = [];
    const subjParts = subj.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g);
    for (let idx = 0; idx < subjParts.length; idx++) {
      const part = subjParts[idx];
      if (part.match(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g)) {
        subjComponents.push(
          <span className="emoji" key={idx}>
            {part}
          </span>
        );
      } else {
        subjComponents.push(<span key={idx}>{part}</span>);
      }
    }
    return subjComponents;
  } else {
    return processSubject(subj);
  }
};

const getSnippet = function(thread) {
  const messages = thread.__messages || [];
  if (thread.snippet) {
    // quanzs: here substring 400 is for old user, their snippet is too long
    // TODO: if native fix [snippet is over 400] issue, here should rollback
    return thread.snippet.substring(0, 400);
    // return thread.snippet;
  }
  for (let ii = messages.length - 1; ii >= 0; ii--) {
    if (messages[ii].snippet) return messages[ii].snippet;
  }
  return (
    <div className="skeleton">
      <div></div>
      <div></div>
    </div>
  );
};

const c1 = new ListTabular.Column({
  name: 'Avatar',
  resolver: thread => {
    return [
      <EmailAvatar key="email-avatar" mode="list" thread={thread} />,
      // <ThreadListIcon key="thread-list-icon" thread={thread} />,
      // <MailImportantIcon
      //   key="mail-important-icon"
      //   thread={thread}
      //   showIfAvailableForAnyAccount={true}
      // />,
      <InjectedComponentSet
        key="injected-component-set"
        inline={true}
        containersRequired={false}
        matching={{ role: 'ThreadListIcon' }}
        className="thread-injected-icons"
        exposedProps={{ thread: thread }}
      />,
    ];
  },
});

const c2 = new ListTabular.Column({
  name: 'Participants',
  maxWidth: 200,
  // eslint-disable-next-line react/display-name
  resolver: thread => {
    let calendar = null;
    const hasCalendar = thread.hasCalendar;
    if (hasCalendar) {
      const calendarClassName = Utils.iconClassName('feed-calendar.svg');
      calendar = <div className={`thread-icon thread-icon-calendar ${calendarClassName}`} />;
    }

    let attachment = null;
    const messages = thread.__messages || [];
    const hasAttachments =
      thread.hasAttachments && messages.find(m => Utils.showIconForAttachments(m.files));
    if (hasAttachments) {
      const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
      attachment = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }
    return (
      <div style={{ display: 'flex' }}>
        <ThreadListParticipants thread={thread} />
        {calendar || attachment || <div className="thread-icon no-icon" />}
      </div>
    );
  },
});

const c3 = new ListTabular.Column({
  name: 'Message',
  flex: 4,
  // eslint-disable-next-line react/display-name
  resolver: thread => {
    const messages = thread.__messages || [];
    let draft = null;
    const hasDraft = messages.find(m => m.draft && !DraftStore().isSendingDraft(m.id));
    if (hasDraft) {
      // draft = (
      //   <RetinaImg
      //     name="pencil.svg"
      //     isIcon
      //     style={{ width: 16, height: 16 }}
      //     className="thread-icon thread-icon-pencil"
      //     mode={RetinaImg.Mode.ContentIsMask}
      //   />
      // );
      draft = <span className="draft-icon">Draft</span>;
    }
    const processedSnippet = snippetProcessSearch(Utils.superTrim(getSnippet(thread)));
    return (
      <span className="details">
        {draft}
        <span className="subject">{subject(thread.subject)}</span>
        <MailLabelSet thread={thread} />
        <span className="snippet">{processedSnippet}</span>
        {/* <ThreadListIcon thread={thread} /> */}
      </span>
    );
  },
});

const c4 = new ListTabular.Column({
  name: 'Date',
  // eslint-disable-next-line react/display-name
  resolver: thread => {
    return (
      <InjectedComponent
        className="thread-injected-timestamp"
        fallback={ThreadListTimestamp}
        exposedProps={{ thread: thread }}
        matching={{ role: 'ThreadListTimestamp' }}
      />
    );
  },
});

const c5 = new ListTabular.Column({
  name: 'HoverActions',
  // eslint-disable-next-line react/display-name
  resolver: thread => {
    return <QuickActions thread={thread} layout="wide" />;
  },
});

const cNarrow = new ListTabular.Column({
  name: 'Item',
  flex: 1,
  // eslint-disable-next-line react/display-name
  resolver: thread => {
    let pencil = false;
    let attachment = false;
    const messages = thread.__messages || [];

    let calendar = null;
    const hasCalendar = thread.hasCalendar;
    if (hasCalendar) {
      const calendarClassName = Utils.iconClassName('feed-calendar.svg');
      calendar = <div className={`thread-icon thread-icon-calendar ${calendarClassName}`} />;
    }

    const hasAttachments =
      thread.hasAttachments && messages.find(m => Utils.showIconForAttachments(m.files));
    if (hasAttachments) {
      const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
      attachment = <div className={`thread-icon thread-icon-attachment ${attachmentClassName}`} />;
    }

    const hasDraft = messages.find(m => m.draft && !DraftStore().isSendingDraft(m.id));
    if (hasDraft) {
      pencil = <span className="draft-icon">Draft</span>;
    }

    const snippet = snippetProcessSearch(Utils.superTrim(getSnippet(thread)));
    // TODO We are limiting the amount on injected icons in narrow mode to 1
    // until we revisit the UI to accommodate more icons
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div className="icons-column">
          <EmailAvatar mode="list" thread={thread} />
        </div>
        <div className="thread-info-column">
          <div className="participants-wrapper">
            <ThreadListParticipants thread={thread} />
            {pencil}
            <InjectedComponent
              key="thread-injected-note-labels"
              className="thread-injected-note-labels"
              exposedProps={{ thread: thread }}
              matching={{ role: 'NoteLabels' }}
            />
            <span style={{ flex: 1 }} />
            <InjectedComponent
              key="thread-injected-timestamp"
              className="thread-injected-timestamp"
              fallback={ThreadListTimestamp}
              exposedProps={{ thread: thread }}
              matching={{ role: 'ThreadListTimestamp' }}
            />
            <QuickActions thread={thread} layout="narrow" />
          </div>
          <div className="subject">
            <span>{subject(thread.subject)}</span>
            {/* <ThreadListIcon thread={thread} /> */}
            {calendar || attachment || <div className="thread-icon no-icon" />}
          </div>
          <div className="snippet-and-labels">
            <div className="snippet">{snippet}</div>
            {/* <div style={{ flex: 1, flexShrink: 1 }} /> */}
            {/* <MailLabelSet thread={thread} /> */}
            {/* <div className="icons">
              <InjectedComponentSet
                inline={true}
                matchLimit={1}
                direction="column"
                containersRequired={false}
                key="injected-component-set"
                exposedProps={{ thread: thread }}
                matching={{ role: 'ThreadListIcon' }}
                className="thread-injected-icons"
              />
              <MailImportantIcon thread={thread} showIfAvailableForAnyAccount={true} />
            </div> */}
          </div>
        </div>
      </div>
    );
  },
});

module.exports = {
  Narrow: [cNarrow],
  Wide: [c1, c2, c3, c4, c5],
};
