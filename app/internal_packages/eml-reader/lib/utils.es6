import { Contact, Message } from 'mailspring-exports';
import uuid from 'uuid';
const convertToContacts = addresses => {
  const ret = [];
  if (addresses) {
    addresses.value.forEach(address => {
      ret.push(convertToContact(address));
    });
  }
  return ret;
};
const convertToContact = address => {
  return new Contact({ email: address.address, name: address.name });
};
const convertToMessage = (mail, accountId) => {
  console.log(mail);
  return new Message({
    id: uuid(),
    accountId,
    subject: mail.subject,
    body: mail.html,
    from: convertToContacts(mail.from),
    cc: convertToContacts(mail.cc),
    bcc: convertToContacts(mail.bcc),
    date: mail.date,
  });
};
module.exports = {
  convertToMessage,
};
