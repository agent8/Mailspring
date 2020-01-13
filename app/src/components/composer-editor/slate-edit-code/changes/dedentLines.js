'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

require('slate');

var _immutable = require('immutable');

// Return the index of the first character that differs between both string, or
// the smallest string length otherwise.
function firstDifferentCharacter(a, b) {
    if (a.length > b.length) {
        return firstDifferentCharacter(b, a);
    }

    var index = (0, _immutable.Range)(0, a.length).find(function (i) {
        return a[i] !== b[i];
    });

    return index == null ? a.length : index;
}

/**
 * Dedent all lines in selection
 */
function dedentLines(opts, change,
    // Indent to remove
    indent) {
    var value = change.value;
    var document = value.document,
        selection = value.selection;

    var lines = document.getBlocksAtRange(selection).filter(function (node) {
        return node.type === opts.lineType;
    });

    return lines.reduce(function (c, line) {
        // Remove a level of indent from the start of line
        var textNode = line.nodes.first();
        var lengthToRemove = firstDifferentCharacter(textNode.text.replace(/\u00A0/g, ' '), indent);
        lengthToRemove = lengthToRemove >= 4 ? 4 : lengthToRemove;
        return c.removeTextByKey(textNode.key, 0, lengthToRemove);
    }, change);
}

exports.default = dedentLines;