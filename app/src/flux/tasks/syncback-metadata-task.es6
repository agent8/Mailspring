import Task from './task';
import Attributes from '../attributes';

export default class SyncbackMetadataTask extends Task {
  static forSaving({ model, pluginId, value, undoValue, ...others }) {
    if (!pluginId) {
      throw new Error('SyncbackMetadataTask.forSaving: You must specify a pluginId.');
    }
    const task = new SyncbackMetadataTask({
      modelId: model.id,
      pluginId: pluginId,
      modelClassName: model.constructor.name.toLowerCase(),
      modelMessageId: model.id || null,
      modelThreadId: model.threadId || null,
      accountId: model.accountId,
      value,
      undoValue,
      ...others,
    });

    if (value && value.expiration) {
      const ts = new Date(value.expiration).getTime();
      task.value.expiration = Math.round(ts > 1000000000000 ? ts / 1000 : ts);
    }
    if (undoValue && undoValue.expiration) {
      const ts = new Date(undoValue.expiration).getTime();
      task.undoValue.expiration = Math.round(ts > 1000000000000 ? ts / 1000 : ts);
    }

    return task;
  }

  static attributes = Object.assign({}, Task.attributes, {
    pluginId: Attributes.String({
      modelKey: 'pluginId',
    }),
    modelId: Attributes.String({
      modelKey: 'modelId',
    }),
    modelClassName: Attributes.String({
      modelKey: 'modelClassName',
    }),
    modelMessageId: Attributes.String({
      modelKey: 'modelMessageId',
    }),
    modelThreadId: Attributes.String({
      modelKey: 'modelThreadId',
    }),
    value: Attributes.Object({
      modelKey: 'value',
    }),
    undoValue: Attributes.Object({
      modelKey: 'undoValue',
    }),
    delayedTasks: Attributes.Collection({
      delayedTasks: 'delayedTasks',
    }),
    delayTimeoutCallback: Attributes.Object({
      modelKey: 'delayTimeoutCallback',
    }),
    taskPurged: Attributes.Object({
      modelKey: 'taskPurged',
    }),
  });

  get canBeUndone() {
    return !!this.undoValue;
  }

  description() {
    return null;
  }

  createUndoTask() {
    const task = this.createIdenticalTask();
    const { value, undoValue } = task;
    task.value = undoValue;
    task.undoValue = value;
    return task;
  }
}
