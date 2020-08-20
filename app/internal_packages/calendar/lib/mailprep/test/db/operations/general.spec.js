import { Op } from 'sequelize';
import sinon from 'sinon';
import EventsBlock from '../../../app/sequelizeDB/schemas/events';
import * as dbEventActions from '../../../app/sequelizeDB/operations/events';
import { mockEventData } from '../../reducers/mockEventData';

describe('DB General Operations', () => {
  it('Sample test', async () => {});
});

// import UserBlock from '../schemas/users';
// import CalendarsBlock from '../schemas/calendars';
// import EventPersonsBlock from '../schemas/eventPersons';
// import EventsBlock from '../schemas/events';
// import PendingActionsBlock from '../schemas/pendingActions';
// import RecurrencePatternsBlock from '../schemas/recurrencePatterns';

// export const cleardb = () => {
//   UserBlock.destroy({
//     where: {},
//     truncate: true
//   });
//   CalendarsBlock.destroy({
//     where: {},
//     truncate: true
//   });
//   EventPersonsBlock.destroy({
//     where: {},
//     truncate: true
//   });
//   EventsBlock.destroy({
//     where: {},
//     truncate: true
//   });
//   PendingActionsBlock.destroy({
//     where: {},
//     truncate: true
//   });
//   RecurrencePatternsBlock.destroy({
//     where: {},
//     truncate: true
//   });
// };

// export default cleardb;
