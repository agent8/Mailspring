import { from, iif, of, timer, interval, throwError } from 'rxjs';
import moment from 'moment';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';

import { getUserEvents, getAccessToken, filterEventToOutlook } from '../../utils/client/outlook';
import { getEventsSuccess, getEventsFailure } from '../../actions/events';
import { GET_OUTLOOK_EVENTS_BEGIN } from '../../actions/providers/outlook';
import * as Providers from '../../utils/constants';

// #region Outlook Epics
// eslint-disable-next-line import/prefer-default-export
export const beginGetOutlookEventsEpics = (action$) =>
  action$.pipe(
    ofType(GET_OUTLOOK_EVENTS_BEGIN),
    mergeMap((action) =>
      from(
        new Promise((resolve, reject) => {
          if (action.payload === undefined) {
            reject(getEventsFailure('Outlook user undefined!!'));
          }

          console.log('Outlook Performing full sync', action);
          getUserEvents(
            action.payload.accessToken,
            action.payload.accessTokenExpiry,
            (events, error) => {
              if (error) {
                console.error(error);
                return;
              }

              resolve(events);
            }
          );
        })
      ).pipe(
        map((resp) => getEventsSuccess(resp, Providers.OUTLOOK, action.payload.email)),
        catchError((error) => of(error))
      )
    )
  );
// #endregion
