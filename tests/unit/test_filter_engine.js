// Unit tests for core/filter_engine.js (Node only)
const assert = require('assert');
const FilterEngine = require('../../core/filter_engine.js');

function row(id, deductFrom) {
  return { _id: id, deductFrom };
}

// Normalization
assert.equal(FilterEngine.normDeduct('  Bonus  '), 'bonus');
assert.equal(FilterEngine.normDeduct(null), '');

const rows = [
  row(1, 'Balance'),
  row(2, 'FREE UNIT'),
  row(3, 'bonus'),
  row(4, 'bonus/free unit'),
  row(5, 'free balance'), // junk (contains both balance and free)
  row(6, ''),
];

// matchesFilter semantics
assert.equal(FilterEngine.matchesFilter('ALL', rows[0]), true);
assert.equal(FilterEngine.matchesFilter('BALANCE', rows[0]), true);
assert.equal(FilterEngine.matchesFilter('BALANCE', rows[1]), false);
assert.equal(FilterEngine.matchesFilter('UNITS', rows[1]), true);
assert.equal(FilterEngine.matchesFilter('BONUS', rows[2]), true);
assert.equal(FilterEngine.matchesFilter('JUNK', rows[3]), true);

// apply semantics
assert.deepEqual(FilterEngine.apply('ALL', rows).map(r => r._id), [1,2,3,4,5,6]);
assert.deepEqual(FilterEngine.apply('BALANCE', rows).map(r => r._id), [1]);
assert.deepEqual(FilterEngine.apply('UNITS', rows).map(r => r._id), [2,4]);
assert.deepEqual(FilterEngine.apply('BONUS', rows).map(r => r._id), [3]);
assert.deepEqual(FilterEngine.apply('JUNK', rows).map(r => r._id), [4,5]);

console.log('test_filter_engine: ok');
