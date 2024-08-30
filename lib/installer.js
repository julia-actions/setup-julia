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
exports.getJuliaVersionInfo = getJuliaVersionInfo;
exports.getJuliaVersions = getJuliaVersions;
exports.getProjectFile = getProjectFile;
exports.validJuliaCompatRange = validJuliaCompatRange;
exports.readJuliaCompatRange = readJuliaCompatRange;
exports.getJuliaVersion = getJuliaVersion;
exports.getFileInfo = getFileInfo;
exports.getDownloadURL = getDownloadURL;
exports.installJulia = installJulia;
exports.showVersionInfo = showVersionInfo;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const retry = require("async-retry");
const semver = __importStar(require("semver"));
const toml = __importStar(require("toml"));
const LTS_VERSION = '1.6';
const MAJOR_VERSION = '1'; // Could be deduced from versions.json
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
            retries: 5,
            onRetry: (err) => {
                core.info(`Download of versions.json failed, trying again. Error: ${err}`);
            }
        });
        return JSON.parse(fs.readFileSync(versionsFile).toString());
    });
}
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
/**
 * @returns The path to the Julia project file
 */
function getProjectFile(projectInput = "") {
    let projectFile = "";
    // Default value for projectInput
    if (!projectInput) {
        projectInput = process.env.JULIA_PROJECT || ".";
    }
    if (fs.existsSync(projectInput) && fs.lstatSync(projectInput).isFile()) {
        projectFile = projectInput;
    }
    else {
        for (let projectFilename of ["JuliaProject.toml", "Project.toml"]) {
            let p = path.join(projectInput, projectFilename);
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
                projectFile = p;
                break;
            }
        }
    }
    if (!projectFile) {
        throw new Error(`Unable to locate project file with project input: ${projectInput}`);
    }
    return projectFile;
}
/**
 * @returns A valid NPM semver range from a Julia compat range or null if it's not valid
 */
function validJuliaCompatRange(compatRange) {
    let ranges = [];
    for (let range of compatRange.split(",")) {
        range = range.trim();
        // An empty range isn't supported by Julia
        if (!range) {
            return null;
        }
        // NPM's semver doesn't understand unicode characters such as `≥` so we'll convert to alternatives
        range = range.replace("≥", ">=").replace("≤", "<=");
        // Cleanup whitespace. Julia only allows whitespace between the specifier and version with certain specifiers
        range = range.replace(/\s+/g, " ").replace(/(?<=(>|>=|≥|<)) (?=\d)/g, "");
        if (!semver.validRange(range) || range.split(/(?<! -) (?!- )/).length > 1 || range.startsWith("<=") || range === "*") {
            return null;
        }
        else if (range.search(/^\d/) === 0 && !range.includes(" ")) {
            // Compat version is just a basic version number (e.g. 1.2.3). Since Julia's Pkg.jl's uses caret
            // as the default specifier (e.g. `1.2.3 == ^1.2.3`) and NPM's semver uses tilde as the default
            // specifier (e.g. `1.2.3 == 1.2.x == ~1.2.3`) we will introduce the caret specifier to ensure the
            // orignal intent is respected.
            // https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
            // https://github.com/npm/node-semver#x-ranges-12x-1x-12-
            range = "^" + range;
        }
        ranges.push(range);
    }
    return semver.validRange(ranges.join(" || "));
}
/**
 * @returns An array of version ranges compatible with the Julia project
 */
