// this code is according to 'electron-text-substitutions'
import { remote } from 'electron';
const { systemPreferences } = remote;

const UserDefaultsTextSubstitutionsKey = 'NSUserDictionaryReplacementItems';
var TextReplacementDidChange = 'IMKTextReplacementDidChangeNotification';


export const shortCutsUtils = {
  shortcuts: [],
  refreshTextShortCuts: function () {
    if (process.platform === 'darwin') {
      shortCutsUtils.shortcuts = systemPreferences.getUserDefault(UserDefaultsTextSubstitutionsKey, 'array') || [];
    }
  },
  // this subscribe is not working
  subscribeNotification: function () {
    systemPreferences.subscribeNotification(TextReplacementDidChange, () => {
      shortCutsUtils.refreshTextShortCuts();
    });
  }
}
shortCutsUtils.refreshTextShortCuts();

function lastIndexOfWhitespace(value, fromIndex) {
  var lastIndex = 0;
  var whitespace = /\s/g;
  var textToCaret = value.substring(0, fromIndex).trimRight();

  while (whitespace.exec(textToCaret) !== null) {
    lastIndex = whitespace.lastIndex;
  }
  return lastIndex;
}

export default [
  {
    onKeyDown: function onKeyDown(event, change) {
      if (event.keyCode === 32 && shortCutsUtils.shortcuts.length > 0) {
        window.change = change;
        const offset = change.value.focusOffset;
        const focusBlock = change.value.focusBlock.text;
        var searchStartIndex = lastIndexOfWhitespace(focusBlock, offset);
        var lastWord = focusBlock.substring(searchStartIndex, offset);
        var replaceWith = null;
        for (let s of shortCutsUtils.shortcuts) {
          if (s.replace === lastWord) {
            replaceWith = s.with;
            break;
          }
        }
        if (replaceWith) {
          return change.moveOffsetsTo(searchStartIndex, offset).delete().insertText(replaceWith);
        }
      }
    },
  },
];


