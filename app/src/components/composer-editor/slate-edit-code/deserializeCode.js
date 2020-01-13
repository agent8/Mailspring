'use strict';

var _require = require('slate'),
    Block = _require.Block,
    Text = _require.Text;

var _require2 = require('immutable'),
    List = _require2.List;

var detectNewline = require('detect-newline');

var DEFAULT_NEWLINE = '\n';

/**
 * Deserialize a text into a code block
 * @param {Option} opts
 * @param {String} text
 * @return {Block}
 */
function deserializeCode(opts, text) {
    var sep = detectNewline(text) || DEFAULT_NEWLINE;

    var lines = List(text.split(sep)).map(function (line) {
        return Block.create({
            type: opts.lineType,
            nodes: [Text.create(line)]
        });
    });

    var code = Block.create({
        type: opts.containerType,
        nodes: lines
    });

    return code;
}

module.exports = deserializeCode;