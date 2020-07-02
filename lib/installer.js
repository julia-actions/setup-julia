"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optOutOfPkgTelemetry = exports.installJulia = exports.getJuliaVersion = exports.juliaVersions = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const tc = __importStar(require("@actions/tool-cache"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
// Store information about the environment
const osPlat = os.platform(); // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`);
// This is temporary until we have a better way of fetching releases (see #1, #4 for details)
exports.juliaVersions = ['v1.5.0-rc1', 'v1.5.0-beta1', 'v1.4.2', 'v1.4.1', 'v1.4.0', 'v1.4.0-rc2', 'v1.4.0-rc1', 'v1.3.1', 'v1.3.0', 'v1.3.0-rc5', 'v1.3.0-rc4', 'v1.3.0-rc3', 'v1.3.0-rc2', 'v1.0.5', 'v1.2.0', 'v1.3.0-rc1', 'v1.2.0-rc3', 'v1.3.0-alpha', 'v1.2.0-rc2', 'v1.2.0-rc1', 'v1.1.1', 'v1.0.4', 'v1.1.0', 'v1.1.0-rc2', 'v1.1.0-rc1', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0', 'v0.7.0', 'v1.0.0-rc1', 'v0.7.0-rc3', 'v0.7.0-rc2', 'v0.7.0-rc1', 'v0.7.0-beta2', 'v0.6.4', 'v0.7.0-beta', 'v0.7.0-alpha', 'v0.6.3', 'v0.6.2', 'v0.6.1', 'v0.6.0', 'v0.6.0-rc3', 'v0.6.0-rc2', 'v0.5.2', 'v0.6.0-rc1', 'v0.6.0-pre.beta', 'v0.5.1', 'v0.6.0-pre.alpha', 'v0.5.0', 'v0.4.7', 'v0.5.0-rc4', 'v0.5.0-rc3', 'v0.5.0-rc2', 'v0.5.0-rc1', 'v0.5.0-rc0', 'v0.4.6', 'v0.4.5', 'v0.4.4', 'v0.4.3', 'v0.4.2', 'v0.4.1', 'v0.3.12', 'v0.4.0', 'v0.4.0-rc4', 'v0.4.0-rc3', 'v0.4.0-rc2', 'v0.4.0-rc1', 'v0.3.11', 'v0.3.10', 'v0.3.9', 'v0.3.8', 'v0.3.7', 'v0.3.6', 'v0.3.5', 'v0.3.4', 'v0.3.3', 'v0.3.2', 'v0.3.1', 'v0.3.0', 'v0.3.0-rc4', 'v0.3.0-rc3', 'v0.3.0-rc2', 'v0.3.0-rc1', 'v0.2.0-rc1', 'v0.2.0-rc3', 'v0.2.0-rc4', 'v0.2.0', 'v0.2.0-rc2'];
function getJuliaVersion(availableReleases, versionInput) {
    return __awaiter(this, void 0, void 0, function* () {
        if (semver.valid(versionInput) == versionInput) {
            // versionInput is a valid version, use it directly
            return versionInput;
        }
        // nightlies
        if (versionInput == 'nightly') {
            return 'nightly';
        }
        // Use the highest available version that matches versionInput
        let version = semver.maxSatisfying(availableReleases, versionInput);
        if (version == null) {
            throw `Could not find a Julia version that matches ${versionInput}`;
        }
        // GitHub tags start with v, remove it
        version = version.replace(/^v/, '');
        return version;
    });
}
exports.getJuliaVersion = getJuliaVersion;
function getMajorMinorVersion(version) {
    return version.split('.').slice(0, 2).join('.');
}
function getDownloadURL(version, arch) {
    let platform;
    if (osPlat === 'win32') { // Windows
        platform = 'winnt';
    }
    else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS';
        }
        platform = 'mac';
    }
    else if (osPlat === 'linux') { // Linux
        platform = 'linux';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    // nightlies
    if (version == 'nightly') {
        const baseURL = 'https://julialangnightlies-s3.julialang.org/bin';
        return `${baseURL}/${platform}/${arch}/${getFileName('latest', arch)}`;
    }
    // normal versions
    const baseURL = 'https://julialang-s3.julialang.org/bin';
    const versionDir = getMajorMinorVersion(version);
    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version, arch)}`;
}
function getFileName(version, arch) {
    let versionExt, ext;
    if (osPlat === 'win32') { // Windows
        versionExt = arch == 'x64' ? '-win64' : '-win32';
        ext = 'exe';
    }
    else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS';
        }
        versionExt = '-mac64';
        ext = 'dmg';
    }
    else if (osPlat === 'linux') { // Linux
        if (version == 'latest') { // nightly version
            versionExt = arch == 'x64' ? '-linux64' : '-linux32';
        }
        else {
            versionExt = arch == 'x64' ? '-linux-x86_64' : '-linux-i686';
        }
        ext = 'tar.gz';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    return `julia-${version}${versionExt}.${ext}`;
}
function installJulia(version, arch) {
    return __awaiter(this, void 0, void 0, function* () {
        // Download Julia
        const downloadURL = getDownloadURL(version, arch);
        core.debug(`downloading Julia from ${downloadURL}`);
        const juliaDownloadPath = yield tc.downloadTool(downloadURL);
        // Install it
        switch (osPlat) {
            case 'linux':
                // tc.extractTar doesn't support stripping components, so we have to call tar manually
                yield exec.exec('mkdir', [`${process.env.HOME}/julia`]);
                yield exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', `${process.env.HOME}/julia`]);
                return `${process.env.HOME}/julia`;
            case 'win32':
                const juliaInstallationPath = path.join('C:', 'Julia');
                if (version == 'nightly' || semver.gtr(version, '1.3', { includePrerelease: true })) {
                    // The installer changed in 1.4: https://github.com/JuliaLang/julia/blob/ef0c9108b12f3ae177c51037934351ffa703b0b5/NEWS.md#build-system-changes
                    yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/SILENT /dir=${juliaInstallationPath}" -NoNewWindow -Wait`]);
                }
                else {
                    yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${juliaInstallationPath}" -NoNewWindow -Wait`]);
                }
                return juliaInstallationPath;
            case 'darwin':
                yield exec.exec('hdiutil', ['attach', juliaDownloadPath]);
                yield exec.exec('mkdir', [`${process.env.HOME}/julia`]);
                yield exec.exec('/bin/bash', ['-c', `cp -a /Volumes/Julia-*/Julia-*.app/Contents/Resources/julia ${process.env.HOME}`]);
                return `${process.env.HOME}/julia`;
            default:
                throw `Platform ${osPlat} is not supported`;
        }
    });
}
exports.installJulia = installJulia;
/**
 * Opt out of all Pkg telemetry.
 *
 * More info: https://julialang.org/legal/data/#opting_out
 */
function optOutOfPkgTelemetry() {
    return __awaiter(this, void 0, void 0, function* () {
        let telemetryPath;
        if (process.env.HOME) {
            telemetryPath = path.join(process.env.HOME, '.julia', 'servers');
        }
        else {
            telemetryPath = ''; // Otherwise tsc claims the variable is being used before being assigned below
            core.setFailed('Something went horribly wrong and $HOME is not defined. Failing build to avoid sending telemetry data unintentionally');
        }
        // Create telemetry.toml file
        yield io.mkdirP(telemetryPath);
        fs.writeFileSync(path.join(telemetryPath, 'telemetry.toml'), 'telemetry = false');
        core.debug('Opted out of all Pkg telemetry');
    });
}
exports.optOutOfPkgTelemetry = optOutOfPkgTelemetry;
