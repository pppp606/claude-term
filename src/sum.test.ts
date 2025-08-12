import { sum } from './sum'

describe('sum', () => {
  it('should add two positive numbers correctly', () => {
    expect(sum(2, 3)).toBe(5)
  })

  it('should add negative numbers correctly', () => {
    expect(sum(-1, -2)).toBe(-3)
  })

  it('should add positive and negative numbers correctly', () => {
    expect(sum(5, -3)).toBe(2)
  })

  it('should return 0 when adding 0 + 0', () => {
    expect(sum(0, 0)).toBe(0)
  })
})
