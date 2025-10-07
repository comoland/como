import os from 'os'
// const os = require('os');
console.log('os module:', os);

async function main() {
  console.log('os.endianness():', os.endianness())
  console.log('os.platform():', os.platform())
  console.log('os.type():', os.type())
  console.log('os.arch():', os.arch())
  console.log('os.homedir():', os.homedir())
  console.log('os.tmpdir():', os.tmpdir())
  console.log('os.hostname():', os.hostname())
  // console.log('os.getHostname():', os.getHostname())
  console.log('os.uptime():', os.uptime())
  // console.log('os.getUptime():', os.getUptime())
  console.log('os.totalmem():', os.totalmem())
  console.log('os.freemem():', os.freemem())
  console.log('os.loadavg():', os.loadavg())
  console.log('os.cpus():', os.cpus())
  console.log('os.networkInterfaces():', os.networkInterfaces())
  console.log('os.userInfo():', os.userInfo())
  // console.log('os.getAvailableParallelism():', os.getAvailableParallelism())
  // console.log('os.getOSInformation():', os.getOSInformation())
  console.log('os.EOL (repr):', JSON.stringify(os.EOL))

  // set/get priority test (try current pid)
  try {
    const pid = process ? process.pid : undefined
    if (pid) {
      console.log('current pid:', pid)
      const old = os.getPriority(pid)
      console.log('current priority:', old)
      // don't change priority in this test to avoid permission issues
    }
  } catch (e) {
    console.log('priority test error:', e)
  }
}

main().catch(e => console.error('os_test error:', e))
