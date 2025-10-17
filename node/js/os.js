import { endianness, platform, type as osType, arch, homedir, tmpdir, hostname, uptime, getUptime, totalmem, freemem, loadavg, cpus, networkInterfaces, userInfo, setPriority, getPriority, getAvailableParallelism, getOSInformation, EOL } from 'os.go';

const exports = {
    endianness: () => endianness(),
    platform: () => platform(),
    type: () => osType(),
    arch: () => arch(),
    homedir: () => homedir(),
    tmpdir: () => tmpdir(),
    hostname: () => hostname(),
    uptime: () => uptime(),
    getUptime: () => getUptime(),
    totalmem: () => totalmem(),
    freemem: () => freemem(),
    loadavg: () => loadavg(),
    cpus: () => cpus(),
    networkInterfaces: () => networkInterfaces(),
    userInfo: () => userInfo(),
    setPriority: (pid, prio) => setPriority(pid, prio),
    getPriority: pid => getPriority(pid),
    getAvailableParallelism: () => getAvailableParallelism(),
    getOSInformation: () => getOSInformation(),
    EOL: EOL()
};

export default exports;
export {
    endianness,
    platform,
    osType as type,
    arch,
    homedir,
    tmpdir,
    hostname,
    uptime,
    getUptime,
    totalmem,
    freemem,
    loadavg,
    cpus,
    networkInterfaces,
    userInfo,
    setPriority,
    getPriority,
    getAvailableParallelism,
    getOSInformation,
    EOL
};
