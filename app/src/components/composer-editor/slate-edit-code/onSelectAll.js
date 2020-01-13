'use strict';

var getCurrentCode = require('./getCurrentCode');

/**
 * User is Cmd+A to select all text
 */
function onSelectAll(event, data, change, opts) {
    var state = change.state;

    event.preventDefault();

    var currentCode = getCurrentCode(opts, state);
    return change.collapseToStartOf(currentCode.getFirstText()).extendToEndOf(currentCode.getLastText());
}

module.exports = onSelectAll;