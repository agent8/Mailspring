import { Op } from 'sequelize';
import sinon from 'sinon';
import EventsBlock from '../../../app/sequelizeDB/schemas/events';
import * as dbEventActions from '../../../app/sequelizeDB/operations/events';
import { mockEventData } from '../../reducers/mockEventData';

describe('DB Events Operations', () => {
  it('Get All Events, Empty Array', async () => {
    const fake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'findAll', fake);

    expect(await dbEventActions.getAllEvents()).toEqual([]);

    sinon.restore();
  });

  it('Get All Events, Get 3 Elements', async () => {
    const fake = sinon.fake.resolves([mockEventData[0], mockEventData[1], mockEventData[2]]);
    sinon.replace(EventsBlock, 'findAll', fake);

    expect(await dbEventActions.getAllEvents()).toEqual([
      mockEventData[0],
      mockEventData[1],
      mockEventData[2]
    ]);

    sinon.restore();
  });

  it('Get One Event, By Id', async () => {
    const fake = sinon.fake.resolves(mockEventData[0]);
    sinon.replace(EventsBlock, 'findOne', fake);

    expect(await dbEventActions.getOneEventById(mockEventData[0].id)).toEqual(mockEventData[0]);

    sinon.restore();
  });

  it('Get One Event, By iCalUID', async () => {
    const fake = sinon.fake.resolves(mockEventData[0]);
    sinon.replace(EventsBlock, 'findOne', fake);

    expect(await dbEventActions.getOneEventById(mockEventData[0].iCalUID)).toEqual(
      mockEventData[0]
    );

    sinon.restore();
  });

  // Need additional check of original id of each element to be the same.
  it('Get All Events, By OriginalId, Get 5 Elements', async () => {
    const fake = sinon.fake.resolves([
      mockEventData[0],
      mockEventData[4],
      mockEventData[5],
      mockEventData[6],
      mockEventData[7]
    ]);
    sinon.replace(EventsBlock, 'findAll', fake);

    expect(await dbEventActions.getAllEventByOriginalId(mockEventData[0].originalId)).toEqual([
      mockEventData[0],
      mockEventData[4],
      mockEventData[5],
      mockEventData[6],
      mockEventData[7]
    ]);

    sinon.restore();
  });

  // // Does not work yet as I have not added mock elements of recurringEventId in yet.
  // it('Get All Events, By RecurringEventId, Get 5 Elements', async () => {
  //   const fake = sinon.fake.resolves([
  //     mockEventData[0],
  //     mockEventData[4],
  //     mockEventData[5],
  //     mockEventData[6],
  //     mockEventData[7]
  //   ]);
  //   sinon.replace(EventsBlock, 'findAll', fake);

  //   expect(await dbEventActions.getAllEventByOriginalId(mockEventData[0].originalId)).toEqual(
  //     mockEventData[0],
  //     mockEventData[4],
  //     mockEventData[5],
  //     mockEventData[6],
  //     mockEventData[7]
  //   );

  //   sinon.restore();
  // });

  it('Inserting element, No previous (Insert)', async () => {
    const sampleData = mockEventData[0];

    const findAllFake = sinon.fake.resolves([]);
    const upsertFake = sinon.fake.resolves([]);

    sinon.replace(EventsBlock, 'findAll', findAllFake);
    sinon.replace(EventsBlock, 'upsert', upsertFake);

    expect(await dbEventActions.insertEventsIntoDatabase(sampleData)).toEqual(sampleData);
    sinon.restore();
  });

  it('Inserting element, Has previous (Update)', async () => {
    const previousSampleData = mockEventData[0];
    const updateSampleData = mockEventData[0];

    const findAllFake = sinon.fake.resolves([previousSampleData]);
    const upsertFake = sinon.fake.resolves([updateSampleData]);

    sinon.replace(EventsBlock, 'findAll', findAllFake);
    sinon.replace(EventsBlock, 'upsert', upsertFake);

    expect(await dbEventActions.insertEventsIntoDatabase(previousSampleData)).toEqual(
      updateSampleData
    );
    sinon.restore();
  });

  it('Delete element, By Id', async () => {
    const previousSampleData = mockEventData[0];

    const destroyFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'destroy', destroyFake);

    expect(await dbEventActions.deleteEventById(previousSampleData.id)).toBe(undefined);
    sinon.restore();
  });

  it('Delete element, By OriginalId', async () => {
    const previousSampleData = mockEventData[0];

    const destroyFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'destroy', destroyFake);

    expect(await dbEventActions.deleteEventByOriginalId(previousSampleData.originalId)).toBe(
      undefined
    );
    sinon.restore();
  });

  it('Delete element, By iCalUID', async () => {
    const previousSampleData = mockEventData[0];

    const destroyFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'destroy', destroyFake);

    expect(await dbEventActions.deleteEventByOriginaliCalUID(previousSampleData.iCalUID)).toBe(
      undefined
    );
    sinon.restore();
  });

  it('Delete element, By iCalUID and Start DateTime', async () => {
    const previousSampleData = mockEventData[0];

    const destroyFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'destroy', destroyFake);

    expect(
      await dbEventActions.deleteEventByiCalUIDandStartDateTime(
        previousSampleData.iCalUID,
        previousSampleData.start.dateTime
      )
    ).toBe(undefined);
    sinon.restore();
  });

  // // As previous, no recurring event id mock data yet.
  // it('Delete all recurring element, By Recurring Event Id', async () => {
  //   const previousSampleData = mockEventData[0];

  //   const destroyFake = sinon.fake.resolves([]);
  //   sinon.replace(EventsBlock, 'destroy', destroyFake);

  //   expect(
  //     await dbEventActions.deleteAllEventByRecurringEventId(
  //       previousSampleData.iCalUID,
  //       previousSampleData.start.dateTime
  //     )
  //   ).toBe(undefined);
  //   sinon.restore();
  // });

  it('Update element, By Id', async () => {
    const previousSampleData = mockEventData[0];
    const updatedSampleData = mockEventData[1];
    updatedSampleData.id = previousSampleData.id;

    const updateFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'update', updateFake);

    expect(
      await dbEventActions.updateEventById(previousSampleData.id, {
        updatedSampleData
      })
    ).toBe(undefined);
    sinon.restore();
  });

  it('Update element, By OriginalId', async () => {
    const previousSampleData = mockEventData[0];
    const updatedSampleData = mockEventData[1];
    updatedSampleData.id = previousSampleData.id;

    const updateFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'update', updateFake);

    expect(
      await dbEventActions.updateEventById(previousSampleData.originalId, {
        updatedSampleData
      })
    ).toBe(undefined);
    sinon.restore();
  });

  it('Update element, By iCalUID and Start DateTime', async () => {
    const previousSampleData = mockEventData[0];
    const updatedSampleData = mockEventData[1];
    updatedSampleData.id = previousSampleData.id;

    const updateFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'update', updateFake);

    expect(
      await dbEventActions.updateEventById(
        previousSampleData.iCalUID,
        previousSampleData.start.dateTime.id,
        {
          updatedSampleData
        }
      )
    ).toBe(undefined);
    sinon.restore();
  });

  it('Update element iCALString, By iCalUid', async () => {
    const previousSampleData = mockEventData[0];
    const updatedSampleData = mockEventData[1];
    updatedSampleData.id = previousSampleData.id;

    const updateFake = sinon.fake.resolves([]);
    sinon.replace(EventsBlock, 'update', updateFake);

    expect(
      await dbEventActions.updateEventById(previousSampleData.iCalUID, {
        iCALString: previousSampleData.iCALString
      })
    ).toBe(undefined);
    sinon.restore();
  });

  // // As previous, no recurring event id mock data yet.
  // it('Update element, By RecurringEventId', async () => {
  //   const previousSampleData = mockEventData[0];
  //   const updatedSampleData = mockEventData[1];
  //   updatedSampleData.id = previousSampleData.id;

  //   const updateFake = sinon.fake.resolves([]);
  //   sinon.replace(EventsBlock, 'update', updateFake);

  //   expect(
  //     await dbEventActions.updateEventById(previousSampleData.id, {
  //       updatedSampleData
  //     })
  //   ).toBe(undefined);
  //   sinon.restore();
  // });
});
