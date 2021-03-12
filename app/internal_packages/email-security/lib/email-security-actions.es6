const Reflux = require('reflux');

const Actions = [
  'checkHeader',
  'checkEmail',
  'spamAndSMTPCheck',
  'fetchSenderInfo',
  'fetchSenderEmails',
];

for (let idx of Array.from(Actions)) {
  Actions[idx] = Reflux.createAction(Actions[idx]);
  Actions[idx].sync = true;
}

module.exports = Actions;
