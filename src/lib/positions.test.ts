import { describe, expect, it } from 'vitest'
import { validateNewPosition } from './positions'

describe('validateNewPosition', () => {
  it('tidies the title', () => {
    expect(validateNewPosition({ title: '  Data   Intern ', level: 'intern', category: 'data' })).toEqual({
      ok: true,
      fields: { title: 'Data Intern', level: 'intern', category: 'data' },
    })
  })

  it('reports each problem', () => {
    const result = validateNewPosition({ title: 'x', level: 'boss', category: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['category', 'level', 'title'])
  })
})
