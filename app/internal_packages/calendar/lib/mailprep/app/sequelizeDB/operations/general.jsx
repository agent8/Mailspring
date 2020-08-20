import UserBlock from '../schemas/accounts';
import CalendarsBlock from '../schemas/calendars';
import EventPersonsBlock from '../schemas/eventPersons';
import EventsBlock from '../schemas/events';
import PendingActionsBlock from '../schemas/pendingActions';
import RecurrencePatternsBlock from '../schemas/recurrencePatterns';

export const cleardb = () => {
  UserBlock.destroy({
    where: {},
    truncate: true
  });
  CalendarsBlock.destroy({
    where: {},
    truncate: true
  });
  EventPersonsBlock.destroy({
    where: {},
    truncate: true
  });
  EventsBlock.destroy({
    where: {},
    truncate: true
  });
  PendingActionsBlock.destroy({
    where: {},
    truncate: true
  });
  RecurrencePatternsBlock.destroy({
    where: {},
    truncate: true
  });
};

export default cleardb;
