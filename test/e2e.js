import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdir } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const screenshotDir = join(__dirname, 'screenshots')

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runE2ETest() {
  console.log('🎮 Gas Town UI E2E Test\n')

  // Create screenshot directory
  await mkdir(screenshotDir, { recursive: true })

  // Start dev server
  console.log('1. Starting dev server...')
  const server = spawn('npm', ['run', 'dev'], {
    cwd: join(__dirname, '..'),
    stdio: 'pipe'
  })

  let serverUrl = null

  // Wait for server to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 30000)

    server.stdout.on('data', (data) => {
      const output = data.toString()
      const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/)
      if (match) {
        serverUrl = match[1]
        clearTimeout(timeout)
        resolve()
      }
    })

    server.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString())
    })
  })

  console.log(`   ✓ Server running at ${serverUrl}\n`)

  // Launch browser
  console.log('2. Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })
  console.log('   ✓ Browser launched\n')

  // Collect console logs and errors
  const consoleLogs = []
  const errors = []

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() })
  })

  page.on('pageerror', err => {
    errors.push(err.message)
  })

  // Navigate to game
  console.log('3. Loading game...')
  await page.goto(serverUrl, { waitUntil: 'networkidle0', timeout: 30000 })
  console.log('   ✓ Page loaded\n')

  // Wait for Phaser to initialize
  console.log('4. Waiting for Phaser to initialize...')
  await sleep(3000) // Give Phaser time to render

  // Take initial screenshot
  const screenshot1 = join(screenshotDir, '01-initial-load.png')
  await page.screenshot({ path: screenshot1 })
  console.log(`   ✓ Screenshot: ${screenshot1}\n`)

  // Check if canvas exists
  console.log('5. Verifying game elements...')
  const canvas = await page.$('canvas')
  if (canvas) {
    console.log('   ✓ Canvas element found')
  } else {
    console.log('   ✗ Canvas element NOT found')
    errors.push('Canvas not found')
  }

  // Check canvas dimensions
  const canvasSize = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? { width: c.width, height: c.height } : null
  })
  if (canvasSize) {
    console.log(`   ✓ Canvas size: ${canvasSize.width}x${canvasSize.height}`)
  }

  // Wait a bit more for game to fully render
  await sleep(2000)

  // Take screenshot after game initialization
  const screenshot2 = join(screenshotDir, '02-game-rendered.png')
  await page.screenshot({ path: screenshot2 })
  console.log(`   ✓ Screenshot: ${screenshot2}\n`)

  // Test keyboard controls (pan camera with WASD)
  console.log('6. Testing controls...')
  await page.keyboard.press('KeyD') // Pan right
  await sleep(500)
  await page.keyboard.press('KeyD')
  await sleep(500)
  await page.keyboard.press('KeyS') // Pan down
  await sleep(500)

  const screenshot3 = join(screenshotDir, '03-after-pan.png')
  await page.screenshot({ path: screenshot3 })
  console.log(`   ✓ Screenshot after panning: ${screenshot3}\n`)

  // Test zoom with mouse wheel
  await page.mouse.move(640, 360)
  await page.mouse.wheel({ deltaY: -200 }) // Zoom in
  await sleep(500)

  const screenshot4 = join(screenshotDir, '04-zoomed-in.png')
  await page.screenshot({ path: screenshot4 })
  console.log(`   ✓ Screenshot zoomed in: ${screenshot4}\n`)

  // Test click selection
  console.log('7. Testing selection...')
  await page.mouse.click(640, 360)
  await sleep(300)

  const screenshot5 = join(screenshotDir, '05-after-click.png')
  await page.screenshot({ path: screenshot5 })
  console.log(`   ✓ Screenshot after click: ${screenshot5}\n`)

  // Summary
  console.log('=' .repeat(50))
  console.log('TEST RESULTS')
  console.log('=' .repeat(50))

  console.log(`\nConsole messages: ${consoleLogs.length}`)
  const jsErrors = consoleLogs.filter(l => l.type === 'error')
  if (jsErrors.length > 0) {
    console.log('JS Errors:')
    jsErrors.forEach(e => console.log(`  - ${e.text}`))
  }

  if (errors.length > 0) {
    console.log(`\n❌ Page errors: ${errors.length}`)
    errors.forEach(e => console.log(`  - ${e}`))
  } else {
    console.log('\n✓ No page errors')
  }

  console.log(`\nScreenshots saved to: ${screenshotDir}`)
  console.log('\nFiles:')
  console.log('  - 01-initial-load.png')
  console.log('  - 02-game-rendered.png')
  console.log('  - 03-after-pan.png')
  console.log('  - 04-zoomed-in.png')
  console.log('  - 05-after-click.png')

  // Cleanup
  await browser.close()
  server.kill()

  const success = errors.length === 0 && canvas !== null
  console.log(`\n${success ? '✅ E2E TEST PASSED' : '❌ E2E TEST FAILED'}`)

  process.exit(success ? 0 : 1)
}

runE2ETest().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
