'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = require('immutable'),
    Set = _require.Set,
    List = _require.List;

var Slate = require('slate');

/**
 * Create a schema for code blocks.
 * @param {Options} opts
 * @return {Object} A schema definition with normalization rules
 */
function makeSchema(opts) {
    return {
        rules: [noOrphanLine(opts), onlyLine(opts), onlyText(opts), noMarks(opts)]
    };
}

/**
 * @return {Object} A rule that ensure code lines are always children
 * of a code block.
 */
function noOrphanLine(opts) {

    return {
        // Match all blocks that are not code blocks
        match: function match(node) {
            return (node.kind === 'block' || node.kind === 'document') && node.type !== opts.containerType;
        },
        validate: function validate(node) {
            var codeLines = node.nodes.filter(function (n) {
                return n.type === opts.lineType;
            });

            if (codeLines.isEmpty()) {
                // All good
                return null;
            } else {
                // Wrap the orphan lines
                return {
                    toWrap: codeLines
                };
            }
        },


        /**
         * Wrap the given blocks in code containers
         * @param {List<Nodes>} value.toWrap
         */
        normalize: function normalize(change, node, value) {
            return value.toWrap.reduce(function (c, n) {
                return c.wrapBlockByKey(n.key, opts.containerType);
            }, change);
        }
    };
}

/**
 * @return {Object} A rule that ensure code blocks only contain lines of code, and no marks
 */
function onlyLine(opts) {
    return {
        match: function match(node) {
            return node.type === opts.containerType;
        },

        validate: function validate(node) {
            var nodes = node.nodes;


            var toWrap = [];
            var toRemove = [];

            nodes.forEach(function (child) {
                if (child.kind === 'text') toWrap.push(child);else if (child.type !== opts.lineType) toRemove.push(child);
            });

            if (toWrap.length || toRemove.length) {
                return { toWrap: toWrap, toRemove: toRemove };
            } else {
                return null;
            }
        },
        normalize: function normalize(change, node, _ref) {
            var toWrap = _ref.toWrap,
                toRemove = _ref.toRemove;

            toRemove.forEach(function (child) {
                change.removeNodeByKey(child.key);
            });

            toWrap.forEach(function (child) {
                change.wrapBlockByKey(child.key, opts.lineType);
            });

            // Also remove marks here (since the no mark rule for
            // lines will not be applied afterward).
            return applyRule(noMarks(opts), change, node.key);
        }
    };
}

/**
 * @return {Object} A rule that ensure code lines only contain one text
 * node.
 */
function onlyText(opts) {
    return {
        match: function match(node) {
            return node.type === opts.lineType;
        },

        validate: function validate(node) {
            var nodes = node.nodes;


            var toRemove = nodes.filterNot(function (n) {
                return n.kind === 'text';
            });
            if (!toRemove.isEmpty()) {
                // Remove them, and the rest
                // will be done in the next validation call.
                return { toRemove: toRemove };
            }
            // Else, there are only text nodes

            else if (nodes.size > 1) {
                    return { toJoin: nodes };
                } else if (nodes.size === 0) {
                    return { toAdd: [Slate.Text.create()] };
                } else {
                    // There is a single text node -> valid
                    return null;
                }
        },


        /**
         * Clean up the child nodes.
         */
        normalize: function normalize(change, node, _ref2) {
            var _ref2$toRemove = _ref2.toRemove,
                toRemove = _ref2$toRemove === undefined ? List() : _ref2$toRemove,
                _ref2$toAdd = _ref2.toAdd,
                toAdd = _ref2$toAdd === undefined ? List() : _ref2$toAdd,
                _ref2$toJoin = _ref2.toJoin,
                toJoin = _ref2$toJoin === undefined ? List() : _ref2$toJoin;

            // Remove invalids
            toRemove.reduce(function (c, child) {
                return c.removeNodeByKey(child.key, { normalize: false });
            }, change);

            // Join nodes.
            var pairs = toJoin.butLast().map(function (child, index) {
                return [child.key, toJoin.get(index + 1).key];
            });

            // Join every node onto the previous one.
            pairs.reverse().reduce(function (c, _ref3) {
                var _ref4 = _slicedToArray(_ref3, 2),
                    childKey = _ref4[0],
                    nextChildKey = _ref4[1];

                return c.joinNodeByKey(nextChildKey, childKey, { normalize: false });
            }, change);

            // Add missing nodes
            toAdd.reduce(function (c, child) {
                return c.insertNodeByKey(node.key, 0, child);
            }, change);

            return change;
        }
    };
}

/**
 * @return {Object} A rule that ensure code blocks contains no marks
 */
function noMarks(opts) {
    return {
        // Match at the line level, to optimize memoization
        match: function match(node) {
            return node.type === opts.lineType;
        },

        validate: function validate(node) {
            if (opts.allowMarks) return null;

            var marks = getMarks(node);

            if (marks.isEmpty()) {
                return null;
            } else {
                return {
                    removeMarks: marks
                };
            }
        },


        /**
         * Removes the given marks
         * @param {Set<Marks>} value.removeMarks
         */
        normalize: function normalize(change, node, _ref5) {
            var removeMarks = _ref5.removeMarks;

            var selection = change.state.selection;
            var range = selection.moveToRangeOf(node);

            return removeMarks.reduce(function (c, mark) {
                return c.removeMarkAtRange(range, mark);
            }, change);
        }
    };
}

/**
 * @param {Node} node
 * @return {Set<Marks>} All the marks in the node
 */
function getMarks(node) {
    var texts = node.getTexts();

    var marks = texts.reduce(function (all, text) {
        return text.characters.reduce(function (accu, chars) {
            return accu.union(chars.marks);
        }, all);
    }, new Set());

    return marks;
}

/**
 * Apply a normalization rule to a node
 * @param {Rule} rule
 * @param {Change} change
 * @param {String} key
 * @return {Change}
 */
function applyRule(rule, change, key) {
    var node = change.state.document.getDescendant(key);
    var notValid = rule.validate(node);
    if (notValid) {
        rule.normalize(change, node, notValid);
    }

    return change;
}

module.exports = makeSchema;