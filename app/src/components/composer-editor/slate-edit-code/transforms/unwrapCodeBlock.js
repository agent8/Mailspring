'use strict';

var getCurrentCode = require('../getCurrentCode');
var unwrapCodeBlockByKey = require('./unwrapCodeBlockByKey');

/**
 * Convert a code block to a normal block.
 * @param  {Transform} transform
 * @param  {String} type
 * @return {Transform}
 */
function unwrapCodeBlock(opts, transform, type) {
    var _transform = transform,
        state = _transform.state;


    var codeBlock = getCurrentCode(opts, state);

    if (!codeBlock) {
        return transform;
    }

    // Convert to paragraph
    transform = unwrapCodeBlockByKey(opts, transform, codeBlock.key, type);

    return transform;
}

module.exports = unwrapCodeBlock;