import MailspringStore from 'mailspring-store';
import {
  Actions,
  MuteNotifacationsTask,
  UnMuteNotifacationsTask,
  GetMuteListTask,
  AccountStore,
} from 'mailspring-exports';
import DatabaseStore from './database-store';
import MuteNotifacation from '../models/mute-notifacation';

class MuteNotifacationsStore extends MailspringStore {
  constructor() {
    super();
    this.basicData = [];
    this.muteNotifacations = [];
    this.refreshMuteNotifacations();
    this.listenTo(Actions.changeMuteSucceeded, this.refreshMuteNotifacations);

    DatabaseStore.listen(change => {
      if (change.objectClass === MuteNotifacation.name) {
        this.refreshMuteNotifacations();
      }
    });
  }

  refreshMuteNotifacations = async () => {
    // status is 1 or 3 mean this data is deleted
    const mutes = await DatabaseStore.findAll(MuteNotifacation).where([
      MuteNotifacation.attributes.state.not(1),
      MuteNotifacation.attributes.state.not(3),
    ]);
    const muteNotifacationsSet = new Set();
    const muteDeDuplication = [];
    mutes.forEach(mute => {
      // delete the duplication email data
      if (!muteNotifacationsSet.has(mute.email)) {
        muteNotifacationsSet.add(mute.email);
        muteDeDuplication.push(mute);
      }
    });
    this.basicData = mutes;
    this.muteNotifacations = muteDeDuplication;
    this.trigger();
  };

  syncMuteNotifacations = () => {
    Actions.queueTask(new GetMuteListTask());
  };

  getMuteNotifacations = () => {
    return this.muteNotifacations;
  };

  isMuteByAccount = (accountId, email) => {
    const mutedEmailList = this.basicData.filter(
      mute => mute.email === email && mute.accountId === accountId
    );
    return mutedEmailList.length > 0;
  };

  isMuteded = email => {
    const mutedEmailList = this.muteNotifacations.filter(mute => mute.email === email);
    return mutedEmailList.length > 0;
  };

  muteNotifacationByAccount = (accountId, email) => {
    Actions.queueTask(new MuteNotifacationsTask({ accountId: accountId, email: email }));
  };

  unMuteNotifacationByAccount = (accountId, email) => {
    Actions.queueTask(new UnMuteNotifacationsTask({ accountId: accountId, email: email }));
  };

  muteNotifacationEmails = emails => {
    const muteTaskList = [];
    AccountStore.accounts().forEach(account => {
      emails.forEach(email => {
        muteTaskList.push(new MuteNotifacationsTask({ accountId: account.id, email: email }));
      });
    });
    Actions.queueTasks(muteTaskList);
  };

  unMuteNotifacationEmails = emails => {
    const unMuteTaskList = [];
    AccountStore.accounts().forEach(account => {
      emails.forEach(email => {
        unMuteTaskList.push(new UnMuteNotifacationsTask({ accountId: account.id, email: email }));
      });
    });
    Actions.queueTasks(unMuteTaskList);
  };
}

module.exports = new MuteNotifacationsStore();
