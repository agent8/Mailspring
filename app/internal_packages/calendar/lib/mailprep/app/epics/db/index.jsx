import * as authEpics from './auth';
import * as eventPersonsEpics from './eventPersons';
import * as eventEpics from './events';

export default {
  ...authEpics,
  ...eventPersonsEpics,
  ...eventEpics
};
