import { map, mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { from } from 'rxjs';
import uuidv4 from 'uuid';
import { successStoreEventPerson, failureStoreEventPerson } from '../../actions/db/eventPerson';
import { SUCCESS_STORED_EVENTS } from '../../actions/db/events';

const storeEventPersonEpic = (action$) =>
  action$.pipe(
    // ofType(SUCCESS_STORED_EVENTS),
    ofType(),
    mergeMap((action) =>
      from(storeEventPerson(action.payload)).pipe(
        map((resp) => successStoreEventPerson()),
        catchError((error) => failureStoreEventPerson())
      )
    )
  );

const storeEventPerson = async (payload) => {
  // const db = await getDb();
  // return payload.forEach(async (attendee) => {
  //   if (attendee !== undefined) {
  //     try {
  //       await db.eventpersons.upsert({
  //         eventPersonId: uuidv4(),
  //         eventId: attendee.id,
  //         personId: attendee.email
  //       });
  //     } catch (e) {
  //       return e;
  //     }
  //   }
  // });
};

export default storeEventPersonEpic;
