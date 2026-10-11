import { pageList } from './pager';

describe('pageList', () => {
  it('shows every page when there are few', () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(2, 3)).toEqual([1, 2, 3]);
    expect(pageList(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shortens long runs with … (0) around the current page', () => {
    expect(pageList(1, 12)).toEqual([1, 2, 3, 4, 5, 0, 12]);
    expect(pageList(5, 12)).toEqual([1, 0, 4, 5, 6, 0, 12]);
    expect(pageList(12, 12)).toEqual([1, 0, 8, 9, 10, 11, 12]);
  });
});
