"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// Store information about the environment
const osPlat = os.platform(); // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`);
function getMajorMinorVersion(version) {
    return version.split('.').slice(0, 2).join('.');
}
function getDownloadURL(version) {
    const baseURL = 'https://julialang-s3.julialang.org/bin';
    let platform, arch;
    const versionDir = getMajorMinorVersion(version);
    if (osPlat === 'win32') { // Windows
        platform = 'winnt';
        arch = 'x64';
    }
    else if (osPlat === 'darwin') { // macOS
        platform = 'mac';
        arch = 'x64';
    }
    else if (osPlat === 'linux') { // Linux
        platform = 'linux';
        arch = 'x64';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version)}`;
}
function getFileName(version) {
    let versionExt, ext;
    if (osPlat === 'win32') { // Windows
        versionExt = '-win64';
        ext = 'exe';
    }
    else if (osPlat === 'darwin') { // macOS
        versionExt = '-mac64';
        ext = 'dmg';
    }
    else if (osPlat === 'linux') { // Linux
        versionExt = '-linux-x86_64';
        ext = 'tar.gz';
    }
    else {
        throw `Platform ${osPlat} is not supported`;
    }
    return `julia-${version}${versionExt}.${ext}`;
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const version = core.getInput('version');
            core.debug(`selected Julia version: ${version}`);
            // Download Julia
            const downloadURL = getDownloadURL(version);
            core.debug(`download Julia from ${downloadURL}`);
            const juliaDownloadPath = yield tc.downloadTool(downloadURL);
            // Install Julia
            if (osPlat === 'linux') { // Linux
                const juliaExtractedFolder = yield tc.extractTar(juliaDownloadPath);
                const juliaCachedPath = yield tc.cacheDir(juliaExtractedFolder, 'julia', version);
                const juliaPath = path.join(juliaCachedPath, `julia-${version}`);
                core.addPath(path.join(juliaPath, 'bin'));
            }
            else if (osPlat === 'win32') { // Windows
                // Install Julia in C:\Julia
                const juliaInstallationPath = path.join('C:', 'Julia');
                yield exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${juliaInstallationPath}" -NoNewWindow -Wait`]);
                const juliaCachedPath = yield tc.cacheDir(juliaInstallationPath, 'julia', version);
                core.addPath(path.join(juliaCachedPath, 'bin'));
            }
            else if (osPlat === 'darwin') { // macOS
                yield exec.exec('hdiutil', ['attach', juliaDownloadPath]);
                const juliaCachedPath = yield tc.cacheDir(`/Volumes/Julia-${version}/Julia-${getMajorMinorVersion(version)}.app/Contents/Resources/julia`, 'julia', version);
                core.addPath(path.join(juliaCachedPath, 'bin'));
            }
            // Test if Julia has been installed by showing versioninfo()
            yield exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()']);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
