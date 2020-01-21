"use strict";

/**
 * User pressed Mod+Enter in an editor
 * Exit the current code block
 */
function onModEnter(event, data, change, opts) {
    var state = change.state;

    if (!state.isCollapsed) {
        return;
    }

    event.preventDefault();

    // Exit the code block
    return opts.onExit(change, opts);
}

module.exports = onModEnter;