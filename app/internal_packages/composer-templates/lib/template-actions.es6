import Reflux from 'reflux';

const TemplateActions = Reflux.createActions([
  'addTemplate',
  'updateTemplate',
  'removeTemplate',
  'showTemplates',
  'insertTemplateToMessage',
  'createTemplateByMessage',
]);

for (const key of Object.keys(TemplateActions)) {
  TemplateActions[key].sync = true;
}

export default TemplateActions;
