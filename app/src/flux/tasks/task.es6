/* eslint no-unused-vars: 0*/
import _ from 'underscore';
import Model from '../models/model';
import Attributes from '../attributes';
import { generateTempId } from '../models/utils';
import { PermanentErrorCodes } from '../mailspring-api-request';

const Status = {
  Local: 0,
  Remote: 1,
  Complete: 2,
  Cancelled: 3,
};

export default class Task extends Model {
  static Status = Status;
  static SubclassesUseModelTable = Task;
  static passAsIs = true;
  static mappingFunc = {};

  static attributes = Object.assign({}, Model.attributes, {
    // version: Attributes.String({
    //   queryable: false,
    //   jsonKey: 'v',
    //   modelKey: 'version',
    // }),
    status: Attributes.Number({
      modelKey: 'state',
    }),
    result: Attributes.Number({
      modelKey: 'result',
    }),
    source: Attributes.String({
      modelKey: 'source',
      queryable: false,
      loadFromColumn: false,
    }),
    error: Attributes.Object({
      modelKey: 'error',
      queryable: false,
      loadFromColumn: false,
    }),
    needToBroadcastBeforeSendTask: Attributes.Object({
      modelKey: 'needToBroadcastBeforeSendTask',
      queryable: false,
      loadFromColumn: false,
    }),
    lingerAfterTimeout: Attributes.Boolean({
      modelKey: 'lingerAfterTimeout',
      queryable: false,
      loadFromColumn: false,
    }),
    priority: Attributes.Number({
      modelKey: 'priority',
      queryable: false,
      loadFromColumn: false,
    }),
    createdAt: Attributes.DateTime({
      modelKey: 'createdAt',
      loadFromColumn: true,
      queryable: true,
    }),
    undoDelay: Attributes.Number({
      modelKey: 'undoDelay',
      queryable: false,
      loadFromColumn: false,
    }),
  });

  // Public: Override the constructor to pass initial args to your Task and
  // initialize instance variables.
  //
  // **IMPORTANT:** if (you override the constructor, be sure to call)
  // `super`.
  //
  // On construction, all Tasks instances are given a unique `id`.
  constructor(data) {
    super(data);
    this.status = this.status || Status.Local;
    this.id = this.id || generateTempId();
    this.createdAt = Date.now();
    this.undoDelay = AppEnv.config.get('core.task.delayInMs');
    this.source = (data || {}).source;
  }

  // Public: Override to raise exceptions if your task is missing required
  // arguments or perform client-side business logic.
  willBeQueued() {}

  // Public: Return from `createIdenticalTask` and set a flag so your
  // `performLocal` and `performRemote` methods know that this is an undo
  // task.
  createUndoTask() {
    throw new Error('Unimplemented');
  }

  // Public: Return a deep-cloned task to be used for an undo task
  createIdenticalTask() {
    const json = this.toJSON();
    delete json.status;
    delete json.version;
    delete json.id;
    return new this.constructor(json);
  }

  // Public: code to run if (someone tries to dequeue your task while it is)
  // in flight.
  //
  cancel() {}

  // Public: (optional) A string displayed to users when your task is run.
  //
  // When tasks are run, we automatically display a notification to users
  // of the form "label (numberOfImpactedItems)". if (this does not a return)
  // a string, no notification is displayed
  label() {}

  // Public: A string displayed to users indicating how many items your
  // task affected.
  numberOfImpactedItems() {
    return 1;
  }

  onError(err) {
    // noop
  }

  onCancelled() {
    // noop
  }

  onSuccess() {
    // noop
  }
  description() {
    // noop
  }
}
