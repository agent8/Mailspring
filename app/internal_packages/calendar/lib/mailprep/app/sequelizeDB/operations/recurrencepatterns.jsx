import { Op } from 'sequelize';
import RecurrencePatternsBlock from '../schemas/recurrencePatterns';

export const getOneRpByiCalUID = async (iCalUID) => {
  const debug = true;

  const rp = await RecurrencePatternsBlock.findOne({
    where: {
      iCalUID: {
        [Op.eq]: iCalUID
      }
    }
  });
  if (rp !== null && rp !== undefined) {
    if (typeof rp.exDates === 'number') {
      rp.exDates = rp.exDates.toString();
    }
    if (typeof rp.recurrenceIds === 'number') {
      rp.recurrenceIds = rp.recurrenceIds.toString();
    }
  }
  return rp;
};

export const getOneRpByOId = async (originalId) => {
  const debug = true;

  const rp = await RecurrencePatternsBlock.findOne({
    where: {
      originalId: {
        [Op.eq]: originalId
      }
    }
  });
  if (rp !== null && rp !== undefined) {
    if (typeof rp.exDates === 'number') {
      rp.exDates = rp.exDates.toString();
    }
    if (typeof rp.recurrenceIds === 'number') {
      rp.recurrenceIds = rp.recurrenceIds.toString();
    }
  }
  return rp;
};

export const getAllRp = async (iCalUID) => {
  const rps = await RecurrencePatternsBlock.findAll();
  rps.map((rp) => {
    if (typeof rp.exDates === 'number') {
      rp.exDates = rp.exDates.toString();
    }
    if (typeof rp.recurrenceIds === 'number') {
      rp.recurrenceIds = rp.recurrenceIds.toString();
    }
    return rp;
  });
  return rps;
};

export const addExDateByiCalUID = async (iCalUID, date) => {
  const pastRp = await getOneRpByiCalUID(iCalUID);
  const exDateSet = new Set(pastRp.exDates.split(',').filter((e) => e !== ''));

  if (!exDateSet.has(date)) {
    exDateSet.add(date);
    const exDates = Array.from(exDateSet).join(',');
    await RecurrencePatternsBlock.update(
      { exDates },
      {
        where: {
          iCalUID: {
            [Op.eq]: iCalUID
          }
        }
      }
    );
  }
};

export const addExDateByOid = async (originalId, date) => {
  const pastRp = await getOneRpByOId(originalId);
  if (pastRp.exDates === undefined || pastRp.exDates === null) {
    pastRp.exDates = '';
  } else if (typeof pastRp.exDates === 'number') {
    pastRp.exDates = pastRp.exDates.toString();
  }
  const exDateSet = new Set(pastRp.exDates.split(',').filter((e) => e !== ''));

  if (!exDateSet.has(date)) {
    exDateSet.add(date);
    const exDates = Array.from(exDateSet).join(',');
    await RecurrencePatternsBlock.update(
      { exDates },
      {
        where: {
          originalId: {
            [Op.eq]: originalId
          }
        }
      }
    );
  }
};

export const addRecurrenceIdsByiCalUID = async (iCalUID, date) => {
  const pastRp = await getOneRpByiCalUID(iCalUID);
  // debugger;
  if (pastRp.recurrenceIds === undefined || pastRp.recurrenceIds === null) {
    pastRp.recurrenceIds = '';
  } else if (typeof pastRp.recurrenceIds === 'number') {
    pastRp.recurrenceIds = pastRp.recurrenceIds.toString();
  }
  const recurrenceIdsSet = new Set(pastRp.recurrenceIds.split(',').filter((e) => e !== ''));

  if (!recurrenceIdsSet.has(date)) {
    recurrenceIdsSet.add(date);
    const recurrenceIds = Array.from(recurrenceIdsSet).join(',');
    await RecurrencePatternsBlock.update(
      { recurrenceIds },
      {
        where: {
          iCalUID: {
            [Op.eq]: iCalUID
          }
        }
      }
    );
  }
};

export const addRecurrenceIdsByOid = async (originalId, date) => {
  const pastRp = await getOneRpByOId(originalId);
  const recurrenceIdsSet = new Set(pastRp.recurrenceIds.split(',').filter((e) => e !== ''));

  if (!recurrenceIdsSet.has(date)) {
    recurrenceIdsSet.add(date);
    const recurrenceIds = Array.from(recurrenceIdsSet).join(',');
    await RecurrencePatternsBlock.update(
      { recurrenceIds },
      {
        where: {
          originalId: {
            [Op.eq]: originalId
          }
        }
      }
    );
  }
};

export const deleteRpByiCalUID = async (iCalUID) => {
  const debug = true;

  RecurrencePatternsBlock.destroy({
    where: {
      iCalUID: {
        [Op.eq]: iCalUID
      }
    }
  });
};

export const deleteRpByOid = async (originalId) => {
  const debug = true;

  RecurrencePatternsBlock.destroy({
    where: {
      originalId: {
        [Op.eq]: originalId
      }
    }
  });
};

// #region Update Event
export const updateRpByOid = async (originalId, data) => {
  const debug = true;

  await RecurrencePatternsBlock.update(data, {
    where: {
      originalId: {
        [Op.eq]: originalId
      }
    }
  });
};

export const updateRpByiCalUID = async (iCalUID, data) => {
  const debug = true;

  await RecurrencePatternsBlock.update(data, {
    where: {
      iCalUID: {
        [Op.eq]: iCalUID
      }
    }
  });
};

export const insertOrUpdateRp = async (rp) => {
  const debug = false;
  if (debug) {
    console.log(rp);
  }
  const dbRps = await RecurrencePatternsBlock.findAll({
    where: {
      iCalUID: {
        [Op.eq]: rp.iCalUID
      }
    }
  });

  if (dbRps.length === 0) {
    if (debug) {
      console.log('(Log) No Event found, Upserting');
    }

    await RecurrencePatternsBlock.upsert(rp);
  } else if (dbRps.length === 1) {
    if (debug) {
      console.log('(Log) Found Event of ', dbRps, ', Updating');
    }

    rp.id = dbRps[0].id;
    await RecurrencePatternsBlock.update(rp, {
      where: {
        id: {
          [Op.eq]: dbRps[0].id
        }
      }
    });
  } else {
    console.log('(Error) Duplicate Recurrence pattern in the database');
  }
  return rp;
};
