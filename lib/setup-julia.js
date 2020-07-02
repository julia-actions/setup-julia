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
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
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
            // Test if Julia has been installed
            exec.exec('julia', ['--version']);
            // If enabled, also show the full version info
            if (core.getInput('show-versioninfo') == 'true') {
                exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()']);
            }
            // Pkg telemetry opt out
            let telemetryInput = core.getInput('pkg-telemetry');
            if (!['true', 'false', 'default'].includes(telemetryInput)) {
                core.warning(`Invalid pkg-telemetry input: ${telemetryInput}. Must be 'true', 'false' or 'default'. Falling back to 'false'.`);
                telemetryInput = 'false';
            }
            // Assume it's a private repo by default
            let isPrivateRepo = true;
            // If the event payload contains info on the privateness state of the repo, use that instead
            if (github.context.payload.repository) {
                isPrivateRepo = github.context.payload.repository.private;
                core.debug(`inferred privateness state of the repo: ${isPrivateRepo}`);
            }
            // isPrivateRepo && input 'true' => don't opt-out
            // isPrivateRepo && input 'default' => opt-out
            // 'input false' => always opt-out
            if (telemetryInput == 'false' || (isPrivateRepo && telemetryInput != 'true')) {
                yield installer.optOutOfPkgTelemetry();
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
