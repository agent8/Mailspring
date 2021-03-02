module.exports = [
  {
    title: 'APPLICATION',
    items: [
      ['application:new-message', 'New Message'],
      ['core:focus-search', 'Search'],
      ['core:undo', 'Undo'],
      ['core:new-folder', 'New Folder'],
    ],
  },
  {
    title: 'EMAILS',
    items: [
      ['core:reply', 'Reply'],
      ['core:reply-all', 'Reply All'],
      ['core:forward', 'Forward'],
      ['core:archive-item', 'Archive'],
      ['core:delete-item', 'Trash'],
      ['core:star-item', 'Flag'],
      // ['core:snooze-item', 'Snooze'],
      ['core:change-labels', 'Label'],
      ['core:change-folders', 'Move to folder'],
      ['core:mark-as-read', 'Mark read'],
      ['core:mark-as-unread', 'Mark unread'],
      ['core:report-as-spam', 'Mark spam'],
      ['core:mark-important', 'Mark as important (Gmail)'],
      ['core:mark-unimportant', 'Mark unimportant (Gmail)'],
    ],
  },
  {
    title: 'COMPOSER',
    items: [
      ['composer:send-message', 'Send Email'],
      ['composer:focus-to', 'Jump to "To" field'],
      ['composer:show-and-focus-cc', 'Jump to "Cc" field'],
      ['composer:show-and-focus-bcc', 'Jump to "Bcc" field'],

      ['contenteditable:insert-link', 'Insert link'],
      ['contenteditable:quote', 'Quote text'],
      ['contenteditable:numbered-list', 'Numbered list'],
      ['contenteditable:bulleted-list', 'Bulleted list'],
      ['contenteditable:indent', 'Increase text indent'],
      ['contenteditable:outdent', 'Decrease text indent'],
      ['contenteditable:underline', 'Underline'],
      ['contenteditable:bold', 'Bold'],
      ['contenteditable:italic', 'Italic'],

      ['composer:select-attachment', 'Select attachment'],
    ],
  },
  {
    title: 'NAVIGATION',
    items: [
      ['core:pop-sheet', 'Return to email list'],
      ['core:focus-item', 'Open selected email'],
      ['core:previous-item', 'Move to previous email'],
      ['core:next-item', 'Move to next email'],
      ['core:previous-folder', 'Move to previous folder'],
      ['core:next-folder', 'Move to next folder'],
      ['core:select-item', 'Select'],
      ['multiselect-list:select-all', 'Select all'],
      ['multiselect-list:deselect-all', 'Deselect all'],
      ['thread-list:select-read', 'Select all read'],
      ['thread-list:select-unread', 'Selet all unread'],
      ['thread-list:select-starred', 'Select all flagged'],
      ['thread-list:select-unstarred', 'Select all unflagged'],
      ['navigation:go-to-all-inbox', 'Go to "Inbox"'],
      ['navigation:go-to-all-unread', 'Go to "Unread"'],
      ['navigation:go-to-starred', 'Go to "Flagged"'],
      ['navigation:go-to-all-sent', 'Go to "Sent"'],
      ['navigation:go-to-drafts', 'Go to "Drafts"'],
      ['navigation:go-to-all', 'Go to "Archive"'],
    ],
  },
];
