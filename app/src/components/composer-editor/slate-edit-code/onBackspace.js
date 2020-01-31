'use strict';

var endsWith = require('ends-with');

var getCurrentIndent = require('./getCurrentIndent');
var getCurrentCode = require('./getCurrentCode');

/**
 * User pressed Delete in an editor:
 * Remove last idnentation before cursor
 */
function onBackspace(event, data, change, opts) {
    var state = change.state;

    if (state.isExpanded) {
        return;
    }

    var startOffset = state.startOffset,
        startText = state.startText;


    var currentLine = state.startBlock;

    // Detect and remove indentation at cursor
    var indent = getCurrentIndent(opts, state);
    var beforeSelection = currentLine.text.slice(0, startOffset);

    // If the line before selection ending with the indentation?
    if (endsWith(beforeSelection, indent)) {
        // Remove indent
        event.preventDefault();

        return change.deleteBackward(indent.length).focus();
    }

    // Otherwise check if we are in an empty code container...
    else if (opts.exitBlockType) {
            var currentCode = getCurrentCode(opts, state);
            var isStartOfCode = startOffset === 0 && currentCode.getFirstText() === startText;
            // PERF: avoid checking for whole currentCode.text
            var isEmpty = currentCode.nodes.size === 1 && currentLine.text.length === 0;

            if (isStartOfCode && isEmpty) {

                event.preventDefault();
                // Convert it to default exit type
                return change.setBlock(opts.exitBlockType).unwrapNodeByKey(currentLine.key);
            }
        }
}

module.exports = onBackspace;