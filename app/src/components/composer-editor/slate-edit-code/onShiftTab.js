'use strict';

var getCurrentIndent = require('./getCurrentIndent');
var dedentLines = require('./changes/dedentLines');

/**
 * User pressed Shift+Tab in an editor:
 * Reduce indentation in the selected lines.
 */
function onShiftTab(event, data, change, opts) {
    var state = change.state;

    event.preventDefault();
    event.stopPropagation();

    var indent = getCurrentIndent(opts, state);

    // We dedent all selected lines
    return dedentLines(opts, change, indent);
}

module.exports = onShiftTab;