function readJuliaCompatRange(projectFileContent) {
    var _a;
    let compatRange;
    let meta = toml.parse(projectFileContent);
    if (((_a = meta.compat) === null || _a === void 0 ? void 0 : _a.julia) !== undefined) {
        compatRange = validJuliaCompatRange(meta.compat.julia);
    }
    else {
        compatRange = "*";
    }
    if (!compatRange) {
        throw new Error(`Invalid version range found in Julia compat: ${compatRange}`);
    }
    return compatRange;
}
function getJuliaVersion(availableReleases, versionInput, includePrerelease = false, juliaCompatRange = "") {
    let version;
    if (semver.valid(versionInput) == versionInput || versionInput.endsWith('nightly')) {
        // versionInput is a valid version or a nightly version, use it directly
        version = versionInput;
    }
    else if (versionInput == "min") {
        // Resolve "min" to the minimum supported Julia version compatible with the project file
        if (!juliaCompatRange) {
            throw new Error('Unable to use version "min" when the Julia project file does not specify a compat for Julia');
        }
        version = semver.minSatisfying(availableReleases, juliaCompatRange, { includePrerelease });
    }
    else if (versionInput == "lts") {
        version = semver.maxSatisfying(availableReleases, LTS_VERSION, { includePrerelease: false });
    }
    else if (versionInput == "pre") {
        version = semver.maxSatisfying(availableReleases, MAJOR_VERSION, { includePrerelease: true });
    }
    else {
        // Use the highest available version that matches versionInput
        version = semver.maxSatisfying(availableReleases, versionInput, { includePrerelease });
    }
    if (!version) {
        throw new Error(`Could not find a Julia version that matches ${versionInput}`);
    }
    // GitHub tags start with v, remove it
    version = version.replace(/^v/, '');
    return version;
}
function getDesiredFileExts() {
    let fileExt1;
    let hasFileExt2;
    let fileExt2;
    if (osPlat == 'win32') {
        fileExt1 = 'tar.gz';
        hasFileExt2 = true;
        fileExt2 = 'exe';
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
        if (arch == 'x86') {
            versionExt = '-win32';
        }
        else if (arch == 'aarch64') {
            throw new Error('Aarch64 Julia is not available on Windows');
        }
        else if (arch == 'x64') {
            versionExt = '-win64';
        }
        else {
            throw new Error(`Architecture ${arch} is not supported on Windows`);
        }
    }
    else if (osPlat == 'darwin') {
        if (arch == 'x86') {
            throw new Error('32-bit (x86) Julia is not available on macOS');
        }
        else if (arch == 'aarch64') {
            versionExt = '-macaarch64';
        }
        else if (arch == 'x64') {
            versionExt = '-mac64';
        }
        else {
            throw new Error(`Architecture ${arch} is not supported on macOS`);
        }
    }
    else if (osPlat === 'linux') {
        if (arch == 'x86') {
            versionExt = '-linux32';
        }
        else if (arch == 'aarch64') {
            versionExt = '-linux-aarch64';
        }
        else if (arch == 'x64') {
            versionExt = '-linux64';
        }
        else {
            throw new Error(`Architecture ${arch} is not supported on Linux`);
        }
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
        core.error(`Encountered error: ${err}`);
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
        // The following block is just to provide improved log messages in the CI logs.
        // We specifically want to improve the case where someone is trying to install
        // Julia 1.6 or 1.7 on Apple Silicon (aarch64) macOS.
        {
            const one_fileext_is_targz = (fileExt1 == "tar.gz") || (fileExt2 == "tar.gz");
            const one_fileext_is_dmg = (fileExt1 == "dmg") || (fileExt2 == "dmg");
            const one_fileext_is_targz_and_other_is_dmg = one_fileext_is_targz && one_fileext_is_dmg;
            // We say that "this Julia version does NOT have native binaries for Apple Silicon"
            // if and only if "this Julia version is < 1.8.0"
            const this_julia_version_does_NOT_have_native_binaries_for_apple_silicon = semver.lt(version, '1.8.0');
            const this_is_macos = osPlat == 'darwin';
            if (this_is_macos && one_fileext_is_targz_and_other_is_dmg && this_julia_version_does_NOT_have_native_binaries_for_apple_silicon) {
                const msg = `It looks like you are trying to install Julia 1.6 or 1.7 on ` +
                    `the "macos-latest" runners.\n` +
                    `"macos-latest" now resolves to "macos-14", which run on Apple ` +
                    `Silicon (aarch64) macOS machines.\n` +
                    `Unfortunately, Julia 1.6 and 1.7 do not have native binaries ` +
                    `available for Apple Silicon macOS.\n` +
                    `Therefore, it is not possible to install Julia with the current ` +
                    `constraints.\n` +
                    `For instructions on how to fix this error, please see the following Discourse post: ` +
                    `https://discourse.julialang.org/t/how-to-fix-github-actions-ci-failures-with-julia-1-6-or-1-7-on-macos-latest-and-macos-14/117019`;
                core.error(msg);
            }
        }
    }
    core.error(`Encountered error: ${err}`);
    throw err;
}
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
function installJulia(dest, versionInfo, version, arch) {
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
            retries: 5,
            onRetry: (err) => {
                core.info(`Download of ${downloadURL} failed, trying again. Error: ${err}`);
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
        // Install it
        switch (osPlat) {
            case 'linux':
                // tc.extractTar doesn't support stripping components, so we have to call tar manually
                yield exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', dest]);
                return dest;
            case 'win32':
                if (fileInfo !== null && fileInfo.extension == 'exe') {
                    if (version.endsWith('nightly') || semver.gtr(version, '1.3', { includePrerelease: true })) {
                        // The installer changed in 1.4: https://github.com/JuliaLang/julia/blob/ef0c9108b12f3ae177c51037934351ffa703b0b5/NEWS.md#build-system-changes
                        yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/SILENT /dir=${path.join(process.cwd(), dest)}" -NoNewWindow -Wait`]);
                    }
                    else {
                        yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${path.join(process.cwd(), dest)}" -NoNewWindow -Wait`]);
                    }
                }
                else {
                    // This is the more common path. Using .tar.gz is much faster
                    // don't use the Git bash provided tar. Issue #205
                    // https://github.com/julia-actions/setup-julia/issues/205
                    yield exec.exec('powershell', ['-Command', `& "$env:WINDIR/System32/tar" xf ${juliaDownloadPath} --strip-components=1 -C ${dest}`]);
                }
                return dest;
            case 'darwin':
                if (fileInfo !== null && fileInfo.extension == 'dmg') {
                    core.debug(`Support for .dmg files is deprecated and may be removed in a future release`);
                    yield exec.exec('hdiutil', ['attach', juliaDownloadPath]);
                    yield exec.exec('/bin/bash', ['-c', `cp -a /Volumes/Julia-*/Julia-*.app/Contents/Resources/julia ${dest}`]);
                    return path.join(dest, 'julia');
                }
                else {
                    // tc.extractTar doesn't support stripping components, so we have to call tar manually
                    yield exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', dest]);
                    return dest;
                }
            default:
                throw new Error(`Platform ${osPlat} is not supported`);
        }
    });
}
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
