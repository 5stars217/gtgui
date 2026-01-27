import { test, expect } from '@playwright/test'

test.describe('Gas Town UI Interface', () => {
  // Track created test rigs for cleanup
  const createdRigs = []

  test.afterAll(async ({ request }) => {
    // Clean up all test rigs created during tests
    for (const rigName of createdRigs) {
      try {
        await request.delete(`/api/rigs/${rigName}`)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto('/')
    // Wait for Phaser game to initialize (canvas should be present)
    await page.waitForSelector('canvas', { timeout: 10000 })
    // Give the game a moment to render
    await page.waitForTimeout(2000)
  })

  test('page loads with game canvas', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('login overlay appears in dev mode', async ({ page }) => {
    // Check if dev login is visible or we're already logged in
    const devLogin = page.locator('#dev-login')
    const isLoginVisible = await devLogin.isVisible().catch(() => false)

    if (isLoginVisible) {
      await expect(devLogin).toBeVisible()
      // Should have username input
      const usernameInput = page.locator('#dev-username')
      await expect(usernameInput).toBeVisible()
    }
  })

  test('can login with dev credentials', async ({ page }) => {
    const devLogin = page.locator('#dev-login')
    const isLoginVisible = await devLogin.isVisible().catch(() => false)

    if (isLoginVisible) {
      // Enter a test username
      await page.fill('#dev-username', 'test-user')
      await page.click('#dev-login button[type="submit"]')

      // Wait for login to complete
      await page.waitForTimeout(1000)

      // Login overlay should be hidden after successful login
      await expect(devLogin).not.toBeVisible()
    }
  })

  test('API returns status', async ({ request }) => {
    const response = await request.get('/api/status')
    expect(response.ok()).toBeTruthy()

    const status = await response.json()
    expect(status).toHaveProperty('rigs')
    expect(status).toHaveProperty('polecats')
    expect(Array.isArray(status.rigs)).toBeTruthy()
  })

  test('API returns rigs list', async ({ request }) => {
    const response = await request.get('/api/rigs')
    expect(response.ok()).toBeTruthy()

    const rigs = await response.json()
    expect(Array.isArray(rigs)).toBeTruthy()
  })

  test('API returns settings', async ({ request }) => {
    const response = await request.get('/api/settings')
    expect(response.ok()).toBeTruthy()

    const settings = await response.json()
    expect(settings).toHaveProperty('stuckTokenThreshold')
    expect(settings).toHaveProperty('stuckTimeThreshold')
    expect(settings).toHaveProperty('enableSounds')
    expect(settings).toHaveProperty('enableNotifications')
  })

  test('API can update settings', async ({ request }) => {
    const newSettings = {
      stuckTokenThreshold: 30000,
      stuckTimeThreshold: 2400000  // 40 minutes
    }

    const response = await request.post('/api/settings', {
      data: newSettings
    })
    expect(response.ok()).toBeTruthy()

    const result = await response.json()
    expect(result.success).toBeTruthy()
    expect(result.settings.stuckTokenThreshold).toBe(30000)
  })

  test('API can create and delete a rig', async ({ request }) => {
    const rigName = `test-rig-${Date.now()}`
    createdRigs.push(rigName)

    // Create rig
    const createResponse = await request.post('/api/rigs', {
      data: { name: rigName }
    })
    expect(createResponse.ok()).toBeTruthy()

    const createResult = await createResponse.json()
    expect(createResult.success).toBeTruthy()
    expect(createResult.name).toBe(rigName)

    // Delete rig
    const deleteResponse = await request.delete(`/api/rigs/${rigName}`)
    expect(deleteResponse.ok()).toBeTruthy()

    const deleteResult = await deleteResponse.json()
    expect(deleteResult.success).toBeTruthy()

    // Remove from cleanup list since we already deleted it
    const idx = createdRigs.indexOf(rigName)
    if (idx > -1) createdRigs.splice(idx, 1)
  })

  test('API can spawn polecat', async ({ request }) => {
    // First create a rig
    const rigName = `test-spawn-${Date.now()}`
    createdRigs.push(rigName)
    await request.post('/api/rigs', { data: { name: rigName } })

    // Then spawn a polecat
    const response = await request.post(`/api/rigs/${rigName}/polecats`, {
      data: {}
    })
    expect(response.ok()).toBeTruthy()

    const result = await response.json()
    expect(result.success).toBeTruthy()
    expect(result.name).toBeTruthy()
  })

  test('API can sling work to agent', async ({ request }) => {
    // Create rig and polecat first
    const rigName = `test-sling-${Date.now()}`
    createdRigs.push(rigName)
    await request.post('/api/rigs', { data: { name: rigName } })
    const spawnResult = await (await request.post(`/api/rigs/${rigName}/polecats`, { data: {} })).json()

    // Sling work
    const response = await request.post('/api/sling', {
      data: {
        agent: `${rigName}/polecats/${spawnResult.name}`,
        issue: 'Test task #123'
      }
    })
    expect(response.ok()).toBeTruthy()

    const result = await response.json()
    expect(result.success).toBeTruthy()

    // Verify status changed to working
    // The agent ID format is: rigName/polecats/polecatName (URL encoded)
    const agentId = encodeURIComponent(`${rigName}/polecats/${spawnResult.name}`)
    const hookResponse = await request.get(`/api/agents/${agentId}/hook`)
    const hookResult = await hookResponse.json()
    expect(hookResult.status).toBe('working')
  })

  test('API can mark agent complete', async ({ request }) => {
    // Create rig and polecat, assign work
    const rigName = `test-complete-${Date.now()}`
    createdRigs.push(rigName)
    await request.post('/api/rigs', { data: { name: rigName } })
    const spawnResult = await (await request.post(`/api/rigs/${rigName}/polecats`, { data: {} })).json()
    await request.post('/api/sling', {
      data: {
        agent: `${rigName}/polecats/${spawnResult.name}`,
        issue: 'Test task'
      }
    })

    // Mark complete - agent ID is URL encoded path
    const agentId = encodeURIComponent(`${rigName}/polecats/${spawnResult.name}`)
    const response = await request.post(`/api/agents/${agentId}/complete`)
    expect(response.ok()).toBeTruthy()

    const result = await response.json()
    expect(result.success).toBeTruthy()

    // Verify status is now idle
    const hookResponse = await request.get(`/api/agents/${agentId}/hook`)
    const hookResult = await hookResponse.json()
    expect(hookResult.status).toBe('idle')
  })

  test('API can reassign work', async ({ request }) => {
    // Create rig and two polecats
    const rigName = `test-reassign-${Date.now()}`
    createdRigs.push(rigName)
    await request.post('/api/rigs', { data: { name: rigName } })
    const polecat1 = await (await request.post(`/api/rigs/${rigName}/polecats`, { data: { polecatName: 'worker1' } })).json()
    const polecat2 = await (await request.post(`/api/rigs/${rigName}/polecats`, { data: { polecatName: 'worker2' } })).json()

    // Assign work to first polecat
    const agent1Path = `${rigName}/polecats/${polecat1.name}`
    await request.post('/api/sling', {
      data: {
        agent: agent1Path,
        issue: 'Test reassign task'
      }
    })

    // Reassign to second polecat - use URL encoded agent IDs
    const agent1Id = encodeURIComponent(`${rigName}/polecats/${polecat1.name}`)
    const agent2Id = encodeURIComponent(`${rigName}/polecats/${polecat2.name}`)

    const response = await request.post(`/api/agents/${agent1Id}/reassign`, {
      data: {
        newAgent: `${rigName}/polecats/${polecat2.name}`,
        rig: rigName
      }
    })
    expect(response.ok()).toBeTruthy()

    const result = await response.json()
    expect(result.success).toBeTruthy()

    // Verify first polecat is idle
    const hook1 = await (await request.get(`/api/agents/${agent1Id}/hook`)).json()
    expect(hook1.status).toBe('idle')

    // Verify second polecat is working
    const hook2 = await (await request.get(`/api/agents/${agent2Id}/hook`)).json()
    expect(hook2.status).toBe('working')
  })

})
