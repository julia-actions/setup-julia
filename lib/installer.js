"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
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
exports.showVersionInfo = exports.installJulia = exports.getDownloadURL = exports.getFileInfo = exports.getJuliaVersion = exports.getJuliaVersions = exports.getJuliaVersionInfo = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const retry = require("async-retry");
const semver = __importStar(require("semver"));
// Translations between actions input and Julia arch names
const osMap = {
    'win32': 'winnt',
    'darwin': 'mac',
    'linux': 'linux'
};
const archMap = {
    'x86': 'i686',
    'x64': 'x86_64',
    'aarch64': 'aarch64'
};
// Store information about the environment
const osPlat = os.platform(); // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`);
/**
 * @returns The SHA256 checksum of a given file.
 */
function calculateChecksum(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(file);
        return new Promise((resolve, reject) => {
            input.on('data', (chunk) => {
                hash.update(chunk);
            });
            input.on('end', () => {
                const digest = hash.digest('hex');
                digest ? resolve(digest) : reject(new Error(`Could not calculate checksum of file ${file}: digest was empty.`));
            });
        });
    });
}
/**
 * @returns The content of the downloaded versions.json file as object.
 */
function getJuliaVersionInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        // Occasionally the connection is reset for unknown reasons
        // In those cases, retry the download
        const versionsFile = yield retry((bail) => __awaiter(this, void 0, void 0, function* () {
            return yield tc.downloadTool('https://julialang-s3.julialang.org/bin/versions.json');
        }), {
            onRetry: (err) => {
                core.debug(`Download of versions.json failed, trying again. Error: ${err}`);
            }
        });
        return JSON.parse(fs.readFileSync(versionsFile).toString());
    });
}
exports.getJuliaVersionInfo = getJuliaVersionInfo;
/**
 * @returns An array of all Julia versions available for download
 */
