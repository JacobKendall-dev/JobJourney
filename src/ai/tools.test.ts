import { describe, expect, it, vi } from 'vitest'
import { buildTools } from './tools'

describe('agent tools', () => {
  it('are read-only: no tool can create, update or delete records', () => {
    const names = Object.keys(buildTools(vi.fn()))
    expect(names.sort()).toEqual(['records_get', 'records_query', 'schema_describe', 'schema_list', 'user_current'])
    expect(names.filter((n) => /create|update|delete|remove|put/.test(n))).toEqual([])
  })
})
