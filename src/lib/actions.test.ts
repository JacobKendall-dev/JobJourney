import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthToken = vi.fn<() => Promise<string | null>>()
vi.mock('deepspace', () => ({ getAuthToken: () => getAuthToken() }))

const { callAction } = await import('./actions')

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  getAuthToken.mockResolvedValue('token-123')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('callAction', () => {
  it('posts params with the bearer token and returns data', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: { id: 'e1' } }))

    const result = await callAction<{ id: string }>('createExperience', { outcome: 'offer' })

    expect(result).toEqual({ success: true, data: { id: 'e1' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/actions/createExperience')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-123')
    expect(init?.body).toBe(JSON.stringify({ outcome: 'offer' }))
  })

  it('refuses without a token and sends nothing', async () => {
    getAuthToken.mockResolvedValue(null)
    expect(await callAction('toggleHelpful')).toEqual({
      success: false,
      error: 'Sign in to do this.',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes the action's own refusal through", async () => {
    fetchMock.mockResolvedValue(json(200, { success: false, error: "You can't edit this experience" }))
    expect(await callAction('updateExperience')).toEqual({
      success: false,
      error: "You can't edit this experience",
      status: 200,
    })
  })

  it('reports an unknown action', async () => {
    fetchMock.mockResolvedValue(json(404, { error: 'Action not found' }))
    expect(await callAction('nope')).toMatchObject({ success: false, error: 'Action not found', status: 404 })
  })

  it('handles network failures and non-JSON replies without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await callAction('x')).toMatchObject({ success: false, error: expect.stringMatching(/reach the server/) })

    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await callAction('x')).toMatchObject({ success: false, status: 502 })
  })

  it('encodes the action name into the path', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true }))
    await callAction('../admin')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/actions/..%2Fadmin')
  })
})
