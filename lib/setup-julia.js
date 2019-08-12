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
const os = __importStar(require("os"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const version = core.getInput("version");
            core.debug(`selected Julia version: ${version}`);
            // Store information about the environment
            const osPlat = os.platform();
            const osArch = os.arch();
            // For now, just download Linux x64 binaries
            yield exec.exec("curl", [
                "-O",
                "https://julialang-s3.julialang.org/bin/linux/x64/1.0/julia-1.0.1-linux-x86_64.tar.gz"
            ]);
            yield exec.exec("tar xf julia-1.0.1-linux-x86_64.tar.gz");
            // Add the downloaded binary to path
            core.addPath("julia-1.0.1/bin");
            // Test if it worked
            yield exec.exec("julia", ["--version"]);
            yield exec.exec("julia", ["-e", "'using InteractiveUtils; versioninfo()'"]);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
