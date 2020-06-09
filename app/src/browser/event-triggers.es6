const fs = require('fs');
const path = require('path');
const _ = require('underscore');

export default class EventTrigger {
  constructor(configDirPath) {
    this.configDirPath = configDirPath;
    this.eventTriggerFilePath = path.join(this.configDirPath, 'event-trigger.json');
    this.eventTriggerTimes = {};
    this.loadData();
    this._debounceSaveChange = _.debounce(this.saveChange, 300);
  }
  loadData() {
    try {
      if (fs.existsSync(this.eventTriggerFilePath)) {
        const fileText = fs.readFileSync(this.eventTriggerFilePath);
        if (!fileText) {
          return;
        }
        const data = JSON.parse(fileText);
        const newData = {};
        Object.keys(data).forEach(key => {
          if (typeof data[key] === 'number') {
            newData[key] = data[key];
          }
        });
        this.eventTriggerTimes = newData;
      }
    } catch (error) {
      console.error(`load event trigger time error:${error.message}`);
    }
  }
  saveChange() {
    try {
      const dataStr = JSON.stringify(this.eventTriggerTimes);
      fs.writeFileSync(this.eventTriggerFilePath, dataStr);
    } catch (error) {
      console.error(`save event trigger time error:${error.message}`);
    }
  }
  getEventTriggerTime(event) {
    return this.eventTriggerTimes[event] || 0;
  }
  eventTrigger(event) {
    if (typeof event !== 'string') {
      return;
    }
    const time = (this.eventTriggerTimes[event] || 0) + 1;
    this.eventTriggerTimes[event] = time;
    this._debounceSaveChange();
  }
}
