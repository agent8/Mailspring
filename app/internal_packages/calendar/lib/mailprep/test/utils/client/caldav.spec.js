import sinon from 'sinon'; // test lib
import util from 'util'; // circular lib checking

import * as dav from 'dav'; // caldav library

import _ from 'lodash'; // deep equals
import * as caldavActions from '../../../app/utils/client/caldav';
import * as caldavBasics from '../../../app/utils/client/caldavbasics';
import * as dbEventActions from '../../../app/sequelizeDB/operations/events';
import * as dbRpActions from '../../../app/sequelizeDB/operations/recurrencepatterns';
import { mockEventData, mockRecurrData } from '../../reducers/mockEventData';
import { mockRecurrExpandedResults } from '../../reducers/mockRecurrExpandedData';
import { filterIntoSchema } from '../../../app/utils/constants';
import PARSER from '../../../app/utils/parser';

// const dav = require('dav');

// Mocked user data
const caldavSampleUser = {
  personId: '88571865-1df1-4ea0-a794-67267ef6e8f6',
  originalId: '794df957-3ac6-4db7-b80b-273e519bf2d8',
  email: 'fongzhizhong@gmail.com',
  providerType: 'CALDAV',
  accessToken: '',
  accessTokenExpiry: 0,
  password: 'pqyp-dnef-nknq-vagt',
  url: 'https://caldav.icloud.com/',
  caldavType: 'ICLOUD'
};

describe('CalDav Utils Functions', async () => {
  let sandbox = null;
  const davDependency = dav;

  const getFakeCreateAccount = () => {
    const resp = {};
    return resp;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Ignore first', () => {
    it('Ignore first', () => {});
  });

  // it('Get All CalDav Event (Non Recurrence Only)', () => {
  //   // Setup variables
  //   const fakeAccount = getFakeCreateAccount();
  //   const fakeEvents = [
  //     { eventData: mockEventData[0] },
  //     { eventData: mockEventData[1] },
  //     { eventData: mockEventData[2] }
  //   ];

  //   // // Setup functions (Dav Library)
  //   sandbox.stub(caldavBasics, 'getCaldavAccount').resolves(fakeAccount);

  //   // Setup functions (Parser)
  //   sandbox.stub(PARSER, 'parseCal').returns();
  //   sandbox.stub(PARSER, 'parseCalEvents').returns(fakeEvents);
  //   sandbox.stub(PARSER, 'parseRecurrenceEvents').returns([]);
  //   sandbox.stub(PARSER, 'expandRecurEvents').returns([]);

  //   const resultPromise = caldavActions.asyncGetAllCalDavEvents(
  //     caldavSampleUser.email,
  //     caldavSampleUser.password,
  //     caldavSampleUser.url,
  //     caldavSampleUser.caldavType
  //   );

  //   return resultPromise
  //     .then((result) => {
  //       // console.log(result);
  //       expect(result).toEqual(fakeEvents.map((e) => e.eventData));
  //     })
  //     .catch((error) => expect(error).toBeNull());
  // });

  // it('Get All CalDav Event (Recurrence Only)', () => {
  //   // Setup variables
  //   const fakeAccount = getFakeCreateAccount();
  //   const fakeEvents = [
  //     { eventData: mockEventData[0], recurData: mockRecurrData[0] },
  //     { eventData: mockEventData[1], recurData: mockRecurrData[1] },
  //     { eventData: mockEventData[2], recurData: mockRecurrData[2] },
  //     { eventData: mockEventData[3], recurData: mockRecurrData[3] }
  //   ];

  //   // // Setup functions (Dav Library)
  //   sandbox.stub(caldavBasics, 'getCaldavAccount').resolves(fakeAccount);

  //   // Setup functions (Parser)
  //   sandbox.stub(PARSER, 'parseCal').returns();
  //   sandbox.stub(PARSER, 'parseCalEvents').returns(fakeEvents);

  //   // Setup functions (DB)
  //   // As we are querying the database for a recurrence pattern, we have to stub it too.
  //   // We stub it to assume it is a new rp.
  //   // sandbox.stub(dbRpActions, 'getOneRpByOId').resolves(null);
  //   // sandbox.stub(dbRpActions, 'insertOrUpdateRp').resolves(null);

  //   const resultPromise = caldavActions.asyncGetAllCalDavEvents(
  //     caldavSampleUser.email,
  //     caldavSampleUser.password,
  //     caldavSampleUser.url,
  //     caldavSampleUser.caldavType
  //   );

  //   return resultPromise
  //     .then((result) => {
  //       // console.log(result);
  //       const resultNoId = result.forEach((event) => delete event.id);
  //       const mockResultNoId = mockRecurrExpandedResults.forEach((event) => delete event.id);
  //       expect(resultNoId).toEqual(mockResultNoId);
  //     })
  //     .catch((error) => expect(error).toBeNull());
  // });

  // it('Get All CalDav Event (Recurrence & Single Events)', () => {
  //   // Setup variables
  //   const fakeAccount = getFakeCreateAccount();
  //   const fakeEvents = [
  //     { eventData: mockEventData[0] },
  //     { eventData: mockEventData[0], recurData: mockRecurrData[0] },
  //     { eventData: mockEventData[1], recurData: mockRecurrData[1] },
  //     { eventData: mockEventData[2], recurData: mockRecurrData[2] },
  //     { eventData: mockEventData[3], recurData: mockRecurrData[3] }
  //   ];

  //   // // Setup functions (Dav Library)
  //   sandbox.stub(caldavBasics, 'getCaldavAccount').resolves(fakeAccount);

  //   // Setup functions (Parser)
  //   sandbox.stub(PARSER, 'parseCal').returns();
  //   sandbox.stub(PARSER, 'parseCalEvents').returns(fakeEvents);

  //   // Setup functions (DB)
  //   // As we are querying the database for a recurrence pattern, we have to stub it too.
  //   // We stub it to assume it is a new rp.
  //   // sandbox.stub(dbRpActions, 'getOneRpByOId').resolves(null);
  //   // sandbox.stub(dbRpActions, 'insertOrUpdateRp').resolves(null);

  //   const resultPromise = caldavActions.asyncGetAllCalDavEvents(
  //     caldavSampleUser.email,
  //     caldavSampleUser.password,
  //     caldavSampleUser.url,
  //     caldavSampleUser.caldavType
  //   );

  //   return resultPromise
  //     .then((result) => {
  //       // console.log(result);
  //       const newResults = [...mockRecurrExpandedResults, mockEventData[0]];
  //       const resultNoId = result.forEach((event) => delete event.id);
  //       const mockResultNoId = newResults.forEach((event) => delete event.id);
  //       expect(resultNoId).toEqual(mockResultNoId);
  //     })
  //     .catch((error) => expect(error).toBeNull());
  // });
});
