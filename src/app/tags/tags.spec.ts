import { tagsByGroup } from './tags';

it('groups a trade’s tags by tag group, keeping empty groups', () => {
  const groups = [
    {
      id: 1,
      name: 'Setup',
      tags: [
        { id: 10, name: 'IFVG' },
        { id: 11, name: 'SMT' },
      ],
    },
    { id: 2, name: 'News', tags: [{ id: 20, name: 'CPI' }] },
  ];
  expect(tagsByGroup(groups, [11])).toEqual([
    { name: 'Setup', tags: [{ id: 11, name: 'SMT' }] },
    { name: 'News', tags: [] },
  ]);
  expect(tagsByGroup(groups, undefined)[0].tags).toEqual([]);
});
