'use strict';

var wrapCodeBlockByKey = require('./wrapCodeBlockByKey');

/**
 * Wrap current block into a code block.
 * @param  {Transform} transform
 * @return {Transform}
 */
function wrapCodeBlock(opts, transform) {
    var _transform = transform,
        state = _transform.state;
    var startBlock = state.startBlock,
        selection = state.selection;

    // Convert to code block

    transform = wrapCodeBlockByKey(opts, transform, startBlock.key);

    // Move selection back in the block
    transform = transform.collapseToStartOf(transform.state.document.getDescendant(startBlock.key)).moveOffsetsTo(selection.startOffset);

    return transform;
}

module.exports = wrapCodeBlock;