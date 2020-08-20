import { Op } from 'sequelize';
import sinon from 'sinon';
import PendingActionBlock from '../../../app/sequelizeDB/schemas/pendingActions';
import * as dbPendingActionActions from '../../../app/sequelizeDB/operations/pendingactions';
import { mockEventData } from '../../reducers/mockEventData';

describe('DB Pending Action Operations', () => {
  it('Sample test', async () => {});
});

// import { Op } from 'sequelize';
// import PendingActionBlock from '../schemas/pendingActions';

// export const getAllPendingActions = async () => {
//   const pendingactions = await PendingActionBlock.findAll();
//   return pendingactions;
// };

// export const findPendingActionById = async (eventId) =>
//   PendingActionBlock.findOne({
//     where: {
//       eventId: {
//         [Op.eq]: eventId
//       }
//     }
//   });

// export const insertPendingActionIntoDatabase = async (pendingAction) => {
//   const debug = true;
//   // debugger;

//   console.log(pendingAction);
//   // As we are inserting a new user into the database, and personId being the priamry key
//   // that is uuidv4 generated, meaning unique each time, we need to check based off the
//   // user information before we decide to upsert or update accrordingly.
//   const dbPendingAction = await PendingActionBlock.findAll({
//     where: {
//       eventId: {
//         [Op.eq]: pendingAction.eventId
//       }
//     }
//   });

//   if (dbPendingAction.length === 0) {
//     if (debug) {
//       console.log('(Log) No Event found, Upserting');
//     }

//     await PendingActionBlock.upsert(pendingAction);
//   } else if (dbPendingAction.length === 1) {
//     debugger;
//     if (debug) {
//       console.log('(Log) Found Pending Action of ', dbPendingAction[0], ', Updating');
//     }

//     pendingAction.uniqueId = dbPendingAction[0].uniqueId;
//     await PendingActionBlock.update(pendingAction, {
//       where: {
//         uniqueId: {
//           [Op.eq]: dbPendingAction[0].uniqueId
//         }
//       }
//     });
//   } else {
//     console.log('(Error) Duplicate Event in the database');
//   }
//   return pendingAction;
// };

// export const deletePendingActionById = async (eventId) => {
//   const debug = true;

//   await PendingActionBlock.destroy({
//     where: {
//       eventId: {
//         [Op.eq]: eventId
//       }
//     }
//   });
// };
