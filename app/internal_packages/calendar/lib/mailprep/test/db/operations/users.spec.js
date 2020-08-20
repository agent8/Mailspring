import { Op } from 'sequelize';
import sinon from 'sinon';
import UserBlock from '../../../app/sequelizeDB/schemas/accounts';
import * as dbUserActions from '../../../app/sequelizeDB/operations/accounts';
import { mockEventData } from '../../reducers/mockEventData';

describe('DB User Operations', () => {
  it('Sample test', async () => {});
});

// import { Op } from 'sequelize';
// import UserBlock from '../schemas/users';

// export const insertUserIntoDatabase = async (user) => {
//   const debug = false;

//   // As we are inserting a new user into the database, and personId being the priamry key
//   // that is uuidv4 generated, meaning unique each time, we need to check based off the
//   // user information before we decide to upsert or update accrordingly.
//   const dbUser = await UserBlock.findAll({
//     where: {
//       email: user.email,
//       providerType: user.providerType,
//       caldavType: user.caldavType === undefined ? null : user.caldavType,
//       url: user.url === undefined ? null : user.url
//     }
//   });

//   if (dbUser.length === 0) {
//     if (debug) {
//       console.log('(Log) No User of ', user, ', Upserting');
//     }

//     UserBlock.upsert(user);
//   } else if (dbUser.length > 1) {
//     console.log('(Error) Duplicate user in the database');
//   } else {
//     if (debug) {
//       console.log('(Log) Found User of ', user, ', Updating');
//     }

//     UserBlock.update(
//       {
//         originalId: user.originalId,
//         email: user.email,
//         providerType: user.providerType,
//         accessToken: user.accessToken,
//         accessTokenExpiry: user.accessTokenExpiry,
//         password: user.password,
//         url: user.url === undefined ? null : user.url,
//         caldavType: user.caldavType === undefined ? null : user.caldavType
//       },
//       {
//         where: {
//           personId: {
//             [Op.eq]: dbUser.personId
//           }
//         }
//       }
//     );
//   }
// };

// export const findUser = async (providerType, owner) =>
//   UserBlock.findOne({
//     where: {
//       providerType: {
//         [Op.eq]: providerType
//       },
//       email: { [Op.eq]: owner }
//     }
//   });
