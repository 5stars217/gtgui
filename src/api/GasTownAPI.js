export class GasTownAPI {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json()
  }

  // Get overall town status
  async getStatus() {
    return this.request('/status')
  }

  // Get list of rigs
  async getRigs() {
    return this.request('/rigs')
  }

  // Create a new rig
  async createRig(name) {
    return this.request('/rigs', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  }

  // Clone a repo into a rig
  async cloneRepo(rigName, repo, branch = null) {
    return this.request(`/rigs/${rigName}/clone`, {
      method: 'POST',
      body: JSON.stringify({ repo, branch })
    })
  }

  // Spawn a polecat in a rig
  async spawnPolecat(rigName, polecatName = null) {
    return this.request(`/rigs/${rigName}/polecats`, {
      method: 'POST',
      body: JSON.stringify({ polecatName })
    })
  }

  // Get polecats for a rig
  async getPolecats(rigName) {
    return this.request(`/rigs/${rigName}/polecats`)
  }

  // Get convoy status
  async getConvoys() {
    return this.request('/convoys')
  }

  // Sling work to an agent
  async sling(agentId, issueId) {
    return this.request('/sling', {
      method: 'POST',
      body: JSON.stringify({ agent: agentId, issue: issueId })
    })
  }

  // Send mail
  async sendMail(to, subject, message) {
    return this.request('/mail/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, message })
    })
  }

  // Get agent's current hook
  async getHook(agentId) {
    return this.request(`/agents/${agentId}/hook`)
  }

  // Emergency stop
  async stop(agentId) {
    return this.request(`/agents/${agentId}/stop`, { method: 'POST' })
  }

  // Get costs
  async getCosts() {
    return this.request('/costs')
  }
}
