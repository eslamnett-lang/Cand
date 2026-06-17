// Unit tests for core/summarizer.js (Node only)
const assert = require('assert');
const Summarizer = require('../../core/summarizer.js');

const rowsById = new Map([
  [1, { _id: 1, totalFee: '10', freeUnitConsumed: '3' }],
  [2, { _id: 2, totalFee: '20.50', freeUnitConsumed: '2' }],
  [3, { _id: 3, totalFee: '100', totalPromotionalFee: '7', freeUnitConsumed: '0' }],
]);

let res = Summarizer.compute({
  selectedIds: new Set([1, 2]),
  rowById: (id) => rowsById.get(id),
  keys: { feeKey: 'totalFee', unitsKey: 'freeUnitConsumed' },
  filterKey: 'ALL'
});

assert.equal(res.selectedCount, 2);
assert.equal(res.totalFee, 30.5);
assert.equal(res.totalUnits, 5);

res = Summarizer.compute({
  selectedIds: new Set([3]),
  rowById: (id) => rowsById.get(id),
  keys: { feeKey: 'totalFee', promoFeeKey: 'totalPromotionalFee', unitsKey: 'freeUnitConsumed' },
  filterKey: 'BONUS'
});
assert.equal(res.totalFee, 7);

console.log('OK: test_summarizer');
