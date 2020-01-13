'use strict';

var getIndent = require('./getIndent');
var getCurrentCode = require('./getCurrentCode');

/**
 * Detect indentation in the current code block
 * @param {Options} opts
 * @param {State} state
 * @return {String}
 */
function getCurrentIndent(opts, state) {
  var currentCode = getCurrentCode(opts, state);
  var text = currentCode.getTexts().map(function (t) {
    return t.text;
  }).join('\n');
  return getIndent(text);
}

module.exports = getCurrentIndent;