function getJuliaVersions(versionInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        let versions = [];
        for (let version in versionInfo) {
            versions.push(version);
        }
        return versions;
    });
}
exports.getJuliaVersions = getJuliaVersions;
function getJuliaVersion(availableReleases, versionInput, includePrerelease = false) {
    if (semver.valid(versionInput) == versionInput || versionInput.endsWith('nightly')) {
        // versionInput is a valid version or a nightly version, use it directly
        return versionInput;
    }
    // Use the highest available version that matches versionInput
    let version = semver.maxSatisfying(availableReleases, versionInput, { includePrerelease });
    if (version == null) {
        throw new Error(`Could not find a Julia version that matches ${versionInput}`);
    }
    // GitHub tags start with v, remove it
    version = version.replace(/^v/, '');
    return version;
}
exports.getJuliaVersion = getJuliaVersion;
function getDesiredFileExts() {
    let fileExt1;
    let hasFileExt2;
    let fileExt2;
    if (osPlat == 'win32') {
        fileExt1 = 'exe';
        hasFileExt2 = false;
        fileExt2 = '';
    }
    else if (osPlat == 'darwin') {
        fileExt1 = 'tar.gz';
        hasFileExt2 = true;
        fileExt2 = 'dmg';
    }
    else if (osPlat === 'linux') {
        fileExt1 = 'tar.gz';
        hasFileExt2 = false;
        fileExt2 = '';
    }
    else {
        throw new Error(`Platform ${osPlat} is not supported`);
    }
    return [fileExt1, hasFileExt2, fileExt2];
}
function getNightlyFileName(arch) {
    let versionExt;
    let fileExt1;
    [fileExt1, ,] = getDesiredFileExts();
    if (osPlat == 'win32') {
        versionExt = arch == 'x64' ? '-win64' : '-win32';
    }
    else if (osPlat == 'darwin') {
        if (arch == 'x86') {
            throw new Error('32-bit Julia is not available on macOS');
        }
        versionExt = '-mac64';
    }
    else if (osPlat === 'linux') {
        versionExt = arch == 'x64' ? '-linux64' : '-linux32';
    }
    else {
        throw new Error(`Platform ${osPlat} is not supported`);
    }
    return `julia-latest${versionExt}.${fileExt1}`;
}
function getFileInfo(versionInfo, version, arch) {
    const err = `Could not find ${archMap[arch]}/${version} binaries`;
    let fileExt1;
    let hasFileExt2;
    let fileExt2;
    [fileExt1, hasFileExt2, fileExt2] = getDesiredFileExts();
    if (version.endsWith('nightly')) {
        return null;
    }
    if (!versionInfo[version]) {
        throw err;
    }
    for (let file of versionInfo[version].files) {
        if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
            if (file.extension == fileExt1) {
                return file;
            }
        }
    }
    if (hasFileExt2) {
        core.debug(`Could not find ${fileExt1}; trying to find ${fileExt2} instead`);
        for (let file of versionInfo[version].files) {
            if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
                if (file.extension == fileExt2) {
                    return file;
                }
            }
        }
    }
    throw err;
}
exports.getFileInfo = getFileInfo;
function getDownloadURL(fileInfo, version, arch) {
    const baseURL = `https://julialangnightlies-s3.julialang.org/bin/${osMap[osPlat]}/${arch}`;
    // release branch nightlies, e.g. 1.6-nightlies should return .../bin/linux/x64/1.6/julia-latest-linux64.tar.gz
    const majorMinorMatches = /^(\d*.\d*)-nightly/.exec(version);
    if (majorMinorMatches) {
        return `${baseURL}/${majorMinorMatches[1]}/${getNightlyFileName(arch)}`;
    }
    // nightlies
    if (version == 'nightly') {
        return `${baseURL}/${getNightlyFileName(arch)}`;
    }
    // Verify that fileInfo.url points at the official Julia download servers
    if (!fileInfo.url.startsWith('https://julialang-s3.julialang.org/')) {
        throw new Error(`versions.json points at a download location outside of Julia's download server: ${fileInfo.url}. Aborting for security reasons.`);
    }
    return fileInfo.url;
}
exports.getDownloadURL = getDownloadURL;
function installJulia(versionInfo, version, arch) {
    return __awaiter(this, void 0, void 0, function* () {
        // Download Julia
        const fileInfo = getFileInfo(versionInfo, version, arch);
        const downloadURL = getDownloadURL(fileInfo, version, arch);
        core.debug(`downloading Julia from ${downloadURL}`);
        // Occasionally the connection is reset for unknown reasons
        // In those cases, retry the download
        const juliaDownloadPath = yield retry((bail) => __awaiter(this, void 0, void 0, function* () {
            return yield tc.downloadTool(downloadURL);
        }), {
            onRetry: (err) => {
                core.debug(`Download of ${downloadURL} failed, trying again. Error: ${err}`);
            }
        });
        // Verify checksum
        if (!version.endsWith('nightly')) {
            const checkSum = yield calculateChecksum(juliaDownloadPath);
            if (fileInfo.sha256 != checkSum) {
                throw new Error(`Checksum of downloaded file does not match the expected checksum from versions.json.\nExpected: ${fileInfo.sha256}\nGot: ${checkSum}`);
            }
            core.debug(`Checksum of downloaded file matches expected checksum: ${checkSum}`);
        }
        else {
            core.debug('Skipping checksum check for nightly binaries.');
        }
        const tempInstallDir = fs.mkdtempSync(`julia-${arch}-${version}-`);
        // Install it
        switch (osPlat) {
            case 'linux':
                // tc.extractTar doesn't support stripping components, so we have to call tar manually
                yield exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', tempInstallDir]);
                return tempInstallDir;
            case 'win32':
                if (version.endsWith('nightly') || semver.gtr(version, '1.3', { includePrerelease: true })) {
                    // The installer changed in 1.4: https://github.com/JuliaLang/julia/blob/ef0c9108b12f3ae177c51037934351ffa703b0b5/NEWS.md#build-system-changes
                    yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/SILENT /dir=${path.join(process.cwd(), tempInstallDir)}" -NoNewWindow -Wait`]);
                }
                else {
                    yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${path.join(process.cwd(), tempInstallDir)}" -NoNewWindow -Wait`]);
                }
                return tempInstallDir;
            case 'darwin':
                if (fileInfo !== null && fileInfo.extension == 'dmg') {
                    core.debug(`Support for .dmg files is deprecated and may be removed in a future release`);
                    yield exec.exec('hdiutil', ['attach', juliaDownloadPath]);
                    yield exec.exec('/bin/bash', ['-c', `cp -a /Volumes/Julia-*/Julia-*.app/Contents/Resources/julia ${tempInstallDir}`]);
                    return path.join(tempInstallDir, 'julia');
                }
                else {
                    // tc.extractTar doesn't support stripping components, so we have to call tar manually
                    yield exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', tempInstallDir]);
                    return tempInstallDir;
                }
            default:
                throw new Error(`Platform ${osPlat} is not supported`);
        }
    });
}
exports.installJulia = installJulia;
/**
 * Test if Julia has been installed and print the version.
 *
 * true => always show versioninfo
 * false => only show on nightlies
 * never => never show it anywhere
 *
 * @param showVersionInfoInput
 */
function showVersionInfo(showVersionInfoInput, version) {
    return __awaiter(this, void 0, void 0, function* () {
        // --compile=min -O0 reduces the time from ~1.8-1.9s to ~0.8-0.9s
        let exitCode;
        switch (showVersionInfoInput) {
            case 'true':
                exitCode = yield exec.exec('julia', ['--compile=min', '-O0', '-e', 'using InteractiveUtils; versioninfo()']);
                break;
            case 'false':
                if (version.endsWith('nightly')) {
                    exitCode = yield exec.exec('julia', ['--compile=min', '-O0', '-e', 'using InteractiveUtils; versioninfo()']);
                }
                else {
                    exitCode = yield exec.exec('julia', ['--version']);
                }
                break;
            case 'never':
                exitCode = yield exec.exec('julia', ['--version']);
                break;
            default:
                throw new Error(`${showVersionInfoInput} is not a valid value for show-versioninfo. Supported values: true | false | never`);
        }
        if (exitCode !== 0) {
            throw new Error(`Julia could not be installed properly. Exit code: ${exitCode}`);
        }
    });
}
exports.showVersionInfo = showVersionInfo;
