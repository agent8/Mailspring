import { Op } from 'sequelize';
import AccountBlock from '../schemas/accounts';
import Calendars from '../schemas/calendars';

export const insertAccountIntoDatabase = async (account) => {
  const debug = false;
  const dbAccount = await AccountBlock.findAll({
    where: {
      email: account.email,
      providerType: account.providerType,
      caldavType: account.caldavType === undefined ? '' : account.caldavType
    }
  });
  // console.log(clonedAcc);
  // console.log(dbAccount);
  // clone account to new object so as to not delete calendar data in original object reference (needed for future processing)
  const clonedAcc = Object.assign({}, account);
  if (dbAccount.length === 0 && clonedAcc.calendars && clonedAcc.providerType !== 'GOOGLE') {
    clonedAcc.calendars.forEach((cal) => {
      delete cal.account.calendars;
      delete cal.objects;
    });
  }
  // console.log(clonedAcc);
  // console.log(account);
  // debugger;
  account.json = JSON.stringify(clonedAcc);

  if (dbAccount.length === 0) {
    if (debug) {
      console.log('(Log) No User of ', account, ', Upserting');
    }

    await AccountBlock.upsert(account);
  } else if (dbAccount.length > 1) {
    console.log('(Error) Duplicate user in the database');
  } else {
    if (debug) {
      console.log('(Log) Found User of ', account, ', Updating');
    }

    await AccountBlock.update(
      {
        originalId: account.originalId,
        email: account.email,
        providerType: account.providerType,
        accessToken: account.accessToken,
        accessTokenExpiry: account.accessTokenExpiry,
        password: account.password,
        homeUrl: account.homeUrl === undefined ? null : account.homeUrl,
        principalUrl: account.principalUrl === undefined ? null : account.principalUrl,
        caldavType: account.caldavType === undefined ? null : account.caldavType,
        json: account.json
      },
      {
        where: {
          personId: {
            [Op.eq]: dbAccount.personId
          }
        }
      }
    );
  }
};

export const findAccount = async (providerType, owner) =>
  AccountBlock.findOne({
    where: {
      providerType: {
        [Op.eq]: providerType
      },
      email: { [Op.eq]: owner }
    },
    include: Calendars
  });

export const getAllAccounts = async () => {
  const events = await AccountBlock.findAll({ include: Calendars });
  return events;
};

export const deleteAccount = async (providerType, owner) =>
  AccountBlock.destroy({
    where: {
      providerType: {
        [Op.eq]: providerType
      },
      email: { [Op.eq]: owner }
    }
  });
