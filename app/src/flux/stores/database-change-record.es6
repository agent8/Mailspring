/*
DatabaseChangeRecord is the object emitted from the DatabaseStore when it triggers.
The DatabaseChangeRecord contains information about what type of model changed,
and references to the new model values. All mutations to the database produce these
change records.
*/
export default class DatabaseChangeRecord {
  constructor({ type, objectClass, objects, processAccountId }) {
    this.objects = objects;
    this.type = type;
    this.objectClass = objectClass;
    this.processAccountId = processAccountId;
  }

  toJSON() {
    let objectString = '';
    try{
      objectString = JSON.stringify(this.objects);
    } catch (e){

    }
    return {
      type: this.type,
      objectClass: this.objectClass,
      objectsString: objectString,
      processAccountId: this.processAccountId
    };
  }
}
