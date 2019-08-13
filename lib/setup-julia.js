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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const version = core.getInput('version');
            console.log(`[DEBUG] selected Julia version: ${version}`);
            // Store information about the environment
            const osPlat = os.platform();
            const osArch = os.arch();
            // For now, just download Linux x64 binaries and add it to PATH
            const juliaDownloadPath = yield tc.downloadTool('https://julialang-s3.julialang.org/bin/linux/x64/1.0/julia-1.0.4-linux-x86_64.tar.gz');
            const juliaExtractedFolder = yield tc.extractTar(juliaDownloadPath);
            const juliaCachedPath = yield tc.cacheDir(juliaExtractedFolder, 'julia', '1.0.4', 'x64');
            const juliaPath = path.join(juliaCachedPath, 'julia-1.0.4');
            core.addPath(path.join(juliaPath, 'bin'));
            // Test if it worked
            yield exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()']);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
