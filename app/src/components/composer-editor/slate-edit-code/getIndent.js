'use strict';

var detectIndent = require('detect-indent');
var DEFAULT_INDENTATION = '    ';

/**
 * Detect indentation in a text
 * @param {String} text
 * @param {String} defaultValue?
 * @return {String}
 */
function getIndent(text) {
  var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_INDENTATION;

  return detectIndent(text).indent || defaultValue;
}

module.exports = getIndent;