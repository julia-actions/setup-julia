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
const path = __importStar(require("path"));
const installer = __importStar(require("./installer"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const versionInput = core.getInput('version');
            const arch = core.getInput('arch');
            const availableReleases = installer.juliaVersions;
            const version = yield installer.getJuliaVersion(availableReleases, versionInput);
            core.debug(`selected Julia version: ${arch}/${version}`);
            // Search in cache
            let juliaPath;
            juliaPath = tc.find('julia', version, arch);
            if (!juliaPath) {
                core.debug(`could not find Julia ${version} in cache`);
                const juliaInstallationPath = yield installer.installJulia(version, arch);
                // Add it to cache
                juliaPath = yield tc.cacheDir(juliaInstallationPath, 'julia', version, arch);
                core.debug(`added Julia to cache: ${juliaPath}`);
            }
            else {
                core.debug(`using cached version of Julia: ${juliaPath}`);
            }
            // Add it to PATH
            core.addPath(path.join(juliaPath, 'bin'));
            // Set JULIA_NUM_THREADS
            core.exportVariable("JULIA_NUM_THREADS", "2");
            // Test if Julia has been installed
            exec.exec('julia', ['--version']);
            // If enabled, also show the full version info
            if (core.getInput('show-versioninfo') == 'true') {
                exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()']);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
