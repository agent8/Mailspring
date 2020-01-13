'use strict';

var getIndent = require('./getIndent');

/**
 * User pressed Enter in an editor:
 * Insert a new code line and start it with the indentation from previous line
 */
function onEnter(event, data, change, opts) {
    var state = change.state;

    if (!state.isCollapsed) {
        return;
    }

    event.preventDefault();

    var startBlock = state.startBlock;

    var currentLineText = startBlock.text;
    var indent = getIndent(currentLineText, '');

    return change.splitBlock().insertText(indent).focus();
}

module.exports = onEnter;