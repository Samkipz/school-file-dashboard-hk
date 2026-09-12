import { describe, expect, it } from 'vitest'
import { cn } from '../../lib/utils'

describe('cn', () => {
  it('combines conditional classes and lets the caller override conflicting utilities', () => {
    expect(cn('px-2 text-sm', false, { hidden: false, 'font-medium': true }, 'px-4'))
      .toBe('text-sm font-medium px-4')
  })
})
