import { CALDAV_PROVIDER } from '../../constants';
import { createCaldavEvent } from './create-caldav-event-utils';

// Parameter payload contains:
//  data, --> calendar event to be added
//  providerType, --> CALDAV, EWS etc
//  auth --> auth details to push data into server
//  calendar --> calendar for event to be added
export const createEvent = async payload => {
  console.log('payload', payload.data);
  // Based off which provider
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        await createCaldavEvent(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Create feature for ${payload.providerType} not handled`);
      break;
  }
};
