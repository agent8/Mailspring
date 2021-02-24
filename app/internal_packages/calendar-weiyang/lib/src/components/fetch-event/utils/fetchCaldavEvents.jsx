import Actions from '../../../../../../../src/flux/actions.es6';
import { CALDAV_PROVIDER, ICLOUD_URL } from '../../constants';
import { getCaldavAccount } from './getCaldavAcc';
import * as PARSER from './parser';

export const fetchCaldavEvents = async (email, password, accountType) => {
  const res = await getCaldavAccount(email, password, ICLOUD_URL);
  console.log('res', res);
  const authObject = {
    providerType: res.server.includes('caldav') ? CALDAV_PROVIDER : null,
    username: res.credentials.username,
    password: res.credentials.password,
  };
  Actions.setIcloudAuth(authObject);
  const calendars = PARSER.parseCal(res.calendars);
  Actions.setIcloudCalendarLists(calendars);
  const events = PARSER.parseCalEvents(res.calendars, calendars);
  console.log('events', events);
  const flatEvents = events.reduce((acc, val) => {
    // console.log('accumulator', acc, val);
    return acc.concat(val);
  }, []);
  const filteredEvents = flatEvents.filter(event => event !== '');
  const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
  console.log('flatFilteredEvents', flatFilteredEvents);
  // const eventPersons = PARSER.parseEventPersons(flatFilteredEvents);
  const recurrencePatterns = PARSER.parseRecurrenceEvents(flatFilteredEvents);
  console.log('recurrencePattern', recurrencePatterns);
  const expanded = PARSER.expandRecurEvents(
    flatFilteredEvents.map(calEvent => calEvent.eventData),
    recurrencePatterns
  );
  const finalResult = [
    ...expanded.filter(e => e.isRecurring === true),
    ...flatFilteredEvents
      .filter(e => e.recurData === undefined || e.recurData === null)
      .map(e => e.eventData),
  ];
  finalResult.forEach(e => {
    e.owner = email;
    e.caldavType = accountType;
  });
  console.log('DATA', finalResult);
  return finalResult;
};
