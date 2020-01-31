'use strict';

var getCurrentIndent = require('./getCurrentIndent');
var indentLines = require('./changes/indentLines');

/**
 * User pressed Tab in an editor:
 * Insert a tab after detecting it from code block content.
 */
function onTab(event, data, change, opts) {
    var state = change.state;

    event.preventDefault();
    event.stopPropagation();

    var isCollapsed = state.isCollapsed;

    var indent = getCurrentIndent(opts, state);

    // Selection is collapsed, we just insert an indent at cursor
    if (isCollapsed) {
        return change.insertText(indent).focus();
    }

    // We indent all selected lines
    return indentLines(opts, change, indent);
}

module.exports = onTab;