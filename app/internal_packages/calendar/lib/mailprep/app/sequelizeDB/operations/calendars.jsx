import { v4 } from 'uuid';
import Calendar from '../schemas/calendars';

// Insert calendar into database if absent.
// Update calendar if calendar is present but ctag is different
export const insertCalendar = async (owner, newCalendar) => {
  console.log(owner);
  console.log(newCalendar);
  // debugger;
  const calendar = await Calendar.findOne({
    where: {
      calendarUrl: newCalendar.url,
      ownerId: owner.personId
    }
  });

  // Calendar is found
  if (calendar) {
    // ctag unchanged means calendar unchanged
    if (newCalendar.ctag === calendar.ctag) {
      updateCalendar(newCalendar);
    }
  } else {
    console.log(`*** Creating calendar in db : ${newCalendar.displayName}`);
    delete newCalendar.account.calendars;
    delete newCalendar.objects;
    return Calendar.create({
      calendarUrl: newCalendar.url,
      ownerId: owner.personId,
      displayName: newCalendar.displayName,
      description: newCalendar.description ? newCalendar.description : '',
      color: 'blue',
      ctag: newCalendar.ctag,
      timezone: newCalendar.timezone ? newCalendar.timezone : '',
      json: JSON.stringify(newCalendar)
    });
  }
};

export const updateCalendar = async (calendar) =>
  Calendar.update(calendar, {
    where: {
      calendarUrl: calendar.calendarUrl
    }
  });

export const retrieveCalendarByOwnerId = (ownerId) =>
  Calendar.findAll({
    where: {
      ownerId
    }
  });

export const retrieveCalendarByCalendarUrl = async (calendarUrl) =>
  await Calendar.findOne({
    where: {
      calendarUrl
    }
  });


// For cascade deletes when account is removed
// Deletes all calendars under the same account
export const deleteAllCalendarsByOwner = (owner) =>
  Calendar.destroy({
    where: {
      ownerId: owner.personId
    }
  });

export const deleteCalendar = (calendar) =>
  Calendar.destroy({
    where: {
      calendarId: calendar.calendarId
    }
  });
