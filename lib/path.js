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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.configureJuliaPath = configureJuliaPath;
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// Normalise a path for comparison: resolve symlinks, make it absolute, and (on
// Windows, where the filesystem is case-insensitive) lower-case it. Throws if
// the path does not exist.
function normalizePath(p) {
    const resolved = path.resolve(fs.realpathSync(p));
    return os.platform() == 'win32' ? resolved.toLowerCase() : resolved;
}
// Configure PATH and the environment so that subsequent steps and downstream
// actions use the Julia we just installed at `juliaPath`, dethroning any Julia
// preinstalled on the runner image that would otherwise shadow it.
function configureJuliaPath(juliaPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const juliaBindir = path.join(juliaPath, 'bin');
        const expectedJulia = path.join(juliaBindir, os.platform() == 'win32' ? 'julia.exe' : 'julia');
        // Detect any Julia already resolvable on PATH *before* we prepend ours. Some
        // runner images (e.g. GitHub's `windows-2025`) ship a Julia on PATH that can
        // shadow the version we install when a later step invokes bare `julia` (e.g.
        // via Git Bash on Windows). Capture it now so we can dethrone it below.
        const preexistingJulia = yield io.which('julia', false);
        // Add our Julia to PATH for subsequent steps.
        core.addPath(juliaBindir);
        // Export the absolute path to the Julia we just installed so that downstream
        // actions (e.g. julia-runtest) can invoke it directly and bypass PATH lookup
        // entirely, which is immune to any shadowing.
        core.exportVariable('JULIA_ACTIONS_JULIA', expectedJulia);
        // Set output
        core.setOutput('julia-bindir', juliaBindir);
        // If a different Julia was already on PATH, prepending ours is not always
        // enough: depending on PATH state it can still win bare `julia` lookups in
        // later steps. Remove its bin directory from PATH for subsequent steps, but
        // only when that directory is a self-contained Julia install, so we never drop
        // a shared directory (e.g. a Chocolatey shim dir) that holds other tools too.
        // The PATH change is scoped to this job and touches no files, so it is safe on
        // self-hosted runners.
        if (preexistingJulia && normalizePath(preexistingJulia) !== normalizePath(expectedJulia)) {
            const shadowBindir = path.dirname(path.resolve(fs.realpathSync(preexistingJulia)));
            const isDedicatedJuliaDir = fs.existsSync(path.join(shadowBindir, '..', 'share', 'julia'));
            if (isDedicatedJuliaDir) {
                const shadowNorm = normalizePath(shadowBindir);
                const cleaned = (process.env['PATH'] || '')
                    .split(path.delimiter)
                    .filter(entry => {
                    if (!entry)
                        return false;
                    try {
                        return normalizePath(entry) !== shadowNorm;
                    }
                    catch (_a) {
                        return true;
                    }
                })
                    .join(path.delimiter);
                core.exportVariable('PATH', cleaned);
                core.warning(`A preinstalled Julia at ${preexistingJulia} was shadowing setup-julia's install at ${expectedJulia}. Removed ${shadowBindir} from PATH for subsequent steps. Downstream actions can also use the JULIA_ACTIONS_JULIA environment variable to invoke the installed Julia directly.`);
            }
            else {
                core.warning(`A preinstalled Julia at ${preexistingJulia} may shadow setup-julia's install at ${expectedJulia} when a later step invokes bare \`julia\`. Its directory was left on PATH because it does not look like a dedicated Julia install. Use the JULIA_ACTIONS_JULIA environment variable to invoke the installed Julia directly, or fix the runner's PATH.`);
            }
        }
    });
}
